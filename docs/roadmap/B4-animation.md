# B4: Animation: transition duration and easing

Status: todo · Size: S–M · Depends on: F0 · Branch: `feat/b4-animation`

## Goal

Figma's transition settings (dissolve, an easing, a duration), written as CSS transition classes.

## Current state (verified 2026-11-21)

`getNewClass()` in writer.ts has no transition rules. The properties it does cover are layout,
spacing, colors, font size, opacity, borders, corner radius and position.

## Steps

1. [ ] Add class rules in `getNewClass()` and `matchesProperty()`, with tests first:
   - `transitionProperty`: `transition`, `transition-colors`, `transition-opacity`,
     `transition-transform`, `transition-all`, `transition-none`
   - `transitionDuration`: `duration-<n>`, or `duration-[250ms]`
   - `transitionTimingFunction`: `ease-linear`, `ease-in`, `ease-out`, `ease-in-out`, or
     `ease-[cubic-bezier(...)]`
   - `transitionDelay`: `delay-<n>`
2. [ ] Inline format writes the same values as style properties.
3. [ ] Add an "Animation" section in the inspector with duration and easing presets. Name the presets
   the way Figma does: Ease in, Ease out, Ease in and out, Linear, Gentle, Quick. Gentle and Quick are
   cubic-bezier approximations.
4. [ ] Enter animations for overlays (B2) use `@starting-style`. Tailwind v4 has a `starting:`
   variant; on v3, say it isn't supported instead of writing raw CSS.

## Tests

In `src/__tests__/minimal-diff.test.ts`:
- each rule writes the expected class
- a second edit replaces the first instead of adding a duplicate
- arbitrary values
- inline format

## Done when

The B3 hover color change animates over 200ms in Preview.

## Out of scope

Springs (CSS has no spring easing; `linear()` approximations could come later) and keyframe animations.
