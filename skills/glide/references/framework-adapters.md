# Framework Adapters & Write-Back Guide

Glide saves edits to five file types. JSX/TSX has full support. Template files (Vue, Svelte, Astro, HTML) support class, inline style and text edits only.

A writer **refuses** an edit that it cannot make exactly (`UNSUPPORTED_OPERATION`). In that case, edit the file in source.

---

## 1. React / JSX / TSX (`packages/ast-writer`)

- **Engine**: `recast` with `@babel/parser` (TypeScript and JSX). Changed text is spliced into the original source, so formatting, comments and quotes stay as written.
- **Entry point**: `transformJSXBatch(source, operations, { theme })`.
- **Supported**:
  - Class edits on a static `className`, and on `cn` / `clsx` / `cva` / template-literal class expressions.
  - Inline `style={{ ... }}` edits.
  - Text edits that keep child elements and expressions.
  - Literal prop edits.
  - Structural edits: insert, delete, duplicate, paste, reorder, reparent, group, ungroup, arrange, detach, attach.
- **Refused**: `className` from a spread; a class that a condition or shared `cva` definition would override; moves across lexical scopes; copies of dynamic bindings.

---

## 2. Vue Single File Components (`packages/adapters/vue`)

- **Engine**: `@vue/compiler-sfc`. The element is found by the exact position of its tag in the template.
- **Supported**: static `class`, static `style`, one literal text segment. `<script>` and `<style>` blocks stay untouched.
- **Refused**: `:class` / `:style` / `v-bind`; text controlled by `v-text` or `v-html`; template preprocessors such as Pug; structural edits.

---

## 3. Svelte Components (`packages/adapters/svelte`)

- **Engine**: `svelte/compiler` (`parse`). The result is parsed again after each edit.
- **Supported**: static `class`, static `style`, one literal text segment.
- **Refused**: `class="a {b}"` and other dynamic values; elements with `{...spread}`; components such as `<Card>`; structural edits.

---

## 4. Astro Components (`packages/adapters/astro`)

- **Engine**: a tag scanner that reads the opening tag at the exact stamped position. Frontmatter, comments, `<script>` and `<style>` are ignored.
- **Supported**: static `class`, static `style`, text of an element that holds only literal text.
- **Refused**: `class:list`, `class={...}`, `style={{...}}`, `set:html`, `set:text`, `{...spread}`; text with expressions or child elements; components; structural edits.

---

## 5. Static HTML (`.html`)

- **Engine**: the same tag scanner as Astro.
- **Stamping**: HTML pages are stamped only in projects with no UI framework. In a React, Vue or Svelte project, `index.html` is a mount point and is not editable in Glide. `<html>`, `<head>` and `<body>` are never stamped; only the elements inside `<body>` are editable.
- **Supported**: `class`, `style`, text of an element that holds only text.
- **Refused**: text of an element with child tags; void tags such as `<img>`; structural edits.
