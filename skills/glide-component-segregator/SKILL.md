---
name: glide-component-segregator
description: >
  Component segregation guide for Glide. Teaches the agent how to read
  `glide-components.json` to discover, locate, and edit components by name
  instead of by raw file:line:col. Covers auto-watch behavior, adding new
  components, and all edge cases (co-located CSS, background/root elements,
  anonymous exports, Vue SFC, Svelte, HTML).
---

# Glide Component Segregator

## What Is This?

When `glide` starts (via `node dist/cli.js` or `npx @srivarsank/glide`), it scans the target project's source tree and writes **`glide-components.json`** to the project root. It also watches for source file changes and rebuilds the file incrementally with a 300 ms debounce.

Every component in the app — including layout wrappers, backgrounds, and sub-elements — is captured in a `ComponentBucket` in that file.

---

## Registry Shape

```ts
// glide-components.json
{
  "projectRoot": "/absolute/path/to/project",
  "generatedAt": "2024-07-01T12:00:00.000Z",
  "framework": "react" | "vue" | "svelte" | "html" | "unknown",
  "buckets": ComponentBucket[]
}

interface ComponentBucket {
  name: string;           // "Card", "Header", "Default", "App", "Anonymous"
  file: string;           // absolute path to source file
  exportType: "default" | "named" | "anonymous" | "sfc" | "html";
  line: number;           // line of the function/export declaration
  column: number;
  elements: RegistryElement[];
  cssFiles: string[];     // co-located CSS files (same dir, same stem)
}

interface RegistryElement {
  id: string;             // data-gl-source value or "file:line:col" fallback
  tagName: string;        // "div", "button", "Card.Header", etc.
  line: number;
  column: number;
  isRoot: boolean;        // true = outermost element returned by the component
  classNames: string[];   // static className tokens
  text?: string;          // trimmed direct text content (≤25 chars)
}
```

---

## How to Use This as an Agent

### 1. Locate a component before editing it

**Do not** guess file paths or scan the source tree manually. Read the registry first:

```bash
# In the target project root:
cat glide-components.json
```

Then find the bucket:
```js
const bucket = registry.buckets.find(b => b.name === 'Card');
// bucket.file = "/Users/dev/myapp/src/components/Card.tsx"
// bucket.line = 12
```

Use `bucket.file` + `bucket.line` as the starting point for any edit.

### 2. Find the root / background element

The outermost wrapper element is tagged `isRoot: true`:
```js
const root = bucket.elements.find(e => e.isRoot);
// root.tagName = "div", root.classNames = ["card-container"], root.id = "src/Card.tsx:13:8"
```

Use `root.id` as the `data-gl-source` target when sending style edits via the Glide WebSocket protocol.

### 3. Target a specific nested element

Find by tagName, className, or text:
```js
const btn = bucket.elements.find(e => e.tagName === 'button' && e.classNames.includes('submit'));
// btn.id → use this as the edit target
```

### 4. Edit co-located CSS

Check `bucket.cssFiles` for associated stylesheets:
```js
if (bucket.cssFiles.length > 0) {
  // Edit bucket.cssFiles[0] for CSS changes
}
```

---

## Adding a New Component

1. Create the new component file in the project source tree.
2. The chokidar watcher detects the change within ~300 ms.
3. `glide-components.json` is rewritten automatically — **no manual rescan needed**.
4. Re-read `glide-components.json` to get the new bucket.

> [!IMPORTANT]
> Never cache the registry in memory across multiple edits. Always re-read `glide-components.json` from disk before each operation — it may have been updated by the watcher.

---

## Edge Cases

### Anonymous / no-export files
Files with JSX but no recognizable PascalCase component function are captured as a single `exportType: "anonymous"` bucket named after the file stem. The first element is tagged `isRoot: true`.

```json
{
  "name": "template",
  "exportType": "anonymous",
  "elements": [{ "isRoot": true, "tagName": "div", ... }]
}
```

### Multiple components in one file
Each PascalCase function/arrow export becomes its own bucket. A file with `Header` + `Footer` exports produces **two** separate buckets, both pointing to the same `file` path but different `line` numbers.

### Vue SFC
The bucket name is the filename stem (e.g., `MyComponent.vue` → `"name": "MyComponent"`). `exportType` is `"sfc"`. Elements come from the `<template>` block only.

### Svelte
Same as Vue SFC. `<script>` and `<style>` blocks are stripped before scanning.

### HTML files
`exportType: "html"`. `<head>`, `<script>`, and `<style>` nodes are excluded. The first `<body>` child (or first tag in the file) is tagged `isRoot: true`.

### Co-located CSS modules
If `Card.tsx` and `Card.module.css` live in the same directory, `cssFiles` will contain the `.module.css` path. The same applies to `.scss`, `.less`.

### Dynamic classNames
Elements using dynamic class expressions (`className={styles.card}`, template literals) will have `classNames: []`. This is expected. Edit their co-located CSS file or the inline style.

### Non-PascalCase utility functions
Functions named `formatDate`, `helper`, etc. are **not** captured as component buckets — they don't return JSX directly in a way Glide can segregate. This is by design.

---

## Registry File Location

`glide-components.json` is written to the **project root** (same directory as `package.json` and `glide-positions.json`). It should be added to `.gitignore`:

```gitignore
glide-components.json
glide-positions.json
```

---

## Summary: Agent Workflow

```
1. Read glide-components.json
2. Find bucket by name (or file basename)
3. Inspect bucket.elements → find target by isRoot / tagName / classNames
4. Use element.id as data-gl-source target for Glide edits
5. For CSS changes → use bucket.cssFiles
6. After adding new component → wait 300ms → re-read registry
```
