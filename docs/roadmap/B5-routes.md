# B5: Real route list (Pages panel and link targets)

Status: todo · Size: M · Depends on: B1 · Branch: `feat/b5-routes`

## Goal

The Pages panel lists the app's real routes. Clicking one navigates the preview, and "Go to page"
(B1) picks from the same list.

## Current state (verified 2026-11-21)

- **The Pages panel is a placeholder.** In editor-html.ts (`<!-- Pages Subsection -->`) it shows a
  hard-coded `active-page-name` of "Page 1".
- **The server only finds an entry file.** ws-server.ts has a list of candidate entry files
  (`src/App.tsx`, `src/routes/+page.svelte`, `src/pages/index.astro` and others), used to pick the
  first file to open.
- **Framework detection is partial.** `detectProjectMeta()` in `packages/core/src/detect.ts` sets
  `metaFramework` to `next` or `astro`.

## Design

- **A new core function,** `listRoutes(projectRoot, meta)`, returning `{ path, file, dynamic }[]`:
  - Next.js app router: `app/**/page.{tsx,jsx,ts,js,mdx}` and the same under `src/app`. Skip
    `(group)` and `@slot` folders; mark `[param]` segments as dynamic.
  - Next.js pages router: `pages/**/*.{tsx,jsx,ts,js}`, excluding `_app`, `_document` and `api/`.
  - SvelteKit: `src/routes/**/+page.svelte`.
  - Astro: `src/pages/**/*.{astro,md,mdx}`.
  - Everything else, such as a Vite React app: return no file routes.
- **A server message,** `list-routes`, that returns the list. It's re-sent when files are added or removed.
- **The overlay** shows the routes in the Pages panel and navigates the preview frame on click. For
  apps without file routes, it falls back to a typed URL plus the URLs already visited in this session.

## Tests

`listRoutes` against temporary project folders for each framework, including route groups, dynamic
segments and excluded files.

## Done when

In a Next.js or Astro project, the Pages panel lists the routes, and "Go to page" offers them.
