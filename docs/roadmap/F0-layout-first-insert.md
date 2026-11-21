# F0: Land layout-first inserts

Status: **in progress** · Size: S · Depends on: none · Branch: `feat/f0-layout-first-insert`

## What it does (committed as `5504bb1` on the branch above, 2026-11-21)

- Drawing a frame, rectangle, ellipse or text inside the page inserts the element next to the
  nearest in-flow child of the container under the pointer. There's no `position: absolute`.
- Starting styles follow the Style format setting through the writer:
  `<div className="w-24 h-20 bg-sky-400 rounded-[50%]">` in Tailwind projects, a style object otherwise.
- Drafts on the pasteboard (`{false && …}`) keep inline styles, because the pasteboard previews read
  only those.

## Changed files

- `packages/core/src/frame-queries.ts`: new `siblingAt()`; `containerAt()` also returns
  `siblingId` and `position`. Reading order: horizontal for flex rows (reverse-aware), row-major for
  grid and wrapping flex, vertical otherwise. It skips absolutely positioned and fixed children, and
  children stamped from another file.
- `packages/overlay/src/editor-html.ts`: `resolveParentAtPoint()` passes the sibling through.
  `dispatchShapeInsert()` sends `siblingId`, `position` and `authoringRepresentation`, and sends
  coordinates only for detached drafts.
- `packages/ast-writer/src/structure.ts`: `mutateStructure(..., applyStyles)`. The insert splices
  before or after the sibling, or appends when there's none. New `inlineStyles()` helper. Frames no
  longer get `backgroundColor: transparent`.
- `packages/ast-writer/src/writer.ts`: passes the style applier (Tailwind when
  `authoringRepresentation === 'tailwind'`, or when it's Auto and `theme.version !== null`).
  `INSERT_CLASSES` is a temporary map that A1 removes.
- `src/__tests__/frame-queries.test.ts` and `src/__tests__/transaction-structures.test.ts`: new tests.

## Steps

- [x] `git checkout -b feat/f0-layout-first-insert`, then commit (`5504bb1`)
- [x] `npm run build && npm run typecheck && npm test && npm run test:artifact`: all pass (444 tests)
- [x] Manual check in `test-site/` (2026-11-21, real editor driven with Playwright, inline-style project):
  - Flex row (between two children, and after the last), flex column and grid: every element landed
    next to the right sibling, with no `absolute`.
  - The pasteboard draft was written as `{false && …}` with inline styles and showed its preview.
  - Found and fixed: new elements shared a line with the next sibling or the closing tag. They now get
    their own indented line (`59e701d`, tests in `transaction-structures.test.ts`).
  - Not checked by hand: Tailwind output (no Tailwind in `test-site`; covered by unit tests).
- [ ] Push the branch and open a PR (needs the user's go-ahead)
- [ ] Merge the PR
- [ ] Changelog entry at release time (this repo adds entries under a version heading when it releases)

## Accepted limits

- **Free placement by drawing is gone.** Dragging afterwards writes relative offsets.
- **Attaching from the pasteboard still writes absolute positioning** (README known issue 5).
- **The `rounded-[50%]` class conflict** is fixed in A1.
