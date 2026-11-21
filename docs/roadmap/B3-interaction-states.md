# B3: Hover, press and focus states

Status: todo · Size: S · Depends on: B1 · Branch: `feat/b3-states`

## Goal

Figma's "change to a variant while hovering or pressing", as `hover:`, `active:` and
`focus-visible:` classes.

## Current state (verified 2026-11-21)

- **The writer already handles state edits.** The `edit-pseudo-state` select in editor-html.ts offers
  hover, focus, focus-visible, active and disabled, and the writer adds the matching prefix to the class.
- **Inline styles can't do states.** With inline format, state edits are refused ("Scoped styles
  require Tailwind authoring").

So this item is mostly UI.

## Steps

- [ ] In the Interactions panel, add "While hovering", "While pressed" and "When focused". Each one sets
  the state select and shows which properties already differ in that state, read from the element's
  classes.
- [ ] Offer to add a transition at the same time (B4) so state changes animate.
- [ ] In inline-format projects, explain why states are unavailable instead of showing an error.

## Tests

The interactions module reads state classes back correctly. The writer side is already covered.

## Done when

A drawn button gets a hover color from the Interactions panel, and the hover works in Preview.

## Out of scope

Forcing a state onto the canvas while editing. JavaScript can't trigger `:hover`; Preview is the way to see it.
