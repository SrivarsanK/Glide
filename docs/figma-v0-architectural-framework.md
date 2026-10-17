# Architectural Frameworks of Modern Web-Native Design and Generative Engines: Figma and Vercel v0

## Executive Summary
Browser-based software has evolved beyond traditional Document Object Model (DOM) rendering trees and standard web APIs [90]. High-performance spatial vector editing and real-time agentic code generation require computational throughput, determinism, and state-synchronization guarantees that standard browser primitives cannot provide [90]. 

This technical report presents the structural frameworks of two web-native software engines: **Figma** [91], a WebAssembly-powered spatial vector rendering platform operating as a high-performance C++ graphics engine with a server-authoritative multiplayer protocol [91, 94, 102], and **Vercel v0** [91, 105], an agentic generative UI builder that unifies natural language prompts, visual direct manipulation, and production React source code via bidirectional Abstract Syntax Tree (AST) coupling [105, 110].

---

## 1. Technical Framework of Figma

Figma's core breakthrough was bringing desktop-class vector design into a browser tab without sacrificing performance [92, 223]. Traditional HTML/CSS DOM trees incur massive memory footprints and computational reflow overhead when handling thousands of vector layers, stroke handles, and typography nodes simultaneously [92]. To achieve a 60-frames-per-second (FPS) execution profile, Figma bypassed the standard browser rendering pipeline, operating as a custom graphics and game engine inside the browser tab [92, 258].

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 BROWSER RUNTIME                                 │
│                                                                                 │
│  ┌─────────────────────────────────────┐   ┌─────────────────────────────────┐  │
│  │     Product UI Shell (React/TS)     │   │      Canvas Core (C++/WASM)     │  │
│  │                                     │   │                                 │  │
│  │  Inspector, Layer Tree, Menus       │   │  SceneGraph, Vector Geometry,   │  │
│  │  Toolbars, Modal Dialogs            │   │  GPU Command Buffer Generation  │  │
│  └──────────────────┬──────────────────┘   └────────────────┬────────────────┘  │
│                     │                                       │                   │
│                     └─────────────────┐   ┌─────────────────┘                   │
│                                       │   │                                     │
│                                       ▼   ▼                                     │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                         WebAssembly Memory Bridge                         │  │
│  └────────────────────────────────────┬──────────────────────────────────────┘  │
│                                       │                                         │
│                                       ▼                                         │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                           WebGL / GPU Pipeline                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Hybrid Execution Architecture (C++ / WebAssembly & React)
Figma isolates responsibilities across two main layers [94, 223]:
1. **Core Canvas Engine (C++ / WASM)**: Written in C++ and compiled to WebAssembly (WASM), this core subsystem manages the in-memory document state, spatial coordinate math, vector geometry evaluation, text shaping, layout calculation, and GPU render command generation [94, 223, 258]. Transitioning from asm.js to WebAssembly reduced document load times by 3x across complex files [95, 226, 329].
2. **Product UI Shell (React / TypeScript / Redux)**: Built with React, TypeScript, and Redux, this layer renders the product UI around the canvas, including inspectors, layer sidebars, toolbars, and modal dialogs [94, 223, 258].

**WebAssembly Memory Model**: WebAssembly memory is a single, contiguous array of unmanaged bytes (`WebAssembly.Memory`) managed directly by C++ memory allocators [95]. This eliminates dynamic Just-In-Time (JIT) compilation overhead, JavaScript type-checking, and dynamic Garbage Collection (GC) pauses during continuous canvas panning and zooming [95].

### 1.2 Custom WebGL GPU Rendering Pipeline
Figma draws all canvas document contents onto an HTML5 `<canvas>` element using WebGL, communicating directly with the host GPU [96, 223]:
* **Analytical Vector Edge Antialiasing**: To avoid CPU-heavy geometry tessellation (converting curves into thousands of tiny triangles on the CPU), Figma's WebGL fragment shaders evaluate quadratic and cubic Bézier curve equations analytically per pixel [96]. The shader computes exact mathematical pixel coverage, delivering smooth, resolution-independent antialiased edges at any zoom level [96].
* **GPU Glyph Shaping & Text Rendering**: Standard browser text rendering varies across operating systems and browser engines [96]. Figma executes its own C++ text layout engine that parses binary OpenType font tables, shapes glyph sequences (kerning, ligatures, bidirectional Unicode scripts), and calculates glyph curves using quadratic segment triangle fans in GPU registers [96, 224]. This provides crisp, cross-platform subpixel antialiasing with lower memory overhead than Signed Distance Field (SDF) texture atlases [96].
* **GLSL Layer Effects**: Multi-pass GLSL (OpenGL Shading Language) fragment shaders execute blending modes (Multiply, Screen, Overlay), Gaussian blurs, drop shadows, inner shadows, opacity groups, and clipping masks directly on GPU memory registers [96].

### 1.3 Vector Network Data Model & Geometric Rules
Traditional vector tools represent geometry using closed or open **paths**—ordered linear sequences of points connected from start to end [97, 102]. Figma replaced paths with **Vector Networks** [97, 224].

Mathematically, a Vector Network is an arbitrary graph $G = (V, E)$, where $V$ represents 2D vertices (points) and $E$ represents edges (line segments or cubic Bézier splines) connecting any two arbitrary vertices without requiring a continuous linear sequence [97, 98].

```
Traditional Path Model (Linear Chain):
(Vertex A) ───► (Vertex B) ───► (Vertex C) ───► (Vertex D)

Vector Network Model (Arbitrary Graph):
(Vertex A) ◄───► (Vertex B) ◄───► (Vertex C)
                    ▲                 ▲
                    │                 │
                    ▼                 ▼
               (Vertex D) ◄─────► (Vertex E)
```

**Geometric Rule Set**:
1. **Arbitrary Node Connectivity**: A single vertex $v \in V$ can connect to an arbitrary number of edges $e \in E$ (degree $\ge 0$), enabling branching structures (e.g., three lines joining at a single point) within a single vector object [98, 104].
2. **Structural Continuity**: Deleting an edge or vertex removes that specific connection locally without auto-closing or corrupting adjacent graph geometry [98].
3. **Winding-Free Fill Algorithm**: Path-based tools rely on directional winding rules (Non-Zero or Even-Odd) that invert fills when path orientations clash [98]. Vector Networks eliminate path directions; the engine analyzes planar graph topology to automatically identify and fill all enclosed 2D faces predictably [98].
4. **Direct Curve Manipulation**: Dragging a curve segment with the Bend Tool causes the C++ engine to back-calculate optimal off-curve Bézier control handle positions automatically [98].

### 1.4 Layout Mechanics & In-Memory SceneGraph
* **In-Memory SceneGraph**: Every layer, frame, component, and vector shape exists as a node in an in-memory C++ tree structure known as the **SceneGraph** [100, 258].
* **Spatial Partitioning & Frustum Culling**: The SceneGraph utilizes spatial bounding indexes (such as R-Trees or Bounding Volume Hierarchies) [100]. Redraw operations test the camera view frustum against the spatial index, instantly culling off-screen nodes to maintain 60 FPS performance [100]. Pointer hit-testing executes in sub-milliseconds without DOM event propagation overhead [100].
* **Auto Layout Engine**: An in-memory C++ implementation of the CSS Flexbox alignment algorithm calculates padding, item gaps, alignment, and wrapping rules down the element hierarchy [99].

### 1.5 Figma Multiplayer Synchronization Protocol & Rule Set
Figma uses a **Server-Authoritative, CRDT-Inspired Synchronization Protocol** over persistent WebSockets [101, 102]. The canonical document state is modeled as a two-level nested key-value dictionary [102]:
$$\text{Document} = \text{Map}\langle \text{ObjectID}, \text{Map}\langle \text{PropertyID}, \text{Value} \rangle \rangle$$

```
┌──────────────────┐         WebSocket Stream         ┌──────────────────┐
│  Client A (Browser) │ ◄───────────────────────────► │  Central Server  │
└──────────────────┘                                  │ (Rust Process)   │
                                                      │                  │
┌──────────────────┐         WebSocket Stream         │ Holds Canonical  │
│  Client B (Browser) │ ◄───────────────────────────► │ Document Tree    │
└──────────────────┘                                  └──────────────────┘
```

**The 6 Multiplayer Rules**:
1. **Server Authority**: A central server process worker holds the canonical document tree and establishes the global sequence order for all operations [102, 103, 239].
2. **Property-Level Last-Writer-Wins (LWW)**: Conflicts resolve per property key based on arrival order at the central server [103, 233]. Concurrent edits to different properties of the same object (e.g., `fillColor` vs. `width`) both apply without conflict [103].
3. **Optimistic Local Execution & Flicker Mitigation**: Mutations execute instantly on the local canvas [103, 230]. If an incoming server state update conflicts with an unacknowledged local modification, the client temporarily discards the server update for that property until local pending operations are confirmed, preventing visual UI flicker [103, 230].
4. **Tree Topology Cycle Rejection**: Parent-child relationships are stored as properties (`parentID`) on child objects [103, 230]. If concurrent reparenting operations would create a circular loop (A parent of B, B parent of A), the server rejects the invalid edit [103, 230]. The sending client rolls back its local edit and temporarily detaches the node [103, 230]. Layer ordering uses fractional indexing (averaging numeric positions between $0$ and $1$) [103, 230].
5. **Client-Centric Regional Undo/Redo**: Undo stacks track inverse property deltas [103, 230]. Executing an undo calculates the inverse delta for past local edits and submits a *new forward mutation* to the central server, ensuring local undos do not overwrite edits made by collaborator sessions [103, 230].
6. **Offline Client Generation & Garbage Collection**: Clients generate unique object IDs locally using embedded client-session IDs [103, 230]. Deleting an object completely removes its properties from the server map; deleted records persist only inside the deleting client's local undo buffer, preventing document state bloat [103, 230].

**Server Infrastructure**: Every active document is sharded to an isolated worker process [104, 239]. Figma migrated its multiplayer sync backend from TypeScript (Node.js) to **Rust**, eliminating V8 garbage collection pauses, reducing memory footprint, and accelerating document serialization by over 10x [104, 224, 244].

---

## 2. Technical Framework of Vercel v0

Vercel v0 is an agentic generative platform engineered to unify natural-language prompts, visual direct manipulation, and production full-stack React source code [105, 108, 342].

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 VERCEL v0 STACK                                 │
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                           User Interaction Layer                          │  │
│  │     Natural Language Chat Prompt  <--->  Visual Drag/Edit Canvas Mode     │  │
│  └─────────────────────────────────────┬─────────────────────────────────────┘  │
│                                        │                                        │
│                                        ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                 Bidirectional Synchronization & AST Engine                │  │
│  │                                                                           │  │
│  │  * Source Code <---> Babel/SWC Parser <---> Abstract Syntax Tree (AST)   │  │
│  │  * AST Node ID Injection (e.g., data-ast-id) Mapping to Canvas Elements  │  │
│  │  * Direct Manipulation <---> Precise AST Mutation / Codemod Rewriting     │  │
│  └─────────────────────────────────────┬─────────────────────────────────────┘  │
│                                        │                                        │
│                                        ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                        Isolated Execution Sandbox                         │  │
│  │                                                                           │  │
│  │  * Real-Time Next.js 15 App Router Engine (WebContainers / Micro-VMs)   │  │
│  │  * Live Hot-Module Reloading (HMR) & Runtime Error Instrumentation     │  │
│  │  * Automated Self-Correction Loop for Generative AI Agent                 │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 System Stack & Execution Runtime
* **Native Tech Stack**: Built on Next.js 15 App Router (React 19 / Server Components), TypeScript, Server Actions, Tailwind CSS v4, and shadcn/ui [105, 107, 287].
* **Composite AI Architecture**: Uses the Vercel AI SDK and Vercel AI Gateway to coordinate composite model workflows—combining specialized retrieval-augmented generation (RAG), reasoning models (Claude Sonnet, Claude Opus), and specialized post-processing fixers [107, 345, 346].
* **Sandbox Execution Runtime**: Generates code inside containerized WebContainers or micro-VM sandboxes running live Next.js development servers [108, 344].
* **Automated Self-Correction Loop**: The sandbox monitors compilation output, TypeScript type checks, and browser runtime errors [108, 344]. When an exception occurs, the harness captures the stack trace and feeds it directly back into the LLM context loop [108, 345]. The agent diagnoses the error, rewrites the failing code paths, and verifies the fix before displaying the output [108, 345].

### 2.2 Dual Operational Modes
* **Design Mode**: The natural-language chat interface where users prompt the agent, upload screenshots, or import Figma frames [109, 348]. Selecting any element in the live preview exposes visual controls (colors, margins, typography) that compile back into source code changes [109, 348].
* **Canvas Mode**: The interactive visual manipulation surface displaying rendered previews alongside direct editing controls [109, 348]. It allows designers to reorder elements, adjust spatial padding, or modify theme variables visually [109, 348].

---

## 3. Deep-Dive: Bidirectional Canvas-to-Code Coupling in Vercel v0

Legacy visual builders write edits to secondary representations (like separate JSON schemas or CSS override files), causing code-to-design drift [110]. v0 treats **source code as the single source of truth**, synchronizing visual canvas modifications directly to React TypeScript (TSX) codebases via Abstract Syntax Tree (AST) codemods [110, 261, 270].

```
Visual Canvas Interaction (Drag, Resize, Color Change)
                       │
                       ▼
Read Element Metadata Attribute (e.g., data-ast-id="Node_12")
                       │
                       ▼
Locate Corresponding Node in In-Memory AST Representation
                       │
                       ▼
Execute Targeted AST Codemod (Update Tailwind String / JSX Props)
                       │
                       ▼
Regenerate Exact TSX Code File (Preserving Comments & Structure)
                       │
                       ▼
Hot-Module Reload (HMR) Sandbox Preview Updates Instantly
```

### 3.1 AST Parsing & Source Code Instrumentation
1. **Syntax Parsing**: An AST parser (SWC, Babel, or Tree-sitter) parses TSX source files into an Abstract Syntax Tree [112, 270].
2. **Metadata Tagging**: During development compilation inside the execution sandbox, an AST transformation plugin injects metadata tracking attributes (e.g., `data-ast-id` or `data-onlook-id` containing line, column, and file path coordinates) into every JSX element [112, 270, 275].
3. **Canvas Selection to AST Lookup**: When a user selects or hovers over an element in Canvas Mode, the preview intercepts DOM pointer events, reads the embedded `data-ast-id` attribute, and queries the in-memory AST representation [112, 275].

### 3.2 Canvas Interaction to AST Codemod Pipeline
* **Class Name Token Rewriting**: Adjusting colors or spacing on the visual canvas isolates the element's `className` prop string inside the AST node, rewriting only the specific Tailwind tokens (e.g., replacing `bg-blue-500` with `bg-red-600` or `p-4` with `p-6`) [113, 270, 275].
* **JSX Tree Reordering**: Dragging elements to new positions updates the child node array sequence inside the parent AST node [113].
* **Code Serialization**: The modified AST is serialized back into clean TypeScript code [113]. Because transformations occur directly at specific AST node boundaries, variable names, developer comments, custom state hooks (`useState`), and event handlers are preserved completely without code destruction [113, 275].
* **Hot Module Replacement (HMR)**: Saved code changes trigger HMR inside the sandbox runtime, repainting the canvas preview in real time [113].
* **Bidirectional Figma Sync**: v0 connects to Figma via the Figma REST API, reading design tokens, typography, and Auto Layout structures to translate them into Tailwind CSS tokens and Flexbox/Grid JSX layouts [114, 287, 361]. Modified components can also be exported back into native Figma frames [114, 287].

---

## 4. Comparative Structural Analysis

| Architectural Dimension | Figma Framework | Vercel v0 Framework |
| :--- | :--- | :--- |
| **Primary Domain Objective** | Collaborative spatial vector design & prototyping [92, 115]. | Generative full-stack code synthesis & visual UI editing [105, 110, 115]. |
| **Canvas Execution Core** | C++ Rendering Engine compiled to WebAssembly (WASM) [94, 115, 258]. | Instrument-backed DOM Preview Canvas running Next.js in micro-VM sandboxes [108, 115, 344]. |
| **Graphics & Paint Layer** | Custom WebGL pipeline bypassing HTML/CSS DOM [92, 96, 115]. | Browser-native CSS engine using Tailwind CSS v4 & shadcn/ui [105, 107, 115]. |
| **Spatial Data Model** | Graph-theoretic Vector Networks $G=(V,E)$ & in-memory SceneGraph [97, 100, 115]. | Abstract Syntax Trees (AST), React JSX trees, & CSS design tokens [110, 112, 115]. |
| **Synchronization Model** | Server-Authoritative property-level LWW over WebSockets [102, 103, 115]. | AST-level codemods synchronized with Git repositories & PRs [110, 113, 115, 360]. |
| **Backend Infrastructure** | Sharded per-document isolated server worker processes written in Rust [104, 115, 244]. | Managed Vercel serverless platform with containerized WebContainers / micro-VM sandboxes [108, 115]. |
| **Visual-to-Code Bridge** | Dev Mode inspecting static CSS, iOS, and Android code tokens [115, 186]. | **Bidirectional AST Coupling**: Visual canvas adjustments execute direct AST codemods [110, 113, 115]. |
| **Primary Latency Bottleneck** | GPU draw call limits, curve shader calculations, & spatial tree hit-testing [96, 100, 115]. | LLM generation token latency & container compilation startup times [108, 115]. |

---

## References & Sources

1. **Architectural Frameworks of Modern Web-Native Design and Generative Engines: A Technical Analysis of Figma and Vercel v0** [90-120]
2. **Figma - Made by Evan** (Evan Wallace Retrospective on Figma C++/WASM, Vector Networks, and Rust sync) [222-226]
3. **Figma's Multiplayer Editor: The Server That Decides Who Wins** (Mukul Kumar Mishra System Design Analysis) [235-253]
4. **Figma Interview: Multiplayer Design Round, Pay - Calibrd** [227-234]
5. **Onlook: Open Source AI Visual Editor for Nextjs Apps** [265-278]
6. **v0 by Vercel Review 2026: Features, Pricing & Benchmarks | HumanTestsAI** [337-363]
7. **WebAssembly Vs JavaScript (2026): When Should You Use It? - Matrix Internet** [315-328]
8. **DevToolsDigest: Issue #128 - Heavybit** [102-104]
9. **Appendix A: Terms of reference - GOV.UK** (CMA Adobe/Figma Investigation) [57-88]
