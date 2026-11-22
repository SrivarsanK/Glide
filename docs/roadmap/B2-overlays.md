# B2: Overlays with the Popover API

Status: **in review** · Size: M · Depends on: B1 · Branch: `feat/b2-overlays`

## Goal

Figma's Open overlay, Close overlay and "close when clicking outside", with no JavaScript.

## Source written

- **On the overlay element:** `popover` plus an `id`. `popover` (auto) closes on a click outside or
  Esc. `popover="manual"` turns that off.
- **On the trigger:** it must be a `button` (A3), because `popovertarget` works only on buttons and
  inputs. It gets `popoverTarget="<id>"`.
- **On the close button inside the overlay:** `popoverTarget="<id>"` and `popoverTargetAction="hide"`.
- **Both generated buttons get `type="button"`.** Inside a form, a button without a type submits the
  form instead of toggling the popover. An existing button of any other type (`submit`, `reset`) is
  refused as a trigger until its type is changed to `button`.
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

## As built (2026-11-21)

- Overlays are elements that already have a unique id and the `popover` attribute (A2's Add attribute
  sets both); the panel lists them. Making an overlay from the selection is deferred.
- Each action is one `retag` carrying the attributes, like B1. An existing `type="submit"` button is
  refused as a trigger.
- A Show button calls the new `show-popover` frame query, so an overlay can be opened and edited on the canvas.
- Checked with React 19 (renders `popovertarget`). React 18 is unverified.

## Steps

- [x] An "Open overlay" action in the Interactions panel: pick the overlay frame, or make one from the selection
- [x] A "Close overlay" action for buttons inside it
- [ ] Position and backdrop options
- [x] The `show-popover` query, with a Show button in the Interactions panel
- [ ] "Show overlay" in the Layers panel

## Tests

- the plans for open and close in the interactions module
- writer output for both elements
- the frame query, using a fake element in the style of `frame-queries.test.ts`

## Done when

In Preview, the button opens the overlay, a click outside closes it, and the close button works.
