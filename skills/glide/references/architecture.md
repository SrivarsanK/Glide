# Glide Architectural Engine Deep Dive

This document details the internal mechanisms of Glide's bidirectional visual engine, inspired by the spatial rendering architecture of Figma and the generative AST coupling of Vercel v0.

---

## 1. In-Memory SceneGraph (`packages/overlay/src/scene-graph.ts`)

Traditional browser-based visual tools rely on `document.elementFromPoint(x, y)` to detect the clicked element under the cursor. In a production visual designer, this fails because:
1. Canvas zoom (`scale(N)`) and pan transforms distort DOM screen coordinates.
2. Transparent overlays, click-through handles, or selection halos obscure elements.
3. SVG paths, canvas elements, and deeply nested flex layouts frequently miss hit-tests.

### SceneGraph Solution
Glide builds an in-memory spatial tree mirroring the document hierarchy:

```ts
interface SceneNode {
  id: string;          // data-gl-source (e.g. "src/App.tsx:12:4")
  file: string;
  line: number;
  col: number;
  rect: DOMRect;       // Cached bounding rect in canvas space
  children: SceneNode[];
  parent: SceneNode | null;
}
```

- **Spatial Index**: Evaluates hit tests in O(log n) time against cached bounding boxes.
- **Matrix Awareness**: Normalizes click coordinates through the canvas viewport transform matrix before querying nodes.
- **Dynamic Invalidation**: When an element is resized, scrolled, or updated, only affected subtrees are re-measured.

---

## 2. Bidirectional Code-to-Canvas Synchronization

Glide maintains a closed-loop synchronization loop between external code edits and the active canvas:

```
External File Saved in IDE
            │
            ▼
Chokidar File Watcher in ws-server.ts
            │
            ▼
parseJSXElements extracts { id, line, col }
            │
            ▼
WS Broadcast: { type: 'scene_update', nodes: [...] }
            │
            ▼
Overlay sceneGraph.patch(nodes) updates spatial tree
(No iframe reload, zero visual flicker)
```

---

## 3. Property-Level Delta Queue & LWW (`packages/server/src/delta-queue.ts`)

In collaborative or rapid local editing environments, whole-node or whole-file Last-Writer-Wins (LWW) leads to lost updates (e.g., changing width clobbering an incoming background color update).

Glide solves this with a **Property-Level Delta Queue**:
- Every edit is identified by a composite key: `(nodeId, propKey)`.
- Each property maintains an independent logical timestamp clock:
  ```ts
  class PropertyDeltaQueue {
    private clocks: Map<string, number> = new Map(); // "nodeId::prop" -> timestamp
    private pending: Map<string, PendingOp> = new Map();
  }
  ```
- **Stale Write Rejection**: If an edit arrives with `timestamp < currentClock`, the server rejects the edit with `STALE_PROPERTY_WRITE`.
- **Optimistic ACKs**: Edits queued locally are acknowledged with an `ACK_OP` message once AST write-back succeeds.

---

## 4. Component Definition Resolution (`packages/core/src/resolve.ts`)

When an element on canvas is an instantiated sub-component (e.g. `<HeroCard title="Welcome" />`), modifying its internal layout requires opening its defining file rather than the caller file.

`resolveComponentDefinition` performs this trace:
1. Parses the caller file AST using Babel traverse.
2. Identifies the import declaration matching the component name (`import { HeroCard } from './HeroCard'`).
3. Resolves the imported relative path against project aliases and extension rules (`.tsx`, `.jsx`, `.ts`, `.js`).
4. Locates the component's declaration coordinate in the target file.
5. Emits `open_component` over WebSocket to open the file in the developer's editor.

---

## 5. WebSocket Protocol Reference

| Message Type | Direction | Payload | Description |
|:---|:---|:---|:---|
| `edit` | Client → Server | `{ file, line, col, change, timestamp }` | Apply AST modification |
| `reparent` | Client → Server | `{ sourceId, newParentId, newIndex }` | Move element into new parent |
| `resolve_component` | Client → Server | `{ file, line, col, componentName }` | Trace sub-component definition |
| `open_component` | Client → Server | `{ file, line, col }` | Request editor to open definition file |
| `scene_update` | Server → Client | `{ file, nodes: SceneNodeUpdate[] }` | Hot-patch overlay SceneGraph |
| `ACK_OP` | Server → Client | `{ nodeId, prop, timestamp }` | Confirm successful property write |
| `GET_PENDING_OPS` | Client → Server | `{}` | Query active pending operation snapshot |
| `file_changed` | Server → Client | `{ file }` | General file watcher modification notice |
