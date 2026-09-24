---
name: glide-component-segregator
description: >
  Component segregation guide for Glide (@srivarsank/glide). Teaches AI agents
  how to read `glide-components.json` to discover, locate, and edit components by
  name instead of raw file:line:col coordinates. Covers 300ms auto-watch behavior,
  adding new components, co-located CSS detection, root element targeting,
  multi-framework support (React, Vue, Svelte, Astro, HTML), and coordination with
  Glide's In-Memory SceneGraph and LWW delta queue.
---

# Glide Component Segregator

## What Is This?

When `glide` starts (via `npx @srivarsank/glide` or `glide`), it scans the target project's source tree and writes **`glide-components.json`** to the project root. It watches for source file changes and rebuilds incrementally with a 300 ms debounce.

Every component in the app — including layout wrappers, backgrounds, and sub-elements — is indexed in a `ComponentBucket` within that file.

---

## Registry Shape

```ts
// glide-components.json
{
  "projectRoot": "/absolute/path/to/project",
  "generatedAt": "2026-09-24T12:00:00.000Z",
  "framework": "react" | "vue" | "svelte" | "astro" | "html" | "unknown",
  "buckets": ComponentBucket[]
}

interface ComponentBucket {
  name: string;           // "Card", "Header", "Hero", "Default", "Anonymous"
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

## How to Use This as an AI Agent

### 1. Locate a component before editing it

**Do not** guess file paths or scan the entire filesystem manually. Read the registry first:

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

Use `root.id` as the `data-gl-source` target when sending style or layout edits via the Glide WebSocket protocol.

### 3. Target a specific nested element

Find by tagName, className, or text:
```js
const btn = bucket.elements.find(e => e.tagName === 'button' && e.classNames.includes('submit'));
// btn.id → use this as the edit target
```

### 4. Jump to imported sub-component definitions

If an element has a capitalized `tagName` (e.g. `<Button />`, `<Avatar />`), it is a custom component instantiation.
In Glide v1.1.0+:
- The server provides `resolveComponentDefinition` to locate the origin file of that component.
- The Properties panel header and Layers tree include a **Jump to Component** button.
- Query `registry.buckets.find(b => b.name === tagName)` to jump directly to its definition.

### 5. Edit co-located CSS

Check `bucket.cssFiles` for associated stylesheets:
```js
if (bucket.cssFiles.length > 0) {
  // Edit bucket.cssFiles[0] for CSS module changes
}
```

---

## Edge Cases

| Scenario | Behavior |
|:---|:---|
| **Anonymous export** (`export default function() { ... }`) | `bucket.name = "Anonymous"`, `exportType = "anonymous"` |
| **Vue SFC** (`.vue`) | Scans `<template>` block only; `exportType = "sfc"` |
| **Svelte** (`.svelte`) | Strips `<script>` and `<style>` blocks; scans template; `exportType = "sfc"` |
| **Astro** (`.astro`) | Preserves `---` frontmatter; scans template; `exportType = "sfc"` |
| **Static HTML** (`.html`) | Excludes `<head>`, `<script>`, `<style>`; `exportType = "html"` |
| **Co-located CSS** | Scans directory for `.css`, `.module.css`, `.scss`, `.sass` matching component stem |
| **File added / deleted** | Registry auto-rebuilds in 300 ms via `watchRegistry` |
| **Simultaneous edits** | Server `PropertyDeltaQueue` enforces LWW conflict resolution per `(nodeId, propKey)` |

---

## Recommended Workflow

```
1. Read glide-components.json
2. Find bucket by component name (e.g. "Card", "Header")
3. Inspect elements — target by isRoot / tagName / classNames
4. Use element.id as the target data-gl-source
5. For CSS edits — open file listed in bucket.cssFiles
6. If adding a new component — wait 300 ms, then re-read registry
```
