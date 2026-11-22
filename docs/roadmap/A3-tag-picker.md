# A3: Tag picker (retag)

Status: **in review** · Size: M · Depends on: A2 · Branch: `feat/a3-retag`

## Goal

Change what an element *is*: a `div` into `section`, `header`, `nav`, `ul`, `li`, `a` or `button`,
or a `span` into `h1`–`h6`, `p` or `label`. Then the code says what each element is for.

## Design

- **A structural change,** `{ type: 'retag', tagName }`, in `packages/ast-writer/src/structure.ts`.
  Add it to `structuralKinds`; like every structural change it runs in its own transaction.
- **Only lowercase HTML elements in JSX.** Component tags are refused.
- **Allowed target tags:** `div`, `section`, `header`, `footer`, `nav`, `main`, `article`, `aside`,
  `ul`, `ol`, `li`, `a`, `button`, `p`, `span`, `h1`–`h6`, `label`, `figure`, `figcaption`.
- **Validity checks within the file:**
  - no `a` inside `a`, and no `button` or `a` inside `button`
  - retagging to `a` or `button` is refused when the element contains interactive descendants
    (`a`, `button`, `input`, `select`, `textarea`, `label`, or anything with `tabIndex`)
  - `li` only directly under `ul` or `ol`; refuse otherwise
  - `p` must not contain block children
  - void elements (`img`, `input`, `br`, `hr`) are out of scope for v1
- **Attributes that belong only to the old tag** (`href`, `target` and `rel` on `a`; `type` on
  `button`) make the retag refuse, with a message like "Remove href first". A2 can remove them. This
  keeps the edit exact.
- **Retagging to `button` adds `type="button"`,** so it doesn't submit a surrounding form by accident.
  If the element already has `type="button"`, keep it. If it has any other `type`, refuse ("Remove
  type first"), so the edit never writes a duplicate attribute or silently changes a value.
- **Only the opening and closing tag names change;** children and attributes stay untouched. Check
  that the writer's existing selection remaps, which follow traversal order, stay valid after a retag.
- **Inspector:** a tag dropdown in the selection header. The Layers panel shows the new tag.

## Tests

In the style of `transaction-structures.test.ts`:
- `div` → `section`
- `span` → `h1`
- `a` → `div` while it has an `href` is refused
- a nested `a` is refused
- `li` outside a list is refused
- `button` gets `type="button"`; an existing `type="submit"` is refused
- a `div` containing a `button` can't become an `a`
- undo and redo

## Done when

You can turn a drawn frame into a `nav` and a text into an `h2`, and the code reads that way.
