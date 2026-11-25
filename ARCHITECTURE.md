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
    printer.ts            createPrinter(canvas, { settings?, preserveDrawingBuffer?, onLost?, onRestore? }) → { setFrom(source, placement?), setTo(source, placement?), setSettings(settings), draw(view, state), dispose() } | null (no WebGL2, or the shader fails to build). Settings are applied at build, by setSettings and on context restore; setSettings and uploads clear the skip-identical-draw key. draw places each side with placeRect over sourceSize, lod = lodBias(source width / placed width, settings.soft)
    *.test.ts             Vitest, Node environment, pure logic
apps/site/                Next.js check page (package name `site`, private); imports only newspaper-image/core
  app/layout.tsx          root layout, globals.css
  app/page.tsx            server component rendering PrintCheck
  app/PrintCheck.tsx      'use client' check page: scene switch (site | images), time/fade/press sliders, mode and fadeStyle selects, settle checkbox, Play (time 0 → totalMs by requestAnimationFrame), cell/angle/specks/sweepMs/mergeMs/ink/paper inputs through resolveSettings, reset to DEFAULT_SETTINGS; says so when createPrinter returns null
  app/PrintCanvas.tsx     a canvas with its own createPrinter: backing store Math.round(W·dpr) × Math.round(H·dpr), redraw on resize and on settings/state change
  app/scenes.ts           site scene (the jnao.se Backdrop: window view, from = bg.jpg cover [0, 0.5], to = paintArt canvas fill, repainted on width change); images scene (canvas CSS box view, bg.jpg → forest.jpg, cover centred)
  app/siteArt.ts          copy of jnaose print.ts paintArt/artTop/pickArt/FADE/RESERVE_REM/LANDSCAPE/PORTRAIT at 5e8a66b, with /samples paths
  public/samples/         bg.jpg, forest.jpg, fireweed.jpg: the owner's photographs, all rights reserved, NOT covered by the MIT licence (NOTICE.txt)
  AGENTS.md               written by `next dev`
```

## Entries

- `newspaper-image` is the React entry and begins with `'use client'`. It may re-export types only: a server component that imports a value from a `'use client'` module gets a client reference instead of the value.
- `newspaper-image/core` carries every value (settings, helpers, `createPrinter`) and imports without React installed.
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
