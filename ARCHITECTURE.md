# Architecture

pnpm workspace: the `newspaper-image` npm package (a WebGL2 newspaper-print effect) and `apps/site`, a Next.js App Router app that consumes it through `workspace:*`.

```
package.json              private workspace root; scripts below; packageManager pins pnpm
pnpm-workspace.yaml       packages/*, apps/*; allowBuilds
biome.json                THE lint/format config for the whole repo; the `next` rule domain applies only under apps/site/**
.github/workflows/ci.yml  on every pull_request (no branch filter) and push to main: install --frozen-lockfile, lint, test, build
packages/newspaper-image/
  package.json            exports "." → dist/index (React entry), "./core" → dist/core/index (framework-free); react is an optional peer
  tsconfig.json           tsc src → dist with declarations; *.test.ts excluded
  vitest.config.ts        Node environment, src/**/*.test.ts
  src/index.ts            React entry, starts with 'use client'; placeholder
  src/core/
    index.ts              THE core barrel: everything public is exported here; imports nothing from React
    settings.ts           PrintSettings (prototype key names), DEFAULT_SETTINGS (frozen, = jnaose PRINT at 5e8a66b plus the keys it lacks as the prototype preset "Your pick (CMYK)" sets them), resolveSettings(...parts) (skips undefined parts and values), hexToRgb; settingUniforms(settings): THE settings → fragment-shader uniform table ([name, value] pairs; ink/paper as 0–1 RGB; soft left out, it feeds lodBias at draw time). Adding a setting means adding its row here; settings.test.ts fails on a setting without a uniform or a uniform the shader does not declare
    clock.ts              clamp01, totalMs(settings) = sweepMs * 1.5 + mergeMs with settle, else sweepMs + printMs (prototype total()), revealTime(from, forward, elapsed, total, backSpeed = 1), mirror(time, total)
    geometry.ts           lodBias(texelsPerCssPx, soft), Fit ('cover' | 'fill'), Placement { fit?, position?: [x, y] 0–1 }, placeRect (default cover, centred), sourceSize(TexImageSource) (duck-typed, runs in Node)
    loadImage.ts          loadImage(src, crossOrigin?): crossOrigin is set before src
    printShader.ts        THE GLSL (VERTEX_SHADER, FRAGMENT_SHADER): the fragment shader of jnaose prototypes/print-raster at 5e8a66b, with jnao.se's positioning (uOrigin/uCanvas/uView), per-side tone-blur mip levels (uMonoLod/uPhotoLod), uPress and the clean "to" lookup at automatic LOD. The mode, fadeStyle and settle settings are float uniforms holding whole numbers (applySettings sends every number with uniform1f). GLSL names stay the prototype's: uMono = "from", uPhoto = "to". Not exported from the barrel
    plate.ts              THE GL work both printers share, not exported from the barrel: build (program, quad, uMono = unit 0, uPhoto = unit 1), applySettings (settingUniforms → uniform1f/uniform3fv), upload (creates and fills a new mipmapped texture, then deletes the previous one; a throwing texImage2D deletes only the new texture and rethrows), drawPlate (binds "from" to unit 0 and "to" to unit 1, places each side with placeRect over sourceSize, lod = lodBias(source width / placed width, settings.soft), uDotLod (the light-dots dot-size sample, not a setting) = lodBias("to" width / placed width, 3), and prints into the bottom-left { width, height } of the drawing buffer: viewport and uCanvas are that size)
    printer.ts            PrintView, PrintState, Printer, PrinterOptions; createPrinter(canvas, { settings?, preserveDrawingBuffer?, onLost?, onRestore? }) → { setFrom(source, placement?), setTo(source, placement?), setSettings(settings), draw(view, state), dispose() } | null (no WebGL2, or the shader fails to build): one canvas and its own context on the plate, drawn at canvas.width × canvas.height. Settings are applied at build, by setSettings and on context restore; setSettings and uploads clear the skip-identical-draw key. A side stores its source only once its upload succeeds, so a throwing upload (a tainted source) throws out of setFrom/setTo and leaves the side as it was
    sharedPrinter.ts      createSharedPrinter(target, { settings?, onLost?, onRestore? }) → Printer | null: one page-wide offscreen canvas (document.createElement, preserveDrawingBuffer) and webgl2 context, created by the first call and released by the last dispose (WEBGL_lose_context.loseContext, then a later call starts fresh); without WebGL2 or with a failed shader build every later call is null with no second attempt; null too for a target with no 2D context. Per image: settings, sides, one texture per distinct source (a source both sides hold is one texture; setting a source a side already holds uploads it again; a texture no side holds is deleted) and a skip key. draw skips with no GL call and no copy when its key matches the last; otherwise grows the offscreen canvas (it never shrinks) to the target's backing size, applies the image's settings if they are not the object last applied, draws, and copies the bottom-left target.width × target.height region into the target with drawImage before any other image draws. Context loss (listeners on the offscreen canvas, removed at the last dispose before loseContext): every draw returns false but records its request, each target keeps its last print, setFrom/setTo store sources without uploading, every image's onLost fires; on restore the plate is rebuilt (a failed rebuild stays lost), every image's sources are re-uploaded (a source whose upload throws leaves that image unprinted), every image with both sources and a request is printed at its latest request, and its onRestore fires
    *.test.ts             Vitest, Node environment, pure logic; printer.test.ts and sharedPrinter.test.ts drive the printers against test/fakeGl.ts
  test/fakeGl.ts          fakeGl(calls, overrides?): a WebGL2 context recording every call (constants are their names, uniform locations { name }, textures { texture: n }); fakeCanvas(context) with fire(type) for its listeners; image/surface sources; uniform/draws readers. Outside src, so tsc does not ship it and Vitest does not collect it
apps/site/                Next.js check page (package name `site`, private); imports only newspaper-image/core
  app/layout.tsx          root layout, globals.css
  app/page.tsx            server component rendering PrintCheck
  app/PrintCheck.tsx      'use client' check page: scene switch (SCENES: site | images | prototype, plus grid: GRID_CELLS, each a PrintCanvas with create = createSharedPrinter and boxView), a "shared renderer" checkbox (site/images/prototype pass createSharedPrinter instead of createPrinter, keyed so the canvas is remade; checked and disabled in the grid), one button per prototype preset (setOverrides(preset), so keys a preset leaves out come from DEFAULT_SETTINGS), time/fade/press sliders, mode and fadeStyle selects, settle checkbox, Play (time 0 → totalMs by requestAnimationFrame), cell/angle/specks/sweepMs/mergeMs/ink/paper inputs through resolveSettings, reset to DEFAULT_SETTINGS; says so when createPrinter returns null
  app/PrintCanvas.tsx     a canvas printed by `create(canvas, { settings, onRestore })` (prop, read at mount, default createPrinter): backing store Math.round(W·dpr) × Math.round(H·dpr), redraw on resize and on settings/state change
  app/scenes.ts           site scene (the jnao.se Backdrop: window view, from = bg.jpg cover [0, 0.5], to = paintArt canvas fill, repainted on width change); images scene (canvas CSS box view, bg.jpg → forest.jpg, cover centred); prototype scene (the print-raster prototype's page: window view, from = bg.jpg, to = forest.jpg landscape / fireweed.jpg portrait, both cover [0, 0.5], to swapped on an orientation-changing resize); GRID_CELLS: 24 { id, setup } cells over bg/forest/fireweed ("from" = sample i % 3, "to" the same every fourth cell, else the next; placements cycle through centred cover, cover [0, 0.5], fill, cover [1, 0.5], cover [0.5, 0]), images loaded once per src
  app/presets.ts          PRESETS: the print-raster prototype's six presets at 5e8a66b, verbatim (Partial<PrintSettings>; biome-ignore format keeps the prototype's layout). The settings tool (#7) reuses it
  app/siteArt.ts          copy of jnaose print.ts paintArt/artTop/pickArt/FADE/RESERVE_REM/LANDSCAPE/PORTRAIT at 5e8a66b, with /samples paths
  public/samples/         bg.jpg, forest.jpg, fireweed.jpg: the owner's photographs, all rights reserved, NOT covered by the MIT licence (NOTICE.txt)
  AGENTS.md               written by `next dev`
```

## Entries

- `newspaper-image` is the React entry and begins with `'use client'`. It may re-export types only: a server component that imports a value from a `'use client'` module gets a client reference instead of the value.
- `newspaper-image/core` carries every value (settings, helpers, `createPrinter`, `createSharedPrinter`) and imports without React installed.
- The jnao.se Backdrop reproduces as `setFrom(bg, { fit: 'cover', position: [0, 0.5] })` and `setTo(paintArtCanvas, { fit: 'fill' })` with `origin [0, 0]`.
- `apps/site` resolves the package through its `dist`, so the package is built before the app (`apps/site`'s `build` and the root `dev` both do this).

## Commands

Run from the repo root.

- `pnpm install`
- `pnpm lint`: `biome check` (lint, format, import order). Biome does not type-check; `pnpm build` does.
- `pnpm test`: `pnpm -r test` (Vitest in `packages/newspaper-image`).
- `pnpm build`: builds the package with `tsc`, then `next build` in `apps/site`.
- `pnpm dev`: builds the package once, then runs `tsc --watch` and `next dev` in parallel.

Relative imports in `packages/newspaper-image/src` end in `.js` (Biome `useImportExtensions` enforces it there): `tsc` copies specifiers verbatim, and Node's ESM loader does not resolve extensionless ones in `dist`.

`apps/site/tsconfig.json` is rewritten by `next build`/`next dev` and is excluded from Biome.
