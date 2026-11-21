# B1: Interactions panel: go to page, open URL, scroll to

Status: todo · Size: M · Depends on: A2, A3 · Branch: `feat/b1-links`

## Goal

Figma's Navigate, Open link and Scroll to, written as plain HTML that works in every framework with
no JavaScript.

| Interaction | Source written |
|---|---|
| Go to page | retag to `a` (A3), plus `href="/pricing"` (A2) |
| Open URL | `a` with `href`, `target="_blank"` and `rel="noopener noreferrer"` |
| Scroll to | the target gets an `id` (A2; a slug from its text or layer name, unique in the file), and the trigger gets `href="#id"` |

## Design

- **A new "Interactions" section in the inspector.** The trigger is "On click", and the action is
  None, Go to page, Open URL or Scroll to. The target is a typed path (B5 adds a picker), a typed
  URL, or "pick on canvas".
- **No stored interaction data.** The panel reads the interaction back from `href`: `#…` means
  scroll to, a scheme means open URL, and a path means go to page.
- **Testable logic lives in a pure module,** for example `packages/overlay/src/interactions.ts` with
  `readInteraction(attrs)` and `planInteraction(choice)`, which returns a list of changes. Inject it
  into editor-html.ts with `${fn.toString()}`, the same way `createMutationScope` is, so vitest can
  test it.
- **Several changes mean several transactions.** A retag is structural and must run on its own.
  Show the user one toast for the whole interaction.
- **Router links come in v2.** Switching to `next/link` or React Router's `Link` needs an import to be
  added. A plain `<a>` works everywhere; in a single-page app it does a full page load.

## Steps

- [ ] The `interactions.ts` module, with tests
- [ ] The inspector section, wired to the A2 and A3 changes
- [ ] "Pick on canvas" target mode for scroll to
- [ ] A note in `skills/glide/SKILL.md` on how interactions are stored, so agents keep them intact

## Tests

- unit tests for the interactions module
- writer tests: a `div` becomes an `a` with an `href`; scroll to writes the target's `id` and the trigger's `href`

## Done when

In Preview, clicking a drawn button goes to the page, opens a new tab or scrolls to its target.

## Out of scope

Smooth scrolling (it needs a global CSS or `html` change) and router links (v2).
