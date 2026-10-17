# Glide Repair: Progress vs Audit — Combined Report

## Superseding status — 2026-10-16

Read the opening **Current implementation status** section of
[GLIDE_AUDIT_REPORT.md](GLIDE_AUDIT_REPORT.md) first. The historical tables below
overstate full P0 closure and predate this continuation.

The inherited structural operations and served mutation transport are now wired
and verified, including the safety corrections listed in the audit. Validation:
**364 tests / 39 files**, typecheck, distribution build, and bundled-editor smoke
check all pass. No commit or release was created; changes remain reviewable in
the working tree. No stash should be popped. The initial server failures were
coordinate parsing and a native Windows watcher abort, not the historical
malformed-JSON race described below.

Next implement typed literal call-site prop editing with explicit scope, and
finish external-edit/HMR identity. Continue with source-native layout/style
context, adapter capability UI, Git/browser boundaries, then CLI/offline and
installed-package acceptance. Full browser-to-disk and tarball-consumer gates
remain unverified. F11 is a conservative JSX subset, not universal parity.

---

**Audit baseline:** `8fe0f4e` (GLIDE_AUDIT_REPORT.md)
**Current HEAD:** `a01b2e4`
**Report date:** 2026-10-14 (Asia/Calcutta)
**Sessions:** 2 Codex sessions (session 1 ended ~01:40 IST; session 2 ended ~20:40 IST)

---

## Overall progress

| Metric | Baseline | After session 1 | After session 2 (committed) | After session 2 (all incl. uncommitted) |
|--------|----------|----------------|---------------------------|----------------------------------------|
| Commits past baseline | 0 | 8 | 10 | 10 + WIP |
| Files changed | — | 19 | 28 | 28 + 8 WIP |
| Test count | 268 | 313 | ~330 | ~370 (incl. uncommitted tests) |
| P0 defects fixed | 0/8 | 6/8 | 8/8 | 8/8 ✅ |
| P1 defects fixed | 0/9 | 0/9 | 0/9 | partial (F11 in WIP) |

---

## All commits since audit baseline

### Session 1 (01:25–01:40 IST, 2026-10-14)

| Commit | Message | Audit defect |
|--------|---------|-------------|
| `faf3270` | fix(ast-writer): keep class edits within the selected element | **F01** ✅ |
| `deb78c8` | fix(ast-writer): reject edits that erase dynamic attributes | **F02** ✅ |
| `a030718` | fix(ast-writer): preserve mixed children during text edits | **F03** ✅ |
| `daa9448` | fix(server): persist staged batches as one transaction | **F04** ✅ |
| `9367683` | refactor(ast-writer): separate node edits from file parsing | Step 2 prereq |
| `4cfc745` | fix(writer): resolve batch targets before source coordinates change | **F05** ✅ |
| `4719217` | fix(server): reject history restores that overwrite external edits | **F06** ✅ |
| `d33a577` | fix(server): require a local authenticated editor session | **F07** ✅ |

### Session 2 (20:25–20:40 IST, 2026-10-14)

| Commit | Message | Audit defect |
|--------|---------|-------------|
| `2351e23` | fix(server): enforce canonical project paths across file operations | **F08** ✅ |
| `a01b2e4` | fix(editor): remap source selections after transactional edits | **F05** extension ✅ |

---

## New files created (committed)

| File | Purpose | Audit reference |
|------|---------|----------------|
| `packages/server/src/mutation-service.ts` | MutationService — digest gate, atomic writes, per-op results, transaction lifecycle | Step 2 / F04 |
| `packages/server/src/session-security.ts` | Host/Origin validation, message schema enforcement | F07 |
| `packages/server/src/project-paths.ts` | `ProjectPaths` — `fs.realpath` canonicalization, writable-extension allow-list | F08 |
| `packages/overlay/src/source-mapping.ts` | Source-mapping helpers: parse `data-gl-source`, remap coordinates after edits | F05 ext. |
| `src/__tests__/mutation-service.test.ts` | MutationService lifecycle and digest-gate tests (109 lines) | F04 |
| `src/__tests__/server-security.test.ts` | Host/Origin rejection tests (97 lines) | F07 |
| `src/__tests__/project-paths.test.ts` | Path escape regression tests (73 lines) | F08 |
| `src/__tests__/source-mapping.test.ts` | Source-mapping coordinate remap tests (89 lines) | F05 ext. |
| `src/__tests__/writer-safety.test.ts` | Dynamic attribute rejection regressions (48 lines) | F02 |
| `src/__tests__/text-safety.test.ts` | Mixed-children text preservation regressions (34 lines) | F03 |
| `src/__tests__/ws-client.ts` | Test WS client helper with session-token support | F07 |

---

## Files with major changes (committed)

| File | Net change | What changed |
|------|-----------|-------------|
| `packages/ast-writer/src/writer.ts` | +353/−293 | Exact-node targeting, expression guards, text safety, batch-resolve separation |
| `packages/server/src/ws-server.ts` | +305/−420 | MutationService wiring, loopback bind, session auth, canonical paths |
| `packages/overlay/src/editor-html.ts` | +114/−62 | Stage clearing moved to post-ACK, session token handshake, selection remap on ACK |
| `packages/server/src/history-manager.ts` | +34/−3 | Digest check before restore; cursor moves only after successful write |
| `packages/cli/src/index.ts` | +31/−42 | ProjectPaths wiring |

**Total committed since baseline:** 28 files, +1318 insertions, −492 deletions

---

## Work in progress — uncommitted (session 2 stopped mid-task)

The second session was building **Step 4 / F11** (delete, duplicate, paste, insert,
group, ungroup, reorder, reparent) and refactoring the server test suite, but hit
the usage limit before committing.

### New files (uncommitted)

| File | Purpose |
|------|---------| 
| `packages/ast-writer/src/structure.ts` | `mutateStructure()` — delete, duplicate, paste, insert, group, ungroup, reorder, reparent, arrange via Babel/Recast. 135 lines. |
| `packages/overlay/src/mutation-transport.ts` | `createMutationTransport()` — browser-side mutation serialization with selection remapping and retry on reconnect. 99 lines. |
| `src/__tests__/transaction-structures.test.ts` | Tests for all 9 structural operation kinds (delete/duplicate/paste/insert/group/ungroup/reorder/reparent/arrange). |
| `src/__tests__/mutation-transport.test.ts` | Tests for transport serialization, remap on ACK, retry semantics. |
| `src/__tests__/server-fixture.ts` | Shared test server fixture (`startTestProject`, `closeTestProjects`, `request`). |

### Modified files (uncommitted)

| File | What is in progress |
|------|---------------------|
| `packages/ast-writer/src/writer.ts` | Wiring `mutateStructure` into the writer dispatch |
| `packages/overlay/src/editor-html.ts` | Wiring `mutation-transport` into the inline editor |
| `packages/server/src/mutation-service.ts` | Extending to handle structural operation kinds |
| `packages/server/src/ws-server.ts` | Major refactor — extracting server logic into `server-fixture.ts` to fix test isolation |
| `packages/cli/src/index.ts` | Aligning with refactored server API |
| `src/__tests__/server.test.ts` | Rewrite to use shared server fixture |
| `src/__tests__/stress.test.ts` | Rewrite to use shared server fixture |
| `src/__tests__/server-security.test.ts` | Minor update |

**1 failing test** (committed state):
- `server-security.test.ts > should reject malformed JSON` — ECONNRESET race.
  Behavior is correct; test timing needs a `waitForClose` helper.
  The uncommitted `server-fixture.ts` is building this fix.

---

## Audit defect status — full comparison

### P0 defects (all 8 fixed)

| Defect | Description | Status | Commit |
|--------|------------|--------|--------|
| F01 | Class edit mutates unrelated siblings | ✅ Fixed | `faf3270` |
| F02 | Dynamic expressions erased silently | ✅ Fixed | `deb78c8` |
| F03 | Text replacement removes markup and expressions | ✅ Fixed | `a030718` |
| F04 | Batches partly apply and report success | ✅ Fixed | `daa9448` |
| F05 | Source coordinates drift between writes | ✅ Fixed | `4cfc745`, `a01b2e4` |
| F06 | External edits and history not protected | ✅ Fixed | `4719217` |
| F07 | WebSocket server trusts untrusted clients | ✅ Fixed | `d33a577` |
| F08 | File safety uses lexical path checks | ✅ Fixed | `2351e23` |

### P1 defects (0 fully fixed, 1 in progress)

| Defect | Description | Status |
|--------|------------|--------|
| F09 | Committed drag appearance lives outside source | ❌ Not started |
| F10 | Typed component props missing from editing contract | ❌ Not started |
| F11 | Delete / Duplicate / Paste unsupported mutations | 🔄 In WIP (`structure.ts` exists, not wired/committed) |
| F12 | Vue locations and bound attributes mishandled | ❌ Not started |
| F13 | Responsive / breakpoint context lost in operations | ❌ Not started |
| F14 | Parallel browser implementations — fixes miss users | ❌ Not started |
| F15 | Selector fallback used as source target | ❌ Not started |
| F16 | Git staging scope and browser origin unsafe | ❌ Not started |
| F17 | CLI help/version, offline assets, release gates | ❌ Not started |

---

## What is still to be done

Work items are ordered by the repair sequence. Complete each step before starting
the next.

---

### Immediate (before anything else)

**A. Commit the uncommitted F11 / server-refactor work**

1. Run `npm test` — confirm which tests fail.
2. Fix the ECONNRESET race in `server.test.ts` using the `server-fixture.ts`
   `waitForClose` helper.
3. Wire `structure.ts` into `writer.ts` dispatch and `mutation-service.ts`.
4. Wire `mutation-transport.ts` into `editor-html.ts`.
5. Commit as two atomic commits:
   - `refactor(server): extract shared test fixture and fix server test isolation`
   - `feat(ast-writer): implement delete, duplicate, paste, insert, group, ungroup, reorder, reparent` (F11)

---

### Step 3 — Stable mapping and typed component props (F05 extension, F10)

**B. AST-node identity**
- Assign stable node IDs to each JSX element during parsing. IDs must survive
  formatting and insertion. Return ID-to-coordinate remaps in every `MutationResult`.
- The `source-mapping.ts` module started this — it needs to extend to cover the
  full remap contract.

**C. Typed component prop controls** (F10)
- The audit says: "A general typed component-prop inspector is missing from the
  active editing contract."
- Add `EditProp` operation to the `MutationService` discriminated union.
- Support literal boolean / number / string / enum props at call sites.
- Show inherited / dynamic / spread values as read-only with labels in the panel.
- Two call sites of the same component must be editable independently.
- Editing a shared definition must be explicit and labeled.

**D. Unmapped selection guard** (F15)
- `editor-html.ts:2780` falls back to synthetic coordinates when no stamped
  source is found.
- Fix: show a mapping-error state in the inspector. Never dispatch a mutation
  at fallback coordinates `1:1`.

---

### Step 4 — Source-native layout and remaining structural ops (F09, F11, F13)

**E. Source-native drag and resize commit** (F09)
- Gesture preview stays in DOM (correct).
- Final commit must go through `MutationService` as a layout-aware source
  operation — not a position sidecar injected by the Vite plugin.
- Preserve flex / grid / flow relationships; do not absolutize unconditionally.
- Acceptance: committed appearance survives a production build with Glide
  removed. No `position-overrides.css` injected at runtime.

**F. Insert with draw position** (F11 partial)
- `structure.ts` has the `insert` operation but the draw position is not
  carried in the insertion payload.
- Fix: add `x`, `y`, `width`, `height` fields from the draw gesture. Validate
  placement against the parent's layout model.

**G. Breakpoint / pseudo-state scope** (F13)
- Audit says: "`EditCallback` omits breakpoint metadata", "single class changes
  convert to inline styles", and "staged vs direct semantics differ."
- Fix: carry `breakpoint` and `pseudoState` in every `MutationOperation`.
- Use `authoringRepresentation` to decide output form (tailwind class vs CSS
  property).
- Same operation staged and direct must produce identical output.
- Changing `md:px-4` must not affect `px-4` or `lg:px-4`.

---

### Step 5 — Browser runtime consolidation and framework gating (F12, F14, F15, F16)

**H. Extract one typed served browser runtime** (F14)
- Current: `packages/overlay/src/editor-html.ts` is ~8 000 lines of inlined
  HTML/CSS/JS. Fixes to exported helpers do not reach npm users.
- Fix: extract the inline runtime into importable TypeScript modules.
  The `mutation-transport.ts` WIP is the right direction. Continue extracting
  the bridge, overlay, and panel logic into modules that `editor-html.ts`
  imports and bundles.
- Tests must load the same runtime the package serves.

**I. Vue adapter repair** (F12)
- `packages/adapters/vue/src/index.ts:48` uses whole-file line offsets against
  template content — wrong.
- `packages/adapters/vue/src/index.ts:26` matches class inside a dynamic
  binding — wrong.
- Fix: use `@vue/compiler-sfc` template node ranges for exact targeting.
  Separate static and dynamic attribute handling.
  Reject edits on dynamic bindings with `{supported: false, reason: "..."}`.
- Acceptance: script-before-template SFC, CRLF, multiline attributes, dynamic
  bindings, and neighbors all target exactly one valid node.

**J. Git staging scope** (F16 partial)
- `ws-server.ts:1414` runs `git add -A` — adds all dirty files, not just
  Glide-owned changes.
- Fix: record which files Glide wrote. Stage only those paths. Preserve prior
  index state for unrelated files.

**K. iframe / postMessage origin validation** (F16 partial)
- `editor-html.ts:4403` has unverified `message` listeners.
- `editor-html.ts:4777` renders layer labels with innerHTML.
- Fix: validate `event.origin` and `event.source` in every message listener
  using the session handshake origin. Render labels with `textContent`.

**L. Svelte / Astro / HTML framework gating** (F14 / F12 extension)
- These adapters have unverified structural parity.
- Fix: run acceptance checks. Mark operations as `{supported: false}` for any
  form that is not verified. Do not let unsupported operations report success.

---

### Step 6 — npm and offline release readiness (F17)

**M. CLI help and version**
- `node dist/cli.js --help` currently starts a server and writes files.
- Fix: parse arguments first. `--help` and `--version` must have zero
  filesystem or network side effects.
- VERSION export (`0.1.0`) must match `package.json` (`1.1.1`). Use one source.

**N. Offline / local assets**
- Editor currently loads `unpkg.com/lucide@latest` and Google Fonts over the
  network.
- Fix: pin and bundle both. The editor must load fully with outbound requests
  blocked.

**O. Tarball consumer test**
- Run `npm pack`. Install the tarball in a fresh empty directory with no
  workspace links.
- Confirm: CLI launches, editor loads, a manual edit persists to source, and
  all required assets load without outbound requests.

**P. Release gate**
- Gate CI publication on: build → typecheck → test (all pass) → consumer
  tarball install → browser-to-disk acceptance.
- No publish step runs until every gate is green.

---

## Acceptance gates remaining (from audit)

These 12 gates must all pass before claiming readiness. Current status:

| Gate | Description | Status |
|------|------------|--------|
| 1 | Installed tarball — CLI launches | ❌ Not verified |
| 2 | Select node, edit, Apply → minimal correct source diff | ❌ Not verified |
| 3 | Persistence across restart and production build | ❌ Not verified |
| 4 | Isolation of siblings, repeated components, dynamic forms | ✅ Covered by F01–F03 regression tests |
| 5 | Transactions coherent on failure / disconnect / stale revision | ✅ Covered by F04–F05 tests |
| 6 | External edits visible in canvas; undo cannot overwrite | ✅ Covered by F06 |
| 7 | Component props target right call site | ❌ F10 not started |
| 8 | Breakpoint edits preserve other variants | ❌ F13 not started |
| 9 | Structural ops compile, persist, and support undo | 🔄 F11 WIP |
| 10 | Session boundaries — unauthorized sockets, unsafe paths | ✅ F07 / F08 fixed |
| 11 | Zero-token / offline — no outbound requests, assets local | ❌ F17-N not started |
| 12 | Help/version no side effects; release gate | ❌ F17-M,P not started |

---

## Resume instructions for next Codex session

> You are resuming repair of @srivarsank/glide.
>
> HEAD is `a01b2e4`. There is uncommitted work in progress — run `git status`
> to see it.
>
> Step 1: Run `npm test` and fix the 1 failing test in `server-security.test.ts`
> (ECONNRESET race — the `server-fixture.ts` helper in the working tree is the
> fix).
>
> Step 2: Wire `packages/ast-writer/src/structure.ts` (already written) into
> `writer.ts` dispatch and `mutation-service.ts`. Wire
> `packages/overlay/src/mutation-transport.ts` (already written) into
> `editor-html.ts`. Commit F11 (delete/duplicate/paste/insert/group/reorder).
>
> Then continue with items B through P in this file (GLIDE_REMAINING_WORK.md).
>
> All 8 P0 defects (F01–F08) are fixed and have regression tests. Do not
> re-fix them. Verify with `npm test` before adding new changes.
