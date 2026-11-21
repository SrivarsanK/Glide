# B2: Overlays with the Popover API

Status: todo · Size: M · Depends on: B1 · Branch: `feat/b2-overlays`

## Goal

Figma's Open overlay, Close overlay and "close when clicking outside", with no JavaScript.

## Source written

- **On the overlay element:** `popover` plus an `id`. `popover` (auto) closes on a click outside or
  Esc. `popover="manual"` turns that off.
- **On the trigger:** it must be a `button` (A3), because `popovertarget` works only on buttons and
  inputs. It gets `popoverTarget="<id>"`.
- **On the close button inside the overlay:** `popoverTarget="<id>"` and `popoverTargetAction="hide"`.
- **Placement:** the browser centers popovers by default. Top, bottom and corner positions are done
  with classes, and the backdrop with `backdrop:bg-black/40` (Tailwind's `backdrop:` variant).

## Verify first

- **React:** React 19 knows `popover` and `popoverTarget`. On React 18, check what actually reaches
  the DOM.
- **Vue, Svelte, Astro:** these use the lowercase attributes. They're covered in C4.

## Editor support

A closed popover is hidden, so it can't be selected or edited.
- Add a frame query `show-popover` in `packages/core/src/frame-queries.ts` that calls
  `el.showPopover()` in the preview. That file must stay self-contained.
- Add "Show overlay" to the Layers panel.

## Steps

- [ ] An "Open overlay" action in the Interactions panel: pick the overlay frame, or make one from the selection
- [ ] A "Close overlay" action for buttons inside it
- [ ] Position and backdrop options
- [ ] The `show-popover` query and the Layers action

## Tests

- the plans for open and close in the interactions module
- writer output for both elements
- the frame query, using a fake element in the style of `frame-queries.test.ts`

## Done when

In Preview, the button opens the overlay, a click outside closes it, and the close button works.
