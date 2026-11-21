# C2: Extract component

Status: **in review** (v1: same file) · Size: L · Depends on: A2 · Branch: `feat/c2-extract`

## Goal

Turn a selected element into a named component in its own file, so drawn designs become reusable,
readable code.

## Design

- **A structural change,** `{ type: 'extract', name }`, on the selected element. It:
  - creates `<folder>/<Name>.tsx` containing `export function <Name>() { return (…JSX…); }`. The
    folder is the most common directory of the component files already listed in
    `glide-components.json` (it records each component's file, not a folder setting), or
    `src/components` when there are none
  - replaces the element with `<Name />`
  - adds a relative `import { Name } from '…'`
- **v1 handles static markup only.** Refuse when the JSX uses names from the surrounding scope. Reuse
  the static checks in `cloneStatic(…, acrossScope)` in `structure.ts`, which already refuse
  "dynamic bindings or identity attributes".
- **v2 adds props.** Text literals and `href` values become props (`title`, `href`), with a typed
  props interface. The inspector's props panel and edit scopes then handle each usage.
- **One transaction across two files.** Check whether `MutationService` can *create* a file: its
  `resolveFile()` and `ProjectPaths.sourceFile()` may require the file to exist. If not, add creation
  with the same temp-file-and-rename write.
- **The component registry updates itself** (`maintainRegistryFile`).

## As built (2026-11-21)

- v1 extracts into the same file, above the component that used the markup: one file, one transaction,
  and the existing undo. Creating a file needs undo that can delete it again (history stores file contents
  only), so a file of its own is the next step.
- Refusals: markup using the surrounding component's bindings, a `key` (list item), a name that is not
  PascalCase or is already bound in the file.

## Steps

- [ ] Tests first: a new file plus an import, a name collision refused, dynamic JSX refused, undo across both files
- [ ] New-file support in `MutationService`
- [ ] The `extract` change in structure.ts and writer.ts
- [ ] "Extract component" in the editor's context menu, with a name prompt built into the page
  (the editor can't use `prompt()`)

## Done when

A drawn card becomes `<PricingCard />` backed by `src/components/PricingCard.tsx`, and undo restores both files.
