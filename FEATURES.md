# Glide — FEATURES.md
## Authoritative Technical Specification for AI Agents

> **Purpose:** This document exists to prevent hallucination. Every feature listed here
> describes the EXACT mechanism, the EXACT API, and the EXACT file/package involved.
> Do not invent abstractions not listed here. Do not guess at API names.
> If something is marked ⛔ DO NOT, never do it regardless of how natural it seems.

---

## TABLE OF CONTENTS

1. [Package Entry Point & CLI](#1-package-entry-point--cli)
2. [Build-Time Transform — Source Stamping](#2-build-time-transform--source-stamping)
3. [Local WebSocket Server](#3-local-websocket-server)
4. [In-Browser Bridge Script](#4-in-browser-bridge-script)
5. [Scene Graph](#5-scene-graph)
6. [Canvas Overlay](#6-canvas-overlay)
7. [Framework Auto-Detection](#7-framework-auto-detection)
8. [Framework Adapters](#8-framework-adapters)
9. [Styling Mode Detection](#9-styling-mode-detection)
10. [AST Write-Back Engine](#10-ast-write-back-engine)
11. [Styling Write-Back Decision Tree](#11-styling-write-back-decision-tree)
12. [Text Measurement — Pretext](#12-text-measurement--pretext)
13. [Undo / Redo](#13-undo--redo)
14. [Device Preview](#14-device-preview)
15. [Responsive Write-Back](#15-responsive-write-back)
16. [Canvas Features — Exact Behaviour](#16-canvas-features--exact-behaviour)
17. [Properties Panel — Exact Fields](#17-properties-panel--exact-fields)
18. [Layers Panel — Exact Behaviour](#18-layers-panel--exact-behaviour)
19. [File & Folder Layout](#19-file--folder-layout)
20. [Third-Party Dependencies — Exact Package Names](#20-third-party-dependencies--exact-package-names)
21. [What Glide Does NOT Do](#21-what-glide-does-not-do)

---

## 1. Package Entry Point & CLI

### Published package name
```
glide-dev
```

### Installation
```bash
npm install --save-dev glide-dev
```

### CLI commands (entry: `packages/cli/src/index.ts`)

| Command | What it does |
|---|---|
| `npx glide dev` | Starts user's dev server + Glide overlay server + WebSocket server |
| `npx glide dev -- vite` | Wraps `vite` and adds Glide on top |
| `npx glide dev -- next dev` | Wraps `next dev` |
| `npx glide dev -- nuxt dev` | Wraps `nuxt dev` |

### What `npx glide dev` starts (in order)
1. Spawns the user's dev server as a child process (port auto-detected or from config)
2. Starts the Glide WebSocket server on `ws://localhost:7778`
3. Starts the Glide overlay UI server on `http://localhost:7777`
4. Opens `http://localhost:7777` in the default browser
5. The overlay page renders the user's app in an `<iframe>` pointed at `http://localhost:<DEV_PORT>`

### Config file (optional, project root)
**Filename:** `glide.config.ts`
```typescript
export default {
  port: 7777,           // Glide UI server port
  wsPort: 7778,         // WebSocket server port
  devPort: 5173,        // User's dev server port (auto-detected if omitted)
  adapter: 'auto',      // 'react' | 'vue' | 'svelte' | 'html' | 'auto'
  styling: 'auto',      // 'tailwind' | 'cssmodules' | 'styled-components' | 'css' | 'auto'
  snapGrid: 8,          // px
  exclude: [],          // glob patterns — files never written to
}
```

---

## 2. Build-Time Transform — Source Stamping

### What it does
Injects a `data-gl-source` attribute onto every JSX/TSX/Vue/Svelte element at **dev build time only**. The attribute encodes the source file path, line number, and column number. This is how the overlay knows which source file to edit when you click an element.

### Attribute format
```
data-gl-source="src/components/Card.jsx:24:5"
              └─ relative path from project root  └─ line  └─ col
```

### Implementation: Babel Plugin
**File:** `packages/babel-plugin/src/index.ts`

Uses `@babel/core` visitor API. Visits every `JSXOpeningElement` node and inserts the attribute:

```typescript
import { declare } from '@babel/helper-plugin-utils'
import { NodePath, types as t } from '@babel/core'

export default declare((api) => {
  api.assertVersion(7)
  return {
    visitor: {
      JSXOpeningElement(path: NodePath<t.JSXOpeningElement>, state) {
        const loc = path.node.loc
        if (!loc) return
        const file = state.filename ?? 'unknown'
        const relative = path.relative(state.cwd, file) // relative to project root
        const attr = t.jsxAttribute(
          t.jsxIdentifier('data-gl-source'),
          t.stringLiteral(`${relative}:${loc.start.line}:${loc.start.column}`)
        )
        path.node.attributes.push(attr)
      }
    }
  }
})
```

### Implementation: Vite Plugin
**File:** `packages/vite-plugin/src/index.ts`

Uses Vite's `transform` hook to apply the Babel plugin on `.jsx`, `.tsx`, `.vue`, `.svelte` files during dev:

```typescript
import { transformAsync } from '@babel/core'
import glideSourcePlugin from '../../babel-plugin/src'

export function glide(): Plugin {
  return {
    name: 'vite-plugin-glide',
    apply: 'serve', // ⛔ NEVER apply in production build
    async transform(code, id) {
      if (!/\.(jsx|tsx|vue|svelte)$/.test(id)) return null
      const result = await transformAsync(code, {
        filename: id,
        plugins: [glideSourcePlugin],
        parserOpts: { plugins: ['jsx', 'typescript'] }
      })
      return { code: result?.code ?? code, map: result?.map }
    }
  }
}
```

### ⛔ DO NOT
- ⛔ Never stamp `data-gl-source` in production builds (`NODE_ENV=production`)
- ⛔ Never use `data-vd-source`, `data-cf-source`, or any other prefix — only `data-gl-source`
- ⛔ Never mutate the original source file — this transform runs in-memory at build time only

---

## 3. Local WebSocket Server

### Purpose
Receives edit commands from the browser overlay and writes them to source files.

### File
`packages/server/src/ws-server.ts`

### Technology
Native Node.js `ws` package (`import { WebSocketServer } from 'ws'`). No Socket.io. No HTTP polling.

### Port
`7778` (configurable via `glide.config.ts`)

### Message format (browser → server)
All messages are JSON strings. The browser sends:

```typescript
type EditMessage = {
  type: 'STYLE_CHANGE'
  file: string        // "src/components/Card.jsx"
  line: number        // 1-indexed
  col: number         // 0-indexed
  change: {
    property: string  // CSS property name in camelCase e.g. "marginLeft"
    value: number | string
    unit?: 'px' | 'rem' | '%' | 'em'
  }
}

type ReorderMessage = {
  type: 'REORDER_CHILDREN'
  file: string
  parentLine: number
  parentCol: number
  fromIndex: number
  toIndex: number
}

type UndoMessage = {
  type: 'UNDO'
}

type RedoMessage = {
  type: 'REDO'
}
```

### Message format (server → browser)
```typescript
type AckMessage = {
  type: 'ACK'
  success: boolean
  error?: string
}
```

### Server handler
```typescript
wss.on('connection', (ws) => {
  ws.on('message', async (raw) => {
    const msg = JSON.parse(raw.toString())
    try {
      await handleMessage(msg)  // dispatches to AST writer
      ws.send(JSON.stringify({ type: 'ACK', success: true }))
    } catch (err) {
      ws.send(JSON.stringify({ type: 'ACK', success: false, error: err.message }))
    }
  })
})
```

---

## 4. In-Browser Bridge Script

### Purpose
Injected into the user's app (inside the iframe). Reads the DOM, builds the scene graph, and reports element positions to the overlay.

### File
`packages/overlay/src/bridge.ts`

### How it gets injected
The Vite plugin adds a virtual import to the app's HTML entry point in dev mode:
```html
<script type="module" src="/@glide/bridge"></script>
```

The Vite plugin serves this virtual module from `packages/overlay/src/bridge.ts`.

### What it does on load
1. Calls `buildSceneGraph(document.body)` — walks the DOM and finds all elements with `data-gl-source`
2. Posts the scene graph to the parent frame via `window.parent.postMessage`
3. Attaches a `MutationObserver` on `document.body` to re-run after HMR updates
4. Attaches a `ResizeObserver` to re-run when element sizes change

### postMessage payload (iframe → overlay parent)
```typescript
type SceneGraphMessage = {
  type: 'GLIDE_SCENE_GRAPH'
  nodes: GlideNode[]
}
```

### GlideNode type
```typescript
type GlideNode = {
  id: string               // data-gl-source value e.g. "src/Card.jsx:24:5"
  tagName: string          // lowercase: 'div', 'p', 'button'
  bounds: {                // from element.getBoundingClientRect()
    x: number
    y: number
    width: number
    height: number
  }
  computedStyles: {        // from window.getComputedStyle(element)
    display: string
    flexDirection: string
    justifyContent: string
    alignItems: string
    gap: string
    padding: string
    margin: string
    fontSize: string
    fontFamily: string
    fontWeight: string
    color: string
    backgroundColor: string
    borderRadius: string
    // ... all CSS properties needed by the properties panel
  }
  children: string[]       // array of child GlideNode ids
  parentId: string | null
  componentName: string | null  // name of React/Vue component if element is root of one
  componentFile: string | null  // file where component is defined
}
```

### ⛔ DO NOT
- ⛔ Never use `localStorage` or `sessionStorage` in the bridge script
- ⛔ Never use `eval()` in the bridge script
- ⛔ Never send messages to `window.parent` without checking `window !== window.parent` first

---

## 5. Scene Graph

### Storage
Held in-memory in the overlay app. Updated on every `GLIDE_SCENE_GRAPH` postMessage.

### Data structure (overlay side)
```typescript
// packages/overlay/src/store/scene.ts
import { atom } from 'jotai' // state management: jotai

export const sceneNodesAtom = atom<Map<string, GlideNode>>(new Map())
export const selectedIdsAtom = atom<Set<string>>(new Set())
export const hoveredIdAtom = atom<string | null>(null)
```

### State management library
**Jotai** (`import { atom, useAtom } from 'jotai'`). Not Zustand. Not Redux. Not React Context.

---

## 6. Canvas Overlay

### File
`packages/overlay/src/App.tsx` — a standalone React app served on port 7777.

### Layout structure (HTML)
```
<div id="glide-root">
  <div id="glide-toolbar" />          <!-- top bar -->
  <div id="glide-workspace">
    <div id="glide-layers" />          <!-- left sidebar -->
    <div id="glide-canvas-wrap">
      <div id="glide-canvas-viewport"> <!-- zoom/pan wrapper -->
        <iframe id="glide-app-frame" src="http://localhost:DEV_PORT" />
        <svg id="glide-overlay-svg">   <!-- selection boxes, handles, guides, snap lines -->
          <!-- drawn on top of iframe -->
        </svg>
      </div>
    </div>
    <div id="glide-properties" />      <!-- right sidebar -->
  </div>
</div>
```

### Zoom and pan
- Zoom: `transform: scale(zoomLevel)` on `#glide-canvas-viewport`
- Pan: `transform: translate(panX, panY)` combined with scale
- `Ctrl+Scroll` → zoom
- `Space+Drag` → pan
- `Ctrl+0` → fit to screen
- `Ctrl+1` → 100%

### SVG overlay drawing
The `<svg id="glide-overlay-svg">` is positioned `position: absolute; inset: 0; pointer-events: none` over the iframe. It draws:
- Selection bounding box: `<rect>` with `stroke: #0d99ff` (Figma blue), `fill: none`, `strokeWidth: 1`
- Resize handles: 8 `<rect>` elements (4 corners + 4 edges), each 8×8px, `fill: white`, `stroke: #0d99ff`
- Hover outline: `<rect>` with `stroke: #0d99ff`, `fill: none`, `opacity: 0.5`, `strokeDasharray: "4 2"`
- Snap lines: `<line>` with `stroke: #ff4444`, `strokeWidth: 1`
- Distance indicators: `<line>` + `<text>` showing px distance between elements
- Guides: `<line>` with `stroke: rgba(0,120,255,0.5)`, `strokeWidth: 1`

### Pointer events
The SVG overlay has `pointer-events: none` globally. Only resize handles and guide lines have `pointer-events: all`. Element selection is handled by a transparent div layered over the iframe that intercepts mouse events, reads `document.elementFromPoint` via the bridge postMessage system.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `ArrowUp/Down/Left/Right` | Nudge selected element 1px |
| `Shift+Arrow` | Nudge 10px |
| `Escape` | Deselect all |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` or `Ctrl+Y` | Redo |
| `Ctrl+0` | Fit canvas |
| `Ctrl+1` | 100% zoom |
| `Ctrl+;` | Toggle guides |
| `Space+Drag` | Pan canvas |
| `Ctrl+Scroll` | Zoom |

---

## 7. Framework Auto-Detection

### File
`packages/core/src/detect.ts`

### Detection order (stop at first match)

```typescript
export async function detectFramework(projectRoot: string): Promise<FrameworkId> {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }

  // 1. Check dependencies
  if (deps['react'] || deps['react-dom'])         return 'react'
  if (deps['vue'])                                  return 'vue'
  if (deps['svelte'])                               return 'svelte'
  if (deps['@angular/core'])                        return 'angular'

  // 2. Check config files
  if (fs.existsSync(path.join(projectRoot, 'next.config.js')))   return 'react'
  if (fs.existsSync(path.join(projectRoot, 'next.config.ts')))   return 'react'
  if (fs.existsSync(path.join(projectRoot, 'nuxt.config.ts')))   return 'vue'
  if (fs.existsSync(path.join(projectRoot, 'astro.config.mjs'))) return 'astro'

  // 3. Check file extensions
  const srcFiles = glob.sync('src/**/*', { cwd: projectRoot })
  if (srcFiles.some(f => /\.(jsx|tsx)$/.test(f))) return 'react'
  if (srcFiles.some(f => /\.vue$/.test(f)))        return 'vue'
  if (srcFiles.some(f => /\.svelte$/.test(f)))     return 'svelte'

  // 4. Fallback
  return 'html'
}

export type FrameworkId = 'react' | 'vue' | 'svelte' | 'angular' | 'astro' | 'html'
```

---

## 8. Framework Adapters

### Interface (MUST implement exactly)
**File:** `packages/core/src/adapter.ts`

```typescript
import type { ParseResult } from '@babel/core'

export interface FrameworkAdapter {
  /** Parse a source file and return an AST */
  parseFile(filePath: string, source: string): Promise<AdapterAST>

  /** Locate a specific node by its 1-indexed line and 0-indexed column */
  resolveNode(ast: AdapterAST, line: number, col: number): AdapterNode | null

  /** Apply a CSS property change to a node */
  applyStyleChange(node: AdapterNode, change: StyleChange): void

  /** Reorder children of a parent node */
  reorderChildren(parent: AdapterNode, fromIndex: number, toIndex: number): void

  /** Serialize AST back to source string, preserving original formatting as much as possible */
  generate(ast: AdapterAST, originalSource: string): string
}

export type StyleChange = {
  property: string   // camelCase CSS property e.g. "marginLeft"
  value: string | number
  unit?: 'px' | 'rem' | '%' | 'em'
}

export type AdapterAST = any    // framework-specific, opaque to core
export type AdapterNode = any   // framework-specific, opaque to core
```

### React Adapter
**File:** `packages/adapters/react/src/index.ts`

- Uses `@babel/parser` with plugins `['jsx', 'typescript']` to parse
- Uses `@babel/traverse` to locate nodes
- Uses `@babel/generator` to serialize back to string
- Node location matched by `node.loc.start.line === line && node.loc.start.column === col`

### Vue Adapter
**File:** `packages/adapters/vue/src/index.ts`

- Uses `@vue/compiler-sfc` — specifically `parse()` from `@vue/compiler-sfc`
- Template AST nodes accessed via `descriptor.template.ast`
- Serializes template back using `@vue/compiler-sfc` `compileTemplate` + manual string replacement for non-template sections

### Svelte Adapter
**File:** `packages/adapters/svelte/src/index.ts`

- Uses `svelte/compiler` — specifically `parse()` from `svelte/compiler`
- Walks `ast.html` for template nodes
- Serializes with `magic-string` for minimal diffs

### HTML Adapter
**File:** `packages/adapters/html/src/index.ts`

- Uses `parse5` to parse HTML
- Traverses `document.childNodes` recursively
- Serializes with `parse5.serialize()`

### ⛔ DO NOT
- ⛔ Never use `innerHTML` manipulation to parse HTML — use `parse5`
- ⛔ Never use regex to find/replace class names in source files
- ⛔ Never reformat the entire file — only mutate the target node's string range

---

## 9. Styling Mode Detection

### File
`packages/core/src/detect.ts` (same file as framework detection)

```typescript
export async function detectStyling(projectRoot: string): Promise<StylingMode> {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }

  // Tailwind: check config file existence first (most reliable)
  if (
    fs.existsSync(path.join(projectRoot, 'tailwind.config.js')) ||
    fs.existsSync(path.join(projectRoot, 'tailwind.config.ts')) ||
    deps['tailwindcss']
  ) return 'tailwind'

  if (deps['styled-components'])  return 'styled-components'
  if (deps['@emotion/react'])     return 'emotion'
  if (deps['@stitches/react'])    return 'stitches'

  // CSS Modules: check for *.module.css files in src
  const moduleFiles = glob.sync('src/**/*.module.css', { cwd: projectRoot })
  if (moduleFiles.length > 0)     return 'cssmodules'

  // UnoCSS
  if (deps['unocss'])             return 'unocss'

  return 'css'  // fallback: plain CSS / inline styles
}

export type StylingMode =
  | 'tailwind'
  | 'styled-components'
  | 'emotion'
  | 'stitches'
  | 'cssmodules'
  | 'unocss'
  | 'css'
```

---

## 10. AST Write-Back Engine

### File
`packages/ast-writer/src/index.ts`

### Purpose
Given a file path, a target node location, and a style change, modify the source file non-destructively.

### Algorithm (non-destructive patch)

```
1. Read source file from disk as string
2. Parse to AST using the appropriate framework adapter
3. Locate the target JSX/template node at (line, col) using adapter.resolveNode()
4. Determine how the change should be written (see Styling Decision Tree)
5. Mutate ONLY the target node's attribute/prop value in the AST
6. Serialize the mutated node range back to string using adapter.generate()
7. Replace only that range in the original source string (not the whole file)
8. Write the patched string back to disk using fs.writeFileSync()
9. Record the diff for undo/redo
```

### Range-based replacement (step 7)
Uses character offsets from the AST node's `start` and `end` properties:
```typescript
const patched =
  originalSource.slice(0, node.start) +
  regeneratedNodeString +
  originalSource.slice(node.end)
```

This guarantees everything outside the edited node is byte-for-byte identical to the original.

### ⛔ DO NOT
- ⛔ Never call `prettier.format()` or any formatter on the file during write-back
- ⛔ Never use `fs.writeFileSync` on files matching `glide.config.exclude` patterns
- ⛔ Never write to files outside the project root
- ⛔ Never write to `node_modules`

---

## 11. Styling Write-Back Decision Tree

### File
`packages/ast-writer/src/style-writer.ts`

This is the core intelligence. Given `{ property, value, unit }` and the detected `StylingMode`, determine what to write and where.

### Tailwind mode

```typescript
function writeTailwind(node: AdapterNode, change: StyleChange, ast: AdapterAST) {
  // 1. Map CSS property + value to Tailwind class
  const twClass = cssToTailwind(change.property, change.value, change.unit)
  //    e.g. { property: 'marginLeft', value: 16, unit: 'px' } → 'ml-4'
  //    e.g. { property: 'paddingTop', value: 8, unit: 'px' }  → 'pt-2'

  // 2. Find className/class attribute on the node
  const classAttr = findClassAttribute(node)

  // 3. Remove any existing conflicting class (same utility group)
  const existing = classAttr.value
  const cleaned = removeConflicting(existing, twClass)
  //    e.g. removes 'ml-2' before adding 'ml-4'
  //    uses Tailwind class group knowledge (ml-*, mr-*, etc.)

  // 4. Append new class
  classAttr.value = cleaned + ' ' + twClass

  // 5. If in responsive breakpoint mode, prefix with breakpoint
  if (activeBreakpoint !== null) {
    classAttr.value = cleaned + ' ' + activeBreakpoint + ':' + twClass
  }
}
```

### Tailwind class mapping table (partial — must be complete in implementation)

| CSS Property | Value | Tailwind Class |
|---|---|---|
| marginLeft | 4px | ml-1 |
| marginLeft | 8px | ml-2 |
| marginLeft | 12px | ml-3 |
| marginLeft | 16px | ml-4 |
| marginLeft | 20px | ml-5 |
| marginLeft | 24px | ml-6 |
| marginTop | 4px | mt-1 |
| paddingLeft | 4px | pl-1 |
| paddingTop | 4px | pt-1 |
| width | 100% | w-full |
| display | flex | flex |
| flexDirection | row | flex-row |
| flexDirection | column | flex-col |
| justifyContent | center | justify-center |
| justifyContent | flex-start | justify-start |
| justifyContent | flex-end | justify-end |
| justifyContent | space-between | justify-between |
| alignItems | center | items-center |
| gap | 4px | gap-1 |
| gap | 8px | gap-2 |
| gap | 16px | gap-4 |
| fontSize | 12px | text-xs |
| fontSize | 14px | text-sm |
| fontSize | 16px | text-base |
| fontSize | 18px | text-lg |
| fontSize | 20px | text-xl |
| fontWeight | 400 | font-normal |
| fontWeight | 500 | font-medium |
| fontWeight | 600 | font-semibold |
| fontWeight | 700 | font-bold |
| borderRadius | 4px | rounded |
| borderRadius | 8px | rounded-md |
| borderRadius | 9999px | rounded-full |

> If a pixel value does not map to a standard Tailwind step (e.g. 13px), fall back to CSS mode and write an inline style.

### CSS Modules mode
```typescript
function writeCSSModules(node: AdapterNode, change: StyleChange, moduleFile: string) {
  // 1. Find the CSS Modules file associated with this component
  //    e.g. Card.jsx → Card.module.css (same directory)
  // 2. Parse the CSS file with postcss
  // 3. Find the rule that applies to this element (by class name from className attribute)
  // 4. Update or add the CSS declaration
  // 5. Write the CSS file back
}
```
Uses `postcss` (not string manipulation) to parse and write CSS.

### Plain CSS / inline style mode
```typescript
function writeCSSInline(node: AdapterNode, change: StyleChange) {
  // Adds/updates the style attribute directly on the JSX node
  // e.g. style={{ marginLeft: '16px' }}
}
```

### Styled Components mode
```typescript
function writeStyledComponents(node: AdapterNode, change: StyleChange) {
  // 1. Find the styled.div`` or styled(Component)`` expression that generated this element
  //    (walk up the component's AST looking for styled-components tagged templates)
  // 2. Parse the template literal CSS string with postcss
  // 3. Update the property
  // 4. Write back the template literal
}
```

### ⛔ DO NOT
- ⛔ Never write raw pixel values as Tailwind classes (e.g. never write `ml-[13px]` unless JIT is confirmed in the project)
- ⛔ Never remove Tailwind classes that belong to a different utility group
- ⛔ Never write to the wrong CSS Modules file

---

## 12. Text Measurement — Pretext

### Package
`@chenglou/pretext` — imported as:
```typescript
import { prepare, layout } from '@chenglou/pretext'
```

### Where it is used

**Location 1: Overlay (browser-side)**
File: `packages/overlay/src/utils/text-measure.ts`

Used to calculate the height of text elements before the browser renders them. Called:
- When a text element is selected and the user resizes its container width
- When rendering auto-height text bounding boxes in the layers panel
- When device preview width changes and text reflows

```typescript
export function measureTextHeight(
  text: string,
  fontFamily: string,
  fontSize: number,
  containerWidth: number,
  lineHeight: number
): number {
  const prepared = prepare(text, fontFamily + ' ' + fontSize + 'px')
  const { height } = layout(prepared, containerWidth, lineHeight)
  return height
}
```

**Location 2: Server (Node.js side)**
File: `packages/server/src/validators/text-overflow.ts`

Used to pre-validate that a text element won't overflow after a font-size or container-width change before committing the write:

```typescript
export function willOverflow(
  text: string,
  font: string,
  newWidth: number,
  lineHeight: number,
  maxLines: number
): boolean {
  const prepared = prepare(text, font)
  const { lineCount } = layout(prepared, newWidth, lineHeight)
  return lineCount > maxLines
}
```

### ⛔ DO NOT
- ⛔ Never use `element.getBoundingClientRect()` for text measurement in the overlay — use pretext
- ⛔ Never inject a hidden DOM element to measure text — use pretext
- ⛔ Never guess line count by dividing text length by container width

---

## 13. Undo / Redo

### Storage
In-memory stack on the server. Cleared when the server restarts.

### File
`packages/server/src/undo-manager.ts`

### Data structure
```typescript
type FileDiff = {
  file: string
  before: string   // full file content before the edit
  after: string    // full file content after the edit
}

const undoStack: FileDiff[] = []
const redoStack: FileDiff[] = []
```

### On every write
```typescript
undoStack.push({ file, before: originalContent, after: newContent })
redoStack.length = 0   // clear redo on new edit
```

### On UNDO message
```typescript
const diff = undoStack.pop()
if (diff) {
  fs.writeFileSync(diff.file, diff.before, 'utf8')
  redoStack.push(diff)
}
```

### On REDO message
```typescript
const diff = redoStack.pop()
if (diff) {
  fs.writeFileSync(diff.file, diff.after, 'utf8')
  undoStack.push(diff)
}
```

### ⛔ DO NOT
- ⛔ Never store diffs as patches/hunks — always store full file content (simpler, safer)
- ⛔ Never persist undo history to disk

---

## 14. Device Preview

### File
`packages/overlay/src/components/Toolbar.tsx`

### Breakpoints (exact pixel widths)

| Label | Width (px) |
|---|---|
| Mobile S | 320 |
| Mobile M | 375 |
| Mobile L | 425 |
| Tablet | 768 |
| Laptop | 1024 |
| Desktop | 1440 |
| 4K | 2560 |
| Custom | user input |

### Implementation
Sets `width` on `#glide-app-frame` (the iframe). The iframe height is always 100% of the viewport. The canvas viewport adds a device chrome outline (optional, toggleable) around the iframe at the selected width.

```typescript
function setDeviceWidth(px: number) {
  const frame = document.getElementById('glide-app-frame') as HTMLIFrameElement
  frame.style.width = px + 'px'
  activeBreakpointWidth.set(px)
}
```

---

## 15. Responsive Write-Back

### File
`packages/ast-writer/src/responsive.ts`

### How the active breakpoint is tracked
The overlay sends the current device width with every edit message:
```typescript
type EditMessage = {
  // ...existing fields...
  viewportWidth: number   // current iframe width in px
}
```

### Tailwind breakpoint mapping

| Viewport width | Tailwind prefix | Written as |
|---|---|---|
| < 640px | (none / mobile-first default) | `ml-4` |
| ≥ 640px | `sm:` | `sm:ml-4` |
| ≥ 768px | `md:` | `md:ml-4` |
| ≥ 1024px | `lg:` | `lg:ml-4` |
| ≥ 1280px | `xl:` | `xl:ml-4` |
| ≥ 1536px | `2xl:` | `2xl:ml-4` |

The breakpoint prefix is determined by which Tailwind breakpoint the `viewportWidth` falls into.

### Plain CSS responsive write-back
If styling mode is `css` or `cssmodules`, writes inside a `@media` query:
```css
@media (max-width: 768px) {
  .card {
    margin-left: 16px;
  }
}
```
Uses `postcss` to add/update the rule inside the correct `@media` block.

---

## 16. Canvas Features — Exact Behaviour

### Selection
- **Click** on element → selects it; sends `HOVER_ELEMENT` postMessage to bridge to get element under cursor
- **Shift+Click** → adds to selection
- **Click-drag on empty canvas** → marquee select (draw `<rect>` on SVG, select all nodes whose bounds intersect)
- **Escape** → clears `selectedIdsAtom`
- Selection box: `<rect>` drawn at element's `bounds` (adjusted for zoom/pan) with 8 resize handle rects

### Move (drag)
- `pointerdown` on selected element → start drag, record `dragStartBounds`
- `pointermove` → compute delta, draw element at new position (CSS `transform: translate` on overlay — does NOT move iframe element yet)
- `pointerup` → send `STYLE_CHANGE` with `property: 'marginLeft'` and `property: 'marginTop'` (or appropriate property per styling decision tree)
- Live preview during drag: overlay shows element at new position without waiting for HMR

### Resize
- `pointerdown` on a resize handle → start resize, record which handle (`nw|n|ne|e|se|s|sw|w`)
- `pointermove` → compute new width/height based on handle direction and delta
- `pointerup` → send `STYLE_CHANGE` for `width` and/or `height`
- Shift+drag corner handle → maintain aspect ratio

### Snap
- During move/resize, compare dragged element bounds against all other element bounds
- Snap threshold: 4px
- Snap points: left edge, right edge, center-x, top edge, bottom edge, center-y of every other element
- When snapping, draw red `<line>` on SVG overlay showing the snapped axis
- Distance indicators: if two elements are adjacent, draw a `<line>` + `<text>` showing the gap in px

### Rulers & Guides
- Rulers: two `<div>` elements (one horizontal, one vertical) with tick marks drawn via `<canvas>` inside
- Tick marks update on zoom change
- `pointerdown` on ruler → drag to create guide `<line>` on overlay SVG
- Guide position stored in `guidesAtom: atom<{x?: number, y?: number}[]>` (jotai)
- Double-click guide → removes it from `guidesAtom`
- `Ctrl+;` → toggles `guidesVisibleAtom`

---

## 17. Properties Panel — Exact Fields

### File
`packages/overlay/src/components/PropertiesPanel.tsx`

### Position & Size section
```
X:    [number input]  Y:    [number input]
W:    [number input]  H:    [number input]  [🔗 lock aspect ratio toggle]
Rotation: [number input] °
```
- X/Y: maps to `left`/`top` for `position: absolute` elements, or `margin-left`/`margin-top` for flow elements
- W/H: maps to `width`/`height`
- Rotation: maps to `transform: rotate(Ndeg)`

### Layout (Flex) section — shown only when `computedStyles.display === 'flex'`
```
Direction:  [row button] [column button]
Justify:    [5 buttons: flex-start | center | flex-end | space-between | space-around]
Align:      [4 buttons: flex-start | center | flex-end | stretch]
Gap:        [number input] px    Row gap: [number input] px
Wrap:       [wrap button] [nowrap button]
```

### Spacing section
Visual box model diagram with 9 inputs:
- margin-top, margin-right, margin-bottom, margin-left (outer)
- padding-top, padding-right, padding-bottom, padding-left (inner)
- Each input: number, blurs → sends `STYLE_CHANGE`

### Typography section — shown only when element is or contains text
```
Font family: [text input / dropdown]
Size:   [number] px    Weight: [select: 100-900]
Line height: [number]   Letter spacing: [number] px
Align:  [4 icon buttons: left | center | right | justify]
Color:  [color swatch] [hex input]
Decoration: [U toggle] [I toggle] [S toggle]
```

### Fill & Background section
```
Fill type: [None | Solid | Gradient | Image — segmented control]
```
When Solid:
```
Color: [swatch] [hex input]   Opacity: [0-100 number input] %
```
When Gradient:
```
Type: [Linear | Radial — segmented control]
Angle: [number] °
[gradient bar with draggable color stops]
```

### Border section
```
Color: [swatch]  Width: [number] px  Style: [select: solid|dashed|dotted|none]
Radius: [TL: num] [TR: num] [BR: num] [BL: num]  [🔗 lock toggle]
```

### Shadow section
```
[+ Add shadow]
For each shadow: X[num] Y[num] Blur[num] Spread[num] Color[swatch] [inset toggle] [🗑 delete]
```

### Opacity section
```
[slider 0-100] [number input] %
```

---

## 18. Layers Panel — Exact Behaviour

### File
`packages/overlay/src/components/LayersPanel.tsx`

### Data source
Built from `sceneNodesAtom` (the in-memory scene graph). Rendered as a recursive tree.

### Each row displays
```
[indent] [expand arrow if has children] [element icon] [tagName · componentName?] [eye icon] [lock icon]
```

### Icons by element type
- `div`, `section`, `main`, `article` → frame/box icon
- `p`, `span`, `h1`-`h6` → text icon
- `img` → image icon
- `button`, `a` → component icon
- `svg` → vector icon

### Interactions
- Click row → sets `selectedIdsAtom` to that node's id
- Drag row → reorder. On `pointerup`, sends `REORDER_CHILDREN` WebSocket message
- Click eye icon → sends `STYLE_CHANGE` with `property: 'display', value: 'none'` (toggle)
- Click lock icon → sets `lockedIdsAtom`, prevents selecting/editing that node
- Click component name badge → sends `OPEN_FILE` message to server which opens the component's file in the user's editor

### Component boundary display
- Nodes that are the root of a component are highlighted with a different background (`rgba(0,120,255,0.07)`)
- A component badge `[ComponentName]` appears next to the tag name

---

## 19. File & Folder Layout

```
glide-dev/                          ← monorepo root
├── package.json                    ← workspaces: ["packages/*"]
├── packages/
│   ├── cli/
│   │   └── src/
│   │       └── index.ts            ← entry: npx glide
│   ├── core/
│   │   └── src/
│   │       ├── adapter.ts          ← FrameworkAdapter interface
│   │       ├── detect.ts           ← detectFramework(), detectStyling()
│   │       └── types.ts            ← shared types (GlideNode, StyleChange, etc.)
│   ├── vite-plugin/
│   │   └── src/
│   │       └── index.ts            ← export function glide(): Plugin
│   ├── babel-plugin/
│   │   └── src/
│   │       └── index.ts            ← JSX source stamping plugin
│   ├── server/
│   │   └── src/
│   │       ├── ws-server.ts        ← WebSocket server
│   │       ├── undo-manager.ts     ← undo/redo stacks
│   │       └── validators/
│   │           └── text-overflow.ts
│   ├── ast-writer/
│   │   └── src/
│   │       ├── index.ts            ← main write-back orchestrator
│   │       ├── style-writer.ts     ← styling decision tree
│   │       └── responsive.ts       ← breakpoint-aware write-back
│   ├── adapters/
│   │   ├── react/src/index.ts
│   │   ├── vue/src/index.ts
│   │   ├── svelte/src/index.ts
│   │   └── html/src/index.ts
│   └── overlay/
│       └── src/
│           ├── App.tsx             ← root overlay app
│           ├── bridge.ts           ← injected into user's app iframe
│           ├── store/
│           │   └── scene.ts        ← jotai atoms
│           ├── components/
│           │   ├── Toolbar.tsx
│           │   ├── LayersPanel.tsx
│           │   ├── PropertiesPanel.tsx
│           │   └── Canvas.tsx
│           └── utils/
│               └── text-measure.ts ← pretext wrapper
```

---

## 20. Third-Party Dependencies — Exact Package Names

| Package | Version constraint | Used in | Purpose |
|---|---|---|---|
| `@babel/core` | `^7` | babel-plugin, vite-plugin | AST parsing |
| `@babel/parser` | `^7` | adapters/react | JSX/TSX parsing |
| `@babel/traverse` | `^7` | adapters/react | AST traversal |
| `@babel/generator` | `^7` | adapters/react | AST → source |
| `@babel/helper-plugin-utils` | `^7` | babel-plugin | Plugin utils |
| `@babel/types` | `^7` | babel-plugin, adapters | AST node types |
| `@vue/compiler-sfc` | `^3` | adapters/vue | Vue SFC parse/generate |
| `svelte` | `^4` or `^5` | adapters/svelte | Svelte AST |
| `magic-string` | `^0.30` | adapters/svelte | Source range replacement |
| `parse5` | `^7` | adapters/html | HTML parse/serialize |
| `postcss` | `^8` | ast-writer | CSS file editing |
| `ws` | `^8` | server | WebSocket server |
| `chokidar` | `^3` | server | File watching |
| `glob` | `^10` | core/detect | File pattern matching |
| `@chenglou/pretext` | `latest` | overlay, server | Text measurement |
| `jotai` | `^2` | overlay | State management |
| `react` | `^18` | overlay | Overlay UI |
| `react-dom` | `^18` | overlay | Overlay UI |
| `vite` | `^5` | overlay | Overlay dev/build |

### Build tooling (devDependencies of monorepo)
| Package | Purpose |
|---|---|
| `typescript` | `^5` |
| `turbo` | Monorepo task runner |
| `tsup` | Package bundling |

---

## 21. What Glide Does NOT Do

This section is critical for agent accuracy. Never implement these unless a new version of FEATURES.md explicitly adds them.

- ⛔ **No vector editing / pen tool** — Glide cannot create or edit SVG paths
- ⛔ **No component creation from scratch** — Glide edits existing elements only, it does not scaffold new components
- ⛔ **No cloud sync** — all data is local; no Glide server, no user accounts, no telemetry in v1
- ⛔ **No multiplayer / collaboration** — single-user, local only
- ⛔ **No production mode** — the overlay and source-stamping are `apply: 'serve'` only; zero runtime in production
- ⛔ **No design token editor** — Glide reads token values but does not let you rename or create tokens in v1
- ⛔ **No image generation** — Glide does not generate images; it only references existing ones in the project
- ⛔ **No plugins API** — no third-party plugin system in v1
- ⛔ **No iOS / Android native support** — web only
- ⛔ **No Angular support** — Angular's template syntax is deferred past v1
- ⛔ **No Boolean operations** (union, subtract, intersect on shapes) — deferred
- ⛔ **No component variants / props editor** — deferred
- ⛔ **No WebGL renderer** — the overlay uses Canvas 2D and SVG only in v1; WebGL is future
- ⛔ **No WASM** — no C++ compiled to WASM; all processing is in TypeScript/Node.js
- ⛔ **No `prettier` calls** — the write-back engine never reformats files
- ⛔ **No `eslint` calls** — the write-back engine never lints files
- ⛔ **No regex-based class manipulation** — all class/style changes go through AST

---

*End of FEATURES.md — Generated for Glide v0.1*
