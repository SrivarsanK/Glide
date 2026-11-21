# A1: Frames lay out their children; class rules for `display` and radius

Status: **in review** · Size: S–M · Depends on: F0 · Branch: `feat/a1-layout-frames`

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

1. [x] Test first: hiding and showing an element in a Tailwind fixture. Expect it to fail today.
2. [x] Add a `display` rule.
   - `getNewClass` maps `block`, `inline-block`, `inline`, `flex`, `inline-flex`, `grid`,
     `inline-grid`, `contents`, and `none` → `hidden`.
   - `matchesProperty('display')` matches exactly those class names.
   - Hiding must not lose the element's own display value. A frame is `flex flex-col gap-4`; if hide
     replaced `flex` with `hidden`, show would leave a block. In Tailwind, hide adds `hidden` next to
     the existing display class, and show removes only `hidden`. Checked: v3 defines `.hidden` last,
     but v4 orders display classes alphabetically, so `inline`, `inline-block` and `inline-flex` beat
     `hidden`; hide writes `hidden!` in v4 when one of those is present. In inline format, refuse hide when the element sets its own `display`,
     unless the old value can be restored. `mutateClass` currently rejects values that have no class
     rule, so the removal needs an explicit path.
3. [x] Add a `borderRadius` rule.
   - Writes `rounded-<theme token>` or `rounded-[value]`.
   - `matchesProperty` matches `rounded` and `rounded-*`, except the side and corner forms
     (`-t -r -b -l -s -e -tl -tr -br -bl -ss -se -es -ee`).
   - An all-corners edit also replaces the corner classes; add that to `overlappingProperties()`.
4. [x] Delete `INSERT_CLASSES` from writer.ts. Inserts now use the real rules.
5. [x] Change the insert defaults (the `change.type === 'insert'` branch in `structure.ts`).
   - Frame: `display: flex`, `flexDirection: column`, `gap: 16px`, which becomes `flex flex-col gap-4`.
   - Text: no fixed height. Keep the width only when the user dragged one.
6. [x] Add an "Auto layout" toggle to the inspector, next to the direction buttons. It writes
   `display: flex` on and removes it off. Show the direction and gap controls only while it's on.
7. [ ] Optional (README known issue 5): make `attach` from the pasteboard join the layout the way F0
   does, instead of writing absolute positioning.

## Tests

In `src/__tests__/minimal-diff.test.ts` and `transaction-structures.test.ts`:
- hide and show work in a Tailwind fixture, and hiding then showing a `flex` frame keeps `flex`
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
