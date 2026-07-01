# Roadmap: Glide

## Overview

Glide's roadmap details the transition from an empty project to a multi-framework, feature-rich developer utility. Execution is divided into twelve fine-grained phases, moving sequentially from core compiler transformations to the interactive overlay canvas, layout editors, and finally advanced framework adapters and editor integrations.

## Phases

- [x] **Phase 1: Environment & Tooling Setup** - Set up repository structures, package layouts, and dev configurations.
- [x] **Phase 2: Vite Plugin & Source-Stamping** - Implement compilation-time stamping of `data-cf-source` attributes.
- [x] **Phase 3: WebSocket Server & AST Write-Back** - Run a local server coordinating AST changes in React/Tailwind.
- [x] **Phase 4: Basic Overlay Canvas (React/Tailwind)** - Render visual selection boxes and handles over live DOM elements.
- [x] **Phase 5: Properties Panel & Box Model Spacing** - Implement size controls and padding/margin spacing editor.
- [x] **Phase 6: Flex Layout & Typography Controls** - Support flex container alignment and formatting variables.
- [x] **Phase 7: Layers Panel & Reordering** - Build left DOM/component tree sidebar and support node reordering.
- [x] **Phase 8: Undo/Redo & Pretext Integration** - Build inverse file diff undo managers and integrate `@chenglou/pretext`.
- [x] **Phase 9: CSS Modules & Vue Adapter** - Implement Vue framework adapter and write support for CSS Modules.
- [x] **Phase 10: Responsive Preview & Breakpoint Scoped Editing** - Add responsive preset sizing and breakpoint styling scopes.
- [x] **Phase 11: Polish, Asset Panel & Svelte Adapter** - Add grid snapping, asset pickers, and Svelte framework support.
- [x] **Phase 12: Next.js/Nuxt/Astro Adapters & VS Code Extension** - Build meta-framework configs and VS Code IDE companion.

## Phase Details

### Phase 1: Environment & Tooling Setup
**Goal**: Initialize monorepo project directories and dev tooling environments.
**Depends on**: Nothing
**Requirements**: None
**Success Criteria**:
  1. Monorepo folder layout exists.
  2. Vite and test framework dev configurations are complete.
**Plans**: 1 plan
- [x] 01-01: Configure initial workspace dependencies and boilerplate files. (Completed: 2026-06-27)

### Phase 2: Vite Plugin & Source-Stamping
**Goal**: Stamp elements with code positions during dev build.
**Depends on**: Phase 1
**Requirements**: TRANS-01, TRANS-02
**Success Criteria**:
  1. Inspecting dev elements shows accurate `data-cf-source="filepath:line:col"` attributes.
  2. Bounding attributes are completely omitted from production build files.
**Plans**: 1 plan
- [x] 02-01: Create Vite/Babel transformation plugin for development stamping. (Completed: 2026-07-01)

### Phase 3: WebSocket Server & AST Write-Back
**Goal**: Listen for design commands and modify React/Tailwind source code in real time.
**Depends on**: Phase 2
**Requirements**: SERVER-01, SERVER-02, ADAP-01
**Success Criteria**:
  1. Node WebSocket server receives change requests and locates target AST nodes.
  2. Mutated AST serializes back to source files without removing comments or layout formatting.
**Plans**: 2 plans
- [x] 03-01: Establish WebSocket communication server. (Completed: 2026-07-01)
- [x] 03-02: Write non-destructive AST write-back engine for React/Tailwind. (Completed: 2026-07-01)

### Phase 4: Basic Overlay Canvas (React/Tailwind)
**Goal**: Render visual selection boundaries and drag-to-resize handles on the running app.
**Depends on**: Phase 3
**Requirements**: OVERLAY-01, OVERLAY-02
**Success Criteria**:
  1. Hovering/clicking on elements shows a highlighted bounding border.
  2. Dragging resize handles sends new layout dimensions over the WebSocket connection.
**Plans**: 2 plans
- [x] 04-01: Inject canvas bridge script into the running application iframe. (Completed: 2026-07-01)
- [x] 04-02: Build visual bounding box and handle drag event listeners. (Completed: 2026-07-01)

### Phase 5: Properties Panel & Box Model Spacing
**Goal**: Implement right sidebar for position, sizing, and padding/margin spacing.
**Depends on**: Phase 4
**Requirements**: PROP-01, PROP-03
**Success Criteria**:
  1. Visual margin/padding box editor updates layout in code.
  2. Aspect ratio locking and auto-height double-click work on resize.
**Plans**: 2 plans
- [x] 05-01: Build Spacing editor panel UI. (Completed: 2026-07-01)
- [x] 05-02: Write spacing translation rules to map pixels to Tailwind and inline styles. (Completed: 2026-07-01)

### Phase 6: Flex Layout & Typography Controls
**Goal**: Add flexbox properties and font configuration fields.
**Depends on**: Phase 5
**Requirements**: PROP-02, PROP-04
**Success Criteria**:
  1. Changing flex direction or gaps updates Tailwind classes on the target container.
  2. Text formatting attributes write clean styling changes back to the source component.
**Plans**: 2 plans
- [x] 06-01: Implement Flexbox direction, alignment, wrap, and gap controls. (Completed: 2026-07-01)
- [x] 06-02: Build Typography properties controls (fonts, size, weight, alignment). (Completed: 2026-07-01)

### Phase 7: Layers Panel & Reordering
**Goal**: Build left DOM/component tree sidebar and support node reordering.
**Depends on**: Phase 6
**Requirements**: LAYER-01, LAYER-02, LAYER-03
**Success Criteria**:
  1. Left panel outlines component nesting tree with clear boundaries.
  2. Dragging layers changes order of React child elements in source.
**Plans**: 3 plans
- [x] 07-01: Generate component tree data structure from source files. (Completed: 2026-07-01)
- [x] 07-02: Build layers panel layout displaying node names and hierarchies. (Completed: 2026-07-01)
- [x] 07-03: Implement layer reordering AST mutation handler. (Completed: 2026-07-01)

### Phase 8: Undo/Redo & Pretext Integration
**Goal**: Support undo operations and integrate Pretext for text height checks.
**Depends on**: Phase 7
**Requirements**: SERVER-03, TEXT-01, TEXT-02
**Success Criteria**:
  1. Pressing Undo rolls back the source files to their prior states.
  2. Dynamic text containers resize accurately using Pretext canvas layouts.
**Plans**: 2 plans
- [x] 08-01: Build local file backup and inverse diff undo manager. (Completed: 2026-07-01)
- [x] 08-02: Integrate `@chenglou/pretext` for height calculations. (Completed: 2026-07-01)

### Phase 9: CSS Modules & Vue Adapter
**Goal**: Support editing CSS Modules and Vue SFC files.
**Depends on**: Phase 8
**Requirements**: ADAP-02, PROP-01/03/04 (CSS Modules support)
**Success Criteria**:
  1. Mutating styles in Vue components writes back to Vue Single File Templates.
  2. Spacing adjustments update the linked `.module.css` stylesheet.
**Plans**: 2 plans
- [x] 09-01: Build Vue SFC parser/adapter. (Completed: 2026-07-01)
- [x] 09-02: Implement CSS Modules class-resolver and property updates. (Completed: 2026-07-01)

### Phase 10: Responsive Preview & Breakpoint Scoped Editing
**Goal**: Change viewport sizes and scope edits to active breakpoints.
**Depends on**: Phase 9
**Requirements**: RESP-01, RESP-02
**Success Criteria**:
  1. Selecting Mobile/Tablet preset resizes the canvas preview frame.
  2. Visual edits at a breakpoint write scoped classes (e.g. `md:px-4`) or CSS media query rules.
**Plans**: 2 plans
- [x] 10-01: Build viewport preset toolbar. (Completed: 2026-07-01)
- [x] 10-02: Implement breakpoint-scoped style write-back logic. (Completed: 2026-07-01)

### Phase 11: Polish, Asset Panel & Svelte Adapter
**Goal**: Add grid snapping, guides, image drag, and Svelte compiler adapter.
**Depends on**: Phase 10
**Requirements**: OVERLAY-03, OVERLAY-04, ADAP-03, ASSET-01, ASSET-02
**Success Criteria**:
  1. Elements align with grid/ruler guides; asset picker imports images/icons.
  2. Svelte template files parse and serialize style mutations correctly.
**Plans**: 3 plans
- [x] 11-01: Implement Svelte compiler framework adapter. (Completed: 2026-07-01)
- [x] 11-02: Add local asset copy and file-saver path resolver. (Completed: 2026-07-01)
- [x] 11-03: Implement snap-to-guides grid alignment math. (Completed: 2026-07-01)

### Phase 12: Next.js/Nuxt/Astro Adapters & VS Code Extension
**Goal**: Support meta-framework builds and connect Visual selection to IDE files.
**Depends on**: Phase 11
**Requirements**: ADAP-04, ASSET-03
**Success Criteria**:
  1. Glide maps code positions inside Next.js/Nuxt/Astro bundles.
  2. Visual node selection triggers VS Code to open the source file at the exact line.
**Plans**: 2 plans
- [x] 12-01: Build framework configurations for Next.js, Nuxt, and Astro. (Completed: 2026-07-01)
- [x] 12-02: Create VS Code extension companion for local file integration. (Completed: 2026-07-01)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Environment & Tooling Setup | 1/1 | Complete | 2026-06-27 |
| 2. Vite Plugin & Source-Stamping | 1/1 | Complete | 2026-07-01 |
| 3. WebSocket Server & AST Write-Back | 2/2 | Complete | 2026-07-01 |
| 4. Basic Overlay Canvas (React/Tailwind) | 2/2 | Complete | 2026-07-01 |
| 5. Properties Panel & Box Model Spacing | 2/2 | Complete | 2026-07-01 |
| 6. Flex Layout & Typography Controls | 2/2 | Complete | 2026-07-01 |
| 7. Layers Panel & Reordering | 3/3 | Complete | 2026-07-01 |
| 8. Undo/Redo & Pretext Integration | 2/2 | Complete | 2026-07-01 |
| 9. CSS Modules & Vue Adapter | 2/2 | Complete | 2026-07-01 |
| 10. Responsive Preview & Breakpoint Scoped Editing | 2/2 | Complete | 2026-07-01 |
| 11. Polish, Asset Panel & Svelte Adapter | 3/3 | Complete | 2026-07-01 |
| 12. Next.js/Nuxt/Astro Adapters & VS Code Extension | 2/2 | Complete | 2026-07-01 |
