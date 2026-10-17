# Glide: product, architecture, and shipping audit

## Current implementation status — 2026-10-16

This section supersedes the baseline status statements below and the older
handoffs in `GLIDE_REMAINING_WORK.md` and `CODEX_PROGRESS_REPORT.md`.
The original audit remains below as evidence and acceptance criteria.
Current HEAD is `a01b2e4`; this continuation is in the working tree, including
the unfinished changes inherited from the previous session.

### Completed and verified in this continuation

- Completed the transaction path for the inherited JSX structural operations:
  delete, duplicate, paste into a selected container, insert, group, ungroup,
  reorder, reparent, and arrange. Disk tests cover valid output, exact targets,
  retry-safe undo/redo, and preservation of unrelated source.
- Live edits and served structural controls now use the same revision-checked
  mutation service as staged edits. CLI source-writing callbacks were removed;
  `GlideServer.onEdit` now observes persisted changes and must not write source.
- Fixed the direct server routes' overescaped coordinate expressions and
  validated their primary source reference against the file being edited.
- Finished the served mutation transport: serialize writes, retain transaction
  IDs across reconnects, and remap queued coordinates and structural references.
  Deleted references or mismatched hashes cancel queued writes. Cancelled Apply
  requests release the pending UI state while preserving staged changes.
- Structural copying/moving rejects unsupported dynamic bindings and identity
  attributes. Paste and cross-parent movement reject component references whose
  lexical bindings have not been verified. Insertion rejects destinations whose
  children are controlled by props or spreads. Structural no-ops do not add
  empty history entries. History errors include the transaction ID.
- Native file watching aborted Node on this Windows host during the server
  tests. Windows now uses 200 ms polling; watching does not follow symlinks.
  The same tests pass with this configuration. Polling adds filesystem work and
  should be measured on large projects before release.

### Verification

| Check | Result | Scope |
|---|---|---|
| `npm test -- --silent` | **364 passed, 39 files** | Workspace regressions, authenticated sockets, real temporary source files, history, stress tests, served-script VM tests. |
| `npm run typecheck` | **PASS** | Root TypeScript graph. |
| `npm run build` | **PASS** | Internal packages, distribution bundles and declarations. |
| `node scripts/check-editor-artifact.mjs` | **PASS** | Built editor script parses; its actual transport queues, retries, and remaps edits in a VM. |

The initial test attempt failed because the sandbox blocked esbuild's child
process; tests were rerun with approved execution. The native Windows watcher
abort was a separate reproduced failure, resolved for this suite by polling.

### Remaining work and next entry point

F01–F08 have substantial regression coverage, but the earlier handoff's blanket
claim that every P0 and its acceptance gates are complete is too broad. General
identity reconciliation after external edits/HMR, crash recovery, and complete
browser acceptance remain open. Do not restore the old stash or repeat the
historical stash-pop instructions.

| Audit area | Current state / remaining work |
|---|---|
| F05 / F10: mapping and props | Transaction remaps now cover structural edits. Persistent identity across external edits/HMR and explicit definition/call-site/runtime-instance scope remain open. Typed literal prop controls are the next implementation item. |
| F09: source-native layout | Relative position operations can persist to source through transactions. Full drag/resize/layout semantics, existing sidecar migration, and production-build visual acceptance remain open. |
| F11: structural actions | Conservative JSX subset is implemented and tested through service/socket paths. It is not framework parity or real-browser acceptance. Cross-file paste, dynamic copying, draw placement, and general component scope remain unsupported/unverified. |
| F12 / F15: adapters and targeting | Selector-only references no longer become synthetic line-1 targets. The active mutation service rejects non-JSX/TS/JS adapters. Vue coordinate/binding repairs and explicit capability UI remain open. |
| F13: style scope | Direct and staged mutations share the writer, including explicit breakpoint class operations. UI propagation, pseudo-state authoring, and complete style provenance remain open. |
| F14: served runtime | Mapper and transport are typed modules used by the served script. Most editor/bridge logic still needs consolidation. |
| F16: Git/browser boundaries | Scoped Git finalization, iframe origin/source validation, and safe layer-label rendering remain open. |
| F17: release | Help/version/runtime alignment, local offline assets, fresh tarball consumer checks, and publication gates remain open. |

No real-browser manual-edit flow, isolated tarball install, app restart/production
build appearance check, or release was performed. The package is **not yet
release-ready**. Continue with scoped typed component props and HMR identity,
then source-native layout/style scope, adapter/browser boundaries, and release
acceptance. Keep unsupported operations explicit and byte-preserving.

---

**Prepared for:** GPT Astra implementation handoff.
**Local date:** 2026-10-14, Asia/Calcutta; mapping tool date was 2026-10-13 UTC.
**Source baseline:** `8fe0f4ef1ffc0898ab04b5f4d8df647692625239`.
**Package:** `@srivarsank/glide`, manifest version `1.1.1`.
**Scope:** Analysis and documentation; no application fixes or publication performed.

## 1. Read this first

Glide is a substantial prototype of the owner's intended product: a locally running npm tool for manually editing a real website and writing deterministic changes into its source files. Component discovery, source instrumentation, an application iframe, inspector controls, local messaging, source transformers, and history already exist. The manual editing path needs no AI agent, model inference, API key, or paid AI tokens.

**The package is not ready to ship as a trustworthy general source editor.** Existing tests and builds pass, but targeted probes against the built package reproduce destructive source transformations and misleading batch success. Some interactions do not persist to source, and several UI commands have no corresponding mutation handler. A general typed component-prop inspector is missing from the active editing contract.

Retain the useful local-rendering and parser foundations. Repair source preservation, mapping, transactions, acknowledgment, and installed-package acceptance before adding more controls. A visual control is only complete when its supported source effect and failure behavior are defined and verified.

`.planning/STATE.md` reports 12 completed phases and no concerns. That is historical workflow bookkeeping, not evidence of shipping readiness. README and bundled skills also overstate some guarantees. This audit checks their claims against implementation and execution.

### Owner's product contract

1. Install/run through npm in an existing local development project.
2. Show the actual application in a canvas-like editing surface.
3. Select mapped components/elements and manipulate properties manually.
4. Persist supported edits into actual authored source without AI.
5. Preserve surrounding code, dynamic behavior, comments, and unrelated styles.
6. Keep committed changes after reload, restart, and a normal app build with Glide disabled.
7. Provide useful Figma/v0-inspired interactions within explicit capabilities.
8. Reject unsupported or ambiguous edits with a reason and no source changes.

Temporary DOM previews and editor metadata are appropriate. They must not masquerade as completed source edits. Registries, comments, and UI preferences may be sidecars; committed website appearance must live in app source.

## 2. What the project is and the concepts it uses

### Code-native visual editing

The user's framework renders the website. Glide supplies a surrounding editor, selection overlays, layers, and property controls. The main preview is an iframe; canvas rendering also serves auxiliary editor functions. “Canvas” describes the editing experience, rather than requiring the website to be rebuilt as a separate HTML-canvas renderer.

This is a sound direction: the browser already renders real layout, styles, fonts, and application behavior. Glide's central problem is mapping that result to safe authoring changes.

### Source instrumentation and component discovery

Development transforms add `data-gl-source="file:line:column"`. Babel handles JSX/TSX; the Vite plugin also instruments templates. The component registry scans named components, elements, exports, and related stylesheets; a resolver locates definitions.

A source location is a candidate source target. It is not stable identity across revisions or a unique identity for repeated runtime instances. It also does not prove that an imported component forwards source attributes to its DOM root.

### Deterministic codemods

Manual controls emit structured operations. Local handlers choose a writer and rewrite supported source forms using Babel/Recast or template helpers. No inference is required.

The inverse mapping has limits. A computed red background can originate in a utility class, inline object, CSS module, variable, inheritance, media rule, conditional expression, or component prop. The editor must identify or expose the authoring scope. Computed style alone is insufficient.

The UI should distinguish **runtime value**, **authored value**, **source representation**, and **edit scope**. Unsupported expressions need a visible explanation, not an invented static replacement.

### Figma/v0-inspired mechanisms

- Scene bounds and spatial indexing support selection, hit testing, and zoom.
- Layers, typography/color controls, guides, snapping, device sizes, and drawing tools offer familiar interactions.
- Optimistic DOM previews and staged edits separate immediate feedback from source persistence.
- Per-property sequencing attempts to keep independent edits from clobbering one another.
- Component navigation and codemods connect visual editing to implementation.

These mechanisms have different levels of completeness. Property-level last-write-wins is not an atomic file transaction. Browser-local notes do not establish collaboration. AI generation is unnecessary for the intended manual product.

## 3. Actual architecture and active execution path

~~~mermaid
flowchart TD
    A[User source and local dev server] --> B[Vite and Babel instrumentation]
    A --> C[Glide HTTP proxy]
    B --> D[Real app iframe and injected bridge]
    C --> D
    D -->|postMessage| E[Editor HTML and inline runtime]
    E -->|WebSocket operations| F[GlideServer router]
    F --> G[CLI edit handler]
    F --> H[JSX structural writers]
    G --> I[JSX or template writers]
    I --> J[App source files]
    H --> J
    G --> K[Position sidecar]
    K --> L[Vite CSS overrides]
    L --> D
    J -->|App compiler and HMR| D
    F --> M[History and property queue]
~~~

| Area | Actual location | Responsibility and caveat |
|---|---|---|
| Public API | `src/index.ts` | Exports writers/server/plugins/helpers; exported VERSION is `0.1.0`. |
| Distribution build | `scripts/build-single-package.js` | Bundles workspace implementations into root npm entries/declarations; copies skills. |
| CLI | `packages/cli/src/index.ts` | Config, indexing, edit-to-disk callback, history, server startup. |
| Instrumentation | `packages/babel-plugin/src/index.ts`; `packages/vite-plugin/src/index.ts` | Source attributes, bridge injection, position CSS, custom HMR. |
| Active browser editor | `packages/overlay/src/editor-html.ts` | About 8,034 lines of generated HTML/CSS/inline JS. This is what the server serves. |
| Other editor helpers | `packages/overlay/src/{overlay,bridge,scene-graph}.ts` | Exported/tested overlapping implementations; not the entire active editor. |
| Local server | `packages/server/src/ws-server.ts` | Proxy, fallback bridge, WebSocket routing, watchers, structures, history, Git. |
| JSX mutations | `packages/ast-writer/src/{writer,reorder}.ts` | Classes/styles/text and structural operations. |
| Template adapters | `packages/adapters/{vue,svelte,astro,html}/src/index.ts` | Basic class/style/text helpers; do not imply structural parity. |
| Discovery | `packages/core/src/{component-registry,resolve,scanner}.ts` | Indexing, definition resolution, approximate CSS provenance. |
| Recovery/conflicts | `packages/server/src/{history-manager,delta-queue}.ts` | Snapshot history and property state; not complete transactional persistence. |
| Verification | `src/__tests__/`; `test-site/` | Node tests and playground; no established real-browser acceptance suite. |

Ordinary writes travel through browser controls, socket messages, server validation, the CLI callback, a writer, and filesystem persistence. App HMR renders the result.

Staged batches, direct writes, position sidecars, explicit bake, and server-owned structural writes follow different paths. They do not share a complete validation/transaction service. The Vite and proxy bridges are separate embedded implementations.

**Repair the served path.** Passing tests for exported overlay/bridge helpers do not prove correctness of the inline runtime received by npm users.

## 4. Feature inventory

“Present” means an implementation exists, not that every browser interaction passed. Reproduced defects appear in section 6. Disable unsupported actions with clear capability reasons.

| Feature | Current state | Shipping implication |
|---|---|---|
| Local npm CLI/exports | Present; build/import checks pass | Help is broken; isolated consumer install unverified. |
| Actual app preview/proxy | Present | App dev server is required; browser transport/iframe cases need acceptance tests. |
| Zero-token manual editing | Present | No mandatory AI client found; bundled agent skills are optional guidance. |
| Offline editor | Partial | Google Fonts and mutable `unpkg.com/lucide@latest` remain external dependencies. |
| Component registry/name lookup | Present | Discovery metadata does not solve revision/instance identity. |
| DOM/source mapping | Partial/fragile | Coordinates drift; column conventions, selector fallback, repeated instances need repair. |
| Definition navigation | Present | Jumping to a definition is different from editing props at a call site. |
| Typed component props | Missing from active contract | Need boolean/number/string/enum controls and dynamic/spread/inherited value handling. |
| Static JSX styles/classes | Present but unsafe | Unrelated nodes and dynamic behavior can be changed. |
| Tailwind editing | Present with divergent paths | Single/multi-property semantics differ; breakpoint context is lost. |
| CSS modules/provenance | Helpers exist; ownership incomplete | A computed style does not establish which declaration to edit. |
| Text editing | Present but unsafe | Mixed markup and expressions can be deleted. |
| Staging/Apply | Present but unsafe | Partial writes, false success, early clearing, missing revision checks. |
| Drag/position | Partial | Saves a sidecar; source changes require explicit bake. |
| Resize/layout controls | Present with mixed paths | Need layout-aware persistence and consistent single/batch semantics. |
| Reorder/reparent | JSX path exists | Framework parity and lexical/runtime scope need proof. |
| Group/ungroup | JSX path exists | Relevant CLI handlers explicitly skip non-JSX frameworks. |
| Shape/frame/text insertion | UI and JSX path exist | Draw position is absent from insertion payload; capabilities/placement need review. |
| Delete/Duplicate/Paste | UI wired; handlers absent | UI emits operations the CLI does not implement. |
| Layers/visibility | Present | Runtime identity and persistence scope need defined behavior. |
| Zoom/pan/snapping/guides | Present | Native pointer/layout/scroll/transform acceptance missing. |
| Device previews | Present | Changing preview width does not prove responsive source edits. |
| Undo/redo/history | Present but unsafe under conflicts/failures | Snapshot restoration can overwrite external edits. |
| Git finalize | Present with unsafe scope | `git add -A` includes unrelated work. |
| Comments | Browser-local | Origin-wide localStorage/pixel anchors need project/node scoping. |
| Selection export | Implemented; fidelity unverified | Asset/browser restrictions apply; “Show in exports” only displays a toast. |
| Asset upload | Exported filesystem helper | Complete editor upload route was not established. |
| Five-framework structure parity | Missing | JSX handlers cannot provide universal support. |
| Variables/variants/multiplayer/plugin ecosystem | Not established | Treat as later product scope, not implemented guarantees. |

Incomplete UI wiring: `packages/overlay/src/editor-html.ts:6674` (duplicate), `:6694` (delete), `:6719` (paste), `:7858` (export checkbox). CLI dispatch ends at `packages/cli/src/index.ts:392` without delete/duplicate branches. Server success at `packages/server/src/ws-server.ts:1715` does not prove a supported mutation occurred.

## 5. Framework and styling scope

| Framework | Existing approach | Material limit |
|---|---|---|
| React/JSX/TSX | Babel/Recast coordinate mutations | Most complete structure path; destructive edge cases and instance identity remain. |
| Vue | SFC parser plus regex/span rewriting | Whole-file/template coordinate mismatch and dynamic attribute corruption. |
| Svelte | Template tag/string helpers | Expression boundaries, text preservation, directives, structural parity need verification. |
| Astro | Frontmatter/template preservation with string/tag helpers | Expression/directive semantics and structural parity need verification. |
| HTML | Attribute/class/text helpers | Exact target safety and formatting need proof; JSX structures do not establish HTML editing. |

Dependencies include Babel/Recast, Vue and Svelte tooling, PostCSS, Vite, file watchers, WebSocket transport, and text/layout helpers. This is not a full compiler-backed inverse authoring engine for every framework.

Recommended first trusted release: a tested React/Vite subset, with other frameworks explicitly limited/experimental until their operation gates pass. This is a sequencing recommendation, not a decision to remove the multi-framework goal.

Preserve existing Tailwind/CSS/inline representation where supported. Do not silently turn a breakpoint-specific class into a global inline override. Dynamic/inherited CSS provenance must be labeled rather than presented as certain.

## 6. Prioritized defects and repair targets

**Evidence labels:** R = reproduced against the built package or a live local server; S = confirmed implementation branch; U = integration behavior still unverified. P0 means a blocker for this source-writing product, not an externally assigned security severity.

### F01 — P0: one class edit changes unrelated elements [R]

- **Evidence:** `packages/ast-writer/src/writer.ts:350`–`:372` traverses other nodes with the same old class string.
- **Trigger/result:** Two independent buttons have `className="p-2"`. Updating only A's padding to 16px changes both A and B to `p-4`.
- **Fix:** Mutate the exact selected AST node/range. Shared edits require explicit selection or a declaration scope; class equality is not ownership.
- **Acceptance:** Identical-class siblings and separate definitions stay unchanged unless selected.

### F02 — P0: dynamic class/style behavior is erased [R]

- **Evidence:** `packages/ast-writer/src/writer.ts:341`, `:377`, `:595`.
- **Trigger/result:** `className={active ? "p-2" : "p-4"}` becomes static `className="p-4"`; `style={theme.button}` becomes an object containing only the requested color.
- **Fix:** Initially reject unsupported dynamic forms without byte changes. Add AST composition only where semantics are defined; preserve spreads, quoted/computed keys, imported objects, evaluation behavior, and custom properties.
- **Acceptance:** Dynamic branches survive; unsupported operations return reasons and leave source unchanged.

### F03 — P0: text replacement removes markup and expressions [R]

- **Evidence:** `packages/ast-writer/src/writer.ts:491`; template text helpers also need review.
- **Trigger/result:** `<p>Hello <strong>{name}</strong>!</p>` becomes `<p>Welcome</p>`.
- **Fix:** Select a literal text segment or literal call-site prop. Make replacing all children a separate explicit action. Escape using framework-aware nodes/spans.
- **Acceptance:** Icons, nested elements, expressions, special characters, and multiline text survive a valid round trip.

### F04 — P0: batches partly apply and report success [R/S]

- **Evidence:** `packages/server/src/ws-server.ts:1574`–`:1611`; staging is cleared before ACK at `packages/overlay/src/editor-html.ts:2704`.
- **Reproduction:** Live server callback accepts item 1 and throws on item 2. Reply is `{"success":true,"action":"batch-edit","count":1}`. Stale generation `-100` on both items is ignored. This probe establishes dispatch/response behavior using in-memory callbacks, not browser-to-disk persistence.
- **Fix:** Shared mutation service; validate targets/base revisions, transform all files in memory, validate outputs, and persist with rollback/recovery. Return transaction ID, errors, changed files/revisions. Clear only acknowledged operations.
- **Acceptance:** A failed second item leaves every file unchanged and staging retained; retries are idempotent; success yields one coherent history entry. A single-file rename is not a multi-file atomic transaction.

### F05 — P0: source coordinates drift between writes [R/S]

- **Evidence:** Exact opening-location lookup at `packages/ast-writer/src/writer.ts:299`; coordinate-keyed registries/scenes/positions. Babel and some core tree records use different column bases.
- **Reproduction:** Add a style to the first of two same-line buttons, then mutate the second using its original position: `NODE_NOT_FOUND`.
- **Fix:** Resolve every target against one immutable transaction snapshot; retain AST node identities while applying. Separate logical source-node identity from current coordinates and return remaps across revisions.
- **Acceptance:** Same-line siblings, insertion, formatting, undo, external changes, and HMR never retarget a later operation. Normalize coordinate bases at boundaries.

### F06 — P0: external changes and history are not safely protected [S/U]

- **Evidence:** Self-write time exemptions at `packages/server/src/ws-server.ts:874`, `:1667`; snapshot undo at `:1452`; history cursor advances before persistence at `packages/server/src/history-manager.ts:51`, `:83`.
- **Fix:** Expected content digests immediately before writes, per-file transaction serialization, known-write attribution, conflict-aware snapshot restoration, and cursor movement only after successful persistence. Scope history per project/session.
- **Acceptance:** External changes immediately after a Glide write are preserved or cause a conflict. A multi-file undo failure changes neither disk nor history cursor. Runtime conflict/failure reproduction remains required.

### F07 — P0: write server trusts unintended clients [R/S/U]

- **Evidence:** Unauthenticated WebSocket creation at `packages/server/src/ws-server.ts:918`; no explicit loopback host at `:1787`.
- **Reproduction:** Bound address is IPv6 `::`; a socket with Origin `https://untrusted.example` connects and reaches the audit edit callback. Browser attack conditions and firewall/network exposure were not tested.
- **Fix:** Loopback by default, Host/Origin validation, per-session capability authentication, message schemas/size/operation limits, explicit remote-use configuration. Protect tree/Git/history requests too.
- **Acceptance:** Unauthorized callers cannot read project data or reach mutation callbacks; approved local shell/iframe continue working.

### F08 — P0: file safety uses lexical paths [S/U]

- **Evidence:** `packages/server/src/ws-server.ts:40`; alternate CLI resolutions at `packages/cli/src/index.ts:84`, `:303`.
- **Fix:** One project root; canonicalize final existing targets and parent directories; validate after resolution; restrict writable file types; integrate revision-safe persistence. Existing traversal checks do not prove symlink/junction containment.
- **Acceptance:** Traversal, sibling prefixes, symlinks, Windows junctions, alternate resolution paths, and non-source targets cannot escape scope. No escape exploit was executed.

### F09 — P1: committed drag appearance can remain outside source [S/U]

- **Evidence:** `packages/cli/src/index.ts:140` writes positions JSON; `:169` separately bakes; Vite injects sidecar styles at `packages/vite-plugin/src/index.ts:1796`.
- **Fix:** Gesture preview in memory; commit layout-aware source operations through the shared service. Keep pending source status explicit. Preserve flex/grid/flow relationships rather than indiscriminately absolutizing layout.
- **Acceptance:** Committed appearance survives a normal production build with Glide removed. Registry/position metadata is not required to reproduce it.

### F10 — P1: component props and instance scope are incomplete [S/U]

- **Evidence:** EditChange at `packages/server/src/ws-server.ts:761` lacks a general typed prop operation; registry/resolver primarily describe definitions; repeated renderings share source IDs.
- **Fix:** Distinguish runtime instance, source definition, and call site. Add schema/inference for static boolean/number/string/enum props, supported literal objects, and literal children. Show inherited/dynamic/spread values. Provide a mapping contract for components that do not forward attributes.
- **Acceptance:** Two Button call sites can receive different variant/disabled values; editing a shared definition is explicit. Individual list-item changes require an authored prop/data boundary or are rejected.

### F11 — P1: Delete/Duplicate/Paste are unsupported mutations [S]

- **Evidence:** UI emits `delete`/`duplicate` at `packages/overlay/src/editor-html.ts:6687`, `:6707`, `:6731`; CLI callback has no matching cases and server can still report success.
- **Fix:** Exhaustive typed dispatch with explicit unsupported results; parser-backed operations and meaningful paste destination semantics; adapter capability gating.
- **Acceptance:** Advertised actions modify intended source, compile, persist, and support history. Unknown actions never succeed or increment persisted revisions.

### F12 — P1: Vue locations and bound attributes are mishandled [R/S]

- **Evidence:** `packages/adapters/vue/src/index.ts:48` uses whole-file lines against template content; `:26` matches class inside a dynamic binding.
- **Reproduction:** Script-before-template fixture targeted at `App.vue:5:3` returns unchanged code. Stamped `:class="classes"` becomes `:class="p-4"`, changing a binding into the expression p minus 4 rather than a static utility.
- **Fix:** Compiler offsets/exact template nodes; separate static/dynamic attributes; eliminate tag regex where it cannot handle expressions or quoted comparison characters.
- **Acceptance:** Normal SFC ordering, CRLF, multiline attributes, bindings, and neighbors target exactly one valid node; unsupported forms preserve bytes.

### F13 — P1: responsive/source-style context is lost [S/U]

- **Evidence:** Editor sends viewport metadata; EditCallback at `packages/server/src/ws-server.ts:777` omits it. CLI uses undefined breakpoint in relevant utility writes and converts many single class changes to inline styles.
- **Fix:** Carry representation, breakpoint, pseudo-state, and authoring scope in the operation. Use identical direct/batch semantics; preserve unrelated utilities.
- **Acceptance:** Same operation has identical output staged/direct; changing one breakpoint preserves other widths and normal-build behavior.

### F14 — P1: parallel browser implementations allow fixes to miss users [S]

- **Evidence:** Served inline editor versus exported overlay/bridge/scene helpers; separate Vite/proxy bridges.
- **Fix:** Incrementally extract one typed served browser entry, shared protocol, and bridge; bundle local assets. Preserve behavior under installed-package acceptance, without a broad visual rewrite first.
- **Acceptance:** Tests load the same runtime the package serves; operation serialization and mapping contracts are shared.

### F15 — P1: selector fallback is not a valid source target [S/U]

- **Evidence:** Editor selector fallback at `packages/overlay/src/editor-html.ts:2780` is dropped by server/CLI callback contracts, leaving synthetic coordinates.
- **Fix:** Require a verified stamped target or explicit deterministic mapping. Selectors may identify runtime instances; they cannot prove source locations by themselves.
- **Acceptance:** Unmapped selections show a mapping error and cannot mutate arbitrary source at `1:1`.

### F16 — P1: Git and browser boundaries are incomplete [S/U]

- **Evidence:** Git finalize uses `git add -A` at `packages/server/src/ws-server.ts:1414`; unverified message listeners at `packages/overlay/src/editor-html.ts:4403`; unescaped layer HTML at `:4777`.
- **Fix:** Stage only reviewed editor-owned changes, preserve prior index, validate iframe/parent source and origins with a session handshake, render labels with textContent.
- **Acceptance:** Unrelated dirty files/staged hunks are unchanged; foreign/malformed messages are rejected; markup-like labels display literally. Git/browser exploit probes remain unperformed.

### F17 — P1/P2: CLI, offline use, distribution lack complete release gates [R/S/U]

- **Evidence:** CLI help launches/writes rather than displaying help. Engines say Node >=18, bundle targets Node 20, CI uses Node 20, VERSION says 0.1.0 while manifest says 1.1.1. Release scripts lack their own validation gate. Icons/fonts load externally.
- **Fix:** Argument parsing/help/version/errors; one version source; test/align runtimes; build/typecheck/test/consumer checks before pack/release; pinned local icons/fonts. Optimize duplicate bundles/skills after correctness.
- **Acceptance:** Help/version have no filesystem/server side effects. Fresh packed consumers work with only declared dependencies and with outbound requests blocked. No Node 18 failure is asserted without testing.

## 7. Verification actually performed

Host: Windows, Node `v26.5.0`. Results do not establish every advertised runtime or platform.

| Check | Result | Practical limit |
|---|---|---|
| `npm test` | PASS: 31 files, 268 tests; 7.87s | Existing Node suite. Initial esbuild sandbox EPERM resolved with approved execution. |
| `npm run typecheck` | PASS | Root graph; tests excluded. |
| `npm run build` | PASS | Workspace compile, bundles, declarations, skills. Initial sandbox esbuild restriction resolved. |
| Post-build `npm pack --dry-run --json` | PASS | 31 files; 3,717,253 packed bytes / 22,210,061 unpacked bytes. Advertised entries present. |
| Built root/Vite/Babel imports | PASS | Existing repository dependencies/workspace environment only. |
| `node dist/cli.js --help` | DEFECT | Started server/registry behavior; stopped after observation. |
| Built-package fixture transformations | DEFECTS reproduced | F01–F03, F05, F12; strings only, no application-source writes. |
| Ephemeral server/in-memory callbacks | DEFECTS reproduced | Broad bind, untrusted Origin accepted, stale batch accepted, false-success partial response. |
| Git status after validation | Clean before report artifacts | No tracked application-source changes from checks. |

Tests predominantly import workspace implementations. Node mocks exercise some embedded scripts, but do not provide native layout/pointers/iframe policies/HMR. Test names such as writeback or verification do not prove browser → disk → compiler → reload behavior.

**Not performed:** isolated tarball consumer install; real-browser canvas/inspector acceptance; full framework operation matrix; production build after manual canvas edits; external-edit/undo failure injection; symlink/junction exploit; browser-origin exploit; export fidelity; minimum-Node/cross-platform checks. These are unknowns, not passes.

### Reproducible audit probe

[.planning/audit/reproduce.mjs](.planning/audit/reproduce.mjs) records the targeted baseline cases. After build:

~~~powershell
node .planning/audit/reproduce.mjs
~~~

It transforms strings and uses in-memory callbacks only. It does not register the CLI's source-writing callback or invoke Git actions. It briefly opens a listener and closes it afterward. Outputs demonstrate defects; this is not a release suite that should stay green after fixes.

## 8. Repair sequence for GPT Astra

### Step 1: baseline regressions and fail-closed behavior

Turn the reproduced cases into regression tests. Reject unsupported operation kinds/expressions/ambiguous targets without writes. Fix exact-node class targeting and leaf text edits. Restrict sessions and canonical project scope. Add a browser fixture for the exact served editor.

Deliverable: known cases cannot silently damage source; unsupported controls show reasons.

### Step 2: one persistence and recovery service

Use one project-scoped mutation service for single/batch/structural/bake/history operations. Carry protocol version, project/transaction/operation ID, expected file digests, source identity, authoring representation/scope, and a typed operation. Return changed-file revisions, acknowledgments, errors, and selection remaps.

Resolve targets once against base snapshots, parse once per file, transform buffers, validate syntax, recheck revisions, persist with rollback/recovery, then move history and ACK. Serialize overlapping transactions. Keep staging until success; make retries idempotent. Do not claim cross-file atomicity without a recovery design.

Deliverable: failures/conflicts preserve files, staging, and history coherently.

### Step 3: stable mapping and manual component props

Normalize coordinates. Separate source definition, call site, runtime instance, and literal text range. Remap selections after edits/HMR. Implement typed static prop controls with explicit scope and dynamic/inherited/spread states.

Deliverable: supported props edit the intended instance call site; shared-definition edits are explicit.

### Step 4: source-native layout and completed structural controls

Persist final drag/resize/layout changes through the same service. Preserve flow/flex/grid semantics. Implement delete/duplicate/paste deliberately. Carry draw placement if offered. Add breakpoint/pseudo-state/source-style scope.

Deliverable: ordinary builds reproduce committed appearance without Glide sidecar styling.

### Step 5: consolidate the served editor and enforce framework capabilities

Extract one typed browser runtime/bridge incrementally. Bundle and test the served assets. Repair framework coordinates/bindings using compilers. Enable only operations whose adapter acceptance passes; mark others limited/experimental.

Deliverable: fixes reach users and framework claims match actual operations.

### Step 6: npm release readiness

Fix help/version, ports/project errors, lifecycle, diagnostics, runtime/version consistency. Bundle assets, test tarball consumers, and gate CI/publication on required checks. Address duplicate bundle/skill size afterward.

Deliverable: a fresh npm consumer can launch, manually edit, restart, and build with no AI dependency.

## 9. Acceptance gates before claiming readiness

1. **Installed artifact:** Pack/install in a fresh consumer with no workspace links or dev-dependency leakage; CLI launches.
2. **Actual disk:** Select a rendered node, edit manually, Apply, inspect a minimal correct source diff.
3. **Persistence:** Restart editor/app; value remains. Build/run with Glide disabled; appearance remains.
4. **Isolation:** Same-class siblings, repeated components, mixed children, dynamic forms, and imported components are preserved or explicitly rejected.
5. **Transactions:** Same-line/multi-file edits are coherent; failure/disconnect/stale revision causes no partial source/history change.
6. **External edits:** Code changes appear in canvas; stale edits/undo cannot overwrite them.
7. **Component props:** Literal variant/disabled/title edits target the right call site; definition scope is explicit.
8. **Style semantics:** Breakpoint/Tailwind/CSS edits preserve unrelated variants and authored representation.
9. **Structures:** Every enabled insert/delete/duplicate/paste/group/reorder/reparent action compiles, persists, and supports undo.
10. **Session boundaries:** Unauthorized sockets/windows, unsafe paths, malformed/oversized messages, and unrelated Git work stay outside mutation scope.
11. **Zero-token/offline:** Manual flow succeeds with no model credentials or outbound requests; required editor assets are local.
12. **Release contract:** Help/version have no side effects; supported runtime/platform matrix and release gates pass.

Each enabled action needs a source effect, supported syntax, failure behavior, and persistence evidence. Numerical test counts and completed planning phases are insufficient.

## 10. Supporting references and source authority

Seven maps accompany this report:

- [.planning/codebase/STACK.md](.planning/codebase/STACK.md): dependencies, runtimes, bundles, configuration.
- [.planning/codebase/INTEGRATIONS.md](.planning/codebase/INTEGRATIONS.md): local/network/files/Git and optional agent guidance.
- [.planning/codebase/ARCHITECTURE.md](.planning/codebase/ARCHITECTURE.md): editing paths and abstractions.
- [.planning/codebase/STRUCTURE.md](.planning/codebase/STRUCTURE.md): file navigation and ownership.
- [.planning/codebase/CONVENTIONS.md](.planning/codebase/CONVENTIONS.md): implementation/error patterns.
- [.planning/codebase/TESTING.md](.planning/codebase/TESTING.md): executed commands, coverage limits, CI/release gaps.
- [.planning/codebase/CONCERNS.md](.planning/codebase/CONCERNS.md): source-derived defects, repairs, acceptance.

`.gitignore` ignores `.planning/` and `docs/`. This main report is intentionally at repository root so it can be tracked/shared normally. Supporting maps/probes remain in the workspace; include them explicitly for an external handoff. They were not force-added over the ignore policy.

Line numbers describe the audited baseline. Revalidate them after changes. Maps predate final runtime probes; this report upgrades the reproduced findings and adds disconnected UI operations.

External documentation checked for repair guidance:

- npm [package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/) defines files/bin/exports/engines; test the artifact rather than relying on workspace imports.
- npm [pack](https://docs.npmjs.com/cli/v11/commands/npm-pack/) supports distribution inspection; a dry run is not consumer execution or source correctness.
- Vite [server options](https://vite.dev/config/server-options) document host/CORS/filesystem restrictions. Glide's separate server needs its own protections.
- Babel [parser](https://babeljs.io/docs/babel-parser) covers supported syntax/recovery. Parsing is necessary validation, not proof of semantic preservation.
- [postMessage documentation](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) describes exact target origins and sender verification.

## 11. Copyable GPT Astra handoff

> Read GLIDE_AUDIT_REPORT.md and the supporting .planning/codebase maps. The owner wants a locally running npm package for manual, zero-token visual editing of real websites, persisting supported changes into actual source. Do not make AI agents or a separate design document authoritative for edits.
>
> Baseline is 8fe0f4ef1ffc0898ab04b5f4d8df647692625239; re-check current source. Existing 268 tests/typecheck/build pass, but probes reproduce destructive transforms and false-success batches. Start with F01–F08 and the acceptance gates. Active browser code is packages/overlay/src/editor-html.ts; fixing exported helpers alone may miss users.
>
> Make mutations exact, expression-preserving or explicitly unsupported, revision-checked, recoverable as a transaction, and acknowledged after persistence. Then fix mapping/call-site props, source-native layout, missing structural operations, framework capabilities, and npm/offline readiness. Keep changes reviewable and verify the installed package browser-to-disk path. Do not treat planning completion or canvas-only appearance as proof of readiness.
