# Staged Edits Buffer & Zero-Flicker Drag

This document covers Glide's transaction mode and drag coordinate caching mechanisms.

---

## 1. Staged Edits Buffer (`packages/server/src/staged-edits.ts`)

When making multiple design adjustments across several elements or components, writing each intermediate edit directly to disk causes:
- Frequent disk I/O.
- Continuous Vite HMR rebuilds.
- Layout instability and flicker on the canvas.

### Workflow
1. **Interactive Preview**: In Staged Mode, edits made in the canvas or property panel are immediately applied to the DOM in the browser iframe.
2. **Buffer Queue**: Edits are collected in an in-memory transactional buffer on the client/server.
3. **Staging Bar**: A bottom-docked review bar displays the pending edit count (e.g. `3 changes staged`).
4. **Batch Commit**: Clicking "Commit Changes" sends the entire transaction batch to `GlideServer`, which applies each AST codemod in sequence and writes to disk in one atomic pass.
5. **Rollback**: Clicking "Discard All" clears the buffer and rolls back preview styles to the saved state.

---

## 2. Zero-Flicker Live Dragging (`glide-positions.json`)

During mouse drag operations, an element's X/Y coordinates update at 60 FPS.
Writing AST coordinates to TSX on every mousemove frame would overwhelm the dev server with HMR cycles.

### Coordinate Caching
- When an element is dragged, Glide writes interim `{ x, y }` coordinates to **`glide-positions.json`** in the project root.
- The canvas overlay reads positions from this cache, delivering butter-smooth 60 FPS dragging.
- On drag release (`mouseup`), the final position can be committed to the source file or left in `glide-positions.json`.
- `glide-positions.json` should always be included in `.gitignore`.
