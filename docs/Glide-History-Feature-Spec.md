# Glide — HISTORY FEATURE SPEC
## Anti-Hallucination Reference for AI Agents

> **Purpose:** This document exists to prevent hallucination when implementing
> the Glide history panel. Every mechanism, type, file path, and API is exact.
> Do not invent abstractions not listed here. Do not guess method names.
> If something is marked ⛔ DO NOT, never do it regardless of how natural it seems.

---

## 1. What This Feature Is

The history feature is a **Photoshop-style linear action history panel** that lets
the developer scrub backward and forward through every visual edit made in the
current Glide session.

It is NOT git. It is NOT branching. It is NOT persistent across sessions.
It is an in-memory stack that lives only for the duration of the Node.js server
process. When the server restarts, history is gone — exactly like Photoshop.

Branching mode (git branch creation) is a completely separate feature.
Do NOT mix or conflate them.

---

## 2. Files Involved

```
packages/server/src/
└── history-manager.ts      ← THE ONLY FILE that owns history state

packages/overlay/src/
├── store/scene.ts           ← add historyAtom here (Jotai atom)
└── components/
    └── HistoryPanel.tsx     ← the UI panel (new file)
```

No other files should contain history logic. Do not add history state to
ws-server.ts, index.ts, or any adapter file.

---

## 3. Core Types

**File:** `packages/server/src/history-manager.ts`

```typescript
// A single file's before/after state for one action
type FileDiff = {
  file: string       // absolute path e.g. "/Users/sri/myapp/src/Card.jsx"
  before: string     // full file content as string BEFORE the edit
  after: string      // full file content as string AFTER the edit
}

// One entry in the history stack — may touch multiple files
type HistoryEntry = {
  id: string              // crypto.randomUUID()
  timestamp: number       // Date.now()
  description: string     // human-readable e.g. "ml-4 → ml-6 on Card.jsx:24"
  diffs: FileDiff[]       // one diff per file touched in this action
}
```

⛔ Do NOT use patch/hunk format for diffs — always store full file content strings.
⛔ Do NOT use `Buffer` or base64 — always store as plain UTF-8 strings.
⛔ Do NOT add a `thumbnail` field in v1 — it is deferred.

---

## 4. History Manager Implementation

**File:** `packages/server/src/history-manager.ts`

```typescript
import * as crypto from 'crypto'

// --- State (module-level, in-memory only) ---

const MAX_HISTORY = 100   // configurable via glide.config.ts historyLimit

let stack: HistoryEntry[] = []
let currentIndex: number = -1   // points to the currently applied entry
                                 // -1 means no history yet (initial state)

// --- Public API ---

/**
 * Call this AFTER a successful fs.writeFileSync in the AST writer.
 * Records what changed and updates the stack.
 */
export function pushHistory(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): void {
  // Discard everything after currentIndex (new action kills future states)
  stack = stack.slice(0, currentIndex + 1)

  // Build full entry
  const full: HistoryEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...entry
  }

  stack.push(full)
  currentIndex = stack.length - 1

  // Enforce cap — drop oldest entry when over limit
  if (stack.length > MAX_HISTORY) {
    stack.shift()
    currentIndex = stack.length - 1
  }
}

/**
 * Undo: move currentIndex backward by 1.
 * Applies the `before` content of the current entry.
 * Returns the list of files written so the WebSocket handler can ACK.
 */
export function undo(): FileDiff[] | null {
  if (currentIndex < 0) return null   // nothing to undo

  const entry = stack[currentIndex]
  currentIndex -= 1
  return entry.diffs   // caller writes entry.diffs[i].before to disk
}

/**
 * Redo: move currentIndex forward by 1.
 * Applies the `after` content of the next entry.
 * Returns the list of files written so the WebSocket handler can ACK.
 */
export function redo(): FileDiff[] | null {
  if (currentIndex >= stack.length - 1) return null   // nothing to redo

  currentIndex += 1
  const entry = stack[currentIndex]
  return entry.diffs   // caller writes entry.diffs[i].after to disk
}

/**
 * Jump to any arbitrary index in the stack.
 * Used by the history panel when the developer clicks a past state.
 * Applies `after` for all entries up to targetIndex,
 * applies `before` for all entries after targetIndex.
 *
 * Returns: { file, content }[] — all files to write in this jump.
 */
export function jumpTo(targetIndex: number): { file: string; content: string }[] {
  if (targetIndex < -1 || targetIndex >= stack.length) return []

  const writes: { file: string; content: string }[] = []

  if (targetIndex > currentIndex) {
    // Moving forward — apply `after` for each entry between current+1 and target
    for (let i = currentIndex + 1; i <= targetIndex; i++) {
      for (const diff of stack[i].diffs) {
        writes.push({ file: diff.file, content: diff.after })
      }
    }
  } else if (targetIndex < currentIndex) {
    // Moving backward — apply `before` for each entry between current and target+1
    for (let i = currentIndex; i > targetIndex; i--) {
      for (const diff of stack[i].diffs) {
        writes.push({ file: diff.file, content: diff.before })
      }
    }
  }

  currentIndex = targetIndex
  return writes
}

/**
 * Returns the full stack and current index for the overlay UI.
 * Called when the overlay connects or requests a refresh.
 */
export function getHistoryState(): { stack: HistoryEntry[]; currentIndex: number } {
  return { stack: [...stack], currentIndex }
}

/**
 * Clears all history. Called on server restart only.
 * The overlay should never call this.
 */
export function clearHistory(): void {
  stack = []
  currentIndex = -1
}
```

---

## 5. WebSocket Protocol — History Messages

Add these to the existing WebSocket message types in `packages/core/src/types.ts`:

### Browser → Server (new message types)

```typescript
// Jump to arbitrary history index (user clicked a row in the history panel)
type JumpToHistoryMessage = {
  type: 'JUMP_TO_HISTORY'
  index: number          // 0-indexed, matching stack position
}

// Request full history state (on overlay connect or panel open)
type GetHistoryMessage = {
  type: 'GET_HISTORY'
}
```

Note: `UNDO` and `REDO` message types already exist in the spec — do NOT redefine them.

### Server → Browser (new message types)

```typescript
// Sent after any history mutation (push, undo, redo, jump)
// Also sent in response to GET_HISTORY
type HistoryUpdateMessage = {
  type: 'HISTORY_UPDATE'
  stack: HistoryEntry[]    // full stack (capped at MAX_HISTORY entries)
  currentIndex: number     // which entry is currently applied (-1 = none)
}
```

---

## 6. WebSocket Handler Integration

**File:** `packages/server/src/ws-server.ts`

Add these cases to the existing `handleMessage` switch:

```typescript
import * as fs from 'fs'
import {
  pushHistory,
  undo,
  redo,
  jumpTo,
  getHistoryState,
} from './history-manager'

// Inside handleMessage():

case 'UNDO': {
  const diffs = undo()
  if (diffs) {
    for (const diff of diffs) {
      fs.writeFileSync(diff.file, diff.before, 'utf8')
    }
  }
  ws.send(JSON.stringify({
    type: 'HISTORY_UPDATE',
    ...getHistoryState()
  }))
  ws.send(JSON.stringify({ type: 'ACK', success: true }))
  break
}

case 'REDO': {
  const diffs = redo()
  if (diffs) {
    for (const diff of diffs) {
      fs.writeFileSync(diff.file, diff.after, 'utf8')
    }
  }
  ws.send(JSON.stringify({
    type: 'HISTORY_UPDATE',
    ...getHistoryState()
  }))
  ws.send(JSON.stringify({ type: 'ACK', success: true }))
  break
}

case 'JUMP_TO_HISTORY': {
  const writes = jumpTo(msg.index)
  for (const w of writes) {
    fs.writeFileSync(w.file, w.content, 'utf8')
  }
  ws.send(JSON.stringify({
    type: 'HISTORY_UPDATE',
    ...getHistoryState()
  }))
  ws.send(JSON.stringify({ type: 'ACK', success: true }))
  break
}

case 'GET_HISTORY': {
  ws.send(JSON.stringify({
    type: 'HISTORY_UPDATE',
    ...getHistoryState()
  }))
  break
}
```

---

## 7. AST Writer Integration

**File:** `packages/ast-writer/src/index.ts`

After every successful `fs.writeFileSync`, call `pushHistory` BEFORE sending the ACK:

```typescript
import { pushHistory } from '../server/src/history-manager'

// Inside the write-back function, after fs.writeFileSync():

pushHistory({
  description: buildDescription(change, file),  // e.g. "ml-4 → ml-6 on Card.jsx:24"
  diffs: [
    {
      file: absoluteFilePath,       // MUST be absolute path
      before: originalContent,      // content BEFORE fs.writeFileSync
      after: patchedContent         // content AFTER fs.writeFileSync
    }
  ]
})

// Helper:
function buildDescription(change: StyleChange, file: string): string {
  const shortFile = path.basename(file)  // "Card.jsx"
  return `${change.property}: ${change.oldValue ?? '—'} → ${change.value} on ${shortFile}`
}
```

For multi-file actions (e.g. REORDER_CHILDREN that touches parent + child):

```typescript
pushHistory({
  description: `Reordered children in ${path.basename(parentFile)}`,
  diffs: [
    { file: parentFile, before: parentBefore, after: parentAfter },
    { file: childFile, before: childBefore, after: childAfter }
  ]
})
```

⛔ Do NOT call pushHistory before fs.writeFileSync — always record after the write succeeds.
⛔ Do NOT call pushHistory from the WebSocket handler — only from the AST writer.
⛔ Do NOT call pushHistory for UNDO or REDO operations — those consume history, not create it.

---

## 8. Overlay State

**File:** `packages/overlay/src/store/scene.ts`

Add these Jotai atoms:

```typescript
import { atom } from 'jotai'
import type { HistoryEntry } from '../../core/src/types'

export const historyStackAtom = atom<HistoryEntry[]>([])
export const historyCurrentIndexAtom = atom<number>(-1)
export const historyPanelVisibleAtom = atom<boolean>(false)
```

Update these atoms when a `HISTORY_UPDATE` WebSocket message is received:

```typescript
// In the WebSocket message handler in the overlay:
case 'HISTORY_UPDATE': {
  setHistoryStack(msg.stack)
  setHistoryCurrentIndex(msg.currentIndex)
  break
}
```

---

## 9. History Panel UI

**File:** `packages/overlay/src/components/HistoryPanel.tsx`

### Panel position
Slide-out panel from the left side, toggled by a clock/history icon in the toolbar.
Width: 260px. Overlays the layers panel when open (does not push it).

### Panel header
```
[← back]  HISTORY  [clear — shown as small text, disabled in v1]
```

### Panel body — scrollable list of history entries

Each row:
```
[●/○ indicator] [description text          ] [timestamp]
                 ml-4 → ml-6 · Card.jsx       2m ago
```

- `●` filled circle = this is the currentIndex (currently applied state)
- `○` hollow circle = past state (before current)
- Dimmed rows with no circle = future states (after current — i.e. undone states)
- Current row: blue left border `border-left: 2px solid #0d99ff`, slightly lighter background
- Future rows (after currentIndex): opacity 0.4, italic description text
- A special row at the top: `[initial state]` representing index -1

### Row interactions
```
Click any row → send JUMP_TO_HISTORY WebSocket message with that row's index
Hover → show darker background
```

### Timestamps
Use relative time — "just now", "2m ago", "1h ago". Compute from `entry.timestamp`.

### Empty state (no history yet)
```
No edits yet.
Make a change on the canvas to start building history.
```

---

## 10. Toolbar Integration

**File:** `packages/overlay/src/components/Toolbar.tsx`

Add a history toggle button to the left side of the toolbar (after the Glide logo):

```tsx
// History toggle button
<button
  onClick={() => setHistoryPanelVisible(!historyPanelVisible)}
  title="History (Ctrl+Alt+H)"
  className={historyPanelVisible ? 'active' : ''}
>
  <ClockIcon size={16} />
</button>
```

Keyboard shortcut: `Ctrl+Alt+H` toggles `historyPanelVisibleAtom`.

Undo/Redo buttons remain in the toolbar as they already are (Ctrl+Z / Ctrl+Shift+Z).
They are separate from the history panel toggle.

---

## 11. History Cap Configuration

**File:** `glide.config.ts` (user's project root)

```typescript
export default {
  // ... existing config ...
  historyLimit: 100,   // number of states to keep. Default: 100. Max: 1000.
}
```

The server reads this on startup and passes it to `history-manager.ts` via:

```typescript
import { setHistoryLimit } from './history-manager'
setHistoryLimit(config.historyLimit ?? 100)
```

Add `setHistoryLimit` to `history-manager.ts`:

```typescript
let MAX_HISTORY = 100

export function setHistoryLimit(limit: number): void {
  MAX_HISTORY = Math.min(Math.max(limit, 1), 1000)
}
```

---

## 12. What History Does NOT Do

⛔ History is NOT persisted to disk — never write history to a file.
⛔ History does NOT survive server restarts — in-memory only.
⛔ History does NOT create git commits — that is branching mode, a separate feature.
⛔ The overlay does NOT store history state independently — it only mirrors what the server sends via HISTORY_UPDATE.
⛔ Do NOT implement thumbnails/canvas snapshots in v1 — HistoryEntry has no thumbnail field.
⛔ Do NOT implement named history states ("snapshot" / "bookmark") in v1.
⛔ Do NOT implement history pruning based on time — only prune by count (MAX_HISTORY).
⛔ Do NOT show a "clear history" button that works in v1 — show it disabled as a placeholder only.
⛔ Do NOT call pushHistory for read-only operations (GET_HISTORY, selection changes, panel resizes).
⛔ Do NOT allow the overlay to directly mutate historyStackAtom — it is read-only in the overlay; only the server controls history state.

---

## 13. Exact Build Order for This Feature

Build in this exact order to avoid import cycle errors:

1. Add `HistoryEntry` and `FileDiff` types to `packages/core/src/types.ts`
2. Add `JumpToHistoryMessage`, `GetHistoryMessage`, `HistoryUpdateMessage` to `packages/core/src/types.ts`
3. Write `packages/server/src/history-manager.ts` (full implementation above)
4. Integrate `pushHistory` call into `packages/ast-writer/src/index.ts`
5. Add UNDO / REDO / JUMP_TO_HISTORY / GET_HISTORY cases to `packages/server/src/ws-server.ts`
6. Add `historyStackAtom`, `historyCurrentIndexAtom`, `historyPanelVisibleAtom` to `packages/overlay/src/store/scene.ts`
7. Handle `HISTORY_UPDATE` in the overlay WebSocket message handler
8. Write `packages/overlay/src/components/HistoryPanel.tsx`
9. Add history toggle button to `packages/overlay/src/components/Toolbar.tsx`
10. Add `historyLimit` to config schema

---

## 14. End-to-End Test for This Feature

```
1. Start Glide on a React + Tailwind test project
2. Open history panel (Ctrl+Alt+H)
3. Panel shows: "No edits yet."
4. Click h1 element, drag 16px right
5. EXPECTED: Card.jsx updated, toast appears, history panel shows 1 row: "marginLeft: — → ml-4 · Card.jsx"  current indicator (●) on that row
6. Make 2 more edits (change color, change padding)
7. EXPECTED: History panel shows 3 rows, ● on the last one
8. Press Ctrl+Z (undo)
9. EXPECTED: ● moves to row 2, row 3 becomes dimmed/italic (future state), HMR fires
10. Click row 1 in history panel (jump to first edit)
11. EXPECTED: ● moves to row 1, rows 2 and 3 dimmed, both Card.jsx writes fire, HMR fires twice
12. Make a new edit
13. EXPECTED: Rows 2 and 3 are discarded, new row 2 appears with new edit, stack is now 2 entries
14. Restart the Glide server
15. EXPECTED: History panel shows "No edits yet." — history was not persisted
```

---

*End of HISTORY FEATURE SPEC — for Glide coding agent*
