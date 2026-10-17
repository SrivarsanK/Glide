# Codex Session Progress Report

## Latest continuation — 2026-10-16

The authoritative current status is the opening section of
[GLIDE_AUDIT_REPORT.md](GLIDE_AUDIT_REPORT.md). This supersedes older resume
instructions below; do not pop the historical stash.

Completed the inherited JSX structural/transport work and repaired structural
coordinate parsing, cross-file target validation, queued deleted/stale reference
handling, cancelled Apply state, unsafe component moves, controlled-child
destinations, and history error acknowledgments. Windows native watching crashed
the test process; the server now uses polling on Windows and avoids following
symlinks. Existing work was preserved, and no commit or release was created.

Validation: **364 tests across 39 files pass**, typecheck passes, build passes,
and `node scripts/check-editor-artifact.mjs` verifies the bundled served transport.
Real-browser and isolated tarball acceptance are still outstanding. Next: typed
call-site props and identity across external edits/HMR. See the audit's current
status table for the remaining layout, framework, browser, Git, and release work.

## Current continuation status — 2026-10-14

**Current code HEAD:** `a01b2e4` on `main`.
**Validation:** 326 tests pass across 37 files; typecheck and distribution build pass.

This section supersedes the historical handoff below. Do not run its stash-pop
instruction. F08 was already restored in the working tree when this session
started. The existing stash belongs to older work and was left untouched.

### Completed in this continuation

| Commit | Result |
|---|---|
| `2351e23` | Completed F08 canonical project-path checks across source transactions, CLI writes, server structural routes, metadata, and uploaded asset destinations. |
| `a01b2e4` | Added transaction selection remapping to the served editor, corrected raw-source coordinates, and made workspace tests resolve current package source. |

F08 now rejects traversal, alternate path forms, escaping directory junctions,
protected directories and their aliases, unsupported source types, and shared
hard links. New metadata paths are resolved through canonical parents; dangling
directory links are rejected. Asset uploads reject path-bearing filenames and
never overwrite existing destinations. Structural handlers validate paths before
reading or writing. Regression tests exercise these boundaries on this Windows
host, with platform-specific symlink handling for POSIX runs.

The WebSocket test helper requests a fresh HTTP connection when obtaining a
session token. This avoids pooling sockets across server restarts on the same
port. The reported ECONNRESET failure did not reproduce in the initial run or
the final suite; no waitForClose workaround was added to the malformed-JSON test.

Step 3 has advanced, but is not complete:

- Transactions remap every JSX element, including untouched siblings and
  ancestors, with updated coordinates, hashes, and file digests.
- The actual served editor consumes successful remaps for selection and
  clipboard references. Failed transactions leave selection unchanged.
- A typed, self-contained mapper is shared with the served script and tested by
  executing that script's mapper and transaction handler.
- Babel's original source coordinates resolve targets before pairing them with
  Recast nodes. Tabs and CRLF no longer corrupt batch coordinates or node hashes;
  the single-edit writers also use the same node-pairing approach.
- Windows drive paths, numeric hashes, and zero-based tree columns are parsed
  correctly. Selector-only references no longer become fabricated line-1 targets.
- Further staging is blocked while a batch awaits acknowledgment.
- Vitest workspace imports now resolve source files instead of potentially stale
  package `dist` output.

### Verification

- `npm test -- --silent`: **326 passed, 37 test files**.
- `npm run typecheck`: passed.
- `npm run build`: passed, including internal packages and bundled declarations.
- Built artifact smoke check: imported `dist/index.js`, parsed the served editor
  script with `vm.Script`, and executed its source mapper successfully.
- Regression coverage includes consecutive disk transactions on identical
  siblings in a tab-indented CRLF file and all server structural path routes.

### Resume here

1. Finish Step 3: stable source identity across external changes/HMR; explicit
   definition/call-site/runtime-instance scope; typed static prop controls (F10).
   Current remaps preserve identity across structure-preserving transactions;
   they are not persistent AST-node IDs or general HMR reconciliation.
2. Complete mutation-service adoption: legacy live-edit callbacks and several
   structural operations still write outside the transaction service. Do not
   mistake the existing Step 2 foundation for universal transactional coverage.
3. Continue Step 4: source-native drag/resize, deliberate structural mutations,
   and breakpoint/pseudo-state persistence (F09, F11, F13).
4. Continue Steps 5–6: browser/runtime consolidation, framework capabilities,
   Git/browser boundaries, offline assets, CLI/version, tarball consumer checks,
   and release gates (F12, F14–F17). F15 has only the selector-fallback correction.

No full browser-to-disk or isolated tarball-consumer acceptance run was performed
in this continuation. General release readiness is still unproven.

The audit report remains an existing untracked local file. This progress report
is updated locally. No stash was popped, no release was published, and no branch
was pushed.

---

## Historical handoff — superseded by the current status above

**Date:** 2026-10-14, Asia/Calcutta
**Baseline commit:** `8fe0f4e` (audit baseline)
**Current HEAD:** `d33a577`
**Session stopped:** Usage limit hit at ~01:40 IST

---

## Summary

Codex completed **8 commits** in one session (~15 min of active execution).
The session addressed **6 of 8 P0 defects** from the audit (F01–F07, minus F08
which is in progress) and created the `MutationService` foundation (Step 2).

**Test count:** 268 → **313 tests** (45 new tests added).
**Test status:** 312 pass, 1 fail (ECONNRESET race in `server.test.ts`).

---

## Commits made

| Commit | Type | Summary | Audit defect |
|--------|------|---------|-------------|
| `faf3270` | fix | Keep class edits within the selected element | F01 |
| `deb78c8` | fix | Reject edits that erase dynamic attributes | F02 |
| `a030718` | fix | Preserve mixed children during text edits | F03 |
| `daa9448` | fix | Persist staged batches as one transaction | F04 |
| `9367683` | refactor | Separate node edits from file parsing | Step 2 prereq |
| `4cfc745` | fix | Resolve batch targets before source coordinates change | F05 |
| `4719217` | fix | Reject history restores that overwrite external edits | F06 |
| `d33a577` | fix | Require a local authenticated editor session | F07 |

---

## Files changed (vs baseline `8fe0f4e`)

| File | Change |
|------|--------|
| `packages/ast-writer/src/writer.ts` | Major refactor — exact node targeting, expression guards, text safety |
| `packages/ast-writer/src/index.ts` | Export new batch-resolve function |
| `packages/server/src/mutation-service.ts` | **New** — MutationService with digest gate, atomic writes, per-op results |
| `packages/server/src/session-security.ts` | **New** — Host/Origin validation, message schema guard |
| `packages/server/src/ws-server.ts` | Wired MutationService; loopback binding; removed unauthenticated path |
| `packages/server/src/history-manager.ts` | Digest check before restore; cursor moves after write only |
| `packages/overlay/src/editor-html.ts` | Stage clearing moved to post-ACK; session token handshake |
| `packages/core/src/config.ts` | Added session token config field |
| `packages/core/src/component-registry.ts` | Minor fix |
| `packages/core/src/scanner.ts` | Minor fix |
| `src/__tests__/mutation-service.test.ts` | **New** — 109 lines, MutationService lifecycle and digest-gate tests |
| `src/__tests__/server-security.test.ts` | **New** — 73 lines, Host/Origin rejection tests |
| `src/__tests__/writer-safety.test.ts` | **New** — 48 lines, dynamic attribute rejection regressions |
| `src/__tests__/text-safety.test.ts` | **New** — 34 lines, mixed-children text preservation regressions |
| `src/__tests__/ws-client.ts` | **New** — test WS client helper with session token support |
| `src/__tests__/writer.test.ts` | Updated for exact-node targeting |
| `src/__tests__/staged-edits.test.ts` | Updated for batch transaction semantics |
| `src/__tests__/server.test.ts` | Updated for session auth |
| `src/__tests__/stress.test.ts` | Updated for session auth |

**Total:** 19 files, +868 insertions, −348 deletions

---

## New modules created

### `packages/server/src/mutation-service.ts` (187 lines)

MutationService contract from the audit repair plan:

- `MutationOperation` — `expectedDigest` (SHA-256), `operationId`, `filePath`,
  `line`, `column`, `change`
- `MutationResult` — `transactionId`, `changedFiles`, `operationResults`, `selectionRemaps`
- Lifecycle: read + digest → parse → resolve targets → transform in memory →
  validate syntax → re-check digests → atomic write (temp + rename) → ACK
- Failures at any step leave all files unchanged

### `packages/server/src/session-security.ts` (34 lines)

- `trustedRequest(req, port, remote?)` — validates `Host` and `Origin` headers;
  defaults to loopback; supports explicit remote allowlist
- `validateMessage(value)` — schema enforcement: type field, max depth 16,
  max keys 1000, prototype pollution guard

---

## In-progress (uncommitted — `stash@{0}`)

Codex had started **F08 — file safety / path canonicalization** before the usage
limit. Four files are modified and one new file exists, uncommitted:

| File | Status |
|------|--------|
| `packages/server/src/project-paths.ts` | **New** — `ProjectPaths` with `fs.realpath` canonicalization |
| `packages/server/src/mutation-service.ts` | Modified — integrates `ProjectPaths` |
| `packages/server/src/index.ts` | Modified — exports `ProjectPaths` |
| `packages/cli/src/index.ts` | Modified — wires `ProjectPaths` |
| `src/__tests__/project-paths.test.ts` | **New** — path escape regression tests |

Run `git stash pop` to restore this work before continuing.

---

## One failing test

**File:** `src/__tests__/server.test.ts`
**Test:** `GlideServer WebSocket Server > should reject malformed JSON`
**Error:** `TypeError: fetch failed — ECONNRESET`

The session-auth refactor in `d33a577` changed the rejection timing. The test
client connects before the server emits the close frame. The server behavior is
correct. The test needs a `waitForClose` helper instead of `fetch` after rejection.

---

## Audit defect status

| Defect | Severity | Status |
|--------|----------|--------|
| F01 — class edit mutates siblings | P0 | ✅ Fixed (`faf3270`) |
| F02 — dynamic expressions erased | P0 | ✅ Fixed (`deb78c8`) |
| F03 — text replace wipes children | P0 | ✅ Fixed (`a030718`) |
| F04 — batch partial-apply reports success | P0 | ✅ Fixed (`daa9448`) |
| F05 — coordinates drift between writes | P0 | ✅ Fixed (`4cfc745`) |
| F06 — history overwrites external edits | P0 | ✅ Fixed (`4719217`) |
| F07 — WS server accepts any origin | P0 | ✅ Fixed (`d33a577`) |
| F08 — lexical path containment | P0 | 🔄 In progress (stash) |
| F09 — drag persists outside source | P1 | ❌ Not started |
| F10 — typed component props missing | P1 | ❌ Not started |
| F11 — delete/duplicate/paste unsupported | P1 | ❌ Not started |
| F12 — Vue locations / bound attrs broken | P1 | ❌ Not started |
| F13 — breakpoint context lost | P1 | ❌ Not started |
| F14 — parallel browser implementations | P1 | ❌ Not started |
| F15 — selector fallback is not a source target | P1 | ❌ Not started |
| F16 — Git and browser boundaries | P1 | ❌ Not started |
| F17 — CLI help, version, offline assets | P1/P2 | ❌ Not started |

---

## Remaining work (in order)

1. **Finish F08** — `git stash pop`, complete `ProjectPaths` integration, add
   symlink/junction escape tests, commit.
2. **Fix 1 failing test** — race condition in `server.test.ts`.
3. **Step 3** — Stable source identity (AST-node IDs), coordinate normalization,
   selection remaps after HMR, typed component prop controls (F10).
4. **Step 4** — Source-native drag/resize commit (F09), delete/duplicate/paste (F11),
   draw placement, breakpoint/pseudo-state scope (F13).
5. **Step 5** — Extract typed served browser runtime from `editor-html.ts` (F14);
   bundle local icons/fonts (F17 partial); Vue/Svelte framework gating (F12, F15, F16).
6. **Step 6** — CLI help fix, version consistency, tarball consumer test, release gate (F17).

---

## Resume instructions for next Codex session

> You are resuming repair of @srivarsank/glide.
>
> Current HEAD is `d33a577`. Run `git stash pop` to restore in-progress F08
> (path canonicalization). Then fix the 1 failing test in
> `src/__tests__/server.test.ts` (ECONNRESET race — add waitForClose before
> fetch). Then continue with Steps 3–6 from the handoff prompt.
>
> Do not restart from F01. Those defects are fixed and have regression tests.
> Verify with `npm test` before adding new changes.
