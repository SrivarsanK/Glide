# D3: Breakpoint previews side by side

Status: **todo** · Size: L · Depends on: — · Branch: `feat/d3-breakpoint-previews`

## Goal

While editing, see the page at several widths at once, so a change to `md:` classes is checked at
every breakpoint without resizing the canvas back and forth. Glide already writes breakpoint-targeted
Tailwind classes (`sm` to `2xl`); this shows their effect. Onlook 2.0 puts phone, tablet and desktop
previews (402, 744 and 1512 px) on one canvas.

Words: the **preview** is the app's iframe; a **frame** is an element drawn with the Frame tool (see
D7's glossary). This item adds previews, not frames.

## Current state (verified 2026-11-28)

- **One preview, assumed everywhere.** `packages/overlay/src/editor-html.ts` has one
  `<iframe id="app-iframe">` inside `#frame-wrapper`, and refers to `app-iframe` 50 times.
  `frameAsk()` always talks to it.
- **Messages are trusted per iframe.** The page-message handler passes `frame?.contentWindow` to
  `trustedWindowMessage()` (`packages/core/src/window-messages.ts`), which checks the sender's identity
  and origin. Messages from any other iframe are ignored.
- **Widths already exist.** Device presets (iPhone SE at 375 px to Desktop at 1440 px) and the
  breakpoint select `#edit-breakpoint` are in `editor-html.ts`, and `TailwindTheme.breakpoints`
  holds the project's breakpoint widths.

## Design

- **One primary preview, up to three mirrors.** The primary preview stays exactly as today: selection,
  edits, drag and resize. Mirrors are extra iframes on the same URL at other widths, placed to the
  right of the primary preview inside `#canvas-viewport`, so zoom and pan move them together.
- **Mirrors are read-only.** They take no pointer events and send nothing the editor trusts (the sender
  check already ignores them). Each one is a live copy of the app, so it hot-reloads on its own after
  every write.
- **Widths come from the theme.** One width under `sm`, then the project's own breakpoints, chosen with
  a "Breakpoints" toggle in the top bar. Projects without Tailwind use three device presets.
- **Selection shows everywhere.** When the selection changes, the editor posts
  `glide:highlight { source }` to each mirror. The bridge outlines every element with that source
  reference (a list item outlines all its copies). This is one-way, so mirrors need no editor-side trust.
- **Navigation follows the primary preview.** When it changes route, mirrors load the same path.
- **Make a mirror primary.** Clicking a mirror's label swaps it with the primary preview. The
  breakpoint select then suggests the breakpoint that width falls in, but doesn't switch on its own.

## Steps

- [ ] D3a: one `primaryPreview()` helper behind all 50 `app-iframe` lookups, with no change in behavior
  (`npm run build && npm run test:artifact`)
- [ ] D3b: the toggle and the mirrors, with widths from the theme or the presets
- [ ] D3c: `glide:highlight` in both bridges (the Vite bridge and the inline bridge), and selection
  mirroring
- [ ] D3d: navigation sync, and swapping a mirror with the primary preview
- [ ] D3e (optional, from Onlook): an off-screen mirror shows a still picture from the export path and
  drops its iframe until it scrolls back into view

## Tests

- The previews module picks widths from a theme's breakpoints, and falls back to presets without one.
- The bridges outline every element with a given source reference and ignore unknown references.
- Browser acceptance (`test:consumer`): with Breakpoints on, a class edit appears in every preview
  after hot reload.

## Done when

With Breakpoints on, the user selects a card and changes `md:` padding, and the narrow preview stays
the same while the wider ones update.

## Out of scope

Editing inside a mirror, and syncing app state (scroll position, open menus, form input) between
previews. Each mirror runs the app's code too, so the cap of three keeps the cost bounded.
