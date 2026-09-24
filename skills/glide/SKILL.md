---
name: glide
description: >
  Authoritative guide for AI agents to operate, configure, and visually design
  applications using Glide (@srivarsank/glide). Covers the full Figma/v0
  bidirectional architecture: In-Memory SceneGraph, bidirectional AST sync,
  surgical Tailwind token rewriting, canvas cross-parent reparenting,
  component definition resolution, property-level LWW delta queue,
  staged edits buffer, and multi-framework adapters (React, Vue, Svelte, Astro, HTML).
---

# Glide — AI Agent Visual Design & Architecture Skill

## 1. Executive Summary & Mental Model

Glide is a **code-native visual design tool** that bridges visual direct manipulation with source code.
Unlike traditional visual builders that rely on proprietary JSON schemas, **the user's source code is the only source of truth**.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                GLIDE ENGINE                                     │
│                                                                                 │
│   Canvas Overlay (Browser)                      Server & AST Engine             │
│  ┌─────────────────────────┐                   ┌─────────────────────────────┐  │
│  │ In-Memory SceneGraph    │◄─── scene_update ─│ AST JSX Parser (Chokidar)   │  │
│  │ (zoom-aware hit-test)   │                   │ (bidirectional sync)        │  │
│  └────────────┬────────────┘                   └──────────────▲──────────────┘  │
│               │                                               │                 │
│          drag / click / edit                            file change             │
│               │                                               │                 │
│               ▼                                               ▼                 │
│  ┌─────────────────────────┐   WS edit msg     ┌─────────────────────────────┐  │
│  │ Staged Edits Buffer     │──────────────────►│ Property Delta Queue (LWW)  │  │
│  │ (instant live preview)  │                   │ (per-property clock resolution)│  │
│  └─────────────────────────┘                   └──────────────┬──────────────┘  │
│                                                               │                 │
│                                                        recast / babel           │
│                                                               ▼                 │
│                                                ┌─────────────────────────────┐  │
│                                                │ Source Code (TSX/Vue/Svelte)│  │
│                                                └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Pillars

### 2.1 In-Memory SceneGraph (`packages/overlay/src/scene-graph.ts`)
- **Problem solved**: Replaces fragile browser `document.elementFromPoint`, which breaks under CSS transforms, canvas zoom, overlapping layers, and SVG/Canvas children.
- **Implementation**: Maintains an in-memory spatial hierarchy of `SceneNode` bounding rects updated at `glide:ready` and patched dynamically.
- **Performance**: O(log n) hit-testing with transform and zoom matrix awareness.
- **Invalidation**: Receives `scene_update` messages on file edits to update node rects without reloading the iframe.

### 2.2 Bidirectional AST-to-Canvas Sync (`packages/server/src/ws-server.ts`)
- **Code-to-Canvas loop**: When code is changed externally in an IDE, Chokidar file watcher triggers an AST re-parse.
- **JSX coordinate extraction**: `parseJSXElements` extracts `{ id, line, col }` coordinates for all JSX elements.
- **Hot patching**: Server sends `{ type: 'scene_update', nodes: [...] }` over WebSocket. The overlay patches its `SceneGraph` without page reload or iframe flash.

### 2.3 Surgical Tailwind Token Rewriter (`packages/ast-writer/src/css.ts`)
- **Functions**: `rewriteTailwindToken(source, nodeId, prefix, newValue)` and `rewriteClassNameToken`.
- **Targeted utility replacement**: Intelligently swaps tokens matching utility prefixes:
  - Backgrounds: `bg-` (e.g. `bg-red-500`, `bg-[#123456]`, `bg-opacity-50`)
  - Sizing: `w-`, `h-`, `min-w-`, `max-w-`, `min-h-`, `max-h-`
  - Spacing: `p-`, `px-`, `py-`, `pt-`, `pb-`, `pl-`, `pr-`, `m-`, `mx-`, `my-`, `gap-`
  - Typography: `text-`, `font-`, `leading-`, `tracking-`
  - Borders: `rounded-`, `border-`, `border-t-`, `ring-`
- **Integrity preservation**: Surrounding utility classes, conditional expressions, and whitespace are completely preserved.

### 2.4 Canvas Cross-Parent Reparenting (`packages/ast-writer/src/reorder.ts`)
- **Cross-parent drop**: Canvas drag-and-drop detects when an element is dropped inside a different container.
- **AST reordering**: WebSocket dispatches `{ type: 'reparent', sourceId, newParentId, newIndex }`.
- **Recast codemod**: `reorderJSXElement` removes the node from the source parent and splices it into the destination parent's JSX children array at `newIndex`.

### 2.5 Component Definition Resolution & Jump Navigation (`packages/core/src/resolve.ts`)
- **Tracing import graphs**: When `data-gl-source` targets an instantiated custom component (e.g. `<HeroCard />`), `resolveComponentDefinition` traces its `import` statement in the AST to the defining file.
- **Jump navigation**: Exposes `{ type: 'resolve_component', file, line, col, componentName }` and `{ type: 'open_component' }`.
- **UI controls**: Jump icon button in both the Properties panel header and the Layers tree hierarchy opens the component definition directly.

### 2.6 Property-Level Delta Queue & LWW (`packages/server/src/delta-queue.ts`)
- **Conflict resolution**: Last-Writer-Wins (LWW) is enforced per `(nodeId, propKey)` rather than per-node or per-file.
- **Independent property clocks**: Rapid simultaneous edits to `width` and `backgroundColor` on the same node do not clobber each other.
- **Stale write guard**: Incoming writes carrying a timestamp older than the property's logical clock are rejected with `STALE_PROPERTY_WRITE`.
- **Optimistic operations**: Local pending operations are tracked and cleared on `ACK_OP` receipts or 5000ms timeouts.

### 2.7 Staged Edits Buffer (`packages/server/src/staged-edits.ts`)
- **Transaction mode**: Batches multiple edits across several components in memory before writing to disk.
- **Zero-flicker preview**: Live preview updates immediately via DOM manipulation without HMR reloads.
- **Staging bar**: Commit Changes writes all batched edits sequentially to disk; Discard All rolls back the preview.

### 2.8 Zero-Flicker Drag Coordinates (`glide-positions.json`)
- **Real-time dragging**: During live canvas drags, interim coordinates are written to `glide-positions.json` instead of mutating source TSX on every frame, eliminating Vite HMR thrashing.

---

## 3. Supported Frameworks & Adapters

| Framework | AST / Compiler | Write-Back Scope | Features |
|:---|:---|:---|:---|
| **React / TSX** | Recast + Babel parser | Class, inline styles, text, children | Full AST reordering, reparenting, Tailwind rewriting |
| **Vue SFC** | `@vue/compiler-sfc` | `<template>` classes, styles, text | Single File Component preservation |
| **Svelte** | `svelte/compiler` | Template elements, classes, text | Script and style block isolation |
| **Astro** | Custom SFC parser | Template elements, classes, text | Frontmatter (`---`) fence preservation |
| **HTML** | `html-dom-parser` | DOM attributes, classes, inline styles | Static HTML projects |

---

## 4. How AI Agents Must Interact with Glide

### 4.1 Discovering Components via Registry (`glide-components.json`)
Never guess source file paths. At project root, Glide generates `glide-components.json`:

```json
{
  "projectRoot": "/path/to/project",
  "framework": "react",
  "buckets": [
    {
      "name": "Button",
      "file": "/path/to/project/src/components/Button.tsx",
      "exportType": "named",
      "line": 5,
      "elements": [
        { "id": "src/components/Button.tsx:6:4", "tagName": "button", "isRoot": true, "classNames": ["btn", "btn-primary"] }
      ],
      "cssFiles": ["/path/to/project/src/components/Button.module.css"]
    }
  ]
}
```

1. Read `glide-components.json`.
2. Locate component bucket by `name` (e.g. `Button`).
3. Identify target element by `isRoot`, `tagName`, or `classNames`.
4. Use `element.id` as the exact target for style and layout modifications.

### 4.2 Editing Styles via Tailwind Utilities
When editing visual styles of elements:
- Prefer Tailwind classes over inline styles if the project uses Tailwind.
- Use surgical token replacements (e.g. replace `bg-blue-500` with `bg-indigo-600` without removing padding/flex utilities).

### 4.3 Git Safety & Staging
- Glide runs with a safe sandbox: verify changes visually or stage them before committing.
- Ensure `glide-components.json` and `glide-positions.json` are added to `.gitignore`.

---

## 5. CLI Commands & AI Harness Installation

```bash
# Start visual editor targeting local app
npx @srivarsank/glide 5173

# Explicitly install Glide skills to .agents/skills
npx @srivarsank/glide --install-skills

# Start with automatic skill installation confirmation
npx @srivarsank/glide 5173 --yes
```

### Supported AI Environments
Glide skills automatically integrate with:
- **Antigravity IDE**: `.agents/skills/`
- **Claude Code**: `.agents/skills/` & `.claude/skills/`
- **Cursor**: `.cursor/rules/glide.mdc` & `.cursorrules`
- **Windsurf**: `.windsurfrules`
- **GitHub Copilot**: `.github/copilot-instructions.md`
