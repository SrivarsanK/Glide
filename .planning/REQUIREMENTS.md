# Requirements: Glide

**Defined:** 2026-06-27
**Core Value:** Let developers visually design and iterate on layouts directly in a running app and have those changes live in their source files as clean, git-diffable code.

## v1 Requirements

### Build-Time Transform & Mapping (TRANS)
- [ ] **TRANS-01**: Dev build-time transform stamps elements with `data-cf-source="path/to/file:line:col"` (Vite plugin).
- [ ] **TRANS-02**: Transform is automatically stripped in production builds (`NODE_ENV=production`).

### Local Node.js Server (SERVER)
- [ ] **SERVER-01**: Runs local WebSocket server to receive edits from browser overlay and coordinate HMR.
- [ ] **SERVER-02**: Recast-style non-destructive AST parser and writer preserves formatting, comments, and untouched nodes.
- [ ] **SERVER-03**: Undo/redo history manager records and applies inverse file diffs.

### Browser Canvas Overlay (OVERLAY)
- [ ] **OVERLAY-01**: Injects a self-contained vanilla JS bridge into the application iframe.
- [ ] **OVERLAY-02**: Renders selection bounding boxes, 8-directional resize handles, and pointer events interceptor.
- [ ] **OVERLAY-03**: Zoom/pan controls for canvas scaling (Ctrl+Scroll, Space+Drag).
- [ ] **OVERLAY-04**: Smart snapping to grid and guides with red distance lines.

### Framework Adapters (ADAP)
- [ ] **ADAP-01**: React framework adapter parses and mutates JSX/TSX nodes.
- [ ] **ADAP-02**: Vue framework adapter parses and mutates Vue Single File Components (SFC).
- [ ] **ADAP-03**: Svelte framework adapter parses and mutates Svelte components.
- [ ] **ADAP-04**: Advanced adapters for Next.js, Nuxt, and Astro project configurations.

### Properties & Spacing Panel (PROP)
- [ ] **PROP-01**: Position, size, rotation edit fields (writing inline styles or Tailwind).
- [ ] **PROP-02**: Flexbox layout editor (Direction, Justify, Align, Gap) in right sidebar.
- [ ] **PROP-03**: Visual box model padding/margin editor.
- [ ] **PROP-04**: Typography (font family, weight, size, color) and background/borders/shadows properties.

### Layers & Navigation (LAYER)
- [ ] **LAYER-01**: Left sidebar DOM tree showing elements, nesting, and component boundaries.
- [ ] **LAYER-02**: Drag-and-drop layer reordering which mutates child ordering in AST.
- [ ] **LAYER-03**: Breadcrumb selector displaying component nesting path.

### Responsive & Preview (RESP)
- [ ] **RESP-01**: Top device preview toolbar to toggle canvas width presets.
- [ ] **RESP-02**: Scopes CSS edits to media queries and Tailwind edits to responsive prefixes (`sm:`, `md:`).

### Text Measurement & Pretext (TEXT)
- [ ] **TEXT-01**: In-browser text height calculation and bounding box resizing via `@chenglou/pretext`.
- [ ] **TEXT-02**: Server-side validation to warn if text edits will cause container overflow or truncation.

### Assets & Extensions (ASSET)
- [ ] **ASSET-01**: Drag-and-drop images from `/public` or `/assets` folders onto canvas.
- [ ] **ASSET-02**: Searchable Lucide and Heroicons picker for inline icon insertion.
- [ ] **ASSET-03**: VS Code extension to open the code file in the editor at the exact line when selected.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud sync & collaboration | v1 is focused on local solo developer workflows. |
| Code generation from scratch | Glide only modifies existing components and template trees. |
| Production build integration | Dev mode execution only; stripped in production builds. |
| Native mobile support | Visual overlay is designed for web browsers only. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRANS-01 | Phase 2 | Pending |
| TRANS-02 | Phase 2 | Pending |
| SERVER-01 | Phase 3 | Pending |
| SERVER-02 | Phase 3 | Pending |
| SERVER-03 | Phase 8 | Pending |
| OVERLAY-01 | Phase 4 | Pending |
| OVERLAY-02 | Phase 4 | Pending |
| OVERLAY-03 | Phase 11 | Pending |
| OVERLAY-04 | Phase 11 | Pending |
| ADAP-01 | Phase 3 | Pending |
| ADAP-02 | Phase 9 | Pending |
| ADAP-03 | Phase 11 | Pending |
| ADAP-04 | Phase 12 | Pending |
| PROP-01 | Phase 5 | Pending |
| PROP-02 | Phase 6 | Pending |
| PROP-03 | Phase 5 | Pending |
| PROP-04 | Phase 6 | Pending |
| LAYER-01 | Phase 7 | Pending |
| LAYER-02 | Phase 7 | Pending |
| LAYER-03 | Phase 7 | Pending |
| RESP-01 | Phase 10 | Pending |
| RESP-02 | Phase 10 | Pending |
| TEXT-01 | Phase 8 | Pending |
| TEXT-02 | Phase 8 | Pending |
| ASSET-01 | Phase 11 | Pending |
| ASSET-02 | Phase 11 | Pending |
| ASSET-03 | Phase 12 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-27*
*Last updated: 2026-06-27 after initial definition*
