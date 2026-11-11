# Staged Edits & Saved Drag Results

This document covers Glide's two write modes and how drag and resize results are saved.

---

## 1. Write Modes

| Mode | Behavior |
|:---|:---|
| Instant | Each edit is previewed on the page, then written to source after a short delay |
| Staged | Edits are previewed and held in the editor until the user applies them |

The user selects the mode in the editor. The selection is kept in the browser.

### Staged Mode Workflow
1. **Preview**: an edit is applied to the page in the iframe. No file is written.
2. **Buffer**: edits are collected in the editor, by element and property.
3. **Staging bar**: shows the count (e.g. `3 changes staged`) and a Before / After preview toggle.
4. **Apply Changes**: sends all edits as one `batch-edit` transaction. The server writes all files or none.
5. **Discard**: clears the buffer and removes the preview styles.

If the transaction fails (for example `STALE_DIGEST`), no file is changed.

---

## 2. Drag and Resize

- During the gesture, the page shows a live preview. No file is written.
- On release, Glide writes the result to source as a `layout` edit:
  - `left` / `top` / `width` / `height` in pixels.
  - An element in normal flow gets `position: relative`, so its place in flex or grid layout is kept.
  - Sticky elements cannot be dragged.
- With Tailwind authoring, the values are written as classes; otherwise as inline styles.

There is no `glide-positions.json` sidecar file. A project that still has one can delete it.
