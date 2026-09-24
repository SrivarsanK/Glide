---
name: glide
description: >
  Authoritative guide and toolset for AI agents to operate, configure, and visually
  design applications using Glide (@srivarsank/glide). Always trigger this skill whenever
  the user mentions Glide, visual design, visual editing, WYSIWYG editing, canvas direct manipulation,
  editing UI visually, styling components visually, dragging/resizing elements, adjusting Tailwind
  classes visually, or when inspecting glide-components.json, glide-positions.json, or working with
  Glide's In-Memory SceneGraph and bidirectional AST engine across React, Vue, Svelte, Astro, or HTML projects.
---

# Glide — AI Agent Visual Design & Architecture Skill

Glide is a **code-native visual design tool** that bridges direct manipulation on a browser canvas directly with source code.
There is **no secondary JSON AST or proprietary schema** — the user's source code is the only source of truth.

---

## 1. Quick Reference & Core Workflow

When asked to inspect, modify, or design UI with Glide, follow this 5-step loop:

```
┌────────────────────────────────────────────────────────────────────────┐
│  1. READ REGISTRY      cat glide-components.json                       │
│  2. TARGET ELEMENT     Locate bucket by component name, get element.id │
│  3. APPLY CODEMOD      Tailwind surgical rewrite or inline style update│
│  4. VERIFY SCENE       In-Memory SceneGraph patches via scene_update   │
│  5. STAGE OR COMMIT    Review staged batch or commit to source code    │
└────────────────────────────────────────────────────────────────────────┘
```

### Deterministic Helper Scripts
The skill bundles executable scripts for fast, deterministic queries:
- **Query components**: `node skills/glide/scripts/query-components.js --name <ComponentName>`
- **Verify project setup**: `node skills/glide/scripts/verify-setup.js`

---

## 2. Component Discovery via `glide-components.json`

Never guess file paths or crawl the workspace manually.
On startup, Glide auto-generates **`glide-components.json`** in the project root and updates it with a 300 ms debounce whenever source files change.

### Registry Schema

```ts
interface ComponentRegistry {
  projectRoot: string;
  framework: 'react' | 'vue' | 'svelte' | 'astro' | 'html';
  buckets: ComponentBucket[];
}

interface ComponentBucket {
  name: string;           // "Card", "Header", "Button", "App"
  file: string;           // Absolute path to source file
  exportType: "default" | "named" | "anonymous" | "sfc" | "html";
  line: number;           // Line of declaration
  elements: RegistryElement[];
  cssFiles: string[];     // Associated stylesheets (e.g. Card.module.css)
}

interface RegistryElement {
  id: string;             // data-gl-source ("file:line:col")
  tagName: string;        // "div", "button", "Card.Header"
  line: number;
  column: number;
  isRoot: boolean;        // Outermost component wrapper
  classNames: string[];   // Static class tokens
  text?: string;          // Direct text preview (<=25 chars)
}
```

### Element Targeting Rules
1. **Root / Background Element**: Look for `element.isRoot === true`. Use this for background color, outer padding, container sizing.
2. **Interactive Elements**: Filter `elements` by `tagName === 'button'`, `tagName === 'input'`, or specific class tokens.
3. **Sub-Components**: If an element's `tagName` is capitalized (e.g. `<UserAvatar />`), it is an imported sub-component. Use Glide's component definition resolution to inspect its origin file (see [architecture.md](references/architecture.md)).

---

## 3. Visual Styling & Tailwind Codemods

Glide supports surgical editing of Tailwind CSS utility classes and inline styles without clobbering surrounding code.

### Surgical Tailwind Token Replacement
When changing styling on elements using Tailwind:
- **Prefix Isolation**: Replace only tokens matching the target CSS property (`bg-`, `text-`, `p-`, `m-`, `w-`, `h-`, `rounded-`, `border-`).
- **Arbitrary Values**: Preserve bracketed arbitrary values like `bg-[#1a1a2e]` or `w-[420px]`.
- **Non-Destructive**: Do not replace the entire `className` string. Keep flex, grid, positioning, and responsive variants (`md:`, `hover:`) intact.
- Detailed codemod rules: [tailwind-rewriting.md](references/tailwind-rewriting.md).

### Inline Styles & CSS Modules
- If the component uses CSS Modules, edit the file listed in `bucket.cssFiles[0]`.
- If the component uses inline styles or Vue/Svelte/Astro styles, apply changes to the respective template adapter.

---

## 4. Canvas Reparenting & Cross-Parent Drag

In Glide v1.1.0+, elements can be visually dragged from one container and dropped into another:
- The overlay detects the new parent and target sibling index.
- The server executes `reorderJSXElement(sourceFile, sourceLoc, newParentLoc, newIndex)`.
- Recast codemod detaches the JSX child from the source parent and splices it into the destination parent children array.

---

## 5. Conflict Resolution & Staged Edits Buffer

### Property-Level LWW Delta Queue
When multiple edits occur rapidly (e.g. slider adjustments or concurrent prop changes):
- Conflicts resolve per `(nodeId, propKey)` with independent logical clocks.
- Edits to `width` never clobber edits to `backgroundColor`.
- Outdated timestamps are rejected with `STALE_PROPERTY_WRITE`.

### Staged Edits Buffer
- To batch changes across multiple components without triggering continuous Vite HMR cycles, use the staged edits buffer.
- Live preview renders instantaneously via DOM patch.
- Review pending count in the staging bar, then execute batch commit to disk.

---

## 6. Multi-Framework Support

Glide provides native AST adapters across 5 major web frameworks:
- **React / TSX**: Recast + Babel parser for fine-grained JSX AST transforms.
- **Vue SFC**: `@vue/compiler-sfc` preserving script/style blocks and rewriting `<template>`.
- **Svelte**: `svelte/compiler` template rewrite with script/style isolation.
- **Astro**: Frontmatter fence (`---`) preservation with template AST write-back.
- **HTML**: Static HTML DOM attribute and class manipulation.

Refer to [framework-adapters.md](references/framework-adapters.md) for framework-specific nuances and examples.

---

## 7. Progressive Disclosure References

Load these reference documents into context only when dealing with their specific domains:

| Reference | When to Consult |
|:---|:---|
| [references/architecture.md](references/architecture.md) | Deep dive on In-Memory SceneGraph, WebSocket protocol, LWW DeltaQueue, and AST engine |
| [references/framework-adapters.md](references/framework-adapters.md) | Framework-specific write-back rules for React, Vue, Svelte, Astro, and HTML |
| [references/tailwind-rewriting.md](references/tailwind-rewriting.md) | Complete utility prefix map and AST regex patterns for Tailwind class editing |
| [references/staged-edits.md](references/staged-edits.md) | Transactional batch staging bar and zero-flicker live drag coordination |
