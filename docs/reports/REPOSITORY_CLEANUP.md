# Repository cleanup audit

Date: 2026-11-12. Baseline: `0baa1942a68c9303626dd916b5b22e2ce4e58493`.

Removed 11 tracked files, unused private code and three unused dependencies.
The lockfile decreased from 804 package entries to 250 (554 fewer, including
workspace links and platform-specific entries). No retained package versions
changed. Public declaration bundles are byte-for-byte unchanged.

## Removed files and dependencies

| Removed item | Evidence and replacement |
| --- | --- |
| `packages/overlay/src/components/HistoryPanel.tsx` | No runtime import or public export; disconnected React prototype. Working history rendering is in `packages/overlay/src/editor-html.ts`. |
| `packages/overlay/src/components/Toolbar.tsx` | No runtime import or export; only toggled the disconnected Jotai history atom. Current toolbar is part of the generated editor. |
| `packages/overlay/src/store/scene.ts` | Only imported by those two prototypes. Current editor owns its state directly; server history remains in `history-manager.ts`. |
| `jotai` dependency in the overlay workspace | Only consumers were the three removed files. Removed from the workspace manifest and lockfile. |
| `packages/adapters/react/src/index.ts`, `package.json`, `tsconfig.json` | Private `ReactAdapter` scaffold had no imports, tests, registrations or root exports. Current JSX/TSX mutation routes use `packages/ast-writer/`. Removed the unused build step and test alias too. |
| `lerna.json` and `lerna` dev dependency | No package script or CI workflow invoked Lerna. The repository already uses npm workspaces and its own single-package build script. |
| `turbo.json` and `turbo` dev dependency | No package script or CI workflow invoked Turbo. Its `latest` dependency added an unused task runner. |
| `pnpm-workspace.yaml` | Alternate workspace scaffold with no pnpm lockfile or CI path. npm's workspace declarations and committed npm lockfile remain authoritative. |
| `.env.example` | Contained only `FIRECRAWL_API_KEY`; tracked application code never reads it. Normal checkout setup needs no API key. |
| `docs/sys_prompt.md` | Unrelated third-party assistant prompt dump, with no code/build/documentation dependency. |

Also removed the obsolete Nx install-script allowance, overrides for packages
no longer present (`js-yaml`, `tar`, `smol-toml`, `brace-expansion`), and the
redundant local `.npmrc` `allow-scripts` setting. The existing root
`allowScripts` policy for esbuild remains.

The prototype-removal commit produced exactly the same hashes for all four
JavaScript bundles and all four declaration bundles as the baseline. That
comparison was made before the subsequent private-code cleanup.

## Removed private code

TypeScript unused-symbol diagnostics identified these candidates; source and
call-site checks confirmed they were not public exports or string-injected code.

| File | Removal |
| --- | --- |
| `packages/core/src/tree.ts` | Uncalled `getJSXFromFunction` and its exclusively used `findReturnedJSX` helper |
| `packages/core/src/scanner.ts` | Uncalled `lookupColor`; unused `cssProp` destructuring bindings |
| `packages/server/src/ws-server.ts` | Uncalled `extractModifiedProps` and unused bridge `snap` local |
| `packages/vite-plugin/src/index.ts` | Unused filesystem import, write-only `mainEntryInjected` and `viteServer` locals and assignments |
| `packages/adapters/html/src/index.ts` | Unused React namespace import; HTML-to-React API and dependency retained |
| `packages/babel-plugin/src/index.ts` | Unused Babel namespace import; type import retained |
| `packages/ast-writer/src/reorder.ts` | Unused parser import; required but unused filter parameter renamed `_child` |

## Collaboration and build improvements

- `npm run typecheck` now checks all 11 remaining workspace projects plus the
  root, and rejects unused locals and parameters. Previously it checked only
  the root configuration.
- Pull-request CI uses that command and the existing bundled-editor artifact
  check after building.
- `esbuild`, directly imported by the build script, is now an explicit dev
  dependency at the existing override range; its locked version is unchanged.
- The build clears each active internal package's generated `dist/` before
  compiling, preventing deleted source files from leaving stale output.
- [CONTRIBUTING](../../CONTRIBUTING.md) documents `npm ci`, build-before-typecheck,
  actual test discovery, the current architecture and actual release triggers.
- [The documentation index](../README.md) separates current guidance from
  historical specifications. Four obsolete specs now carry explicit historical
  notices. The test guide no longer claims a stale test count or nonexistent suite.

## Retained deliberately

- Every root export in `src/index.ts`, including `measureTextLayout`,
  `parseHTMLToReact` and `generateVSCodeConfig`. Lack of an internal caller is
  not evidence that an exported API is unused by consumers.
- The legacy `FrameworkAdapter` workspace type contract, with a corrected
  comment. Removing the unreferenced concrete React implementation does not
  require removing this separately exported contract.
- All active framework writers, source-safety checks, history/undo code,
  browser bridges, unit tests and acceptance scripts.
- React-related parser dependencies and text measurement dependencies, because
  retained APIs still use them.
- Research, design specifications, dated reports, branding assets and shipped
  agent skills. These are context or product assets, not automatically dead code.
- Existing ignored local artifacts and the pre-existing untracked
  `.github/context-mode/` directory. They were not included in these commits.

The historical specifications still contain old examples for reference. Their
notices and the documentation index explain their status; they should not be
used as instructions to restore the removed architecture.

## Validation

Executed locally on Windows with Node.js 26.5.0. The existing CI configuration
uses Node.js 20 on Linux; remote CI was not run during this audit.

| Check | Result |
| --- | --- |
| Baseline build and source tests | Passed; 60 suites, 548 tests |
| Prototype removal | Build, 548 tests and bundled-editor check passed; all eight bundle hashes unchanged |
| Clean installation after dependency pruning | `npm ci --no-audit --no-fund` passed |
| Final build | `npm run build` passed |
| All workspace type checks | `npm run typecheck` passed for 12 projects, including unused-symbol checks |
| Final source tests | 60 suites and 548 tests passed after the clean install |
| Bundled editor | `npm run test:artifact` passed |
| Hosted browser acceptance | `npm run test:hosted` passed, including cross-origin editing and isolation |
| Isolated consumer acceptance | `npm run test:consumer` passed: tarball install, CLI, offline assets, editing, drag/resize, source persistence and consumer production build |
| Published type surface | All four final `.d.ts` bundle hashes match the baseline |
| Dependency stability | Zero retained lockfile package version changes |
| Patch hygiene | `git diff --check` passed |

The offline install initially lacked a cached tarball; a normal clean install
resolved it. Browser checks initially hit sandbox process restrictions and
passed when rerun with approval outside that sandbox.

These checks support compatibility for the exercised workflows. This cleanup
is not a security certification, a runtime performance benchmark, or proof that
every possible consumer integration is covered. The existing advertised Node 18
minimum versus Node 20 build target remains a separate compatibility decision.

## Review and recovery

| Commit | Isolated change |
| --- | --- |
| `f55bf56` | Remove disconnected prototypes and Jotai |
| `ddb051a` | Remove unused private helpers and imports |
| `f6db638` | Remove unused runners and add workspace validation |
| `docs(repo): distinguish current guidance from stale artifacts` | Remove unrelated setup/prompt files and document the audit |

Removed files remain recoverable from Git history. Inspect an original file with
`git show 0baa1942:path/to/file`, or revert the relevant commit to restore its
logical change. There is no duplicate archive of executable dead code in the
working tree. Nothing was pushed or published.
