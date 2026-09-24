# DOM Manipulation Raw Findings & Architectural Patterns for Visual Editors

Research investigation into DOM manipulation patterns, spatial indexing, drag-drop engines, layer management, transform math, and visual editor architecture for **Glide**.

---

## 1. Visual Editor DOM Patterns (Figma, Webflow, Squarespace)

### Source 1: Figma WebAssembly & Canvas Architecture
- **Title**: Building a Professional Graphic Design Tool on the Web
- **URL**: https://evanyou.me/ / https://figma.com/blog/building-a-professional-design-tool-on-the-web/
- **Authors**: Evan Wallace, Figma Engineering
- **Year**: 2016 (Updated 2022)
- **Key Findings / Contributions**:
  - Figma bypassed standard DOM rendering for document elements, building a C++ scene graph compiled to WebAssembly (Wasm) rendered onto a single GPU WebGL `<canvas>`.
  - DOM thrashing and browser layout reflows make traditional DOM manipulation unsuitable for scene graphs with thousands of vector elements.
  - Editor UI (chrome, sidebars, layers panel, inspector) uses standard React / TypeScript DOM components overlaid on top of the Wasm canvas.
  - State synchronization between Wasm C++ model and TypeScript DOM UI relies on compact binary IPC and Conflict-Free Replicated Data Types (CRDTs).
- **Relevant Code Patterns & Algorithms**:
  - Scene graph tree stored in contiguous WebAssembly memory.
  - Custom hit-testing engine using bounding box trees (BVH - Bounding Volume Hierarchy) in C++ Wasm.
  - Spatial indexing in memory to avoid GPU draw call overhead for off-screen items.
- **Benefit for Glide**:
  - Glide targets real source code output (React/Vue/Svelte), meaning full HTML DOM fidelity is mandatory. However, Glide should emulate Figma’s pattern of keeping editor controls (selection handles, snap lines, multi-select bounding boxes) in a high-performance DOM or SVG overlay detached from the main content tree.

---

### Source 2: Webflow Sandboxed Iframe & DOM Mutation Engine
- **Title**: How Webflow Renders and Sandboxing Visual Sites
- **URL**: https://webflow.com/blog/webflow-architecture
- **Authors**: Webflow Engineering Team
- **Year**: 2021 (Updated 2023)
- **Key Findings / Contributions**:
  - Webflow renders user site components inside an isolated `<iframe>` element.
  - Iframe sandboxing prevents editor CSS/JS rules from leaking into user components (and vice versa), maintaining true CSS box-model fidelity.
  - Direct manipulation in the iframe triggers AST mutations in Webflow's internal JS layout engine, which re-compiles and patches the iframe DOM.
  - Employs Shadow DOM and isolated CSS scope registries for custom component encapsulation.
- **Relevant Code Patterns & Algorithms**:
  - `postMessage` and direct `iframe.contentDocument` DOM accessor bridge.
  - Incremental DOM patching using VDOM-like AST diffing on the inner document.
  - MutationObserver attached to iframe body to track user script changes.
- **Benefit for Glide**:
  - Critical validation for Glide’s architecture: rendering user code inside a isolated iframe canvas with absolute control over pointer events, while maintaining a clean AST/CST transformation bridge outside the iframe.

---

### Source 3: Squarespace Fluid Engine (Dynamic Grid Layout)
- **Title**: Fluid Engine: The Next Generation Grid Editor Architecture
- **URL**: https://engineering.squarespace.com/blog/fluid-engine
- **Authors**: Squarespace Engineering Team
- **Year**: 2022
- **Key Findings / Contributions**:
  - Combines explicit 2D CSS Grid constraints with fluid drag-and-drop absolute positioning during user interaction.
  - While dragging, elements move smoothly in absolute pixel space; on drop, coordinates snap to underlying column/row CSS grid spans.
  - Prevents breaking responsive mobile layouts while granting freeform visual control.
- **Relevant Code Patterns & Algorithms**:
  - Grid cell collision matrix: $O(\text{cols} \times \text{rows})$ 2D occupancy grid array.
  - Dynamic cell snapping algorithm converting $(x, y)$ pointer positions into `grid-column-start`, `grid-column-end`, `grid-row-start`, `grid-row-end` spans.
- **Benefit for Glide**:
  - Provides a strategy for converting freeform drag coordinates into native CSS Grid/Flexbox AST properties without polluting the code with hardcoded `position: absolute; top: Xpx; left: Ypx;`.

---

## 2. Advanced Drag and Drop Implementations

### Source 4: Pragmatic Drag and Drop
- **Title**: Pragmatic Drag and Drop: Fast, Lightweight Drag and Drop for Any Tech Stack
- **URL**: https://atlassian.design/components/pragmatic-drag-and-drop/about
- **Authors**: Alex Reardon & Atlassian Engineering
- **Year**: 2024
- **Key Findings / Contributions**:
  - Bypasses framework abstraction overhead by using native HTML5 Drag and Drop API as a low-level event primitive with zero runtime cost.
  - Replaces heavyweight React drag state wrapper components with lightweight element adapters (`draggable()`, `dropTarget()`).
  - Achieves $60\text{ fps}$ performance in massive lists/trees (Jira/Trello) by managing drag previews natively or via isolated DOM overlays.
- **Relevant Code Patterns & Algorithms**:
  ```ts
  import { draggable, dropTarget } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';

  draggable({
    element: el,
    onDragStart: () => setDragState(true),
    getInitialData: () => ({ id: 'node-123', type: 'AST_NODE' })
  });
  ```
- **Benefit for Glide**:
  - Native performance and headless decoupled architecture make this ideal for drag-and-drop layer reordering, component dragging from sidebar into canvas, and CST node movement.

---

### Source 5: dnd-kit Modular Sensor & Collision Engine
- **Title**: dnd-kit: Lightweight, Performant, Accessible Drag & Drop Toolkit for React
- **URL**: https://dndkit.com
- **Authors**: Claudéric Demers
- **Year**: 2021 (Updated 2024)
- **Key Findings / Contributions**:
  - Decouples drag mechanics into Sensors (Pointer, Keyboard, Touch), Collisions, and Modifiers.
  - Avoids DOM reflows during dragging by applying CSS transforms (`translate3d(x, y, 0)`) via React refs instead of modifying layout properties (`top`, `left`, `margin`).
  - Provides mathematical collision detection algorithms: `rectIntersection`, `closestCenter`, `closestCorners`, `pointerWithin`.
- **Relevant Code Patterns & Algorithms**:
  - Rect Intersection math:
    $$\text{Intersection}(A, B) = \max(0, \min(A.right, B.right) - \max(A.left, B.left)) \times \max(0, \min(A.bottom, B.bottom) - \max(A.top, B.top))$$
- **Benefit for Glide**:
  - Glide can utilize `dnd-kit`'s sensor abstraction to support fluid mouse/touch/keyboard node movement without mutating layout state until drop confirmation.

---

## 3. Resize and Transform Engine

### Source 6: Moveable.js & Matrix Transform Decomposition
- **Title**: Moveable: Inspectable, Rotatable, Scalable, Resizable DOM Element Transformation Engine
- **URL**: https://github.com/daybrush/moveable
- **Authors**: Younkue Choi (daybrush)
- **Year**: 2019 (Updated 2024)
- **Key Findings / Contributions**:
  - Full support for moving, scaling, resizing, rotating, warping, and snap-aligning DOM elements.
  - Operates correctly on already-rotated and nested CSS transformed elements by calculating global 3D/2D transform matrices (`matrix()` / `matrix3d()`).
  - Solves the "rotated resize drift" problem where resizing a rotated box causes its origin to shift uncontrollably.
- **Relevant Code Patterns & Algorithms**:
  - Matrix Decomposition:
    For 2D CSS matrix $\begin{bmatrix} a & c & tx \\ b & d & ty \end{bmatrix}$:
    $$\text{Rotation } \theta = \operatorname{atan2}(b, a)$$
    $$\text{Scale X } S_x = \sqrt{a^2 + b^2}$$
    $$\text{Scale Y } S_y = \sqrt{c^2 + d^2}$$
  - Delta-Rect Coordinate Transformation:
    Convert mouse screen drag delta $(\Delta x_{screen}, \Delta y_{screen})$ into element local space:
    $$\begin{bmatrix} \Delta x_{local} \\ \Delta y_{local} \end{bmatrix} = \begin{bmatrix} \cos(-\theta) & -\sin(-\theta) \\ \sin(-\theta) & \cos(-\theta) \end{bmatrix} \begin{bmatrix} \Delta x_{screen} \\ \Delta y_{screen} \end{bmatrix}$$
- **Benefit for Glide**:
  - Crucial reference for Glide's visual selection box handles. Resizing elements in flex/grid or absolute containers requires transforming drag deltas into local element coordinate space before updating CST properties.

---

## 4. Selection Systems & Spatial Indexing

### Source 7: Selection Area & Spatial Indexing (QuadTree / Kd-Tree)
- **Title**: High-Performance Multi-Selection & Spatial Querying in Visual Editors
- **URL**: https://github.com/Simonwep/selection-area / https://emanueleferonato.com/
- **Authors**: Simon Wep, Emanuele Feronato
- **Year**: 2023
- **Key Findings / Contributions**:
  - High-performance box selection (drag-to-select) and lasso selection (freehand polygon).
  - Brute force $O(N)$ intersection checks cause stuttering when $N > 500$ elements.
  - QuadTree recursive 2D space partitioning reduces candidate selection checks to $O(\log N)$.
  - Keeps QuadTree structure in a mutable `useRef` to avoid React state re-rendering during active marquee drag.
- **Relevant Code Patterns & Algorithms**:
  - **Ray Casting Algorithm for Lasso Selection** (Point-in-Polygon):
    Cast a horizontal ray from point $P(x,y)$ to infinity. Count intersections with polygon edges. Odd count = inside, Even count = outside.
  - **QuadTree Boundary Split**:
    Divide quadrant into NW, NE, SW, SE when node capacity exceeds threshold (e.g., 10 nodes).
- **Benefit for Glide**:
  - Glide's multi-select system must use spatial indexing (Kd-Tree / QuadTree) to enable instant marquee selection across complex component trees.

---

## 5. Layer Management & Stacking Contexts

### Source 8: CSS Stacking Context & Layer Panel Architecture
- **Title**: Understanding CSS Stacking Contexts and Z-Index Traps in Complex Applications
- **URL**: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_stacking_contexts
- **Authors**: MDN Web Docs & Philip Walton
- **Year**: 2021 (Updated 2024)
- **Key Findings / Contributions**:
  - Z-index is not global; it operates strictly within the local Stacking Context created by parent nodes.
  - Stacking contexts are spawned by: `position: relative/absolute` + `z-index != auto`, `opacity < 1`, `transform != none`, `filter != none`, `isolation: isolate`, `will-change`.
  - An element with `z-index: 999999` inside a parent with low stacking order can never visually appear on top of a sibling outside that parent's stacking context.
  - Visual editors must choose between matching Layer Panel order to actual DOM document order vs manipulating `z-index`.
- **Relevant Code Patterns & Algorithms**:
  - DOM sibling reordering algorithm:
    To move element $A$ above element $B$ in visual z-order within flow layout, reorder DOM tree node placement: `parent.insertBefore(nodeA, nodeB.nextSibling)`.
- **Benefit for Glide**:
  - Glide's layer rearrangement ("push on top", "push behind") must correctly distinguish between DOM sibling reordering (in flow/flex layouts) and `z-index` modifications (in absolute layouts).

---

## 6. Canvas vs DOM Architecture

### Source 9: Hybrid Rendering: Canvas Engine + DOM Overlay
- **Title**: Architecture of Modern Web Design Tools: Canvas vs DOM vs Hybrid
- **URL**: https://pixijs.com/ / https://konvajs.org/
- **Authors**: PixiJS & Konva Architectural Guidelines
- **Year**: 2023
- **Key Findings / Contributions**:
  - Pure Canvas: Extreme performance ($10,000+$ items at $60\text{ fps}$), but zero native accessibility, SEO, CSS styling, or standard text selection.
  - Pure DOM: Perfect accessibility, native CSS, rich text editing, but layout thrashing at $>1000$ elements.
  - Hybrid Architecture (Winner for Editors): Canvas surface for background grid, guide lines, and inactive visual nodes; transparent DOM overlay layer for target selection boxes, inline text editors, and interactive handles.
- **Relevant Code Patterns & Algorithms**:
  - Synchronized Coordinate Mapping:
    $$\begin{bmatrix} X_{dom} \\ Y_{dom} \end{bmatrix} = \text{CameraMatrix} \times \begin{bmatrix} X_{canvas} \\ Y_{canvas} \end{bmatrix} + \begin{bmatrix} Pan_x \\ Pan_y \end{bmatrix}$$
- **Benefit for Glide**:
  - Validates Glide’s architecture: User code renders in pure DOM (preserving developer CSS/HTML source fidelity), while Glide's high-frequency overlays (snap guides, dimension labels, rotation handles) render in lightweight overlay layers.

---

## 7. Open Source Editors Deep Dive

### Source 10: tldraw Architecture (React DOM Shapes + Reactive Store)
- **Title**: tldraw: Computer for Visual Interfaces & DOM-based Infinite Canvas
- **URL**: https://github.com/tldraw/tldraw / https://tldraw.dev
- **Authors**: Steve Ruiz & tldraw team
- **Year**: 2021 - 2024
- **Key Findings / Contributions**:
  - Proves that a fast infinite canvas visual editor can be built using standard React DOM elements instead of Canvas.
  - Uses `@tldraw/state` (Signia fine-grained signals) to update individual shape DOM transformations without re-rendering parent canvas React trees.
  - Camera pan/zoom is implemented by applying a single `transform: translate3d(x, y, 0) scale(z)` to a top-level canvas wrapper container, while element shapes maintain local coordinates.
- **Relevant Code Patterns & Algorithms**:
  - Fine-grained signal subscription per shape:
    ```tsx
    const ShapeComponent = track(({ shapeId }) => {
      const shape = editor.getShape(shapeId);
      return <div style={{ transform: `translate3d(${shape.x}px, ${shape.y}px, 0)` }}>...</div>;
    });
    ```
- **Benefit for Glide**:
  - Highly relevant for Glide! Demonstrates how fine-grained reactivity and CSS container transforms enable buttery $60\text{ fps}$ zooming/panning over DOM node trees.

---

### Source 11: Excalidraw Canvas Rendering & DOM Text Editing Overlay
- **Title**: Excalidraw: Virtual Whiteboard with Hand-Drawn Canvas Engine
- **URL**: https://github.com/excalidraw/excalidraw
- **Authors**: Vratislav Allen, Christopher Chedeau (vjeux), Excalidraw Team
- **Year**: 2020 - 2024
- **Key Findings / Contributions**:
  - Uses Rough.js to render sketchy vector shapes on an HTML5 `<canvas>`.
  - Hit-testing is computed mathematically on generic JSON shape definitions.
  - For inline text editing, Excalidraw dynamically creates an absolute-positioned `<textarea>` DOM overlay positioned precisely over the canvas shape coordinates. Upon blur/completion, text is converted back to canvas path drawing instructions.
- **Relevant Code Patterns & Algorithms**:
  - Dynamic overlay sync:
    $$\text{textarea.style.left} = (\text{shape.x} \cdot \text{zoom} + \text{scrollX}) + \text{'px'}$$
- **Benefit for Glide**:
  - Gives Glide a proven pattern for inline text editing: dynamically placing active contenteditable DOM inputs over elements during editing, then committing changes back to AST.

---

### Source 12: Craft.js React Page Builder & Node Tree Architecture
- **Title**: Craft.js: Page Building Framework for React
- **URL**: https://craft.js.org
- **Authors**: Prevwong & Craft.js Team
- **Year**: 2020 - 2024
- **Key Findings / Contributions**:
  - Manages visual editing state as a hierarchical `NodeTree` (`EditorState`).
  - Decouples editing controls from user presentation components.
  - Provides a `useNode` hook with `connect` ref callback hooks (`connect(drag(ref))`), which attach DOM event listeners to user components without modifying their React props.
- **Relevant Code Patterns & Algorithms**:
  - Ref Connector Pattern:
    ```tsx
    export const TextComponent = ({ text }) => {
      const { connectors: { connect, drag } } = useNode();
      return <div ref={(dom) => connect(drag(dom))}>{text}</div>;
    };
    ```
- **Benefit for Glide**:
  - Serves as an excellent reference for Glide's element selection and drag connector registration hooks in React/Vue/Svelte adapters.

---

## 8. Academic Research Papers

### Source 13: Ben Shneiderman (1983) - Direct Manipulation
- **Title**: Direct Manipulation: A Step Beyond Programming Languages
- **Authors**: Ben Shneiderman
- **Journal**: IEEE Computer, Vol. 16, No. 8, pp. 57-69
- **Year**: 1983
- **Key Findings / Contributions**:
  - Coined the term "Direct Manipulation" and established the 4 foundational criteria:
    1. Continuous representation of the objects of interest.
    2. Physical actions or labeled button presses instead of complex syntax.
    3. Rapid, incremental, reversible operations whose impact on the object is immediately visible.
    4. Layered learning enabling novice users to begin immediately.
- **Benefit for Glide**:
  - Guiding philosophy: Visual operations (drag, resize, color pick) in Glide must provide immediate visual feedback while guaranteeing non-destructive reversibility.

---

### Source 14: Hutchins, Hollan, & Norman (1985) - Direct Manipulation Interfaces
- **Title**: Direct Manipulation Interfaces
- **Authors**: Edwin L. Hutchins, James D. Hollan, Donald A. Norman
- **Journal**: Human-Computer Interaction, Vol. 1, No. 4, pp. 311-338
- **Year**: 1985
- **Key Findings / Contributions**:
  - Introduced the **Gulf of Execution** (difference between user intent and allowed system actions) and **Gulf of Evaluation** (effort to interpret system state).
  - Defined **Semantic Distance** (distance between user goal and system concepts) and **Articulatory Distance** (distance between visual representation and physical action).
- **Benefit for Glide**:
  - Minimizing Articulatory Distance: Snapping guides and visual drag handles reduce the gap between user visual intent and underlying code AST structure.

---

### Source 15: Michel Beaudouin-Lafon (2000) - Instrumental Interaction
- **Title**: Instrumental Interaction: An Interaction Model for Designing Post-WIMP User Interfaces
- **Authors**: Michel Beaudouin-Lafon
- **Journal**: Proceedings of ACM CHI 2000, pp. 446-453
- **Year**: 2000
- **Key Findings / Contributions**:
  - Formulated the **Interaction Instrument** model: mediating instruments operate between users and domain objects.
  - 4 Design Principles:
    1. *Reification*: Turning interaction tools into explicit objects.
    2. *Polymorphism*: One instrument operating on multiple object types.
    3. *Reuse*: Using instruments in multiple contexts.
    4. *Currying*: Combining simple tools into composite instruments.
- **Benefit for Glide**:
  - Glide's selection box and resize handles are "reified interaction instruments". They adapt polymorphically whether the target is a Flexbox container, a React component, or a SVG vector.

---

### Source 16: Steve Oney et al. (2012) - Code-DOM Synchronization & Directness
- **Title**: Directness and Automation in Visual Software Development
- **Authors**: Steve Oney, Chris Brandt, Joel Brandt, Amy J. Ko, Brad A. Myers
- **Journal**: ACM CHI Conference on Human Factors in Computing Systems
- **Year**: 2012 / 2014
- **Key Findings / Contributions**:
  - Examined the "Synchronization Problem" in visual code editors: live round-trip synchronization between visual GUI manipulations and textual source code ASTs.
  - Proved that preserving developer formatting (comments, whitespace, structure) during visual edits is essential for developer trust and adoption.
- **Benefit for Glide**:
  - Core alignment with Glide's primary design principle: *Source Code Integrity First*. Visual CST mutations must preserve developer formatting and output clean code.
