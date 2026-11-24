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
  src/core/index.ts       core barrel; imports nothing from React
apps/site/                Next.js check page (package name `site`, private)
  app/layout.tsx, app/page.tsx
  AGENTS.md               written by `next dev`
```

## Entries

- `newspaper-image` is the React entry and begins with `'use client'`. It may re-export types only: a server component that imports a value from a `'use client'` module gets a client reference instead of the value.
- `newspaper-image/core` carries every value (settings, helpers, `createPrinter`) and imports without React installed.
- `apps/site` resolves the package through its `dist`, so the package is built before the app (`apps/site`'s `build` and the root `dev` both do this).

## Commands

Run from the repo root.

- `pnpm install`
- `pnpm lint`: `biome check` (lint, format, import order). Biome does not type-check; `pnpm build` does.
- `pnpm test`: `pnpm -r test` (Vitest in `packages/newspaper-image`).
- `pnpm build`: builds the package with `tsc`, then `next build` in `apps/site`.
- `pnpm dev`: builds the package once, then runs `tsc --watch` and `next dev` in parallel.

`apps/site/tsconfig.json` is rewritten by `next build`/`next dev` and is excluded from Biome.
