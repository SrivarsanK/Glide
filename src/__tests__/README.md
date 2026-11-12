# Glide Test Suite Architecture

Glide maintains a centralized test suite under `src/__tests__/` executing across all workspace packages (`@srivarsank/*`) with Vitest.

## Why Centralized Tests?

1. **Clean Distribution Bundles**: Keeping tests in `src/__tests__/` ensures `tsc` compilation inside `packages/*/src/` outputs only production code and types to `packages/*/dist/`, preventing test utilities or mock files from leaking into published npm artifacts.
2. **End-to-End & Cross-Package Integration**: Glide's visual editing involves complex interaction between browser runtime (`overlay`), Vite development server plugin (`vite-plugin`), WebSocket transaction manager (`server`), and code modding AST engines (`ast-writer`, `core`, `adapters`). Centralized tests exercise these interdependent contracts without cyclic monorepo dependencies.
3. **Workspace Aliasing**: `vitest.config.ts` maps `@srivarsank/<pkg>` directly to active development source under `packages/<pkg>/src/index.ts`, ensuring test runs always validate live changes rather than stale dist builds.

---

## Test Suites by Package Domain

This is a guide to representative suites. Run `npm test` for the current complete
file and test counts; the Vitest include pattern is `src/__tests__/**/*.test.ts`.

### 1. Core (`packages/core`)
- `component-registry.test.ts` — Component discovery, project metadata, and file watching.
- `component-resolve.test.ts` — Component definition and call-site resolution.
- `meta.test.ts` — Framework, style dialect, and project meta detection.
- `mutation-scope.test.ts` — Responsive breakpoint and pseudo-state mutation scopes.
- `tree.test.ts` — Component hierarchy and nesting paths.
- `universal-tree.test.ts` — Universal component tree model across frameworks.

### 2. AST & CST Writer (`packages/ast-writer`)
- `layout-source.test.ts` — Persisting drag/resize gestures directly to source AST without sidecars.
- `parse-jsx-elements.test.ts` — JSX element tokenization and coordinate extraction.
- `props.test.ts` — Typed component prop inspections and literal updates.
- `text-safety.test.ts` — Text updates preserving mixed children, markup, and expressions.
- `transaction-structures.test.ts` — JSX structural operations (delete, duplicate, paste, arrange).
- `writer.test.ts` & `writer-safety.test.ts` — Exact node targeting, dynamic expression preservation, and atomic batch mutations.

### 3. Server & Storage (`packages/server`)
- `assets.test.ts` — Local asset handling and uploads.
- `editor-git.test.ts` — Scoped Git finalization and status queries.
- `history.test.ts` — Undo/redo stack and transaction digest verification.
- `mutation-service.test.ts` — Atomic transaction lifecycle, digest gates, and rollbacks.
- `project-paths.test.ts` — Path canonicalization, junction protection, and allow-lists.
- `server.test.ts` — WebSocket server lifecycles, messages, and broadcast handlers.
- `server-security.test.ts` — Localhost binding, origin checks, and escape attempts.
- `stress.test.ts` — Concurrency, burst requests, and revision-checked write stress tests.
- *Test Helpers*: `server-fixture.ts`, `ws-client.ts`.

### 4. Overlay & Browser Runtime (`packages/overlay`)
- `bridge.test.ts` — The two injected bridge scripts parse and run.
- `frame-queries.test.ts` — Page queries shared by the editor and the bridge.
- `mutation-transport.test.ts` — Serialized mutation queue, transaction tracking, and ACK remapping.
- `overlay.test.ts` — Contents of the served editor page and its stylesheet.
- `canvas-selection-regressions.test.ts` — Uninstrumented runtime node feedback and inspector guarding.
- `source-mapping.test.ts` — `data-gl-source` parsing and coordinate remapping after AST writes.
- `staged-edits.test.ts` — Staging buffer, review workflow, and multi-element batches.
- `window-messages.test.ts` — Safe window message schemas and origin verification.

### 5. Framework Adapters (`packages/adapters/*`)

### 6. Integration, CLI & Acceptance
- `index.test.ts` — Root exports, versions, and public library contract.
- `plugin.test.ts` — Vite plugin injection, dev bridge script, and absence of legacy position sidecars.
- `installer.test.ts` — CLI skill installation and bootstrap logic.
- `scripts/check-editor-artifact.mjs` — Served editor script parsing and VM transport verification.
- `scripts/consumer-acceptance.mjs` — Headless Chromium real-browser end-to-end acceptance from packaged tarball.
