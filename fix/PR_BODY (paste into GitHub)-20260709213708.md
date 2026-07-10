# PR_BODY (paste into GitHub)

> Paste everything below the line straight into the GitHub PR description. It's plain GitHub-flavored Markdown, no ClickUp-specific bits.
* * *
## Summary
Centralizes every hardcoded value in Glide behind a single `GlideConfig` type, adds a `glide.config.{ts,js,mjs,json}` loader (via `jiti`), and flips the package to publish publicly on npm. No behavior changes out of the box, defaults mirror the previous hardcoded values exactly.

Scope: refactor tasks **1, 2, 5, 6**. Bridge-script templating (#3), editor-HTML theming (#4), and tests (#7) land in a follow-up PR.
## Why
Magic numbers and strings were scattered across five packages with no way to override them:
*   **Ports:** `7777` (editor), `5173` (target), `4321` (VSCode config, a bug: never matched the real default)
*   **Snap engine:** threshold `4`, gap thresholds `500` / `120` / `20`
*   **DOM attributes:** `data-gl-source`, `data-glide-hover`, `data-glide-selected`
*   **Theme:** hardcoded hex values and font stack
*   **Canvas:** iframe `1440×1024`, sidebar widths `260` / `270`
*   **Behavior:** self-write debounce `3000ms`, history limit `100`

The publish config also pointed only at GitHub Packages, which forced consumers to configure `.npmrc` + a PAT just to `npx` the tool.
## What changed
### New
*   **`packages/core/src/config.ts`** — `GlideConfig` interface, `DEFAULT_CONFIG` (mirrors old hardcoded values), and `resolveConfig()` with one-level-deep merge for nested objects (`editorTheme`, `defaultViewport`).
*   **`packages/core/src/config-loader.ts`** — `loadConfigFromDisk()` reads `glide.config.json` directly and `.ts`/`.js`/`.mjs` through `jiti`, so a TypeScript config works with zero build step. Falls back to `DEFAULT_CONFIG` on any error.
### Modified
*   **`packages/core/src/index.ts`** — re-exports the config type + utilities.
*   **`packages/cli/src/index.ts`** — loads config from disk; precedence is **CLI arg > env var > config file > default**. Passes the full config into `GlideServer`.
*   **`packages/server/src/ws-server.ts`** — constructor now takes a `GlideConfig`. Replaces the hardcoded `3000ms` debounce with `config.selfWriteDebounceMs`, the `100` history limit with `config.historyLimit`, and deletes the old regex scrape of `glide.config.ts` (the loader owns that now).
*   **`packages/core/src/detect.ts`** — `generateVSCodeConfig` now uses `config.port` instead of the wrong hardcoded `4321`.
*   **`package.json`** — `publishConfig` → `https://registry.npmjs.org/` with `access: public`; `vite` moved from `dependencies` to an optional `peerDependency`; `jiti` added to `dependencies`; `engines.node >= 18.0.0` added.
*   **`scripts/build-single-package.js`** — `jiti` added to esbuild `externals`.
*   **`README.md`** — removed the `.npmrc` + PAT auth steps from Quick Start (public npm needs no auth).
## How to test

```bash
npm install
npm run build
npm run test          # existing suite should stay green

# defaults still work
npx . 5173

# override via config
echo '{ "port": 8080, "snapThresholdPx": 8 }' > glide.config.json
npx . 5173            # editor should come up on 8080

# CLI arg still wins over config
PORT=9090 npx . 3000  # editor on 9090, target 3000
```

## Breaking changes
*   `GlideServer` constructor signature gains a third `config` argument. It defaults to `DEFAULT_CONFIG`, so existing `new GlideServer(port, targetPort)` calls keep working.
*   `generateVSCodeConfig` gains an optional `config` argument (defaults to `DEFAULT_CONFIG`).
*   Consumers installing from GitHub Packages must switch to public npm (no more `.npmrc`/PAT).
## Follow-up (not in this PR)
*   **#3** Template the bridge-script IIFE in `vite-plugin` from config.
*   **#4** Theme `editor-html.ts` from `config.editorTheme` + viewport/sidebar values.
*   **#7** Unit tests for `resolveConfig` / `loadConfigFromDisk` + full `vitest` regression pass.