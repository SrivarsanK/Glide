# Glide — PORTING SAFETY SPEC
## Anti-Hallucination Prompt for Feature-Safe Code Migration

> **Purpose:** This document is fed to any AI coding agent performing porting,
> refactoring, migration, or dependency changes on the Glide codebase.
> Its job is to prevent the agent from silently dropping, renaming, or
> reimplementing features that already exist and work correctly.
> Every section defines what MUST survive unchanged after any porting operation.

---

## GOLDEN RULE

**If a feature is listed in this document, it must exist and work identically
after the port. If you cannot preserve it exactly, STOP and report the conflict.
Do NOT silently drop it. Do NOT rename it. Do NOT reimplement it differently.**

---

## 1. WHAT A "PORT" MEANS IN THIS CODEBASE

A port is any of the following operations:

- Switching a parser (e.g. `@babel/parser` → `recast`)
- Switching a state manager (e.g. Jotai → Zustand)
- Switching a build tool (e.g. tsup → esbuild)
- Switching a WebSocket library (e.g. `ws` → `socket.io`)
- Upgrading a major version of any dependency
- Moving code between packages in the monorepo
- Changing the overlay from one framework to another
- Changing the styling approach in the overlay UI

For each of these, the checklist in Section 8 MUST be completed before the
agent marks the task done.

---

## 2. FEATURES THAT MUST SURVIVE ANY PORT — COMPLETE LIST

### 2.1 Source Stamping

**What it is:** The Babel plugin in `packages/babel-plugin/src/index.ts` stamps
every JSX/TSX element at dev build time with a `data-gl-source` attribute
containing the file path, line number, and column number.

**Exact attribute name:** `data-gl-source` — NEVER any other name.

**Exact value format:** `"{relativePath}:{line}:{col}"`
  - relativePath: relative to project root e.g. `src/components/Card.jsx`
  - line: 1-indexed integer
  - col: 0-indexed integer
  - Example: `data-gl-source="src/components/Card.jsx:24:5"`

**Must survive:** The attribute name, value format, and the fact that it is
ONLY applied in dev mode (`NODE_ENV !== 'production'`) must all survive unchanged.

**After any port verify:**
```bash
# Build a test React project with the plugin, inspect the DOM:
# Every JSX element must have data-gl-source="path:line:col"
# No element may have data-vd-source, data-cf-source, or any other variant
```

---

### 2.2 WebSocket Protocol — All Message Types

The following message types are defined in `packages/core/src/types.ts`.
ALL of them must exist after any port. None may be renamed or removed.

**Browser → Server:**
```typescript
'STYLE_CHANGE'       // CSS property change (move, resize, color, spacing)
'REORDER_CHILDREN'   // layer drag reorder
'UNDO'               // undo last action
'REDO'               // redo last undone action
'OPEN_FILE'          // open file in editor
'CREATE_BRANCH'      // git branching mode
'FINALIZE_BRANCH'    // commit branch
'JUMP_TO_HISTORY'    // jump to history index
'GET_HISTORY'        // request full history state
```

**Server → Browser:**
```typescript
'ACK'                // success/failure acknowledgment
'HISTORY_UPDATE'     // full history stack + currentIndex
'BRANCH_CREATED'     // branch creation confirmation
```

**Field that MUST exist on STYLE_CHANGE:**
```typescript
{
  type: 'STYLE_CHANGE'
  file: string         // absolute path
  line: number         // 1-indexed
  col: number          // 0-indexed
  change: {
    property: string   // camelCase CSS property
    value: string | number
    unit?: string
  }
  viewportWidth: number  // current iframe width — used for responsive write-back
}
```

⛔ `viewportWidth` is CRITICAL — it drives responsive Tailwind prefix decisions.
If this field is dropped, responsive write-back silently breaks with no error.

---

### 2.3 History Manager — All Public Functions

**File:** `packages/server/src/history-manager.ts`

ALL of these exported functions must exist with identical signatures:

```typescript
export function pushHistory(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): void
export function undo(): FileDiff[] | null
export function redo(): FileDiff[] | null
export function jumpTo(targetIndex: number): { file: string; content: string }[]
export function getHistoryState(): { stack: HistoryEntry[]; currentIndex: number }
export function clearHistory(): void
export function setHistoryLimit(limit: number): void
```

**Rules that must survive:**
- `stack` and `currentIndex` are module-level variables — in-memory only
- `pushHistory` splices the stack at `currentIndex + 1` before pushing
- `pushHistory` enforces `MAX_HISTORY` cap by dropping the oldest entry
- `undo` moves `currentIndex` backward and returns diffs with `before` content
- `redo` moves `currentIndex` forward and returns diffs with `after` content
- `jumpTo` applies intermediate diffs — it is NOT a simple index assignment
- History is NEVER persisted to disk
- History is NEVER stored in the overlay — only in the server

---

### 2.4 AST Write-Back Engine — Non-Destructive Rules

**File:** `packages/ast-writer/src/index.ts`

These rules are ABSOLUTE and must survive any port:

```
RULE 1: Only the target node's character range is replaced.
        originalSource.slice(0, node.start) + newNodeString + originalSource.slice(node.end)
        NOTHING outside that range is touched.

RULE 2: prettier is NEVER called. Ever. Not before write. Not after write.

RULE 3: eslint is NEVER called. Ever.

RULE 4: The file is NEVER fully regenerated from AST.
        Only the mutated node range is spliced back.

RULE 5: pushHistory() is called AFTER fs.writeFileSync(), never before.

RULE 6: pushHistory() is NEVER called for UNDO or REDO operations.

RULE 7: Files matching glide.config.exclude patterns are NEVER written to.

RULE 8: node_modules is NEVER written to.

RULE 9: Files outside the project root are NEVER written to.
```

**If switching from @babel/generator to recast:**
- The range splice approach (rules 1 and 4) is replaced by `recast.print(ast).code`
- Rules 2, 3, 5, 6, 7, 8, 9 remain exactly the same
- The `node.start` / `node.end` character offsets are still used to LOCATE the
  node, but the output is generated by `recast.print()` not by string splicing
- `recast` must be configured to use the Babel parser:
  `parse(source, { parser: require('recast/parsers/babel') })`

---

### 2.5 Framework Adapter Interface

**File:** `packages/core/src/adapter.ts`

This interface must not change. All adapters implement it:

```typescript
interface FrameworkAdapter {
  parseFile(filePath: string, source: string): Promise<AdapterAST>
  resolveNode(ast: AdapterAST, line: number, col: number): AdapterNode | null
  applyStyleChange(node: AdapterNode, change: StyleChange): void
  reorderChildren(parent: AdapterNode, fromIndex: number, toIndex: number): void
  generate(ast: AdapterAST, originalSource: string): string
}
```

**Adapters that must exist:**
- `packages/adapters/react/src/index.ts` — uses `@babel/parser` + `@babel/traverse` + `@babel/generator`
- `packages/adapters/vue/src/index.ts` — uses `@vue/compiler-sfc`
- `packages/adapters/html/src/index.ts` — uses `parse5`

---

### 2.6 Framework Auto-Detection

**File:** `packages/core/src/detect.ts`

These two exported functions must exist:

```typescript
export async function detectFramework(projectRoot: string): Promise<FrameworkId>
export async function detectStyling(projectRoot: string): Promise<StylingMode>
```

**FrameworkId values that must be detectable:**
`'react' | 'vue' | 'svelte' | 'angular' | 'astro' | 'html'`

**StylingMode values that must be detectable:**
`'tailwind' | 'styled-components' | 'emotion' | 'stitches' | 'cssmodules' | 'unocss' | 'css'`

**Detection order for framework (must preserve order):**
1. Check `package.json` dependencies
2. Check config files (`next.config.*`, `nuxt.config.*`, `astro.config.*`)
3. Check file extensions in `src/`
4. Fallback to `'html'`

**Detection order for styling (must preserve order):**
1. `tailwind.config.*` exists OR `tailwindcss` in deps → `'tailwind'`
2. `styled-components` in deps → `'styled-components'`
3. `@emotion/react` in deps → `'emotion'`
4. `*.module.css` files in src → `'cssmodules'`
5. `unocss` in deps → `'unocss'`
6. Fallback → `'css'`

---

### 2.7 Styling Write-Back Decision Tree — Tailwind Mapping

**File:** `packages/ast-writer/src/style-writer.ts`

The pixel → Tailwind class mapping must be preserved exactly:

```
4px  → *-1    8px  → *-2    12px → *-3    16px → *-4
20px → *-5    24px → *-6    28px → *-7    32px → *-8
36px → *-9    40px → *-10   48px → *-12   64px → *-16
80px → *-20   96px → *-24
```

Where `*` = `m`, `mt`, `mr`, `mb`, `ml`, `p`, `pt`, `pr`, `pb`, `pl`, `gap`, etc.

**The fallback rule must survive:**
If a pixel value does not map to a standard Tailwind step → fall back to inline
style write-back. Never write a class that doesn't exist in the standard scale.

**The responsive prefix rule must survive:**
`viewportWidth` from the WebSocket message determines the Tailwind breakpoint prefix:

```
< 640px  → no prefix (mobile-first)
≥ 640px  → sm:
≥ 768px  → md:
≥ 1024px → lg:
≥ 1280px → xl:
≥ 1536px → 2xl:
```

---

### 2.8 Jotai Atoms — All Must Exist

**File:** `packages/overlay/src/store/scene.ts`

ALL of these atoms must exist after any port. If switching state managers,
every atom must have an equivalent with identical semantics:

```typescript
// Scene graph
sceneNodesAtom: atom<Map<string, GlideNode>>(new Map())

// Selection
selectedIdsAtom: atom<Set<string>>(new Set())
hoveredIdAtom: atom<string | null>(null)
lockedIdsAtom: atom<Set<string>>(new Set())

// Canvas
zoomLevelAtom: atom<number>(1)
panOffsetAtom: atom<{x: number, y: number}>({x: 0, y: 0})
activeToolAtom: atom<'select'|'frame'|'text'|'shape'|'pan'>('select')
activeDeviceWidthAtom: atom<number>(1440)
guidesAtom: atom<{axis:'x'|'y', position:number}[]>([])
guidesVisibleAtom: atom<boolean>(true)
gridVisibleAtom: atom<boolean>(false)

// UI
expandedLayerIdsAtom: atom<Set<string>>(new Set())
collapsedSectionsAtom: atom<Set<string>>(new Set())
toastAtom: atom<ToastMessage | null>(null)
branchingModeActiveAtom: atom<boolean>(false)
activeBranchAtom: atom<string | null>(null)

// History
historyStackAtom: atom<HistoryEntry[]>([])
historyCurrentIndexAtom: atom<number>(-1)
historyPanelVisibleAtom: atom<boolean>(false)
```

⛔ If switching from Jotai to another state manager: the atom NAMES become the
store slice/selector names. They must be identical. Do NOT rename them.

---

### 2.9 Bridge Script postMessage Contract

**File:** `packages/overlay/src/bridge.ts`

The bridge script runs inside the user's app iframe. The following postMessage
types must survive any port:

**iframe → overlay parent:**
```typescript
{ type: 'GLIDE_SCENE_GRAPH', nodes: GlideNode[] }
{ type: 'HIT_TEST_RESULT', nodeId: string, bounds: DOMRect }
```

**overlay parent → iframe:**
```typescript
{ type: 'HIT_TEST', x: number, y: number }
```

**GlideNode shape — all fields must survive:**
```typescript
type GlideNode = {
  id: string
  tagName: string
  bounds: { x: number, y: number, width: number, height: number }
  computedStyles: Record<string, string>
  children: string[]
  parentId: string | null
  componentName: string | null
  componentFile: string | null
  isComponentRoot: boolean
}
```

⛔ `id` is always the `data-gl-source` value e.g. `"src/Card.jsx:24:5"`.
If this changes, the entire selection → write-back pipeline breaks silently.

---

### 2.10 Device Preset Widths — Exact Values

**File:** `packages/overlay/src/components/Toolbar.tsx`

These exact pixel values must be preserved:

```typescript
const DEVICES = [
  { label: 'Mobile S',  width: 320  },
  { label: 'Mobile M',  width: 375  },
  { label: 'Mobile L',  width: 425  },
  { label: 'Tablet',    width: 768  },
  { label: 'Laptop',    width: 1024 },
  { label: 'Desktop',   width: 1440 },
  { label: '4K',        width: 2560 },
  { label: 'Custom',    width: null },
]
```

These widths directly determine which Tailwind breakpoint prefix is written
to source. Changing any width changes the responsive output silently.

---

### 2.11 Keyboard Shortcuts — All Must Work

**File:** `packages/overlay/src/components/Canvas.tsx`

```
V              → activate select tool
F              → activate frame tool
T              → activate text tool
R              → activate shape tool
H              → activate pan tool
Escape         → clear selectedIdsAtom
ArrowUp        → nudge -1px Y
ArrowDown      → nudge +1px Y
ArrowLeft      → nudge -1px X
ArrowRight     → nudge +1px X
Shift+Arrow    → nudge ±10px
Ctrl+Z         → send UNDO
Ctrl+Shift+Z   → send REDO
Ctrl+Y         → send REDO
Ctrl+0         → fit canvas to viewport
Ctrl+1         → set zoom to 100%
Ctrl+;         → toggle guidesVisibleAtom
Ctrl+Alt+H     → toggle historyPanelVisibleAtom
Space+Drag     → pan canvas
Ctrl+Scroll    → zoom canvas
```

---

### 2.12 Config File Schema

**Filename:** `glide.config.ts` (in user's project root)

All fields must remain optional with these exact defaults:

```typescript
export default {
  port: 7777,           // Glide UI server
  wsPort: 7778,         // WebSocket server
  devPort: 5173,        // User's dev server (auto-detected if omitted)
  adapter: 'auto',      // framework adapter
  styling: 'auto',      // styling mode
  snapGrid: 8,          // snap grid in px
  exclude: [],          // glob patterns — files never written to
  historyLimit: 100,    // max history entries (1–1000)
}
```

⛔ Do NOT add required fields. The config file is optional — Glide must work
without it using these exact defaults.

---

### 2.13 Branching Mode — Git Commands

**File:** `packages/server/src/branching.ts`

The exact git commands must be preserved:

```typescript
// Create branch:
await exec(`git checkout -b ${branchName}`)

// Finalize:
await exec(`git add -A`)
await exec(`git commit -m "${message}"`)
```

Branch name format: `glide/visual-edit-{YYYY-MM-DD}`
Pre-filled default in UI: `glide/visual-edit-${new Date().toISOString().slice(0,10)}`

---

## 3. THINGS THAT MUST NEVER EXIST — PRESERVED ACROSS ANY PORT

These prohibitions apply before AND after any port:

```
⛔ No prettier calls anywhere in ast-writer
⛔ No eslint calls anywhere in ast-writer
⛔ No localStorage in bridge.ts or overlay
⛔ No sessionStorage in bridge.ts or overlay
⛔ No data-gl-source stamps in production builds
⛔ No history persistence to disk
⛔ No history state stored in the overlay (server owns it)
⛔ No pushHistory() calls inside UNDO/REDO handlers
⛔ No writes to node_modules
⛔ No writes to files outside project root
⛔ No regex-based className manipulation (always use AST)
⛔ No WebGL in v1 (Canvas 2D + SVG only)
⛔ No WASM in v1
⛔ No cloud sync in v1
⛔ No Angular adapter in v1
```

---

## 4. DEPENDENCY SUBSTITUTION RULES

When switching a dependency, use ONLY these approved substitutions:

| Original | Approved substitute | Notes |
|---|---|---|
| `@babel/generator` | `recast` | Changes generate() only, not parse/traverse |
| `@babel/parser` | `recast/parsers/babel` | Only when using recast |
| `ws` | NO SUBSTITUTE | Do not switch WebSocket libs in v1 |
| `jotai` | NO SUBSTITUTE | Do not switch state managers in v1 |
| `postcss` | NO SUBSTITUTE | Do not switch CSS parsers |
| `parse5` | NO SUBSTITUTE | Do not switch HTML parsers |

If a substitution is not in this table, DO NOT make it without explicit approval.
Report the conflict instead.

---

## 5. PACKAGE NAME VERIFICATION

These are the EXACT npm package names used. Never guess or abbreviate:

```
@babel/core
@babel/parser
@babel/traverse
@babel/generator
@babel/types
@babel/helper-plugin-utils
@vue/compiler-sfc
svelte                        (the compiler is at svelte/compiler)
magic-string
parse5
postcss
ws
chokidar
glob
@chenglou/pretext
jotai
react
react-dom
vite
recast                        (if porting to CST-based write-back)
```

---

## 6. FILE PATHS THAT MUST NOT MOVE

These files must exist at these exact paths after any port:

```
packages/core/src/types.ts
packages/core/src/detect.ts
packages/core/src/adapter.ts
packages/babel-plugin/src/index.ts
packages/vite-plugin/src/index.ts
packages/server/src/ws-server.ts
packages/server/src/history-manager.ts
packages/server/src/branching.ts
packages/ast-writer/src/index.ts
packages/ast-writer/src/style-writer.ts
packages/ast-writer/src/responsive.ts
packages/adapters/react/src/index.ts
packages/adapters/vue/src/index.ts
packages/adapters/html/src/index.ts
packages/overlay/src/App.tsx
packages/overlay/src/bridge.ts
packages/overlay/src/store/scene.ts
packages/overlay/src/components/Toolbar.tsx
packages/overlay/src/components/LayersPanel.tsx
packages/overlay/src/components/Canvas.tsx
packages/overlay/src/components/PropertiesPanel.tsx
packages/overlay/src/components/HistoryPanel.tsx
packages/overlay/src/utils/text-measure.ts
packages/cli/src/index.ts
```

If a port requires moving a file, update ALL import paths and verify with a
build before marking done.

---

## 7. THE ROUND-TRIP TEST — MUST PASS AFTER EVERY PORT

This test must pass without modification after any porting operation.
If it fails, the port is incomplete regardless of whether the code compiles.

```
SETUP:
1. Create a fresh React + Tailwind + Vite test project
2. Install the ported Glide package
3. Run: npx glide dev

ROUND-TRIP TEST:
Step 1:  Open http://localhost:7777 in browser
         EXPECT: Canvas shows the test app in iframe

Step 2:  Click the <h1> element on the canvas
         EXPECT: Blue selection bounding box appears around h1
         EXPECT: Layer row highlighted in layers panel
         EXPECT: Properties panel shows element info

Step 3:  Drag the h1 element 16px to the right
         EXPECT: source file updated with ml-4 (Tailwind) or marginLeft: 16px (CSS)
         EXPECT: Vite HMR fires within 150ms
         EXPECT: iframe updates
         EXPECT: Toast shows "Card.jsx updated · ml-4 added · HMR refreshed"

Step 4:  Switch device to Tablet 768 in toolbar
         EXPECT: iframe narrows to 768px
         EXPECT: Active breakpoint shows "md:" in properties panel

Step 5:  Drag the h1 element 8px right while in Tablet view
         EXPECT: source file updated with md:ml-2 (Tailwind responsive prefix)

Step 6:  Press Ctrl+Z
         EXPECT: source file reverts the ml-2 change
         EXPECT: HMR fires
         EXPECT: History panel shows currentIndex moved back one row

Step 7:  Open history panel (Ctrl+Alt+H)
         EXPECT: History panel shows 2 entries
         EXPECT: ● indicator on entry 1 (the first ml-4 edit)
         EXPECT: Entry 2 is dimmed (future state)

Step 8:  Click entry 2 in history panel
         EXPECT: jumpTo() fires, md:ml-2 is re-applied
         EXPECT: HMR fires
         EXPECT: ● moves to entry 2

Step 9:  Click branching mode button in toolbar
         EXPECT: BranchingModeDialog opens with pre-filled branch name
         EXPECT: Branch name format: glide/visual-edit-YYYY-MM-DD

Step 10: Press Escape
         EXPECT: Dialog closes, no branch created

ALL 10 STEPS MUST PASS. If any step fails, the port has broken a feature.
```

---

## 8. PRE-PORT CHECKLIST

Before starting any port, the agent MUST verify:

- [ ] I have read this entire document
- [ ] I know exactly which features the port affects
- [ ] I know which features the port does NOT affect
- [ ] I have identified every file that will change
- [ ] I have confirmed the substitute dependency produces identical AST node shapes
- [ ] I have confirmed the substitute does not reformat output
- [ ] I will not rename any exported function, type, atom, or message type
- [ ] I will not add new required fields to any existing type
- [ ] I will not change the `data-gl-source` attribute name or value format
- [ ] I will not change the WebSocket message type strings

---

## 9. POST-PORT CHECKLIST

After completing any port, the agent MUST verify:

- [ ] All files in Section 6 exist at their exact paths
- [ ] All atoms in Section 2.8 exist with identical names and default values
- [ ] All WebSocket message types in Section 2.2 exist unchanged
- [ ] All history manager exports in Section 2.3 exist with identical signatures
- [ ] The `data-gl-source` attribute is still stamped exactly as in Section 2.1
- [ ] The round-trip test in Section 7 passes all 10 steps
- [ ] No prettier or eslint calls were added anywhere in ast-writer
- [ ] No localStorage or sessionStorage was added to bridge or overlay
- [ ] Production builds do NOT contain data-gl-source attributes
- [ ] `historyLimit` config option still works with default of 100

---

## 10. HOW TO REPORT A CONFLICT

If a port operation conflicts with any requirement in this document, the agent
must NOT silently work around it. Instead output:

```
PORTING CONFLICT DETECTED

Feature: [name of feature from this document]
Conflict: [what the port requires that conflicts with the spec]
Section: [section number in this document]
Options:
  A) [option that preserves the spec]
  B) [option that changes the spec — requires explicit approval]

Awaiting decision before proceeding.
```

Do not proceed with option B without explicit human approval.

---

*End of PORTING SAFETY SPEC — Glide v0.1*
