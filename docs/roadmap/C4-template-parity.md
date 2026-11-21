# C4: Vue, Svelte and Astro parity

Status: **in review** (part 1: attributes and retag, all four) · Size: L · Depends on: A2, A3 · Branch: `feat/c4-attributes`

## Goal

Attributes, retag, insert, delete and move work in Vue, Svelte and Astro files the way they do in
JSX, so the Interactions panel works in those projects too.

## Current state (verified 2026-11-21)

- **`template-mutations.ts`** (`transformTemplateBatch`) handles `class`, `multi-class`, `style`,
  `layout` and `text` only.
- **Adapters** (`packages/adapters/*/src`):
  - Vue: `updateVueSFCClass`, `updateVueSFCStyle`, `updateVueSFCText`, `readVueClass`, `listVueElements`
  - Svelte: `listSvelteElements`, `readSvelteClassAt`, `setSvelteClassAt`, `setSvelteStyleAt`,
    `setSvelteTextAt`
  - Astro: `listAstroElements`, `readAstroClassAt`, `setAstroClassAt`, `setAstroStyleAt`,
    `setAstroTextAt`
- **The README table** says structural edits are JSX-only.

## Steps (one framework per branch: Vue, then Svelte, then Astro, then plain HTML)

1. [x] **Attributes** with A2's rules. Use lowercase names (`popovertarget`, `class`). Refuse bound
   attributes: Vue's `:href`/`v-bind`, Svelte's `{expr}` and spreads, Astro expressions.
2. [x] **Retag** with A3's rules.
3. [ ] **Insert, delete and move.** Deferred until a Vue, Svelte or Astro project asks for it.
4. [x] **Interactions panel:** it emits the same change types, so check that it works and fix any
   framework-specific spellings.

## As built (2026-11-21)

- One branch for all four, not one per framework: the rules are shared, so each adapter only adds a read, a
  write and a rename (`read*AttributeAt`, `set*AttributeAt`, `read*TagAt`, `rename*TagAt`; Vue takes an id).
- The rules live once: `checkAttributeValue` and `templateAttributeName` in `props.ts`, `checkRetag` and
  `RETAG_TARGETS` in `structure.ts`. JSX uses them too. `transformTemplateBatch` applies them.
- Template names are lowercase (`popovertarget`); the editor's React names are mapped.
- A duplicate id is found by a text match over the file (refuses a false match rather than miss one).
- Checked in the Vue test app: Interactions panel "Open URL" turned a `<section>` into `<a href>` with both
  tags renamed, and undo restored the file exactly.
- Not done: the attribute rows of the props inspector (JSX-only `inspect-props`), and insert, delete and move.

## Tests

A test file per adapter in `src/__tests__/`, mirroring the JSX cases from A2 and A3.

## Done when

In a Vue project, a drawn frame can become a link and open an overlay, with the same safety as JSX.
