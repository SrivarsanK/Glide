# Changelog

All notable changes to **Glide** (`@srivarsank/glide`) are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-09-24

### 🚀 Major Architectural Milestone (Figma/v0 Architecture Engine)

This release implements a production-grade bidirectional AST and canvas architecture inspired by the Figma spatial rendering model and Vercel v0 generative engine frameworks.

#### Added
- **In-Memory SceneGraph Engine (`packages/overlay/src/scene-graph.ts`)**:
  - Replaces DOM-fragile `document.elementFromPoint` with a cached spatial bounding rect hierarchy.
  - O(log n) zoom-aware and transform-aware hit testing across overlapping, deep, or transformed elements.
  - Selective invalidation and tree patching on resize, scroll, or file modification.
- **Bidirectional Code-to-Canvas Synchronization (`packages/server/src/ws-server.ts`)**:
  - Chokidar watcher triggers AST re-parse on external source code modifications.
  - Extracts `{ id, line, col }` element coordinate maps without triggering full iframe refreshes.
  - Emits `scene_update` WebSocket events directly patching the overlay's active SceneGraph.
- **Surgical Tailwind CSS Token Rewriting (`packages/ast-writer/src/css.ts`)**:
  - `rewriteTailwindToken` and `rewriteClassNameToken` functions for precise token replacement in `className` props.
  - Intelligently manages utility prefixes (`bg-`, `text-`, `w-`, `h-`, `p-`, `m-`, `rounded-`, `border-`) including arbitrary values (e.g. `bg-[#123456]`).
  - Preserves surrounding utility classes without clobbering or formatting degradation.
- **Canvas Cross-Parent Reparenting (`packages/ast-writer/src/reorder.ts`, `packages/server/src/ws-server.ts`)**:
  - Drag-and-drop elements across different containers visually on canvas.
  - `reparent` WebSocket handler invokes `reorderJSXElement` with new target parent and index, rewriting AST child hierarchies.
- **Component Definition Resolution & Jump Navigation (`packages/core/src/resolve.ts`, `packages/overlay/src/editor-html.ts`)**:
  - `resolveComponentDefinition` traces JSX component instantiations through `import` declarations to their origin files.
  - Added jump buttons in the Properties panel and Layers tree to immediately open component definitions in IDE / editor.
  - WebSocket protocol handlers `resolve_component` and `open_component`.
- **Property-Level Delta Queue & LWW Conflict Resolution (`packages/server/src/delta-queue.ts`)**:
  - Property-level Last-Writer-Wins (LWW) conflict engine keyed by `(nodeId, propKey)`.
  - Independent clocks for distinct properties of the same element prevent clobbering during simultaneous edits.
  - Rejects stale writes (`STALE_PROPERTY_WRITE`) and manages optimistic pending ops queue with timeout expiration and `ACK_OP` receipts.

#### Testing & Quality
- Added 39 new unit and integration tests across SceneGraph, AST JSX parsing, Tailwind rewriting, component resolution, and property-level delta queue.
- Total test coverage: 29 test suites, 219 tests passing.

---

## [1.0.47] - 2026-09-12

### Fixed
- Fixed color picker eyedropper tool state restoration and Chromium freeze guarding.
- Fixed element resizing generation synchronization.

---

## [1.0.46] - 2026-07-25

### Added
- Multi-framework template write-back support for Vue SFC, Svelte, Astro, and HTML.
- Component Registry auto-indexing (`glide-components.json`).
