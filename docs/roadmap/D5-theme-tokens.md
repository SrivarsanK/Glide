# D5: Theme tokens and fonts panel

Status: **todo** · Size: M · Depends on: — · Branch: `feat/d5-theme-tokens`

## Goal

Add or change a project color or font family from the editor, written into the project's Tailwind
theme. Every element that uses the token updates, and new edits can pick it. Today Glide can read
tokens but not create or change one, so a new brand color ends up as a pile of arbitrary values.
Onlook v1 had a brand panel for this.

## Current state (verified 2026-11-28)

- **Reading works for both Tailwind versions.** `loadTailwindTheme()` (`packages/core/src/tailwind-theme.ts`)
  loads v3 through the project's own `loadConfig` and `resolveConfig`, and v4 by parsing `@theme` blocks
  with PostCSS. It caches the result against the files' stamps.
- **There are no font families.** `TailwindTheme` (`tailwind-tokens.ts`) has `colors`,
  `projectColors`, `fontSizes`, `spacing` and `breakpoints`.
- **Tokens are already preferred.** `colorToken()` prefers `projectColors`, so a color added here is
  written as `bg-brand-500` from then on, with no extra work.
- **Nothing writes the theme.**

## Design

- **Panel.** A "Theme" section lists the project's colors (swatch, name, value) and font families. You
  can edit a value, or add a token by name and value. Built-in palette colors are shown but read-only.
- **Writing v4.** Edit the `@theme` block that declares the token, through PostCSS so comments and
  formatting stay as written. A new token goes into the `@theme` block of the CSS file that imports
  Tailwind. Add one if there is none.
- **Writing v3.** Edit `theme.extend.colors` or `theme.extend.fontFamily` in `tailwind.config.*`
  through Babel and recast, creating `extend` and the inner object when they are missing. Only a static
  object literal is supported (`module.exports = { … }` or `export default { … }`, optionally with
  `satisfies Config`). Anything computed, imported or spread is refused with `UNSUPPORTED_OPERATION`.
- **CSS-variable tokens (shadcn).** A token whose value is `var(--x)` or `hsl(var(--x))` is changed at
  `--x`'s `:root` declaration. A `.dark` value, if present, is listed and edited as its own field.
- **One transaction.** A theme write goes through the same transaction as other edits: digests,
  all-or-nothing writes and undo. Put the writer in `packages/ast-writer` beside the class writer.
- **Fonts.** A family's value is a font stack. This item doesn't download web fonts or add `<link>`
  tags; it names fonts the project already loads, or system fonts.
- **Validation.** Token names are `[a-z0-9-]` with at most one level of shades (`brand-500`). Values must
  parse as a color (`parseColor()`) or a font stack, and are never raw CSS that could close the block.

## Steps

- [ ] D5a: read font families into `TailwindTheme` (v3 and v4)
- [ ] D5b: the v4 `@theme` writer, and undo
- [ ] D5c: the v3 config writer, with refusals
- [ ] D5d: CSS-variable tokens (`:root` and `.dark`)
- [ ] D5e: the Theme panel; a new color appears in the color picker's presets

## Tests

- v4: edit a color, add one, and add the first `@theme` block. Comments and formatting are kept.
- v3: edit and add inside `extend`; refuse a config that spreads another object.
- A shadcn token is edited at its `:root` variable.
- The theme cache picks up the change without a restart.

## Done when

In a Tailwind v4 project, the user adds `brand-500` as `#0ea5e9`, sets a button's fill to it, and the
source gets `bg-brand-500`. Undoing twice removes the class, then the token.

## Out of scope

Spacing, radius and shadow tokens (later, the same way), downloading web fonts, and design-token
files other than Tailwind's.
