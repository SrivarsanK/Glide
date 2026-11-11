# Changelog

All notable changes to **Glide** (`@srivarsank/glide`) are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Editor inside the Vite dev server**: with `glideSourceStamping()`, the editor opens at `/__glide/` on the dev server. The app loads from its own origin with no proxy, and Vite HMR works as usual. Use `glideSourceStamping({ editor: false })` to keep the separate `glide` command.
- **Write-back for Vue, Svelte, Astro and HTML**: class, inline style, text, and drag/resize edits now save to `.vue`, `.svelte`, `.astro` and `.html` files, with the same digest checks, atomic writes, rollback and undo as JSX.
  - Vue uses `@vue/compiler-sfc`; Svelte uses `svelte/compiler`. Both find the element by exact tag position and parse the result again.
  - Astro and HTML use a tag scanner that respects quotes and `{}` expressions.
  - Structural edits (insert, delete, move, group) stay JSX/TSX only.
  - Dynamic values (`:class`, `class={...}`, `class:list`, `{...spread}`) are refused with a reason.
- **HTML page stamping**: in projects with no UI framework, the Vite plugin stamps the elements inside `<body>` of HTML pages, so plain HTML sites can be edited. `<html>`, `<head>` and `<body>` are not stamped.
- **Component registry from the dev server**: the editor at `/__glide/` now writes and updates `glide-components.json`, as the `glide` command does.
- **Class expressions (JSX)**: class edits work in `cn`, `clsx`, `cx`, `classnames`, `twMerge`, `cva` and template literals. Glide refuses an edit that a condition, a runtime-built class or a shared `cva` definition would override.
- **Edit scopes**: for an element inside a component, choose where a class edit goes: the component definition, one usage, or one `cva` variant option.
- **Project Tailwind theme**: class edits use the project's own tokens (Tailwind v3 config or v4 `@theme`).
- **Editor chrome**: Figma-style toolbar, zoom menu and keyboard shortcuts.

### Changed
- JSX edits are spliced into the original source, so return statements are no longer reprinted with new semicolons or indentation.
- The package is about 10 times smaller (33 MB to 3.3 MB of JavaScript). The TypeScript compiler is no longer bundled into each entry point; edited JSX is checked with the Babel parser.
- The Vite plugin no longer sets `cors: true` on the dev server. Vite's default policy already admits the editor on localhost.
- The error for an unsupported file type is now "Glide cannot save edits to this file type yet."
- The skills shipped to AI agents (`skills/`) are rewritten to match the code. They no longer describe the LWW queue or `glide-positions.json`.
- Unit tests now run only from `src/__tests__`, so nested git worktrees are not picked up.

### Fixed
- The editor socket was refused when the dev server ran over HTTPS (`server.https`).
- "Find component", "Open in editor" and Git branch actions used the process folder instead of the project root.
- Server memory grew for the whole session: completed transaction results are now capped.
- Every server error was reported as "Malformed JSON".
- Stamping broke `<svelte:head>`, `<svelte:window>` and other namespaced tags.
- The bridge script was not injected when `<head>` had attributes.
- Proxy bridge injection expanded `$&` and `$'` patterns in the injected script.
- A class put in front of the list could be overridden by a base class; Glide now refuses that edit.
- Workspace (pasteboard) mutations did not send the file digest.
- An unclosed `.modal-input` CSS rule stopped later editor styles from applying.

### Removed
- `glide-positions.json` is no longer read or written. Drag results are saved to source. A project that still has this file can delete it.

---

## [1.1.2] - 2026-10-17

### Added
- **Transactional writes**: each edit, staged batch, structural action and undo/redo runs as one transaction. The editor sends a SHA-256 digest of each file; a changed file gives `STALE_DIGEST` and nothing is written. Files are written to a temp file, checked again and renamed. A failure rolls back all files in the transaction.
- **Selection remapping**: after a write, the server sends the new position of every element, so the selection and queued edits stay on the correct element.
- **Responsive and pseudo-state scopes**: class edits can target a breakpoint (`md:`) or a state (`hover:`, `focus:`, `focus-visible:`, `active:`, `disabled:`).
- **Layout gestures to source**: drag and resize results are written as `left`/`top`/`width`/`height` styles. Elements in normal flow get `position: relative`, so flex and grid layout is kept.
- **Literal prop editing**: edit literal values of JSX props at an explicit authored scope.
- **Offline editor assets**: Lucide icons and the Inter font are served by Glide. The editor makes no remote requests.
- **Side-effect-free CLI flags**: `--help` and `--version` print and exit without writing files.
- **Release gate**: `verify:release` builds, typechecks, tests, checks the bundled editor, and runs a headless Chromium test against the packed tarball. Publishing runs only after it passes.

### Security
- The server listens on `127.0.0.1` by default and checks the `Host` and `Origin` of each HTTP and WebSocket request. Set `remoteAccess` in the config for other hosts.
- An editor socket must send the session token from the editor page within 5 seconds; other sockets are closed.
- Messages are validated for size, depth and reserved keys (`__proto__`, `constructor`, `prototype`).
- All file paths are resolved to canonical paths inside the project. `.git`, `node_modules`, alternate path forms, dangling symlinks and hard links are refused.
- Browser messages between the editor and the app are accepted only from the expected window and origin, and only with a `glide:` type.
- Git finalize commits only editor-owned changes to files that were clean before (`git commit --only`).

### Fixed
- Class edits stay on the selected element.
- Edits that would remove dynamic attributes are refused.
- Text edits keep mixed children and expressions.
- Batch targets are resolved before source positions change.
- History restores that would overwrite external edits are refused.
- Vue edits keep bindings, and an edit to a missing node leaves the file unchanged.
- Uninstrumented runtime nodes are guarded; the properties panel is inactive for them.
- Cross-platform path traversal is blocked in `isSafeFilePath`.
- Bridge scripts: syntax errors, the drag threshold, text editing across text types, and layer tree icons and selection sync.

---

## [1.1.1] - 2026-09-24

### 🤖 AI Agent Skills Integration & CLI Installer

#### Added
- **Bundled AI Agent Skills (`dist/skills/`)**:
  - `skills/glide/SKILL.md`: Comprehensive master AI agent skill detailing the full Figma/v0 bidirectional architecture, In-Memory SceneGraph, surgical Tailwind token rewriter, cross-parent reparenting, and property-level LWW delta queue.
  - `skills/glide-component-segregator/SKILL.md`: Updated guide for AI agents to query `glide-components.json`, target elements, and coordinate with SceneGraph and LWW delta queue.
  - `skills/glide-setup/SKILL.md`: Zero-error setup and configuration guide for React, Vue, Svelte, Astro, and HTML.
- **Interactive CLI Skill Installer (`packages/cli/src/installer.ts`)**:
  - Detects AI environments: Antigravity IDE, Claude Code, Cursor, Windsurf, GitHub Copilot.
  - CLI flags: `--install-skills`, `install-skills`, `init`, `--yes`, `--no-skills`.
  - Prompts user in interactive TTY and automatically installs skills to `.agents/skills/` in unattended / AI agent runs.
  - Automatically generates `.cursor/rules/glide.mdc` when Cursor is detected.
- **Build Pipeline Skill Packaging (`scripts/build-single-package.js`)**:
  - Automatically bundles `skills/` into `dist/skills/` and synchronizes to `.agents/skills/` on every build.
  - Added `"skills"` to `package.json` `"files"` so npm tarball includes all skills.

---

## [1.1.0] - 2026-09-24

### 🚀 Major Architectural Milestone (Figma/v0 Architecture Engine)

This release implements a production-grade bidirectional AST and canvas architecture inspired by the Figma spatial rendering model and Vercel v0 generative engine frameworks.

#### Added
- **In-Memory SceneGraph Engine (`packages/overlay/src/scene-graph.ts`)**:
  - Replaces DOM-fragile `document.elementFromPoint` with a cached spatial bounding rect hierarchy.
  - O(log n) zoom-aware and transform-aware hit testing across overlapping, deep, or transformed elements.
  - Selective invalidation and tree patching on resize, scroll, or file modification.
- **Bidirectional Code-to-Canvas Synchronization (`packages/server/src/ws-server.ts`)**:
  - Chokidar watcher triggers AST re-parse on external source code modifications.
  - Extracts `{ id, line, col }` element coordinate maps without triggering full iframe refreshes.
  - Emits `scene_update` WebSocket events directly patching the overlay's active SceneGraph.
- **Surgical Tailwind CSS Token Rewriting (`packages/ast-writer/src/css.ts`)**:
  - `rewriteTailwindToken` and `rewriteClassNameToken` functions for precise token replacement in `className` props.
  - Intelligently manages utility prefixes (`bg-`, `text-`, `w-`, `h-`, `p-`, `m-`, `rounded-`, `border-`) including arbitrary values (e.g. `bg-[#123456]`).
  - Preserves surrounding utility classes without clobbering or formatting degradation.
- **Canvas Cross-Parent Reparenting (`packages/ast-writer/src/reorder.ts`, `packages/server/src/ws-server.ts`)**:
  - Drag-and-drop elements across different containers visually on canvas.
  - `reparent` WebSocket handler invokes `reorderJSXElement` with new target parent and index, rewriting AST child hierarchies.
- **Component Definition Resolution & Jump Navigation (`packages/core/src/resolve.ts`, `packages/overlay/src/editor-html.ts`)**:
  - `resolveComponentDefinition` traces JSX component instantiations through `import` declarations to their origin files.
  - Added jump buttons in the Properties panel and Layers tree to immediately open component definitions in IDE / editor.
  - WebSocket protocol handlers `resolve_component` and `open_component`.
- **Property-Level Delta Queue & LWW Conflict Resolution (`packages/server/src/delta-queue.ts`)**:
  - Property-level Last-Writer-Wins (LWW) conflict engine keyed by `(nodeId, propKey)`.
  - Independent clocks for distinct properties of the same element prevent clobbering during simultaneous edits.
  - Rejects stale writes (`STALE_PROPERTY_WRITE`) and manages optimistic pending ops queue with timeout expiration and `ACK_OP` receipts.

#### Testing & Quality
- Added 39 new unit and integration tests across SceneGraph, AST JSX parsing, Tailwind rewriting, component resolution, and property-level delta queue.
- Total test coverage: 29 test suites, 219 tests passing.

---

## [1.0.47] - 2026-09-12

### Fixed
- Fixed color picker eyedropper tool state restoration and Chromium freeze guarding.
- Fixed element resizing generation synchronization.

---

## [1.0.46] - 2026-07-25

### Added
- Multi-framework template write-back support for Vue SFC, Svelte, Astro, and HTML.
- Component Registry auto-indexing (`glide-components.json`).
