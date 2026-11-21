# A2: Attribute edit for HTML elements

Status: todo · Size: M · Depends on: F0 · Branch: `feat/a2-attribute-edit`

## Goal

Add, change or remove these attributes on plain HTML elements from the editor:
- `href`, `target`/`rel`
- `id`, `type`, `title`
- `alt`, `src`
- `popover`, `popoverTarget`
- `role`, `aria-*`

B1, B2 and C2 all build on this.

## Current state (verified 2026-11-21)

- **Only existing props can be edited.** `mutateProp()` in `packages/ast-writer/src/props.ts` edits
  only *existing literal* props of the same type ("Only existing literal props are editable").
- **Some props are blocked outright.** `describe()` in props.ts blocks `id`, `style`, `className`,
  `key`, `ref`, `children`, `on*` and `data-gl-*` with "Use the dedicated source control".
- **No server change needed for a new type.** `validateMessage()` in
  `packages/server/src/session-security.ts` checks only the message shape.
- **Template files have no attribute path.** Vue, Svelte and Astro are handled in C4.

## Design

- **A new non-structural change,** `{ type: 'attribute', name, value }`, where `value` is a string,
  `true`, or `null` to remove. It's handled in the `switch` in writer.ts next to `'prop'` and
  implemented in props.ts as `setAttribute(node, name, value)`.
- **Allowed names (React spellings):** `href`, `target`, `rel`, `id`, `type`, `title`, `alt`, `src`,
  `name`, `placeholder`, `disabled`, `popover`, `popoverTarget`, `popoverTargetAction`, `role`, `aria-*`.
- **Refuse:**
  - component elements (capitalized names); they need a declared prop, through edit scopes
  - elements with a spread
  - an existing dynamic value
  - duplicate attributes
- **Validate at the trust boundary:**
  - `href` accepts relative paths, `#…`, `/…`, `http(s):`, `mailto:` and `tel:`, and refuses
    `javascript:` and `data:`.
  - `target="_blank"` also writes `rel="noopener noreferrer"`.
  - `id` must be unique in the file and match `^[A-Za-z][\w-]*$`.
- **Inspector:** an "Attributes" list for the selection, reusing the server's `inspect-props`
  message (`ws-server.ts`), with add and remove.

## Steps

- [ ] Tests first, in `src/__tests__/props.test.ts`
- [ ] `setAttribute` and the new writer case
- [ ] Confirm `handleSourceMutation` in ws-server.ts passes the change through unchanged
- [ ] Inspector UI
- [ ] A note in `skills/glide/SKILL.md`

## Tests

- add, update and remove `href`
- `target="_blank"` adds `rel`
- `javascript:` is refused
- a duplicate `id` is refused
- a component is refused
- an element with a spread is refused
- a boolean attribute
- undo restores the file

## Done when

From the inspector you can give a `div` an `id` and give a link an `href`, and undo works.
