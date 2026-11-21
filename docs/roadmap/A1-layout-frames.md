# A1: Frames lay out their children; class rules for `display` and radius

Status: todo · Size: S–M · Depends on: F0 · Branch: `feat/a1-layout-frames`

## Goal

A drawn frame behaves like a Figma auto-layout frame: things drawn inside line up with a gap, text
hugs its content, and `display` and `border-radius` become properties that can be edited properly.

## Current state (verified 2026-11-21)

- **No class rules for these two properties.** `getNewClass()` and `matchesProperty()` in
  `packages/ast-writer/src/writer.ts` have no `display` rule and no whole-element `borderRadius` rule,
  only `rounded-tl/tr/br/bl`. F0 works around this with `INSERT_CLASSES`.
- **No way to turn flex on.** The inspector has direction (`flex-row`/`flex-col`), justify and gap
  controls (`sendEdit({type:'class', property:'flexDirection', …})` in editor-html.ts), but nothing
  sets `display: flex`, so those buttons do nothing on a block element.
- **Hide and show probably fail in Tailwind projects.** The visibility toggle sends `display`
  through `sendStyleChange()`, which is a `class` edit, and `mutateClass` would throw "No Tailwind
  authoring rule for display". Prove it with a test first.
- **Text clips.** Text inserts get a fixed 32px height, so longer text is cut off.

## Steps

1. [ ] Test first: hiding and showing an element in a Tailwind fixture. Expect it to fail today.
2. [ ] Add a `display` rule.
   - `getNewClass` maps `block`, `inline-block`, `inline`, `flex`, `inline-flex`, `grid`,
     `inline-grid`, `contents`, and `none` → `hidden`.
   - `matchesProperty('display')` matches exactly those class names.
   - An empty value (show) must *remove* the display class. `mutateClass` currently rejects any value
     that has no class rule, so add an explicit removal path.
3. [ ] Add a `borderRadius` rule.
   - Writes `rounded-<theme token>` or `rounded-[value]`.
   - `matchesProperty` matches `rounded` and `rounded-*`, except the side and corner forms
     (`-t -r -b -l -s -e -tl -tr -br -bl -ss -se -es -ee`).
   - An all-corners edit also replaces the corner classes; add that to `overlappingProperties()`.
4. [ ] Delete `INSERT_CLASSES` from writer.ts. Inserts now use the real rules.
5. [ ] Change the insert defaults (the `change.type === 'insert'` branch in `structure.ts`).
   - Frame: `display: flex`, `flexDirection: column`, `gap: 16px`, which becomes `flex flex-col gap-4`.
   - Text: no fixed height. Keep the width only when the user dragged one.
6. [ ] Add an "Auto layout" toggle to the inspector, next to the direction buttons. It writes
   `display: flex` on and removes it off. Show the direction and gap controls only while it's on.
7. [ ] Optional (README known issue 5): make `attach` from the pasteboard join the layout the way F0
   does, instead of writing absolute positioning.

## Tests

In `src/__tests__/minimal-diff.test.ts` and `transaction-structures.test.ts`:
- hide and show work in a Tailwind fixture
- a radius edit replaces `rounded-[50%]` and any corner classes
- a frame insert writes `flex flex-col gap-4`
- a text insert has no height
- the same cases in inline format

## Done when

- The tests pass.
- In `test-site/`, drawing a frame and then two shapes inside it stacks them with a gap.
- The auto layout toggle works, and hide and show work in a Tailwind project.

## Out of scope

Wrapping, absolutely positioned children inside auto layout, a grid editor.
