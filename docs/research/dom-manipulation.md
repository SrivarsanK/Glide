# DOM Manipulation Research - Analysis

## Executive Summary

Visual editors occupy a complex technical intersection between direct graphical manipulation and structured document layout. This analysis synthesizes findings from 16 primary sources—including industry-defining visual editors (Figma, Webflow, Squarespace, tldraw, Excalidraw, Craft.js), state-of-the-art interaction libraries (Moveable.js, dnd-kit, Pragmatic Drag and Drop, Selection Area), and foundational HCI academic literature (Shneiderman, Norman et al., Beaudouin-Lafon, Oney et al.).

The core challenge in visual web application editing is bridging the gap between high-frequency user input ($60\text{ fps}$ mouse drag, resize, rotate, and marquee selection) and source code AST integrity. While vector graphics tools like Figma discard DOM layout in favor of WebAssembly scene graphs rendered on GPU WebGL canvases, web code editors must preserve standard CSS box-model fidelity, responsive flex/grid dynamics, and developer-formatted source code.

For **Glide**, the optimal paradigm is a **Hybrid Sandboxed DOM Canvas + High-Performance Control Overlay**. User components render natively inside an isolated `<iframe>` DOM, preserving framework styling and runtime behavior. Interaction instruments (selection bounding boxes, resize handles, snap guides, and multi-select marquees) are managed in a transparent SVG/DOM overlay using fine-grained reactivity and spatial indexing (Kd-Tree/QuadTree). Live dragging manipulates lightweight CSS transforms (`translate3d`), deferring concrete Concrete Syntax Tree (CST) mutations until drop confirmation to eliminate layout thrashing and maintain pristine source code formatting.

---

## Key Technical Findings

### Visual Editor Architecture Patterns

Analysis of leading commercial visual editors reveals three dominant DOM architectural patterns:

| Editor | Rendering Pipeline | Component Isolation | Layout Engine | CST / AST Mutation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Figma** | C++ Wasm Scene Graph + WebGL Canvas | Complete (Custom Wasm Memory) | Absolute spatial bounding hierarchy | Custom binary IPC to CRDT model |
| **Webflow** | Sandboxed `<iframe>` DOM | CSS scope isolation + Shadow DOM | Native CSS Box Model (Flex, Grid, Absolute) | AST diffing with VDOM DOM patching |
| **Squarespace** | Fluid Engine (CSS Grid + DOM) | Component container blocks | 2D CSS Grid occupancy matrix | Coordinate-to-Grid-Span transformation |
| **tldraw** | Pure React DOM + Canvas Wrapper | Component shape wrappers | Relative / Absolute CSS transforms | Fine-grained reactive signals state store |

* **Figma's Wasm/Canvas Model**: Bypasses the DOM entirely for the canvas to prevent layout reflows and DOM thrashing across thousands of elements. However, editor controls (toolbars, sidebars, layers panel) remain native DOM components layered above the canvas.
* **Webflow's Sandboxed Iframe**: Renders user projects inside an `<iframe>`. This isolates the editor's UI styles from user CSS and vice-versa, guaranteeing that layout measurements inside the canvas reflect true browser rendering.
* **Squarespace's Fluid Engine**: Solves the absolute-to-responsive layout dilemma. Users drag items freely in absolute pixel space during interaction; upon release, a 2D grid collision matrix snaps pixel coordinates to `grid-column` and `grid-row` spans.

### Drag & Drop Implementations

Standard HTML5 Drag and Drop APIs suffer from poor cross-browser visual customization and DOM manipulation overhead. Modern visual editors utilize two advanced approaches:

1. **Native Primitives with Low-Level Adapters (Pragmatic Drag and Drop)**:
   * Uses native browser drag events as lightweight event triggers rather than heavy React wrapper components.
   * Decouples drag logic into element adapters (`draggable()`, `dropTarget()`).
   * Eliminates React state updates during drag movement by updating drag ghost elements directly in isolated DOM layers.

2. **Decoupled Sensor & Sensor-Modifier Systems (dnd-kit)**:
   * Abstracted sensors monitor pointer, touch, and keyboard events seamlessly.
   * Dragged elements receive real-time updates via CSS `translate3d(x, y, 0)` applied directly through refs, completely avoiding browser layout recalculations (`top`, `left`, `margin`).
   * Mathematical collision algorithms (`rectIntersection`, `closestCenter`, `closestCorners`, `pointerWithin`) calculate drop targets based on bounding box geometry rather than native DOM drag-over events.

### Selection Systems

Selection systems in visual editors must support single clicks, multi-select toggles, marquee box drags, and freehand lasso selections across deep element hierarchies.

* **Spatial Partitioning (QuadTree / Kd-Tree)**: Brute-force $O(N)$ bounding box intersection checks stall the UI when element counts exceed a few hundred nodes. Partitioning 2D space recursively into a QuadTree or Kd-Tree reduces candidate intersection queries to $O(\log N)$.
* **Marquee Drag Performance**: To prevent React re-renders from degrading drag performance, spatial trees and marquee coordinates are retained inside mutable references (`useRef`), updating selection state overlays via raw DOM attributes.
* **Lasso Selection (Ray Casting)**: Point-in-polygon checks utilize the Ray Casting algorithm: a horizontal ray is projected from the target point to infinity; an odd number of boundary edge intersections signifies that the element is inside the lasso polygon.

### Resize & Transform

Manipulating DOM elements across flexbox, grid, and absolute positioning requires converting raw screen coordinates into local element space, especially when CSS transforms (`rotate`, `scale`) are applied.

* **Matrix Decomposition**: CSS transform matrices ($\text{matrix}(a, b, c, d, tx, ty)$) are unpacked into discrete components:
  $$\theta = \operatorname{atan2}(b, a), \quad S_x = \sqrt{a^2 + b^2}, \quad S_y = \sqrt{c^2 + d^2}$$
* **Rotated Resize Drift Correction**: Resizing a rotated element using screen-space delta $(\Delta x_{screen}, \Delta y_{screen})$ causes origin drift. Multiplying the screen delta by the inverse rotation matrix transforms pointer movements into local element delta $(\Delta x_{local}, \Delta y_{local})$:
  $$\begin{bmatrix} \Delta x_{local} \\ \Delta y_{local} \end{bmatrix} = \begin{bmatrix} \cos(-\theta) & -\sin(-\theta) \\ \sin(-\theta) & \cos(-\theta) \end{bmatrix} \begin{bmatrix} \Delta x_{screen} \\ \Delta y_{screen} \end{bmatrix}$$

### Canvas vs DOM Decision Framework

Selecting between Canvas rendering, pure DOM rendering, or a hybrid model depends on specific editor requirements:

```
                          ┌───────────────────────────┐
                          │   Visual Editor Needs     │
                          └─────────────┬─────────────┘
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             ▼                                                     ▼
┌──────────────────────────┐                             ┌──────────────────────────┐
│  Graphic Design / Vector │                             │   Web / UI App Building  │
│  (10,000+ vector shapes) │                             │   (React, Vue, Svelte)   │
└────────────┬─────────────┘                             └────────────┬─────────────┘
             │                                                        │
             ▼                                                        ▼
┌──────────────────────────┐                             ┌──────────────────────────┐
│       PURE CANVAS        │                             │    HYBRID DOM + OVERLAY   │
│  - WebAssembly + WebGL   │                             │  - Sandboxed DOM Canvas  │
│  - Custom BVH SceneGraph │                             │  - Transparent SVG Control│
│  - High throughput       │                             │  - Direct CST/AST Code   │
└──────────────────────────┘                             └──────────────────────────┘
```

* **Pure Canvas**: Essential for graphic tools (Figma) handling thousands of vector paths. Non-viable for web code editors due to loss of native CSS box model, semantic HTML, text wrapping, and accessibility tree integration.
* **Pure DOM**: Simplest implementation. Viable for lightweight whiteboards (tldraw), but risks performance degradation if high-frequency interaction tools (resize handles, snap lines) force layout reflows across the entire document tree.
* **Hybrid Sandboxed DOM Canvas + Overlay (Recommended for Glide)**: Combines standard DOM rendering for user application components (inside an isolated `<iframe>`) with an independent high-performance SVG/DOM overlay layer for selection boxes and snap guides.

---

## Most Relevant Papers & Sources

### 1. Figma WebAssembly & Canvas Architecture (Evan Wallace, 2016/2022)
* **Summary**: Details Figma's custom rendering engine written in C++ and compiled to WebAssembly. Scene objects reside in contiguous Wasm memory and render to a single WebGL `<canvas>`. React is used solely for the editor UI chrome.
* **Key Takeaway for Glide**: Emphasizes isolating high-frequency editing controls from document model rendering. While Glide requires a real DOM for code fidelity, editor controls must run on a decoupled overlay.

### 2. Webflow Sandboxed Iframe & DOM Mutation Engine (Webflow Engineering, 2021/2023)
* **Summary**: Explains Webflow's isolation layer. User components execute inside an `<iframe>` bridge, preventing CSS contamination between editor controls and user styles. Visual edits mutate an AST model, which incrementally updates the iframe DOM.
* **Key Takeaway for Glide**: Confirms the necessity of an iframe sandbox for rendering user components while editing React/Vue/Svelte source code.

### 3. Moveable.js & Matrix Transform Decomposition (Younkue Choi, 2019/2024)
* **Summary**: Provides mathematical algorithms for inspecting, scaling, rotating, and warping DOM elements. Employs 2D/3D CSS matrix decomposition to handle complex nested transforms without coordinate drift.
* **Key Takeaway for Glide**: Essential reference for implementing visual handles and transformation overlays across rotated and nested layout containers.

### 4. Selection Area & Spatial Indexing (Simon Wep / Emanuele Feronato, 2023)
* **Summary**: Demonstrates QuadTree space partitioning and ray-casting algorithms for marquee box and lasso selections, reducing selection candidate checks from $O(N)$ to $O(\log N)$.
* **Key Takeaway for Glide**: Provides the spatial indexing foundation required for smooth multi-element marquee selection and smart guide alignment checks.

### 5. CSS Stacking Contexts & Layer Panel Architecture (MDN & Philip Walton, 2021/2024)
* **Summary**: Analyzes local stacking context creation rules (`position`, `z-index`, `opacity`, `transform`, `isolation`). Details why `z-index` manipulations fail across different parent stacking contexts.
* **Key Takeaway for Glide**: Layer rearrangement ("push on top", "push behind") must default to DOM node sibling reordering for in-flow/flex layouts, reserving `z-index` adjustments strictly for absolute positioning contexts.

### 6. tldraw Architecture & Reactive Signals Store (Steve Ruiz et al., 2021-2024)
* **Summary**: Proves that infinite visual canvas editors can run at $60\text{ fps}$ on React DOM using fine-grained reactivity (`@tldraw/state` signals) and hardware-accelerated container transforms (`translate3d`).
* **Key Takeaway for Glide**: Demonstrates how fine-grained reactivity allows overlay controls to update instantly without triggering React component tree re-renders.

### 7. Direct Manipulation & HCI Foundations (Shneiderman 1983; Hutchins, Hollan, & Norman 1985)
* **Summary**: Introduces direct manipulation principles, the **Gulf of Execution** (gap between user intent and system actions), and **Gulf of Evaluation** (effort to interpret system feedback).
* **Key Takeaway for Glide**: Visual feedback instruments (snapping lines, live dimensions) bridge the Gulfs of Execution and Evaluation, making code AST transformations intuitive.

### 8. Code-DOM Synchronization & Directness (Steve Oney et al., 2012/2014)
* **Summary**: Investigates visual software development tools and the code-GUI synchronization problem. Demonstrates that preserving developer formatting (comments, whitespace, structure) is critical for developer adoption.
* **Key Takeaway for Glide**: Directly validates Glide's core principle: *Source Code Integrity First*. Visual transformations must map cleanly to minimal CST edits.

---

## Relevance to Glide

### Direct Applications

1. **Decoupled SVG/DOM Control Overlay**:
   Render selection handles, drag bounding boxes, and smart snap lines in a transparent SVG/DOM layer overlaid on top of the iframe canvas. This keeps editor controls completely out of the user's React/Vue/Svelte component tree.
2. **QuadTree / Kd-Tree Spatial Indexing**:
   Build an in-memory spatial index of component bounding rects inside the canvas viewport. Use this index for fast marquee selection and real-time smart guide alignment checks ($O(\log N)$ complexity).
3. **Matrix Transform Resizing**:
   Integrate matrix decomposition math into Glide's resize handle logic to allow accurate resizing and transformation of scaled, rotated, or flex-positioned components.

### Architecture Recommendations

```
┌────────────────────────────────────────────────────────────────────────┐
│                        GLIDE EDITOR CONTAINER                          │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     SVG / DOM CONTROL OVERLAY                    │  │
│  │  - Selection Box & Resize Handles                                │  │
│  │  - Smart Snap Alignment Guides (Kd-Tree Query)                   │  │
│  │  - Marquee Selection Rectangle                                   │  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
│                                    │ Coordinates / Pointer Sync        │
│  ┌─────────────────────────────────▼────────────────────────────────┐  │
│  │                    SANDBOXED IFRAME CANVAS                       │  │
│  │  - User Application Code (React / Vue / Svelte)                  │  │
│  │  - Isolated CSS & Runtime Execution Environment                  │  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
│                                    │ DOM Mutation Observer             │
└────────────────────────────────────┼───────────────────────────────────┘
                                     │
                                     ▼
                     ┌──────────────────────────────┐
                     │     CST MUTATION ENGINE      │
                     │  - Minimal AST Patching      │
                     │  - Format-Preserving Edits   │
                     └──────────────────────────────┘
```

1. **Sandboxed Iframe Core**: Mount the user application inside an isolated `<iframe>` canvas. Communication with the main editor frame takes place via a structured window message bridge.
2. **Two-Stage Drag & Commit Pipeline**:
   * **Stage 1 (Fluid Drag)**: Drag movements manipulate overlay transforms via CSS `translate3d(x, y, 0)` at $60\text{ fps}$.
   * **Stage 2 (Commit on Drop)**: Upon drag release, compute the final positional delta, resolve target layout context (Flex, Grid, or Absolute), and dispatch a single atomic CST mutation to the source code file.
3. **Context-Aware Layer Rearrangement**:
   When users trigger layer ordering actions ("push behind", "push on top"):
   * For **Flow / Flex / Grid** layouts: Reorder child CST nodes within the parent container's child array (`parent.insertBefore`).
   * For **Absolute** layouts: Adjust the `z-index` property on the target CST node.

### Future Considerations

* **Fluid-to-Grid CSS Span Conversion**: Implement Squarespace Fluid Engine matrix mechanics to convert drag coordinates into native `grid-column` and `grid-row` spans when dropping items into CSS Grid containers.
* **Overlay Text Editing**: Follow Excalidraw's pattern for inline text updates: mount a styled `<textarea>` in the overlay layer directly over target AST text nodes during editing, committing changes on blur.

---

## Implementation Roadmap

```
Phase 1: Sandboxed Canvas & Overlay Core
├── Implement sandboxed <iframe> rendering environment
├── Establish frame-to-iframe pointer coordinate translation bridge
└── Create high-performance SVG/DOM control overlay container

Phase 2: Spatial Indexing & Marquee Selection
├── Implement Kd-Tree / QuadTree spatial index for canvas DOM nodes
├── Add marquee box drag selection using spatial query filtering
└── Add Ray-Casting algorithm for freehand lasso selection

Phase 3: Transformation Engine & Handle Math
├── Integrate 2D matrix decomposition (rotation, scale, translate)
├── Implement delta coordinate conversion for rotated element resizing
└── Build snapping engine with Kd-Tree alignment queries

Phase 4: Drag & Drop Layer Pipeline
├── Integrate Pragmatic Drag & Drop / dnd-kit sensor adapters
├── Implement two-stage drag pipeline (live transform -> drop commit)
└── Implement flow DOM reordering vs absolute z-index layer resolution

Phase 5: CST Integration & Dynamic Layouts
├── Wire drop confirmation events to atomic CST file mutations
└── Implement dynamic CSS Grid cell span snapping (Fluid Engine pattern)
```

---

## Code Patterns & Snippets

### 1. Matrix Decomposition & Delta Transformation

```ts
/**
 * Unpacks 2D CSS matrix into rotation angle and scale factors.
 */
export function decomposeMatrix2D(a: number, b: number, c: number, d: number) {
  const rotation = Math.atan2(b, a);
  const scaleX = Math.sqrt(a * a + b * b);
  const scaleY = Math.sqrt(c * c + d * d);
  return { rotation, scaleX, scaleY };
}

/**
 * Transforms screen pointer drag delta (dx, dy) into element's local space,
 * correcting for rotation drift during resize operations.
 */
export function transformScreenDeltaToLocal(
  screenDx: number,
  screenDy: number,
  rotationRad: number
): { localDx: number; localDy: number } {
  const cos = Math.cos(-rotationRad);
  const sin = Math.sin(-rotationRad);
  return {
    localDx: screenDx * cos - screenDy * sin,
    localDy: screenDx * sin + screenDy * cos
  };
}
```

### 2. Ray-Casting Point-in-Polygon (Lasso Selection)

```ts
export interface Point { x: number; y: number; }

/**
 * Determines whether a point lies inside a polygon using Ray-Casting algorithm.
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let isInside = false;
  const { x, y } = point;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersect) isInside = !isInside;
  }

  return isInside;
}
```

### 3. Rect Intersection Collision Math (dnd-kit Pattern)

```ts
export interface Rect { left: number; top: number; right: number; bottom: number; }

/**
 * Calculates intersection area between two bounding rectangles.
 */
export function getIntersectionArea(rectA: Rect, rectB: Rect): number {
  const width = Math.max(0, Math.min(rectA.right, rectB.right) - Math.max(rectA.left, rectB.left));
  const height = Math.max(0, Math.min(rectA.bottom, rectB.bottom) - Math.max(rectA.top, rectB.top));
  return width * height;
}
```

### 4. Pragmatic Drag & Drop Element Connector

```ts
import { draggable, dropTarget } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';

export function attachCanvasElementConnectors(
  element: HTMLElement,
  nodeId: string,
  onDrop: (targetId: string) => void
) {
  const cleanupDraggable = draggable({
    element,
    getInitialData: () => ({ nodeId, type: 'GLIDE_CST_NODE' })
  });

  const cleanupDropTarget = dropTarget({
    element,
    getData: () => ({ nodeId }),
    onDrop: ({ source }) => {
      if (source.data.type === 'GLIDE_CST_NODE') {
        onDrop(nodeId);
      }
    }
  });

  return () => {
    cleanupDraggable();
    cleanupDropTarget();
  };
}
```
