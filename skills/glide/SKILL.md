---
name: glide
description: >
  Authoritative guide and toolset for AI agents to operate, configure, and visually
  design applications using Glide (@srivarsank/glide). Always trigger this skill whenever
  the user mentions Glide, visual design, visual editing, WYSIWYG editing, canvas direct manipulation,
  editing UI visually, styling components visually, dragging/resizing elements, adjusting Tailwind
  classes visually, or when inspecting glide-components.json or working with Glide's source
  write-back across React, Vue, Svelte, Astro, or HTML projects.
---

# Glide — AI Agent Visual Design & Architecture Skill

Glide is a **code-native visual design tool**. The user edits a live page on a canvas, and Glide writes each change into the source file.
There is **no secondary JSON AST or proprietary schema** — the user's source code is the only source of truth.

---

## 1. Quick Reference & Core Workflow

When asked to inspect, modify, or design UI in a Glide project, follow this loop:

```
┌────────────────────────────────────────────────────────────────────────┐
│  1. READ REGISTRY      cat glide-components.json                       │
│  2. TARGET ELEMENT     Locate bucket by component name, get element.id │
│  3. EDIT SOURCE        Change the class, style or text in the file     │
│  4. VERIFY             Glide sees the file change and updates canvas   │
└────────────────────────────────────────────────────────────────────────┘
```

An agent edits the source file directly. Glide watches the project, so the canvas updates without a page reload.

### Deterministic Helper Scripts
- **Query components**: `node skills/glide/scripts/query-components.js --name <ComponentName>`
- **Verify project setup**: `node skills/glide/scripts/verify-setup.js`

---

## 2. How Glide Runs

| Mode | Start | Editor address |
|:---|:---|:---|
| Inside Vite (default with the plugin) | `npm run dev` | `http://localhost:5173/__glide/` |
| Standalone | `npx @srivarsank/glide 5173` | `http://localhost:7777` |

The Vite plugin `glideSourceStamping()` is necessary for editing. It stamps each element with `data-gl-source="file:line:col"` in dev mode. Without stamps, elements can be selected but not edited.

---

## 3. Component Discovery via `glide-components.json`

Never guess file paths or crawl the workspace manually.
The `glide` command writes **`glide-components.json`** in the project root and updates it with a 300 ms debounce when source files change.

```ts
interface ComponentRegistry {
  projectRoot: string;
  generatedAt: string;
  framework: 'react' | 'vue' | 'svelte' | 'astro' | 'html' | 'unknown';
  buckets: ComponentBucket[];
}

interface ComponentBucket {
  name: string;           // "Card", "Header", "Button", "App"
  file: string;           // Absolute path to source file
  exportType: "default" | "named" | "anonymous" | "sfc" | "html";
  line: number;           // Line of declaration
  column: number;
  elements: RegistryElement[];
  cssFiles: string[];     // Associated stylesheets (e.g. Card.module.css)
}

interface RegistryElement {
  id: string;             // data-gl-source ("file:line:col")
  tagName: string;        // "div", "button", "Card.Header"
  line: number;
  column: number;
  isRoot: boolean;        // Outermost component wrapper
  classNames: string[];   // Static class tokens
  text?: string;          // Direct text preview (<=25 chars)
}
```

### Element Targeting Rules
1. **Root / Background Element**: `element.isRoot === true`. Use this for background color, outer padding, container sizing.
2. **Interactive Elements**: Filter `elements` by `tagName === 'button'`, `tagName === 'input'`, or specific class tokens.
3. **Sub-Components**: A capitalized `tagName` (e.g. `<UserAvatar />`) is an imported component. Find its own bucket by name to edit its definition.

---

## 4. What Glide Can Save

| File type | Class, inline style, text | Structural edits |
|:---|:---|:---|
| JSX / TSX | Yes | Yes |
| Vue (`.vue`) | Yes | No |
| Svelte (`.svelte`) | Yes | No |
| Astro (`.astro`) | Yes | No |
| HTML (`.html`) | Yes, in projects with no UI framework | No |

Structural edits are: insert, delete, duplicate, paste, reorder, reparent, group, ungroup, arrange, detach.

Glide **refuses** an edit that it cannot make exactly. The error starts with `UNSUPPORTED_OPERATION` and gives the reason. Typical causes:
- The class or style is dynamic (`:class`, `class={...}`, `class:list`, `{...spread}`).
- The text has expressions or child elements.
- A condition or a shared `cva` definition would override the new class.

When Glide refuses, edit the source file directly.

---

## 5. Tailwind Rules

- **Replace only the related token.** A background change replaces `bg-*` only.
- **Keep variants.** `md:`, `hover:` and other scoped classes are separate; do not remove them.
- **Keep arbitrary values** such as `bg-[#1a1a2e]` or `w-[420px]`.
- **Use project theme tokens** where they exist (Tailwind v3 config or v4 `@theme`).
- Details: [tailwind-rewriting.md](references/tailwind-rewriting.md).

If the component uses CSS Modules, edit the file listed in `bucket.cssFiles[0]`.

---

## 6. Edit Modes and Conflict Safety

- **Instant mode**: each canvas edit is written to the source file immediately.
- **Staged mode**: edits are previewed and buffered. "Apply Changes" writes them as one transaction; "Discard" drops them.
- **File digest check**: each transaction carries a SHA-256 digest of the file. If the file changed in the meantime, the server refuses with `STALE_DIGEST` and writes nothing.
- **Element check (JSX)**: a content hash on the element gives `STALE_NODE` if that element changed.
- **All or nothing**: a transaction that fails in any file is rolled back in all files.
- **Undo / redo**: the session history restores full file contents.

If an agent edits a file while the user has edits pending, the user's next save can get `STALE_DIGEST`. The user must then select the element again.

---

## 7. Canvas Features (JSX / TSX)

- **Reparent by drag**: an element dropped into a different container moves in the JSX.
- **Detach to canvas**: a detached element stays in source as `{false && <El data-gl-workspace-id=... />}`. Do not delete these blocks; they are the user's pasteboard.
- **Drag and resize**: the result is written to source as layout styles. There is no position sidecar file.
- **Edit scopes**: for an element inside a component, the user can apply a class to the definition, to one usage, or to one `cva` variant option.

---

## 8. References

| Reference | When to Consult |
|:---|:---|
| [references/architecture.md](references/architecture.md) | Transactions, file watcher sync, WebSocket protocol |
| [references/framework-adapters.md](references/framework-adapters.md) | Write-back rules and limits for each file type |
| [references/tailwind-rewriting.md](references/tailwind-rewriting.md) | Utility prefix map and class edit rules |
| [references/staged-edits.md](references/staged-edits.md) | Staged mode and how drag results are saved |
