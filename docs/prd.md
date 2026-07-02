# Product Requirements Document
## Glide — A Code-Native Visual Design Tool

**Version:** 0.1 Draft  
**Status:** In Review  
**Author:** Srivarsan  
**Last Updated:** June 2026

---

## 1. Overview

### 1.1 Product Summary

Glide is an open-source developer package that brings a Figma-like visual canvas directly into the development workflow. Developers run their existing app, open a canvas overlay in the browser, and manipulate elements visually — moving, resizing, restyling, reordering — while every change writes back to actual source code in real time. No export step. No MCP bridge. No context switching. The code is always the source of truth.

### 1.2 The Problem

Vibe-coding with AI has made it fast to generate UI code, but iterating on layouts still requires either:

- Blindly tweaking CSS numbers and reloading, or
- Designing in Figma and bridging changes back to code via MCP or copy-paste

Both workflows break the flow state. The first is slow and imprecise. The second creates a permanent gap between the design file and the codebase — they drift apart immediately.

There is no tool that lets a developer touch a running UI visually and have those changes live in their source files as clean, idiomatic code.

### 1.3 The Solution

Glide injects a thin overlay script into the dev server. That overlay reads the live DOM, understands which source file and line every element came from, and renders a Figma-like canvas on top. When the developer makes a visual change, a local Node.js server receives the change via WebSocket, parses the source file's AST, and writes back the minimal edit — preserving formatting, comments, and code style.

The result feels like Figma, but the output is always real, runnable, git-diffable code.

---

## 2. Goals & Non-Goals

### 2.1 Goals

- Let developers visually design UI without leaving their browser or IDE
- Write changes back to source code non-destructively in any framework
- Support all major web frameworks via an auto-detected adapter system
- Replicate Figma's core canvas interactions (select, move, resize, layers, flex controls, text, color, spacing)
- Support responsive design with per-breakpoint editing
- Support device preview (mobile, tablet, desktop, custom)
- Leverage `@chenglou/pretext` for accurate, reflow-free text measurement
- Ship as a single npm package that wraps around any dev server with one line

### 2.2 Non-Goals (v1)

- This is not a replacement for Figma for designers — it targets developers
- No cloud sync or collaborative multiplayer in v1
- No native mobile (iOS/Android) support in v1 — web only
- No design-to-code generation from scratch — it edits existing code only
- No production build integration — dev mode only

---

## 3. Target Users

### Primary: Vibe-coders and solo dev-designers

Developers who write their own UI, use AI to generate components, and want to iterate on layout and spacing without touching raw CSS values manually. They know their codebase but find pixel-nudging in code tedious.

### Secondary: Indie hackers and startup frontend devs

Small teams building products fast. They want Figma-level control without the Figma-to-code friction. They'll use this to polish layouts quickly before shipping.

### Tertiary: AI coding tool builders

Tools like Cursor, Windsurf, and similar IDEs looking to embed a visual layer into their coding assistant. Glide's architecture (WebSocket server + overlay script) is designed to be embeddable.

---

## 4. Architecture

### 4.1 System Components

```
┌─────────────────────────────────────────────────────────┐
│                    Browser                              │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Canvas Overlay (SVG + HTML)            │  │  ← selection, handles, layers panel, 
│  │  ┌────────────────────────────────────────────┐  │  │    properties panel, device toolbar
│  │  │        App iframe (user's running app)     │  │  │
│  │  │        + injected overlay-bridge.js        │  │  │  ← stamps data-source attrs,
│  │  │                                            │  │  │    reports element positions
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
│                         │ WebSocket                     │
└─────────────────────────│───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                Local Node.js Server                     │
│                                                         │
│  ┌───────────────┐   ┌──────────────┐  ┌────────────┐  │
│  │ WebSocket     │   │ AST Writer   │  │ Framework  │  │
│  │ Handler       │──▶│ (Babel core) │─▶│ Adapter    │  │
│  └───────────────┘   └──────────────┘  └─────┬──────┘  │
│                                               │         │
│                                    ┌──────────▼──────┐  │
│                                    │  Source Files   │  │
│                                    │  (fs.write)     │  │
│                                    └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │ HMR
                    Vite / Webpack
                    picks up change →
                    browser updates
```

### 4.2 Data Flow for a Single Edit

```
Developer drags element 16px right
        ↓
Overlay captures pointer delta, computes new position
        ↓
Reads element's data-source attr → "src/Card.jsx:24:5"
        ↓
Sends { file, line, col, change: { property: 'marginLeft', value: 16 } } via WebSocket
        ↓
Server opens Card.jsx, parses AST with Babel
        ↓
Framework adapter (React) locates JSX node at line 24
        ↓
Write-back engine decides: project uses Tailwind → maps 16px to ml-4
        ↓
Replaces existing ml-* class or adds ml-4 to className string
        ↓
Writes file. Vite HMR fires. Browser updates element.
        ↓
Overlay re-reads element position, snaps selection box
```

Round trip target: < 150ms on local dev server.

### 4.3 Framework Auto-Detection

On startup, Glide scans the project root:

```
Check package.json dependencies:
  react → React adapter
  vue → Vue adapter
  svelte → Svelte adapter
  @angular/core → Angular adapter

Check config files:
  vite.config.ts / next.config.js / nuxt.config.ts / astro.config.mjs

Check file extensions:
  .jsx / .tsx → React
  .vue → Vue SFC
  .svelte → Svelte

Check styling:
  tailwind.config.* → Tailwind mode
  *.module.css → CSS Modules mode
  styled-components in deps → SC mode
  plain CSS → Raw CSS mode
```

Detected config is displayed in the canvas toolbar so the developer always knows what adapter is active.

### 4.4 Framework Adapter Interface

Each adapter implements this TypeScript interface:

```typescript
interface FrameworkAdapter {
  // Parse a source file and return its AST
  parseFile(filePath: string, source: string): AST

  // Locate a node by file position
  resolveNode(ast: AST, line: number, col: number): ASTNode | null

  // Apply a style change to a node
  applyStyleChange(node: ASTNode, change: StyleChange): void

  // Reorder children (drag layers)
  reorderChildren(parent: ASTNode, fromIndex: number, toIndex: number): void

  // Serialize AST back to source string
  generate(ast: AST, originalSource: string): string
}
```

The generate step uses `@babel/generator` (React/JSX), `@vue/compiler-sfc` (Vue), or the Svelte compiler — each preserving the original file's formatting as much as possible.

### 4.5 Styling Write-Back Decision Tree

```
Incoming change: { property: 'marginLeft', value: 16 }
        │
        ├── Styling mode = Tailwind?
        │       ├── Is 16px a valid Tailwind step? (4 = 1rem = 16px → ml-4) → YES
        │       ├── Does element already have ml-*? → Replace
        │       ├── Is element in a flex container? → Suggest gap instead
        │       └── Write: className="... ml-4"
        │
        ├── Styling mode = CSS Modules?
        │       ├── Find the .module.css file for this component
        │       ├── Locate the relevant rule
        │       └── Write: margin-left: 16px;
        │
        ├── Styling mode = Styled Components?
        │       ├── Find the styled.div`` block
        │       └── Update the CSS-in-JS property
        │
        └── Styling mode = Raw CSS / inline?
                └── Write inline style or update linked stylesheet
```

### 4.6 Text Measurement with Pretext

All text element bounding boxes in the canvas overlay are computed using `@chenglou/pretext`:

```typescript
import { prepare, layout } from '@chenglou/pretext'

// When a text element is selected or resized:
function getTextHeight(text: string, font: string, containerWidth: number, lineHeight: number) {
  const prepared = prepare(text, font)
  const { height, lineCount } = layout(prepared, containerWidth, lineHeight)
  return height
}
```

This means:
- Text bounding boxes in the layer panel are accurate before the browser renders
- Auto-height text boxes grow correctly as you type
- Responsive preview text reflows correctly when device width changes
- Works for all languages including RTL, CJK, and mixed scripts

---

## 5. Feature Specification

### 5.1 Canvas

#### 5.1.1 Element Selection
- Click any element on the live app to select it
- Selection shows a blue bounding box with 8 resize handles (corners + edges)
- Shift-click to add to selection (multi-select)
- Click-drag on empty canvas to draw a selection rect (marquee select)
- Press Escape to deselect
- Arrow keys nudge selected element by 1px; Shift+Arrow by 10px

#### 5.1.2 Move
- Drag any selected element to move it
- Position delta translated to appropriate CSS (margin, position offset, or flex order)
- Smart detection: if element is in a flex container, moving horizontally adjusts `order` or suggests `gap` change rather than adding `margin-left`

#### 5.1.3 Resize
- Drag corner/edge handles to resize
- Shift-drag corner to resize proportionally
- Live preview updates as you drag before committing to source
- Double-click a resize handle to set to `auto` / content size

#### 5.1.4 Smart Snap
- Elements snap to each other's edges and centers during drag
- Red distance lines appear between elements (Figma-style spacing indicator)
- Snap to canvas grid (toggleable, 8px default)
- Snap to guides (draggable ruler lines)

#### 5.1.5 Rulers & Guides
- Rulers on top and left edges of the canvas
- Drag from ruler to create a guide line
- Guides snap to 8px grid
- Double-click guide to remove it
- Toggle guides visibility with Ctrl+;

#### 5.1.6 Zoom & Pan
- Ctrl+scroll to zoom canvas
- Space+drag to pan canvas
- Ctrl+0 to fit canvas to screen
- Ctrl+1 for 100%, Ctrl+2 for 200%
- Zoom level shown in toolbar

### 5.2 Layers Panel

- Left sidebar showing the full DOM/component tree of the running app
- Each layer shows element type and component name (e.g. `div · Card`)
- Indent shows nesting depth
- Drag layer rows to reorder → rewrites children order in source
- Click eye icon to toggle `display: none` (adds class or inline style, dev-only)
- Click lock icon to toggle `pointer-events: none`
- Clicking a layer selects it on canvas and vice versa
- Component boundaries highlighted with a different color than DOM elements
- Clicking a component name shows option: "Edit this instance" or "Go to component definition"

### 5.3 Properties Panel

Right sidebar that updates based on current selection.

#### 5.3.1 Position & Size
```
X: [___]  Y: [___]
W: [___]  H: [___]  🔗 (lock aspect ratio)
Rotation: [___]°
```

#### 5.3.2 Layout (Flex)
When a flex container is selected:
```
Direction:  [→ Row] [↓ Col]
Justify:    [⬅] [↔] [➡] [⬌] [⬍]
Align:      [⬆] [↕] [⬇] [↕↕]
Gap:        [___]  Row gap: [___]
Wrap:       [Wrap] [No Wrap]
```
Each control writes the corresponding Tailwind class or CSS property directly.

#### 5.3.3 Spacing
Visual box model editor:
```
        [ margin-top   ]
[ ml ] [  padding-top  ] [ mr ]
       [ padding-left  ]
       [ content       ]
       [ padding-right ]
[ ml ] [ padding-bottom] [ mr ]
        [ margin-bottom]
```
Click any value to edit. Shows Tailwind class equivalent when in Tailwind mode.

#### 5.3.4 Typography
```
Font family: [Inter ▾]
Size: [16] px    Weight: [400 ▾]
Line height: [1.5]   Letter spacing: [0]
Align: [⬅][↔][➡][↔↔]
Color: [■ #1A1A1A]
Decoration: [U] [I] [S]
```
Detects and edits design tokens (`text-xl`, `$font-heading`, `--font-size-body`) rather than raw values when possible.

#### 5.3.5 Fill & Background
```
Fill type: [None] [Solid] [Gradient] [Image]
Color: [■] #3B82F6   Opacity: [100%]
```
Color picker shows project's detected CSS variable palette for quick selection.

Gradient editor:
- Drag stops along gradient bar
- Click stop to edit color
- Select Linear / Radial / Conic
- Writes: `background: linear-gradient(...)` or Tailwind equivalent

#### 5.3.6 Border
```
Border: [■ color]  Width: [1]px  Style: [solid ▾]
Radius: [TL: 4] [TR: 4] [BR: 4] [BL: 4]  🔗
```

#### 5.3.7 Shadow
```
[+ Add shadow]
X: [0]  Y: [4]  Blur: [6]  Spread: [0]  Color: [■]  [Inset]
```

#### 5.3.8 Opacity
```
Opacity: [====●====] 100%
```

### 5.4 Responsive & Device Preview

Toolbar at the top of the canvas:

```
[Mobile S 320] [Mobile M 375] [Mobile L 425] [Tablet 768] [Laptop 1024] [Desktop 1440] [4K 2560] [Custom: ___]
```

- Changes the canvas iframe width
- When editing at a specific breakpoint, write-back is scoped:
  - Tailwind: writes responsive prefix (`sm:ml-4`, `md:px-8`)
  - CSS: writes inside appropriate `@media` query
- Indicator shows which breakpoint is currently active and which classes are breakpoint-scoped

### 5.5 Asset Panel

Bottom or floating panel:

- Scans `/public`, `/assets`, `/images`, `/src/assets` for images
- Drag image onto canvas → writes `<img src="...">` or sets `background-image`
- If `lucide-react` or `heroicons` is in deps, shows searchable icon picker
- Drag icon onto canvas → writes correct import and JSX

### 5.6 Component Detection & Editing

When an element is selected inside a component:
- Breadcrumb shows: `App > Layout > Card > div`
- Banner at bottom of properties panel: "Inside `<Card>` (Card.jsx:8)"
- Two actions: 
  - "Edit here" — edits this specific instance's inline style
  - "Edit component" — jumps to the component definition and selects the root node there

### 5.7 Canvas UI — Toolbar

```
[Glide logo] [React · Tailwind · Vite]  [Mobile 375px ▾]  [100% ▾]  [Grid] [Guides] [⚙]
                  (adapter badge)
```

---

## 6. CLI & Setup

### 6.1 Installation

```bash
npm install --save-dev glide
# or
npx glide init
```

### 6.2 Usage

```bash
# Starts your existing dev server + Glide overlay
npx glide dev

# Or wrap your existing command:
npx glide -- vite dev
npx glide -- next dev
npx glide -- nuxt dev
```

### 6.3 Config (optional)

`glide.config.ts`:

```typescript
export default {
  port: 7777,           // Glide server port (default: 7777)
  adapter: 'react',    // Override auto-detection
  styling: 'tailwind', // Override styling auto-detection
  snapGrid: 8,          // Snap grid size in px
  exclude: [            // Files never written to
    'src/generated/**',
    '**/*.test.*'
  ]
}
```

### 6.4 Vite Plugin (alternative)

For tighter integration:

```typescript
// vite.config.ts
import { glide } from 'glide/vite'

export default defineConfig({
  plugins: [glide()]
})
```

---

## 7. Technical Stack

### 7.1 Package Dependencies

| Dependency | Role |
|---|---|
| `@babel/parser` | Parse JSX/TSX to AST |
| `@babel/traverse` | Walk and locate AST nodes |
| `@babel/generator` | Serialize AST back to source |
| `@vue/compiler-sfc` | Parse and generate Vue SFCs |
| `svelte/compiler` | Parse and generate Svelte files |
| `@chenglou/pretext` | Accurate text measurement (no DOM reflow) |
| `ws` | WebSocket server (Node.js) |
| `chokidar` | File watcher for external changes |
| `picocolors` | CLI output |

### 7.2 Overlay Stack

The canvas overlay is a self-contained web app (no framework dependency — vanilla TS + CSS):
- SVG layer for selection boxes, handles, guides, snap lines
- HTML panels for layers, properties, toolbar
- Pointer Events API for drag interactions
- ResizeObserver to track element position changes from HMR updates

### 7.3 Build-Time Transform

A Babel plugin (or Vite transform) runs at dev build time and stamps every JSX/HTML element with a `data-cf-source` attribute:

```jsx
// Before transform
<div className="card">

// After transform (dev only, stripped in production)
<div className="card" data-cf-source="src/Card.jsx:12:3">
```

This is how the overlay knows which source file and line to edit.

---

## 8. Write-Back Safety

### 8.1 Non-Destructive Editing

The AST writer must never:
- Reformat code outside the edited node
- Remove comments
- Change quote style or semicolon usage
- Affect untouched lines

It uses Babel's `recast`-style approach: parse the AST, mutate only the target node, and regenerate only that node's string range back into the original source.

### 8.2 Undo / Redo

- Every write is recorded as a diff
- Ctrl+Z in the canvas overlay sends an undo command to the server
- Server applies the inverse diff to the file
- Undo history is per-session (cleared on server restart)

### 8.3 File Exclusions

Files matching `exclude` patterns in config are never written to. The overlay still displays them visually but shows them as read-only in the layers panel.

### 8.4 Production Guard

The Babel transform is automatically stripped in production builds (`NODE_ENV=production`). The overlay server never starts in production. Zero runtime overhead in deployed apps.

---

## 9. Pretext Integration Details

`@chenglou/pretext` is used in two places:

**In the overlay (browser):**
- Computing text element heights for bounding box display before the browser reflows
- Auto-height text boxes that update live as you resize the container width

**In the server (Node.js):**
- Pre-validating that a text element won't overflow its container after a font-size or width change
- Checking if a button label will truncate after a copy change

```typescript
// Example: check if text fits before committing resize
import { prepare, layout } from '@chenglou/pretext'

function willTextOverflow(text: string, font: string, newWidth: number, lineHeight: number, maxLines: number) {
  const prepared = prepare(text, font)
  const { lineCount } = layout(prepared, newWidth, lineHeight)
  return lineCount > maxLines
}
```

---

## 10. Milestones & Phased Rollout

### Phase 1 — Proof of Concept (Weeks 1–4)
- Vite plugin that stamps `data-cf-source` attributes
- Basic overlay with click-to-select and bounding box display
- WebSocket server + file write for a single property (className)
- React + Tailwind only
- Move and resize working end-to-end

### Phase 2 — Core Feature Set (Weeks 5–10)
- Full properties panel (spacing, typography, color, flex)
- Layers panel with reorder
- Undo/redo
- Pretext integration for text measurement
- CSS Modules and inline style write-back modes
- Vue adapter

### Phase 3 — Responsive & Polish (Weeks 11–16)
- Device preview toolbar
- Responsive write-back (Tailwind breakpoint prefixes, media queries)
- Svelte adapter
- Asset panel (images, icons)
- Smart snap and distance indicators
- Component detection and navigation

### Phase 4 — Ecosystem (Weeks 17–24)
- Next.js, Nuxt, Astro adapters
- VS Code extension: clicking a layer opens the file in editor
- Plugin API so community can add adapters
- Embeddable mode for IDE integrations (Cursor, Windsurf)
- Public docs site + demo video

---

## 11. Success Metrics

| Metric | Target |
|---|---|
| End-to-end edit latency | < 150ms |
| Framework auto-detection accuracy | > 95% on top 10 frameworks |
| Write-back non-destructive rate | 100% (no reformatting outside edit) |
| GitHub stars at 3 months | 1,000+ |
| Weekly active installs at 6 months | 500+ |
| Issues filed for broken write-back | < 5% of edits |

---

## 12. Open Questions

- Should the canvas overlay live in a browser extension or as an injected script? Extension has better isolation; injected script is simpler to install.
- How to handle CSS-in-JS libraries like Emotion or Stitches where styles are computed at runtime and can't be statically edited?
- Should we support editing design tokens (CSS variables, Tailwind theme values) directly from the canvas? This would be a high-value feature but complex to implement.
- What is the right model for Angular support given Angular's template syntax is significantly different from JSX?
- How do we handle elements generated by `Array.map()` — selecting one instance vs editing the template?

---

## 13. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| AST write-back breaks edge-case syntax | Medium | Extensive test suite; always write to a temp file and validate before committing |
| HMR doesn't pick up changes fast enough | Low | Direct Vite plugin integration bypasses normal file-watch latency |
| Overlay conflicts with app's own event listeners | Medium | Overlay intercepts pointer events at the top layer; app events paused while canvas tool is active |
| Pretext font measurement differs from browser render | Low | Pretext uses the browser's own canvas engine for measurement — ground truth is the same |
| Users accidentally commit `data-cf-source` attributes | Low | Attributes only injected in dev mode; production build strips them via the Babel plugin |

---

*End of PRD v0.1*