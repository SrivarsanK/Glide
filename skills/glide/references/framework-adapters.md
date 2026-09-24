# Framework Adapters & Write-Back Guide

Glide supports source write-back across five web application targets. Each target has specialized AST parsers and transformation strategies to ensure developer code formatting and structure are preserved.

---

## 1. React / TSX (`packages/ast-writer/src/writer.ts`)

- **Underlying Engine**: `recast` with `@babel/parser` configured for TypeScript and JSX.
- **Why Recast**: Unlike Babel generator, Recast preserves original indentation, comments, single vs double quotes, and line breaks.
- **Operations Supported**:
  - `updateClassName`: Modifies or adds `className="..."` string or JSX expression.
  - `updateJSXStyleProp`: Modifies inline `style={{ ... }}` attributes.
  - `updateJSXText`: Surgically replaces inner JSX text children without touching child elements.
  - `reorderJSXElement`: Reorders sibling JSX elements or reparents across containers.
  - `groupJSXElements` / `ungroupJSXElement`: Wraps elements in a container `<div>` or removes a wrapper.

---

## 2. Vue Single File Components (SFC) (`packages/adapters/vue`)

- **Underlying Engine**: `@vue/compiler-sfc`.
- **Strategy**:
  - Extracts the `<template>` descriptor block.
  - Identifies the target node matching `data-gl-source` coordinates.
  - Updates `:class`, `class`, `:style`, `style`, or text content within the template.
  - Reassembles the SFC, leaving `<script>`, `<script setup>`, and `<style>` blocks completely untouched.

---

## 3. Svelte Components (`packages/adapters/svelte`)

- **Underlying Engine**: `svelte/compiler`.
- **Strategy**:
  - Isolates template markup by stripping `<script>` and `<style>` blocks.
  - Parses Svelte AST to locate target elements.
  - Replaces class attributes or text nodes.
  - Re-injects the modified template between original script and style blocks.

---

## 4. Astro SFCs (`packages/adapters/astro`)

- **Strategy**:
  - Detects frontmatter code fences (`---`).
  - Separates frontmatter server logic from the component template markup.
  - Applies element modifications to the template section.
  - Re-attaches frontmatter block preserving server-side imports and logic.

---

## 5. Static HTML (`packages/adapters/html`)

- **Underlying Engine**: `html-dom-parser`.
- **Strategy**:
  - Parses HTML document or fragment.
  - Targets elements matching `data-gl-source` or element structure.
  - Updates class, style, or text attributes directly and serializes back to clean HTML.
