# Glide Architecture

This document describes how Glide connects the canvas to the source files.

---

## 1. Parts

| Part | Role | Location |
|:---|:---|:---|
| Vite plugin | Stamps elements with `data-gl-source`, injects the bridge, serves the editor at `/__glide/` | `packages/vite-plugin` |
| Bridge | Script in the app page. Reports selection, geometry and styles to the editor | `packages/vite-plugin`, `packages/server` |
| Editor | The canvas UI, served as one HTML page | `packages/overlay/src/editor-html.ts` |
| Server | WebSocket hub, file watcher, transactions, history | `packages/server` |
| Writers | Source edits for JSX and for templates | `packages/ast-writer`, `packages/adapters/*` |

Element identity is the stamp: `file:line:col`. JSX elements also have a short content hash.

---

## 2. One Edit, End to End

```
User changes a property on the canvas
            │
            ▼
Editor sends one `batch-edit` with the file digest (one at a time)
            │
            ▼
Server checks the session, the path and the digest
            │
            ▼
Writer changes the source in memory (JSX: AST; templates: exact tag position)
            │
            ▼
Temp file → check file is unchanged → rename → history entry
            │
            ▼
`status` with new element positions → editor keeps its selection
            │
            ▼
Vite HMR renders the new source
```

---

## 3. Code-to-Canvas Synchronization

```
File saved in the IDE (or by an agent)
            │
            ▼
File watcher in ws-server.ts (Glide's own writes are ignored by digest)
            │
            ▼
For JSX/TSX: `scene_update` and `tree` are broadcast with a new generation
            │
            ▼
Editor requests fresh geometry from the page (no iframe reload)
```

---

## 4. Transactions (`packages/server/src/mutation-service.ts`)

- **One at a time.** Transactions run in sequence.
- **Idempotent.** A repeated transaction ID returns the first result. The same ID with different content gives `TRANSACTION_CONFLICT`.
- **Digest gate.** Each operation has `expectedDigest` (SHA-256 of the file). A mismatch gives `STALE_DIGEST`.
- **Element gate (JSX).** An optional hash on the element gives `STALE_NODE` if the element changed.
- **Atomic write.** Each file is written to a temp file, checked again, then renamed. A failure restores the files already written.
- **Path safety.** Files must be in the project, not in `.git` or `node_modules`, and not a symlink escape or a hard link.

Common error codes: `STALE_DIGEST`, `STALE_NODE`, `NODE_NOT_FOUND`, `INVALID_TARGET`, `INVALID_OPERATION`, `UNSUPPORTED_OPERATION`, `INVALID_PATH`.

---

## 5. Component Definition Resolution (`packages/core/src/resolve.ts`)

For an element that is a component instance (e.g. `<HeroCard />`), `resolveComponentDefinition`:
1. Parses the caller file.
2. Finds the import for the component name.
3. Resolves the path with project aliases and extension rules.
4. Finds the declaration position in the target file.

The editor can then open that file in VS Code or Cursor.

---

## 6. WebSocket Protocol Reference

The first message must be `hello` with the session token from the editor page. Other connections are closed.

| Message | Direction | Description |
|:---|:---|:---|
| `hello` `{ token }` | Client → Server | Session handshake; reply is `authenticated` |
| `batch-edit` `{ batchId, edits[] }` | Client → Server | One transaction. Each edit: `{ file, line, column, hash?, expectedDigest, change }` |
| `edit`, `insert`, `reorder`, `reparent`, `group`, `ungroup`, `arrange` | Client → Server | Single operations; handled as a transaction |
| `status` | Server → Client | Result: `success`, `error`, `changedFiles`, `selectionRemaps`, `deletedSourceIds` |
| `get-tree` `{ file }` | Client → Server | Reply `tree` with the layer tree, `digest` and `generation` |
| `scene_update` `{ file, elements, generation }` | Server → Client | A JSX file changed outside the editor |
| `inspect-props` / `source-props` | Both | Literal props of a JSX element |
| `inspect-scopes` / `edit-scopes` | Both | Whether `className` is forwarded; active `cva` variants |
| `resolve_component` / `resolved_component` | Both | Find a component definition |
| `open_component` / `open_component_status` | Both | Open a file in the code editor |
| `undo`, `redo`, `JUMP_TO_HISTORY`, `GET_HISTORY` | Client → Server | History; reply `HISTORY_UPDATE` |
| `git-branch-create`, `git-branch-finalize` | Client → Server | Git sandbox; reply `git-status` |
