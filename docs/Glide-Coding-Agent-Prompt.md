# Glide — Coding Agent Build Prompt
## Complete Implementation Instructions Based on Wireframes

---

## WHAT YOU ARE BUILDING

You are building **Glide** (`glide-dev`), an npm package that adds a Figma-like visual canvas overlay to any running web app in development mode. The developer runs `npx glide dev` and a panel opens in their browser showing their app inside an iframe, with a full design tool UI surrounding it. Every visual edit the developer makes writes back to the actual source files in real time via WebSocket + AST manipulation.

This is NOT a design tool that exports code. The code already exists. Glide edits it.

---

## ARCHITECTURE OVERVIEW

```
npx glide dev
    ↓
1. Spawns user's dev server (Vite/Next/Nuxt/etc.)
2. Starts WebSocket server on ws://localhost:7778
3. Starts Glide overlay UI server on http://localhost:7777
4. Opens http://localhost:7777 in browser

Browser layout:
┌─────────────────────────────────────────────────────┐
│  TOOLBAR (top bar, full width)                      │
├──────────┬──────────────────────────────┬───────────┤
│  LAYERS  │        CANVAS                │ PROPERTIES│
│  PANEL   │  ┌─────────────────────┐    │  PANEL    │
│  (240px) │  │   App iframe        │    │  (280px)  │
│          │  │   + SVG overlay     │    │           │
│          │  └─────────────────────┘    │           │
├──────────┴──────────────────────────────┴───────────┤
│  TOAST / STATUS BAR (bottom)                        │
└─────────────────────────────────────────────────────┘
```

---

## MONOREPO FILE STRUCTURE

Build this as a pnpm/npm workspace monorepo:

```
glide-dev/
├── package.json                    # workspaces: ["packages/*"]
├── packages/
│   ├── cli/
│   │   └── src/index.ts            # entry: npx glide dev
│   ├── core/
│   │   └── src/
│   │       ├── types.ts            # GlideNode, StyleChange, EditMessage, etc.
│   │       ├── detect.ts           # detectFramework(), detectStyling()
│   │       └── adapter.ts          # FrameworkAdapter interface
│   ├── vite-plugin/
│   │   └── src/index.ts            # Vite plugin that stamps data-gl-source
│   ├── babel-plugin/
│   │   └── src/index.ts            # Babel plugin for JSX source stamping
│   ├── server/
│   │   └── src/
│   │       ├── ws-server.ts        # WebSocket server
│   │       └── undo-manager.ts     # undo/redo stack
│   ├── ast-writer/
│   │   └── src/
│   │       ├── index.ts            # write-back orchestrator
│   │       ├── style-writer.ts     # CSS/Tailwind decision tree
│   │       └── responsive.ts       # breakpoint-aware writes
│   ├── adapters/
│   │   ├── react/src/index.ts
│   │   ├── vue/src/index.ts
│   │   └── html/src/index.ts
│   └── overlay/                    # The visual UI (React app)
│       └── src/
│           ├── App.tsx
│           ├── bridge.ts           # Injected into user's app iframe
│           ├── store/scene.ts      # Jotai atoms
│           └── components/
│               ├── Toolbar.tsx
│               ├── LayersPanel.tsx
│               ├── Canvas.tsx
│               └── PropertiesPanel.tsx
```

---

## SCREEN 1: TOOLBAR

Reference: Top bar visible in both wireframe images.

### Visual spec
```
[⚡ Glide logo]  [React · Tailwind · Vite ▾]   [Mobile 375][Tablet 768][Laptop 1024][Desktop 1440][Custom]   [100% ▾]  [⊞ grid][⊟ guides][⚙ settings][⎇ branch]
```

### Implementation

**File:** `packages/overlay/src/components/Toolbar.tsx`

```tsx
// Toolbar renders three zones: left (logo + adapter badge), center (device presets), right (zoom + toggles)

// Device presets — exact pixel widths:
const DEVICES = [
  { label: 'Mobile 375', width: 375 },
  { label: 'Tablet 768', width: 768 },
  { label: 'Laptop 1024', width: 1024 },
  { label: 'Desktop 1440', width: 1440 },
  { label: 'Custom', width: null },
]

// Active device button highlighted with blue background (#0d99ff)
// Inactive buttons: transparent with muted text

// Adapter badge: reads detected framework + styling from config
// e.g. "React · Tailwind · Vite" — shown as a pill next to logo

// Zoom control: dropdown with options [50%, 75%, 100%, 125%, 150%, 200%]
// Keyboard: Ctrl+scroll also changes zoom

// Branching mode button (⎇): opens BranchingModeDialog
// Grid toggle: shows/hides 8px grid lines on canvas
// Guides toggle: shows/hides draggable guide lines
```

### Toolbar state (Jotai atoms)
```typescript
// packages/overlay/src/store/scene.ts
export const activeDeviceWidthAtom = atom<number>(1440)
export const zoomLevelAtom = atom<number>(1)
export const gridVisibleAtom = atom<boolean>(false)
export const guidesVisibleAtom = atom<boolean>(true)
export const branchingModeActiveAtom = atom<boolean>(false)
```

---

## SCREEN 2: LAYERS PANEL

Reference: Left sidebar in all wireframe screens. Screen 3 shows expanded tree with labels.

### Visual spec
- Width: 240px
- Dark background: `#1e1e1e`
- Row height: 28px
- Header: "Layers" label + search icon (magnifying glass)

### Each row structure
```
[indent][▶/▼ arrow][icon][tagName · ComponentName?][    ][👁 eye][🔒 lock]
```

### Row states (from Screen 3 legend)
- **Default:** muted text, transparent background
- **Hovered:** slightly lighter background
- **Selected:** blue highlight background `rgba(13, 153, 255, 0.15)`, blue left border
- **Hidden:** eye icon struck through, row text dimmed to 40% opacity
- **Locked:** lock icon filled, row has lock indicator, cannot be selected on canvas
- **Component root:** blue-tinted row background, `[ComponentName]` badge in blue pill next to tag

### Icons by element type
```typescript
const ELEMENT_ICONS = {
  div: BoxIcon,
  section: BoxIcon,
  main: BoxIcon,
  article: BoxIcon,
  p: TextIcon,
  span: TextIcon,
  h1: TextIcon, h2: TextIcon, h3: TextIcon, h4: TextIcon, h5: TextIcon, h6: TextIcon,
  img: ImageIcon,
  button: ComponentIcon,
  a: ComponentIcon,
  svg: VectorIcon,
  ul: ListIcon,
  li: ListIcon,
}
```

### Interactions
```
Click row              → set selectedIdsAtom to [nodeId]
Shift+click row        → add to selectedIdsAtom
Click ▶/▼ arrow       → toggle node expansion in expandedIdsAtom
Click 👁 eye icon      → send STYLE_CHANGE { property: 'display', value: 'none' } (toggle)
Click 🔒 lock icon     → add/remove nodeId from lockedIdsAtom
Drag row               → reorder; on pointerup send REORDER_CHILDREN WebSocket message
Click [ComponentName]  → send OPEN_FILE message to server to open file in editor
```

### Bottom bar (below layers list)
```
[+ add element]  [📷 screenshot]  [⬜ add frame]
```

---

## SCREEN 3: CANVAS VIEWPORT

Reference: Center of Screen 1 and Screen 2.

### Structure
```html
<div id="glide-canvas-wrap">
  <div id="glide-rulers-corner" />       <!-- 20×20px dead corner -->
  <div id="glide-ruler-h" />             <!-- horizontal ruler -->
  <div id="glide-ruler-v" />             <!-- vertical ruler -->
  <div id="glide-canvas-viewport"        <!-- zoom/pan transform applied here -->
       style="transform: scale(zoom) translate(panX, panY)">
    <iframe id="glide-app-frame"
            src="http://localhost:DEV_PORT"
            style="width: {deviceWidth}px; height: 100%" />
    <svg id="glide-overlay-svg"          <!-- drawn on top of iframe -->
         style="position:absolute; inset:0; pointer-events:none">
      <!-- selection boxes, handles, snap lines, distance indicators, guides -->
    </svg>
  </div>
</div>
```

### Rulers
- 20px tall (horizontal) / 20px wide (vertical)
- Background: `#2a2a2a`
- Tick marks drawn on `<canvas>` element inside the ruler div
- Tick marks update on zoom change
- `pointerdown` on ruler → drag creates a guide line
- Guide lines stored in `guidesAtom: atom<{axis: 'x'|'y', position: number}[]>`

### SVG overlay elements

**Selection bounding box:**
```svg
<rect
  x={bounds.x} y={bounds.y}
  width={bounds.width} height={bounds.height}
  stroke="#0d99ff" strokeWidth="1" fill="none"
/>
```

**8 resize handles (corners + edges):**
```svg
<!-- Each handle: 8×8px white rect with blue border, pointer-events:all -->
<rect x={hx-4} y={hy-4} width="8" height="8"
      fill="white" stroke="#0d99ff" strokeWidth="1"
      style="cursor: {handleCursor}; pointer-events: all" />
```
Handle cursors: `nw-resize`, `n-resize`, `ne-resize`, `e-resize`, `se-resize`, `s-resize`, `sw-resize`, `w-resize`

**Hover outline:**
```svg
<rect stroke="#0d99ff" strokeWidth="1" fill="none"
      strokeDasharray="4 2" opacity="0.6"
      x={hoverBounds.x} y={hoverBounds.y}
      width={hoverBounds.width} height={hoverBounds.height} />
```

**Distance indicators (red measurement lines):**
```svg
<line x1={x1} y1={y1} x2={x2} y2={y2}
      stroke="#ff4444" strokeWidth="1" />
<text fill="#ff4444" fontSize="11" fontFamily="monospace">{distance}px</text>
```
Show when: another element is within 100px of the selected element, during drag.

**Snap lines:**
```svg
<line stroke="rgba(0,120,255,0.7)" strokeWidth="1"
      x1={0} y1={snapY} x2={canvasWidth} y2={snapY} />
```
Snap threshold: 4px. Show during drag when element snaps to another element's edge/center.

**Source stamp badge (when element is selected):**
```
<foreignObject>
  <div style="background:#0d99ff; color:white; font:11px monospace; padding:2px 6px; border-radius:3px">
    Card.jsx:24:5
  </div>
</foreignObject>
```
Shown at top-right of selection bounding box.

**Device frame boundary:**
```svg
<rect stroke="#444" strokeWidth="1" strokeDasharray="6 3" fill="none"
      x={0} y={0} width={deviceWidth} height={frameHeight} rx="2" />
<!-- Label above frame: -->
<text fill="#666" fontSize="12">iframe ({deviceWidth}px)</text>
```

### Pointer event handling
```typescript
// Canvas intercepts pointerdown on a transparent div layered over the iframe
// On pointerdown:
//   1. Send postMessage to iframe bridge: { type: 'HIT_TEST', x, y }
//   2. Bridge responds with { type: 'HIT_TEST_RESULT', nodeId, bounds }
//   3. Set selectedIdsAtom

// During drag (pointermove):
//   1. Compute delta from dragStart
//   2. Move selection box in SVG (CSS transform) — live preview
//   3. Check snap against all GlideNode bounds in sceneNodesAtom
//   4. Draw snap lines and distance indicators

// On pointerup:
//   1. Send WebSocket STYLE_CHANGE message with final delta
//   2. Wait for ACK, then let HMR update the iframe
```

### Keyboard shortcuts
```typescript
const SHORTCUTS = {
  'Escape': () => selectedIdsAtom.set(new Set()),
  'ArrowUp': () => nudge(0, -1),
  'ArrowDown': () => nudge(0, 1),
  'ArrowLeft': () => nudge(-1, 0),
  'ArrowRight': () => nudge(1, 0),
  'Shift+ArrowUp': () => nudge(0, -10),
  'Shift+ArrowDown': () => nudge(0, 10),
  'Shift+ArrowLeft': () => nudge(-10, 0),
  'Shift+ArrowRight': () => nudge(10, 0),
  'ctrl+z': () => sendWS({ type: 'UNDO' }),
  'ctrl+shift+z': () => sendWS({ type: 'REDO' }),
  'ctrl+0': () => fitCanvas(),
  'ctrl+1': () => zoomLevelAtom.set(1),
  'ctrl+semicolon': () => guidesVisibleAtom.set(!guidesVisible),
  'h': () => activateHandTool(),
  'v': () => activateSelectTool(),
  'f': () => activateFrameTool(),
  't': () => activateTextTool(),
  'r': () => activateShapeTool(),
}
```

---

## SCREEN 4: PROPERTIES PANEL

Reference: Right sidebar. Screen 2 (annotated) shows all numbered controls.

### Visual spec
- Width: 280px
- Background: `#1e1e1e`
- Section headers: uppercase, 11px, muted color, with expand/collapse arrow
- Input fields: 32px tall, dark background `#2a2a2a`, border `#3a3a3a`

### Tabs (top of panel)
```
[Design] [Advanced] [Code]
```
Default: Design tab active.

### Section 1: Element Info
```
App > Layout > Hero > h1          ← breadcrumb, each segment clickable
📄 HeroSection.jsx:15             ← source file badge, blue, clickable
```

### Section 2: Position & Size
```
X: [120  ] px    Y: [180  ] px
W: [630  ] px    H: [64   ] px  [🔗]
Rot: [0°  ]
```
- X/Y: maps to element's left/top offset or margin
- W/H: width/height
- 🔗: lock aspect ratio toggle
- Rot: `transform: rotate(Ndeg)`
- All inputs: number, on blur → send STYLE_CHANGE

### Section 3: Layout (Flex) — show only when `computedStyle.display === 'flex'`
```
Direction:  [→ row ✓] [↓ col  ]
Justify:    [|←] [|↔|] [→|] [←→] [↕]      ← 5 buttons
Align:      [⬆] [↕] [⬇] [↕↕]              ← 4 buttons
Gap:        [24] px    Row gap: [24] px
Wrap:       [wrap toggle ○]
```
Each button maps exactly to a CSS flexbox value and writes the corresponding Tailwind class or CSS property.

### Section 4: Spacing
Visual box model diagram:
```
         [margin-top: 32   ]
[ml:32]  [  padding: 16    ]  [mr:32]
         [  630 × 64       ]
         [  padding: 16    ]
[ml:32]  [                 ]  [mr:32]
         [margin-bot: 32   ]
```
Click any number to edit inline. Tab moves to next input.

### Section 5: Fill & Background
```
Fill type: [None] [Solid ✓] [Gradient] [Image]

When Solid:
[■ white swatch] [#FFFFFF          ] [100 %]

When Gradient:
Type: [Linear ✓] [Radial]   Angle: [90°]
[gradient bar with draggable stops]
```

### Section 6: Typography — show only when element contains text
```
Font: [Inter                    ]
Size: [48  ] px   Weight: [700 ▾]
Line h: [1.2 ]    Letter: [-0.02] em
Align: [⬅][↔][➡][⬌]
Color: [■ #111827]
```

### Section 7: Border
```
Color: [■ #E5E7EB]   Width: [1] px   Style: [solid ▾]
TL: [12] TR: [12] BR: [12] BL: [12]  [🔗]
```

### Section 8: Shadow
```
[+ Add shadow]
X:[0] Y:[4] Blur:[16] Spread:[0] [■ #000000] [inset○] [🗑]
```

### Section 9: Opacity
```
[=========●] 100 %
```

### Collapsed sections
All sections start expanded. Click section header to collapse. Collapsed state stored in `collapsedSectionsAtom`.

---

## SCREEN 5: BRANCHING MODE DIALOG

Reference: Screen 4 in wireframes.

```
┌─────────────────────────────────────────┐
│                                         │
│            [⎇ git icon]                 │
│                                         │
│       Glide Branching Mode              │
│  Edit visually on a safe git branch.   │
│  Merge when ready.                      │
│                                         │
│  Glide will create a new branch         │
│  'glide/visual-edit-[timestamp]'        │
│  and route all source edits to it.      │
│  When satisfied, finalize to commit     │
│  and optionally open a pull request.    │
│                                         │
│  Branch name:                           │
│  [glide/visual-edit-2026-07-04    ]     │
│                                         │
│  [    Start Editing    ]  [ Cancel ]    │
│                                         │
└─────────────────────────────────────────┘
```

### Implementation
```typescript
// packages/server/src/branching.ts
async function createBranch(branchName: string) {
  await exec(`git checkout -b ${branchName}`)
  // All subsequent fs.writeFileSync calls now write to this branch
  activeBranch = branchName
}

async function finalizeBranch(message: string) {
  await exec(`git add -A`)
  await exec(`git commit -m "${message}"`)
  // Optional: open PR via gh CLI
}
```

---

## SCREEN 6: WRITE-BACK TOAST

Reference: Bottom of Screen 5 in wireframes.

```
[✓ green] Card.jsx updated · ml-4 → ml-6 · HMR refreshed    [undo]
```

### Implementation
```typescript
// packages/overlay/src/components/Toast.tsx
// Appears bottom-center of canvas after successful write
// Auto-dismisses after 3000ms
// "undo" link sends UNDO WebSocket message

type ToastMessage = {
  type: 'success' | 'error'
  file: string        // "Card.jsx"
  change: string      // "ml-4 → ml-6"
  hmr: boolean        // whether HMR fired
}
```

Green pill: `background: #22c55e`
Error pill: `background: #ef4444`

---

## BRIDGE SCRIPT (injected into iframe)

**File:** `packages/overlay/src/bridge.ts`

This script runs inside the user's app iframe. It:

1. Walks the DOM finding all `[data-gl-source]` elements
2. Builds a `GlideNode[]` scene graph
3. Posts it to parent: `window.parent.postMessage({ type: 'GLIDE_SCENE_GRAPH', nodes }, '*')`
4. Re-runs on `MutationObserver` (catches HMR updates)
5. Re-runs on `ResizeObserver` (catches layout shifts)
6. Responds to hit-test requests from parent

```typescript
// GlideNode shape:
type GlideNode = {
  id: string                    // data-gl-source value: "src/Card.jsx:24:5"
  tagName: string               // lowercase element tag
  bounds: DOMRect               // from getBoundingClientRect()
  computedStyles: CSSProperties // from getComputedStyle()
  children: string[]            // child node ids
  parentId: string | null
  componentName: string | null  // detected React/Vue component name
  componentFile: string | null  // file where component is defined
  isComponentRoot: boolean      // is this the root element of a component?
}
```

---

## BUILD-TIME SOURCE STAMPING

**File:** `packages/babel-plugin/src/index.ts`

Stamps every JSX element at dev build time with its source location:

```jsx
// Before:
<div className="card">

// After (dev only):
<div className="card" data-gl-source="src/components/Card.jsx:12:3">
```

**Rules:**
- Only runs when `NODE_ENV !== 'production'`
- Uses `@babel/core` visitor on `JSXOpeningElement`
- Attribute name is ALWAYS `data-gl-source` — never any other name
- Value format: `"{relativePath}:{line}:{col}"` (1-indexed line, 0-indexed col)
- Never modifies production builds

---

## WEBSOCKET PROTOCOL

**Server:** `ws://localhost:7778`

### Browser → Server messages

```typescript
// Style change (move, resize, color, spacing, etc.)
{ type: 'STYLE_CHANGE', file: string, line: number, col: number,
  change: { property: string, value: string|number, unit?: string },
  viewportWidth: number }

// Reorder children (layer drag)
{ type: 'REORDER_CHILDREN', file: string,
  parentLine: number, parentCol: number,
  fromIndex: number, toIndex: number }

// Undo / Redo
{ type: 'UNDO' }
{ type: 'REDO' }

// Open file in editor
{ type: 'OPEN_FILE', file: string, line: number }

// Git branching
{ type: 'CREATE_BRANCH', branchName: string }
{ type: 'FINALIZE_BRANCH', message: string }
```

### Server → Browser messages
```typescript
{ type: 'ACK', success: boolean, error?: string }
{ type: 'BRANCH_CREATED', branchName: string }
```

---

## AST WRITE-BACK ENGINE

**File:** `packages/ast-writer/src/index.ts`

### Algorithm (non-destructive)
```
1. Read file from disk as string (originalSource)
2. Parse to AST using framework adapter
3. Find target node at (line, col)
4. Determine write strategy (see decision tree below)
5. Mutate ONLY the target node's attribute in AST
6. Serialize ONLY that node range back to string
7. Splice into originalSource using node.start / node.end offsets
8. Write patched string to disk with fs.writeFileSync()
9. Push { file, before: originalSource, after: patched } to undoStack
```

### Styling decision tree (Tailwind mode)
```
incoming: { property: 'marginLeft', value: 16, unit: 'px' }
    ↓
Is 16px a Tailwind step? (4px = 1 unit, so 16px = ml-4) → YES
    ↓
Find className attr on JSX node
    ↓
Remove any existing ml-* class from className string
    ↓
Is viewportWidth >= 768? → write "md:ml-4" (responsive prefix)
Is viewportWidth < 768?  → write "ml-4" (no prefix, mobile-first)
    ↓
Append new class to className
    ↓
Write file
```

### Tailwind px → class mapping (must be complete)
```
4px  → *-1    8px  → *-2    12px → *-3    16px → *-4
20px → *-5    24px → *-6    28px → *-7    32px → *-8
36px → *-9    40px → *-10   48px → *-12   64px → *-16
80px → *-20   96px → *-24
```
Where `*` is the property prefix: `m`, `mt`, `mr`, `mb`, `ml`, `p`, `pt`, `pr`, `pb`, `pl`, `gap`, etc.

### RULES FOR WRITE-BACK
- NEVER call prettier, eslint, or any formatter
- NEVER rewrite lines outside the target node's range
- NEVER write to files matching `glide.config.exclude` patterns
- NEVER write to `node_modules`
- NEVER write to files outside the project root
- If a px value does not map to a standard Tailwind step, fall back to inline style

---

## FRAMEWORK AUTO-DETECTION

**File:** `packages/core/src/detect.ts`

```typescript
// Detection order — stop at first match:
// 1. Check package.json dependencies
//    react/react-dom → 'react'
//    vue → 'vue'
//    svelte → 'svelte'
// 2. Check config files
//    next.config.* → 'react'
//    nuxt.config.* → 'vue'
//    astro.config.* → 'astro'
// 3. Check file extensions in src/
//    .jsx/.tsx → 'react'
//    .vue → 'vue'
//    .svelte → 'svelte'
// 4. Fallback → 'html'

// Styling detection:
// tailwind.config.* exists OR 'tailwindcss' in deps → 'tailwind'
// 'styled-components' in deps → 'styled-components'
// *.module.css files in src/ → 'cssmodules'
// fallback → 'css'
```

---

## STATE MANAGEMENT

Use **Jotai** (`import { atom, useAtom } from 'jotai'`) for ALL overlay state.

```typescript
// packages/overlay/src/store/scene.ts

// Scene graph (from bridge)
export const sceneNodesAtom = atom<Map<string, GlideNode>>(new Map())

// Selection
export const selectedIdsAtom = atom<Set<string>>(new Set())
export const hoveredIdAtom = atom<string | null>(null)
export const lockedIdsAtom = atom<Set<string>>(new Set())

// Canvas
export const zoomLevelAtom = atom<number>(1)
export const panOffsetAtom = atom<{x: number, y: number}>({x: 0, y: 0})
export const activeToolAtom = atom<'select'|'frame'|'text'|'shape'|'pan'>('select')
export const activeDeviceWidthAtom = atom<number>(1440)
export const guidesAtom = atom<{axis:'x'|'y', position:number}[]>([])
export const guidesVisibleAtom = atom<boolean>(true)
export const gridVisibleAtom = atom<boolean>(false)

// UI
export const expandedLayerIdsAtom = atom<Set<string>>(new Set())
export const collapsedSectionsAtom = atom<Set<string>>(new Set())
export const toastAtom = atom<ToastMessage | null>(null)
export const branchingModeActiveAtom = atom<boolean>(false)
export const activeBranchAtom = atom<string | null>(null)
```

---

## DEPENDENCIES

### Runtime (packages/overlay)
```json
{
  "jotai": "^2.0.0",
  "react": "^18.0.0",
  "react-dom": "^18.0.0",
  "@chenglou/pretext": "latest"
}
```

### Runtime (packages/server + packages/ast-writer)
```json
{
  "ws": "^8.0.0",
  "@babel/core": "^7.0.0",
  "@babel/parser": "^7.0.0",
  "@babel/traverse": "^7.0.0",
  "@babel/generator": "^7.0.0",
  "@babel/types": "^7.0.0",
  "@babel/helper-plugin-utils": "^7.0.0",
  "@vue/compiler-sfc": "^3.0.0",
  "postcss": "^8.0.0",
  "parse5": "^7.0.0",
  "magic-string": "^0.30.0",
  "chokidar": "^3.0.0",
  "glob": "^10.0.0",
  "picocolors": "^1.0.0"
}
```

### DevDependencies (monorepo root)
```json
{
  "typescript": "^5.0.0",
  "turbo": "latest",
  "tsup": "^8.0.0",
  "vite": "^5.0.0"
}
```

---

## WHAT TO BUILD FIRST (Phase 1)

Build in this exact order:

1. **Monorepo scaffold** — pnpm workspaces, tsconfig, turbo.json
2. **`packages/core/src/types.ts`** — all shared types (GlideNode, StyleChange, EditMessage, etc.)
3. **`packages/core/src/detect.ts`** — framework + styling detection
4. **`packages/babel-plugin`** — JSX source stamping (test this first, it's the foundation)
5. **`packages/vite-plugin`** — wraps babel plugin in Vite transform hook
6. **`packages/server/src/ws-server.ts`** — WebSocket server, basic message routing
7. **`packages/overlay/src/bridge.ts`** — scene graph builder, postMessage system
8. **`packages/overlay/src/App.tsx`** — basic 3-panel shell (no functionality yet)
9. **`packages/overlay/src/components/Canvas.tsx`** — iframe + SVG overlay, click-to-select
10. **`packages/overlay/src/components/LayersPanel.tsx`** — tree view from scene graph
11. **`packages/ast-writer/src/index.ts`** — write-back engine (React + Tailwind only first)
12. **End-to-end test** — click element → drag → see source file update → HMR fires
13. **`packages/overlay/src/components/PropertiesPanel.tsx`** — all sections
14. **`packages/overlay/src/components/Toolbar.tsx`** — device presets, zoom, toggles
15. **`packages/cli/src/index.ts`** — `npx glide dev` command
16. **Branching mode** — git branch creation + finalize

---

## WHAT NOT TO BUILD

- ❌ No vector/pen tool (no SVG path editing)
- ❌ No component creation from scratch
- ❌ No cloud sync or multiplayer
- ❌ No production mode integration
- ❌ No WebGL renderer (Canvas 2D + SVG only)
- ❌ No WASM
- ❌ No Angular adapter (v1)
- ❌ No prettier/eslint calls in write-back
- ❌ No regex-based class manipulation (always use AST)
- ❌ No localStorage or sessionStorage in bridge or overlay

---

## TESTING THE ROUND TRIP

The end-to-end test that proves the system works:

```
1. Create a test React + Tailwind + Vite project
2. Run `npx glide dev` in that project
3. Click on the <h1> element in the canvas
4. Drag it 16px to the right
5. EXPECTED: Card.jsx (or whatever file) is updated with ml-4
6. EXPECTED: Vite HMR fires within 150ms
7. EXPECTED: iframe refreshes with new position
8. EXPECTED: Toast appears: "Card.jsx updated · ml-4 added · HMR refreshed"
9. Press Ctrl+Z
10. EXPECTED: file reverts, HMR fires, element returns to original position
```

This single loop is the entire value proposition. Build everything else around making this work perfectly.
