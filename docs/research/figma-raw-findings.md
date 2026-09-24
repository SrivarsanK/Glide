# Figma API Integration & Programmatic Design-to-Code Research

## Executive Overview
This document compiles technical research across 19 primary sources covering the Figma REST API, Figma Plugin API, Figma Dev Mode / CodeConnect API, Design Tokens (W3C standard), open-source Design-to-Code conversion engines, and peer-reviewed academic papers. 

Each entry details architectural mechanics, data schemas, algorithmic patterns, and specific actionable strategies for **Glide**—a visual editor designed for bi-directional AST/CST editing of React, Vue, and Svelte applications.

---

## 1. Figma REST API

### Source 1: Official Figma REST API Documentation
* **Title**: Figma Developer Platform - REST API Reference
* **URL**: https://developers.figma.com/docs/api/
* **Maintainer**: Figma, Inc.
* **Year**: 2026 (Updated continuously)
* **Key Findings & Architecture**:
  * Base URL: `https://api.figma.com/v1` authenticated via Personal Access Token (`X-Figma-Token`) or OAuth2 Bearer token.
  * `GET /v1/files/:key`: Returns full JSON node tree of a document (`DOCUMENT` -> `CANVAS` -> `FRAME` -> `COMPONENT` / `INSTANCE` / `TEXT` / `VECTOR`).
  * `GET /v1/files/:key/nodes?ids=...`: Selectively retrieves subtree nodes without payload bloat.
  * Node Tree Structure: Represents layout via `layoutMode` (`HORIZONTAL`, `VERTICAL`, `NONE`), layout sizing (`primaryAxisSizingMode`, `counterAxisSizingMode`), padding (`paddingLeft`, `paddingRight`, `paddingTop`, `paddingBottom`), gaps (`itemSpacing`), and constraints (`layoutAlign`, `layoutGrow`).
* **Relevant Code Patterns & Algorithms**:
  * Depth-first JSON AST traversal algorithm mapping Figma node properties to CSS Flexbox properties.
  * Image fill resolution: `ImagePaint` properties contain `imageRef` key; raw image asset URLs must be retrieved via `GET /v1/images/:key?ids=...`.
* **Benefits to Glide**:
  * **Headless Import Pipeline**: Allows Glide CLI or cloud sync to fetch user design files programmatically without requiring manual file exports.
  * **AST Node-to-CST Mapping**: Provides exact schema model for converting Figma JSON nodes directly into JSX/Vue/Svelte CST components.

---

### Source 2: `@figma/rest-api-spec` Open-API Specification
* **Title**: Figma REST API Spec (OpenAPI 3.0 TypeScript Definitions)
* **URL**: https://github.com/figma/rest-api-spec
* **Maintainer**: Figma, Inc.
* **Year**: 2024–2026
* **Key Findings & Architecture**:
  * Official TypeScript types and JSON schema definitions for all Figma REST API requests and responses.
  * Formally defines node unions (`SublayerNode`, `FrameNode`, `TextNode`, `VectorNode`, `InstanceNode`, `ComponentNode`).
  * Explicitly types layout wrap properties (`layoutWrap: "NO_WRAP" | "WRAP"`), stroke aligns (`INSIDE`, `OUTSIDE`, `CENTER`), and absolute positioning overrides (`layoutPositioning: "AUTO" | "ABSOLUTE"`).
* **Relevant Code Patterns & Algorithms**:
  ```typescript
  type Node = 
    | DocumentNode
    | CanvasNode
    | FrameNode
    | GroupNode
    | VectorNode
    | TextNode
    | ComponentNode
    | ComponentSetNode
    | InstanceNode;
  ```
* **Benefits to Glide**:
  * **Type-Safe Ingestion Layer**: Glide can import `@figma/rest-api-spec` directly as a devDependency for zero-cost type safety when transforming incoming Figma payload objects to Glide AST nodes.

---

### Source 3: `didoo/figma-api` (TypeScript API Client)
* **Title**: `figma-api` - Node.js TypeScript wrapper for Figma REST API
* **URL**: https://github.com/didoo/figma-api
* **Author**: Crispino Roberto (didoo)
* **Year**: 2023–2025
* **Key Findings & Architecture**:
  * Light wrapper providing rate-limiting resilience, automatic backoff, and helper methods for file downloading, component listing, and variable fetching.
  * Implements payload streaming and retry logic on `429 Too Many Requests`.
* **Relevant Code Patterns & Algorithms**:
  * Exponential backoff algorithm for API rate-limit management during bulk layer transfers.
* **Benefits to Glide**:
  * **Robust Network Layer**: Reference pattern for Glide's external Figma sync pipeline to handle rate limits gracefully during large project imports.

---

## 2. Figma Plugin API & CST/AST Layout Alignment

### Source 4: Official Figma Plugin API Reference
* **Title**: Figma Plugin API Documentation
* **URL**: https://www.figma.com/plugin-docs/api/api-reference/
* **Maintainer**: Figma, Inc.
* **Year**: 2026
* **Key Findings & Architecture**:
  * Runs inside a sandboxed JavaScript environment within the Figma desktop application with direct access to the live visual document model (`figma.currentPage`).
  * Bi-directional canvas manipulation: can create, modify, move, recolor, and re-parent nodes in real time.
  * High-performance visual inspection: direct node property access (`node.absoluteTransform`, `node.width`, `node.height`, `node.fills`, `node.strokes`).
* **Relevant Code Patterns & Algorithms**:
  * Matrix transformation decoding: `node.absoluteTransform` yields a `[[a, b, c], [d, e, f]]` 2D affine transformation matrix for calculating global canvas coordinates.
  ```typescript
  // Global coordinate calculation from 2D Affine Transform Matrix
  const globalX = node.absoluteTransform[0][2];
  const globalY = node.absoluteTransform[1][2];
  ```
* **Benefits to Glide**:
  * **Live Plugin Extension**: Enables building a companion Glide Figma plugin that streams live drag/resize events from Figma directly into Glide's dev server.
  * **Kd-Tree Guide Alignment**: The matrix transformation math directly mirrors Glide's Kd-Tree canvas spatial indexing for smart snapping guides.

---

### Source 5: Figma Auto-Layout to CSS Flexbox Spec
* **Title**: Auto Layout Properties & Flexbox Equivalence Mapping
* **URL**: https://www.figma.com/plugin-docs/api/properties/nodes-layoutmode/
* **Maintainer**: Figma, Inc.
* **Year**: 2025–2026
* **Key Findings & Architecture**:
  * Maps Figma Auto Layout nodes 1:1 to CSS Flexbox primitives:
    * `layoutMode === "HORIZONTAL"` -> `display: flex; flex-direction: row;`
    * `layoutMode === "VERTICAL"` -> `display: flex; flex-direction: column;`
    * `itemSpacing` -> `gap: ${itemSpacing}px;`
    * `primaryAxisAlignItems === "MIN"` / `"CENTER"` / `"MAX"` / `"SPACE_BETWEEN"` -> `justify-content: flex-start` / `center` / `flex-end` / `space-between`
    * `counterAxisAlignItems === "MIN"` / `"CENTER"` / `"MAX"` / `"BASELINE"` -> `align-items: flex-start` / `center` / `flex-end` / `baseline`
    * `layoutGrow === 1` -> `flex-grow: 1;`
    * `layoutAlign === "STRETCH"` -> `align-self: stretch;`
    * `layoutPositioning === "ABSOLUTE"` -> `position: absolute;`
* **Relevant Code Patterns & Algorithms**:
  * Deterministic Layout Transformer Algorithm converting layout properties into standard CSS rule ASTs.
* **Benefits to Glide**:
  * **Source Code Integrity**: Enables Glide to generate zero-fluff Flexbox CSS when converting dragged elements into clean React/Vue/Svelte styled components or Tailwind classes.

---

## 3. Design-to-Code Engines & Frameworks

### Source 6: Builder.io `@builder.io/html-to-figma` & Mitosis
* **Title**: Builder.io Visual Copilot & HTML-to-Figma Converter
* **URL**: https://github.com/BuilderIO/figma-html
* **Author/Maintainer**: Builder.io (Steve Sewell et al.)
* **Year**: 2024–2026
* **Key Findings & Architecture**:
  * Bi-directional conversion engine: converts DOM trees to Figma JSON layers, and Figma layers back into JSX/HTML.
  * Uses **Mitosis** intermediate representation (IR) format (`JSXJSON`) to compile visual layer trees into multi-framework targets (React, Vue, Svelte, Angular, Qwik).
  * Computes computed CSS styles via `window.getComputedStyle()` during DOM parsing to synthesize responsive Auto-Layout containers.
* **Relevant Code Patterns & Algorithms**:
  * Recursive DOM traversal algorithm converting computed DOM node bounding boxes and inline styles into Figma `FrameNode` tree JSON.
  ```typescript
  function domToFigmaNode(el: HTMLElement): FigmaNode {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    // Transform layout mode and children recursively...
  }
  ```
* **Benefits to Glide**:
  * **Multi-Framework Compilation Target**: Validates Glide's architecture of isolating AST/CST logic from visual rendering, ensuring clean export across React, Vue, and Svelte.

---

### Source 7: DhiWise Figma-to-Code Engine
* **Title**: DhiWise Pro-Code Generator Architecture
* **URL**: https://www.dhiwise.com
* **Maintainer**: DhiWise Inc.
* **Year**: 2025–2026
* **Key Findings & Architecture**:
  * Intelligent component identification algorithm: inspects Figma layer structure, visual grouping, and node hierarchy to identify standard UI components (Button, Input, Modal, Navbar, Card).
  * Auto-generates modular component files, separate CSS/Tailwind definitions, and prop interface types (`interface ButtonProps`).
* **Relevant Code Patterns & Algorithms**:
  * Heuristic classification algorithm based on layer geometry, text content, and child count (e.g., Frame with 1 Text child + background fill + rounded corner = `<Button>`).
* **Benefits to Glide**:
  * **Unified Component Tree**: Enhances Glide's component resolution algorithm, turning raw design groupings into instantiated sub-components rather than messy nested `div` trees.

---

### Source 8: Anima Design-to-Code Platform
* **Title**: Anima Figma to React / HTML Engine
* **URL**: https://www.animaapp.com
* **Maintainer**: Anima App Inc.
* **Year**: 2025–2026
* **Key Findings & Architecture**:
  * Focuses on code quality and layout responsiveness, generating clean Flexbox CSS and Tailwind CSS classes directly from Figma Auto Layout attributes.
  * Handles interactive state variants (hover, active, disabled) by mapping Figma Component Set variants to React state props (`variant="primary"`, `size="large"`).
* **Relevant Code Patterns & Algorithms**:
  * Variant Matrix Resolver algorithm: aggregates Figma `ComponentSetNode` variants into unified React component prop schemas.
* **Benefits to Glide**:
  * **Component Variant Support**: Informs how Glide visualizes and edits component variant states directly on the visual canvas.

---

### Source 9: `gbasin/figma-to-react` (Figma MCP Server)
* **Title**: `figma-to-react` - Model Context Protocol for Figma Design-to-Code
* **URL**: https://github.com/gbasin/figma-to-react
* **Author**: gbasin
* **Year**: 2025–2026
* **Key Findings & Architecture**:
  * Implements Model Context Protocol (MCP) server that exposes Figma document nodes directly to LLMs / AI Coding Agents (like Claude / Antigravity).
  * Exposes tools to fetch node trees, query styles, and inspect Auto Layout configurations, enabling AI agents to generate pixel-perfect React + Tailwind code.
* **Relevant Code Patterns & Algorithms**:
  * MCP Tool Interface exposing `get_figma_node`, `get_image_assets`, and `export_tokens`.
* **Benefits to Glide**:
  * **AI Agent Integration**: Provides direct blueprint for equipping Glide subagents with Figma MCP capabilities to translate selected canvas nodes into React code automatically.

---

## 4. Design Tokens & Figma Variables

### Source 10: Tokens Studio for Figma (Figma Tokens)
* **Title**: Tokens Studio Architectural Specification
* **URL**: https://tokens.studio/
* **Maintainer**: Tokens Studio Team
* **Year**: 2025–2026
* **Key Findings & Architecture**:
  * Industry standard plugin for defining, tokenizing, and syncing design systems in Figma.
  * Supports token sets, token themes, multi-brand aliases, and mathematical expression evaluation (e.g., `{spacing.base} * 2`).
  * Syncs bidirectionally with GitHub, GitLab, and Style Dictionary.
* **Relevant Code Patterns & Algorithms**:
  * Dependency graph resolution algorithm for alias token evaluation (e.g., `color.primary` -> `color.brand.blue.500` -> `#1E40AF`).
* **Benefits to Glide**:
  * **Design Token Engine**: Enables Glide to resolve design token aliases when rendering CSS variables in the visual editor canvas.

---

### Source 11: W3C Design Tokens Community Group Specification
* **Title**: W3C Design Tokens Format Specification (Second Draft)
* **URL**: https://design-tokens.github.io/community-group/format/
* **Maintainer**: W3C Design Tokens CG
* **Year**: 2025–2026
* **Key Findings & Architecture**:
  * Standardized JSON format for design token interchange.
  * Format: Each token contains `$type` (`color`, `dimension`, `fontFamily`, `fontWeight`, `duration`), `$value`, and optional `$description`.
  ```json
  {
    "color": {
      "brand": {
        "primary": {
          "$type": "color",
          "$value": "#3b82f6",
          "$description": "Primary action color"
        }
      }
    }
  }
  ```
* **Relevant Code Patterns & Algorithms**:
  * Token Format Parser & Converter translating W3C JSON tokens into CSS Custom Properties (`--color-brand-primary: #3b82f6;`) and Style Dictionary tokens.
* **Benefits to Glide**:
  * **Standardized Token Import/Export**: Glide can adopt W3C format natively to import design token files and apply them to source AST style attributes without breaking formatting.

---

### Source 12: Figma Variables REST API
* **Title**: Figma REST API - Local & Published Variables Endpoints
* **URL**: https://developers.figma.com/docs/api/variables/
* **Maintainer**: Figma, Inc.
* **Year**: 2025–2026
* **Key Findings & Architecture**:
  * Endpoints: `GET /v1/files/:file_key/variables/local`, `POST /v1/files/:file_key/variables`.
  * Allows reading and bulk mutation of variable collections, variable modes (e.g., Dark Mode vs Light Mode), and values per mode.
  * Variables map to types: `FLOAT`, `COLOR`, `STRING`, `BOOLEAN`.
* **Relevant Code Patterns & Algorithms**:
  * Multi-Mode Variable Resolution Matrix algorithm mapping modes (`modeId`) to theme variant values.
* **Benefits to Glide**:
  * **Instant Theme Switching**: Allows Glide canvas to support real-time mode/theme toggling (Dark/Light) by reading Figma variable mode maps.

---

## 5. Figma Dev Mode & Developer Handoff

### Source 13: Figma CodeConnect CLI & SDK
* **Title**: Figma Code Connect - Developer Handoff Automation
* **URL**: https://github.com/figma/code-connect
* **Maintainer**: Figma, Inc.
* **Year**: 2024–2026
* **Key Findings & Architecture**:
  * CLI and library that links production code components (React, Vue, Swift, Jetpack Compose) directly to Figma component node instances in Dev Mode.
  * Replaces auto-generated design code with actual production component usage snippets.
  * Configured via `.figma.tsx` mapping files:
  ```tsx
  import figma from '@figma/code-connect';
  import { Button } from './Button';

  figma.connect(Button, 'https://figma.com/file/KEY?node-id=1:2', {
    props: {
      label: figma.string('Text Content'),
      variant: figma.enum('Variant', {
        Primary: 'primary',
        Secondary: 'secondary',
      }),
      disabled: figma.boolean('Disabled'),
    },
    example: (props) => <Button variant={props.variant} disabled={props.disabled}>{props.label}</Button>,
  });
  ```
* **Relevant Code Patterns & Algorithms**:
  * Code snippet synthesis engine matching Figma node variant properties to TypeScript component props.
* **Benefits to Glide**:
  * **Bi-directional Code Mapping**: Perfect structural template for Glide's AST component mapper. Allows Glide to register visual canvas nodes to real codebase source files.

---

### Source 14: Figma Dev Resources REST API
* **Title**: Figma REST API - Dev Resources Endpoints
* **URL**: https://developers.figma.com/docs/api/dev-resources/
* **Maintainer**: Figma, Inc.
* **Year**: 2024–2026
* **Key Findings & Architecture**:
  * Endpoints: `GET /v1/files/:file_key/dev_resources`, `POST /v1/files/:file_key/dev_resources`.
  * Attaches external developer URLs (Storybook docs, GitHub source file links, Jira tickets) directly to specific node IDs in Figma files.
* **Relevant Code Patterns & Algorithms**:
  * Node ID to URI metadata indexing table.
* **Benefits to Glide**:
  * **Source Linkage Metadata**: Glide can attach source file paths (`file:///src/components/Button.tsx#L12-L45`) to Figma node instances programmatically.

---

## 6. Academic Research Papers

### Source 15: *Figma2Code: Automating Multimodal Design to Code in the Wild*
* **Title**: Figma2Code: Automating Multimodal Design to Code in the Wild
* **URL**: https://arxiv.org/abs/2604.13648
* **Authors**: Chen et al.
* **Conference/Year**: ICLR 2026 (Published April 2026)
* **Key Findings & Contributions**:
  * First large-scale benchmark dataset constructed from real-world Figma files containing raw JSON metadata, visual render images, asset links, and human-written React/Tailwind code.
  * Evaluates state-of-the-art Multimodal LLMs (GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro).
  * Demonstrates that providing **structured layout metadata alongside screenshot images** improves code correctness score by 38.4% compared to image-only visual generation.
  * Highlights current failure modes: flex wrap calculation errors, absolute positioning misuse, and missing design token aliases.
* **Relevant Code Patterns & Algorithms**:
  * Hybrid Multimodal Prompting Pipeline algorithm combining node structural JSON trees with cropped canvas images.
* **Benefits to Glide**:
  * **Grounding for Glide's AST Compiler**: Proves that combining visual node bounding boxes with source code AST yields drastically superior visual editing results than visual computer vision alone.

---

### Source 16: *DeclarUI: Bridging Design and Development with Automated Declarative UI Code Generation*
* **Title**: DeclarUI: Bridging Design and Development with Automated Declarative UI Code Generation
* **URL**: https://arxiv.org/abs/2409.11667
* **Authors**: Zhou et al.
* **Conference/Year**: arXiv preprint (September 2024)
* **Key Findings & Contributions**:
  * Proposes DeclarUI: an end-to-end framework combining Computer Vision, MLLMs, and iterative compiler-driven optimization for declarative UI code (React Native, Flutter, ArkUI).
  * Key innovation: **Page Transition Graphs (PTGs)** to model multi-page state transitions and component interaction semantics.
  * Uses feedback loops from code execution/compilation errors to self-correct generated UI component structures.
* **Relevant Code Patterns & Algorithms**:
  * Compiler Feedback Self-Correction Loop: `Design -> Draft AST -> Compile -> Check Diagnostics -> Repair AST -> Final Code`.
* **Benefits to Glide**:
  * **Compiler-Guided AST Repair**: Direct validation of Glide's CST guardrails—running the TypeScript compiler after AST edits guarantees zero-error visual updates.

---

### Source 17: *DesignCoder: Hierarchy-Aware and Self-Correcting UI Code Generation with LLMs*
* **Title**: DesignCoder: Hierarchy-Aware and Self-Correcting UI Code Generation with Large Language Models
* **URL**: https://arxiv.org/abs/2506.13663
* **Authors**: Chen et al.
* **Conference/Year**: arXiv preprint (June 2025)
* **Key Findings & Contributions**:
  * Addresses visual and structural misalignment caused by flat or deeply nested design node outputs.
  * Key innovation: **UI Grouping Chains (UGC)**—a hierarchical divide-and-conquer algorithm that parses complex UI scenes into semantic parent-child visual clusters before generating code.
  * Achieves state-of-the-art scores in structural similarity (SSIM) and DOM tree edit distance.
* **Relevant Code Patterns & Algorithms**:
  * Hierarchical UI Grouping Chain (UGC) clustering algorithm based on spatial bounding box inclusion and alignment vector clustering.
* **Benefits to Glide**:
  * **Spatial Tree Clustering**: Algorithmic inspiration for Glide's layer panel node tree generation, preventing floating root nodes and fragmented layer hierarchies.

---

### Source 18: *UICopilot: Automating UI Synthesis via Hierarchical Code Generation from Webpage Designs*
* **Title**: UICopilot: Automating UI Synthesis via Hierarchical Code Generation from Webpage Designs
* **URL**: https://arxiv.org/abs/2505.09904
* **Authors**: Anonymous / Researchers on WebCode2M
* **Conference/Year**: arXiv preprint (May 2025)
* **Key Findings & Contributions**:
  * Two-stage UI synthesis framework: (1) Coarse-grained HTML layout tree generation, followed by (2) Fine-grained CSS styling & component prop synthesis.
  * Evaluated on WebCode2M dataset; demonstrates 42% reduction in layout shift and CSS class duplication.
* **Relevant Code Patterns & Algorithms**:
  * Two-stage decoupled AST-to-CSS synthesis pipeline.
* **Benefits to Glide**:
  * **Decoupled CST Formatting**: Reinforces Glide's rule of separating layout node tree mutations from style/color patches during live drag operations.

---

### Source 19: *pix2code: Generating Code from a Graphical User Interface Screenshot*
* **Title**: pix2code: Generating Code from a Graphical User Interface Screenshot
* **URL**: https://arxiv.org/abs/1705.07962
* **Author**: Tony Beltramelli
* **Conference/Year**: ACM / arXiv (2017–2018)
* **Key Findings & Contributions**:
  * Foundational pioneer paper establishing deep learning approach for UI code generation from screenshots using CNN for image encoding and LSTM network for DSL token generation.
  * Introduced domain-specific language (DSL) representation for UI layouts to simplify code generation complexity.
* **Relevant Code Patterns & Algorithms**:
  * Vision Encoder + Recurrent Sequence Decoder neural architecture.
* **Benefits to Glide**:
  * **Historical Benchmark & Architectural Contrast**: Demonstrates why pure vision-to-code models fail at source code integrity—reinforcing Glide's approach of mutating source AST directly instead of guessing code from images.

---

## 7. Comparative Matrix & Architectural Recommendations for Glide

| Domain | Key Technology / Spec | Primary Data Format | Impact on Glide Architecture |
| :--- | :--- | :--- | :--- |
| **REST API** | Figma REST Files API (`GET /v1/files/:key`) | JSON Node Tree | Enables headless sync and design import pipeline |
| **Plugin API** | Figma Plugin SDK | Sandboxed JS (`figma.currentPage`) | Real-time live canvas syncing and matrix coordinate decoding |
| **Dev Mode** | Figma CodeConnect (`@figma/code-connect`) | TSX Mapping Files (`.figma.tsx`) | Bi-directional component registration (Figma node -> React/Vue source) |
| **Design Tokens** | W3C Design Tokens Spec | Standard JSON (`$type`, `$value`) | Preserves CSS variable and theme token integrity across AST edits |
| **Code Generation** | Builder.io Mitosis & DhiWise Engine | AST Intermediate Representation | Multi-framework compilation (React, Vue, Svelte) |
| **AI Research** | Figma2Code & DeclarUI | Multimodal JSON + Vision + Compiler | Compiler-guided AST self-correction loop |

---

## 8. Summary of Actionable Strategies for Glide

1. **Adopt W3C Design Token Schema**: Implement W3C standard JSON parsing inside Glide's token resolver to convert Figma variables directly into CSS Custom Properties without breaking source file formatting.
2. **Implement CodeConnect-Style Component Registration**: Build a mapping registry that binds codebase React/Vue/Svelte components to visual canvas nodes using exact file path pointers (`file:///path/to/component.tsx#L10`).
3. **Use Matrix Coordinate Transformation**: Use 2D Affine Transform matrix math (`[[a,b,c],[d,e,f]]`) for global coordinate calculation to ensure seamless Kd-Tree spatial snapping.
4. **Enforce Compiler-Guided CST Mutator**: Integrate TypeScript compiler diagnostics into the visual drag/resize edit loop to guarantee 100% syntactically valid code outputs.
