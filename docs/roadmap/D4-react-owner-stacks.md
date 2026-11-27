# D4: Find source from React's owner stack, without the plugin

Status: **todo** · Size: M–L · Depends on: — · Branch: `feat/d4-owner-stacks`

## Goal

Select an element and find its source in a React app that has no Glide plugin: a Next.js or webpack
app opened in standalone mode (`npx glide 3000`), or a Vite app before the plugin is added. Selection,
layers, jump to definition and the agent's read tools work first. Edits follow only where the location
is provably exact. This is Glide's route to Next.js. Onlook 2.0 finds every element this way.

## Current state (verified 2026-11-28)

- **Elements without a stamp get a CSS path, not a source.** The Babel plugin writes
  `data-gl-source="path:line:col"`. In `packages/vite-plugin/src/bridge.ts`, `getElId()` falls back to
  `'__glide_cst_' + getCSSPath(el)`, which no source tool can use.
- **Standalone mode already reaches other dev servers.** `packages/cli/src/start.ts` and `ws-server.ts`
  probe common ports, including 3000 (Next.js) and 4321 (Astro), and the proxy injects the bridge
  into every HTML page.
- **The pieces for safe writes exist.** `findJSXElementAt()` and `computeNodeHash()` are in
  `packages/ast-writer/src/writer.ts`, and `ProjectPaths.contains()` (`packages/server/src/project-paths.ts`)
  keeps paths inside the project.
- **A source-map reader is already installed.** `@jridgewell/trace-mapping` is in `node_modules`
  through `@babel/core` and `@babel/generator`. Making it a direct dependency adds nothing to installs.

## How Onlook does it

`apps/studio/src/main/code/mapper/` in onlook-dev/onlook (Apache-2.0). Read it for ideas and don't copy
it: Onlook reads the page over the DevTools protocol, which Glide doesn't have and doesn't need.

1. Read the element's fiber and its `_debugStack` (React 19), or `_debugSource` (React 18).
2. Parse the stack into `url:line:col` frames.
3. Resolve each frame through the dev server's source map: Vite inline maps, webpack paths and
   `turbopack://` URLs.
4. Keep the first frame that lands in the project.
5. Grade how sure the match is.

## Verify first

Before writing code, record what each setup gives on a plain `<div>` in a component:
- React 19 with Vite (plugin-react on Babel, and on SWC)
- Next.js with Turbopack, and with webpack
- React 18 (`_debugSource`)
- an element rendered by a React Server Component in the Next.js App Router

For each, note whether the resolved position is the element's `<`, its tag name, or something else.
That decides how strict the write gate below can be. If server components give no usable stack, they
are out of scope for this item.

## Design

- **Bridge fallback (both bridges).** Only for an element with no `data-gl-source`: find its
  `__reactFiber$…` key and read `_debugSource`, or else `_debugStack`. React 18's `_debugSource` is
  already a source position and needs no source map. For `_debugStack`, send at most 8 frames to the
  server in a new `resolve-source` message. Bound every string (2 KB) and every number, because the
  page is untrusted.
- **Server resolver.** A new `packages/server/src/source-map-resolve.ts` does four things:
  - It fetches the frame's module from the dev server it already proxies (loopback only) and reads
    its `sourceMappingURL`, whether inline or relative.
  - It traces the position with `@jridgewell/trace-mapping`.
  - It maps the `sources` entry to a project path. The forms are `/src/App.tsx` (Vite),
    `webpack://<name>/./src/App.tsx` and `turbopack://[project]/src/App.tsx`.
  - It refuses anything outside `ProjectPaths` or inside `node_modules`.

  The first frame that resolves wins. Each module's source map is cached by its URL until the page
  reloads, and every position is traced against it separately, since one module holds many elements.
- **Read-only first.** A resolved element gets a source reference in memory, used by the selection
  label, layers, jump to definition, `get_selection` and `get_source`. An edit on it is refused with
  `UNSTAMPED: add glideSourceStamping() to edit this element`.
- **Then exact writes.** The server re-parses the file and accepts the reference only when two things
  hold:
  - `findJSXElementAt()` finds an element at that position, within the strictness found in Verify first.
  - That element is the selected one: a lowercase HTML or SVG tag with the same name as the DOM
    element. The first project frame can be a component's call site (`<Card>`), for example when the
    element comes from a package. Such a reference stays read-only, because an edit there would change
    the component instance, not the selected element.

  The server then computes the hash with `computeNodeHash()`, and the edit goes through the normal
  transaction (digests, undo). Anything else is refused with `UNMAPPED_SOURCE` and a reason.

## Steps

- [ ] D4a: Verify first, with results added to this spec
- [ ] D4b: the bridge fallback, and the `resolve-source` message with its bounds
- [ ] D4c: the resolver, with fixtures for the Vite, webpack and Turbopack map forms
- [ ] D4d: read-only use (selection label, layers, jump to definition, MCP read tools)
- [ ] D4e: the exact-position write gate
- [ ] D4f: README ("Next.js and other dev servers") and `skills/glide/SKILL.md`

## Tests

- Stack parsing for V8 frames and the bare `url:line:col` form.
- Source-path mapping for each dev server's form, and refusal for paths outside the project or in
  `node_modules`.
- The resolver against stored source maps (no network in unit tests).
- The write gate: an exact position is accepted; a position inside an attribute value, a component
  call site and a tag that differs from the DOM element are refused.
- Two positions in one module resolve to their own lines.

## Done when

In a Next.js app opened with `npx glide 3000`, selecting a heading shows `app/page.tsx:12` in the
selection label, `get_source` returns its JSX, and, if D4e's gate allows it there, a padding edit
writes correctly and can be undone.

## Out of scope

Vue, Svelte and Astro without the plugin, which have no owner stacks. Production builds, which strip
`_debugStack`. Mapping elements that a component in `node_modules` renders.
