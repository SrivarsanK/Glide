# Glide

## What This Is

Glide is an open-source developer package that brings a Figma-like visual canvas directly into the browser. Developers run their existing app, open a canvas overlay, and manipulate elements visually — moving, resizing, restyling, reordering — while every change writes back to actual source code in real time as clean, idiomatic code.

## Core Value

Let developers visually design and iterate on layouts directly in a running app and have those changes live in their source files as clean, git-diffable code.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **CORE-01**: Dev build-time transform stamps elements with `data-cf-source="path/to/file:line:col"` (dev only, stripped in production).
- [ ] **CORE-02**: Local Node.js WebSocket server coordinates edits with the browser overlay and writes back changes.
- [ ] **CORE-03**: Browser overlay injects into the app iframe and renders visual selection boundaries and resize handles.
- [ ] **CORE-04**: Non-destructive AST writer (using recast-style Babel AST modification) preserves comments and formatting.
- [ ] **CORE-05**: Support React (JSX/TSX) framework adapter.
- [ ] **CORE-06**: Support Tailwind CSS class manipulation (adding, replacing, removing).
- [ ] **CORE-07**: Spacing editor (padding, margin) and layout editor (flex direction, justify, align, gap) in properties panel.
- [ ] **CORE-08**: Typography (font family, size, weight, color) and background/border/shadow/opacity editors in properties panel.
- [ ] **CORE-09**: Layers panel displays the full DOM tree and supports drag-and-drop layer reordering.
- [ ] **CORE-10**: Support undo/redo history (inverse diffing) in local server.
- [ ] **CORE-11**: Pretext integration (`@chenglou/pretext`) for accurate layout heights and text overflow validation.
- [ ] **CORE-12**: Support CSS Modules (`*.module.css`) and inline styles write-back.
- [ ] **CORE-13**: Support Vue framework adapter.
- [ ] **CORE-14**: Support Svelte framework adapter.
- [ ] **CORE-15**: Device preview toolbar for changing canvas width (Mobile, Tablet, Laptop, etc.).
- [ ] **CORE-16**: Breakpoint-scoped write-back (Tailwind `sm:`, `md:` prefixes, and CSS media queries).
- [ ] **CORE-17**: Smart snapping to grid and sibling elements with red distance lines.
- [ ] **CORE-18**: Rulers, guides, and zoom/pan controls.
- [ ] **CORE-19**: Asset panel for public images and Lucide/Heroicon icon picker.
- [ ] **CORE-20**: Next.js, Nuxt, and Astro framework adapters.
- [ ] **CORE-21**: VS Code extension to open file in editor when element is selected.

### Out of Scope

- Cloud synchronization and multiplayer collaboration (v1 focus is local solo dev).
- Design-to-code generation from scratch (Glide only edits existing code).
- Production build integration (dev mode only; zero runtime overhead in production).
- Native mobile (iOS/Android) support (web app overlay only).

## Context

Vibe-coding with AI has accelerated initial UI generation, but minor layout tweaks still require manual CSS value editing and browser reloading, or Figma-to-code copy-pasting. Glide bridges the gap by making the running browser application itself the canvas, translating visual edits back into source code automatically.

## Constraints

- **Execution Environment**: Node.js and modern browsers.
- **Styling Libraries**: Write-back must handle Tailwind, CSS Modules, inline styles, and raw CSS.
- **Non-Destructive AST edits**: Babel generator and framework parsers must preserve developer styling, comments, and structure.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vanilla TS/CSS for Overlay | Avoid framework conflicts inside user applications | — Pending |
| Build-time `data-cf-source` | Direct mapping of elements to source positions without heavy runtime overhead | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-27 after initialization*
