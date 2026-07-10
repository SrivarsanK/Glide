# Glide Refactor PR: Remove Hardcoded Values

# Glide Refactor PR: Centralize Config & Remove Hardcoded Values
> **Status:** PR-ready for 4 of 7 refactor tasks. Copy the file contents below into a branch, commit, and open the PR with the commands at the bottom. Two tasks (bridge script + editor HTML) are blocked pending full source + a config-loader decision (see [@Blocked](#user_mention#blocked) section).
Tracker: Private ([https://app.clickup.com/t/86d3n52zv](https://app.clickup.com/t/86d3n52zv))

* * *
## What this PR does (and why)
Glide had magic numbers and strings scattered across five packages: ports (`7777`, `5173`, `4321`), a snap threshold (`4`), gap thresholds (`500`, `120`, `20`), DOM attribute names (`data-gl-source`, `data-glide-hover`, `data-glide-selected`), theme hex values, iframe dimensions (`1440×1024`), sidebar widths, a self-write debounce (`3000ms`), and a history limit (`100`). None of it was overridable, and the publish config only targeted GitHub Packages, blocking [npmjs.org](http://npmjs.org) distribution.

This PR introduces a **single source of truth** (`GlideConfig`) that every value flows from, plus a loader so users can override via `glide.config.{json,js,mjs}`. It also flips the package to publish publicly on npm.

**Scope of this PR (tasks 1, 2, 5, 6):**
*   New `GlideConfig` type + `DEFAULT_CONFIG` + `resolveConfig()` (deep merge)
*   New `loadConfigFromDisk()` loader
*   CLI + `GlideServer` wired to consume config (ports, debounce, history limit)
*   `generateVSCodeConfig` port bug fixed (`4321` → real default)
*   `package.json` switched to public npm, vite moved to optional peer dep, `engines` added

**Deferred to a follow-up (tasks 3, 4, 7):** bridge script templating, editor HTML theming, and tests. Reasons in [@Blocked](#user_mention#blocked).

* * *
## File-by-file changes
### 1\. `packages/core/src/config.ts` (NEW)
**Why:** the foundational type + defaults everything else imports. Defaults mirror the old hardcoded values exactly, so behavior is unchanged out of the box.

```typescript
/**
 * @srivarsank/core — Centralized Glide configuration.
 * Single source of truth for every value that used to be hardcoded.
 */

export interface GlideEditorTheme {
  accentColor: string;
  bgCanvas: string;
  bgPanel: string;
  borderColor: string;
  fontFamily: string;
}

export interface GlideViewport {
  width: number;
  height: number;
}

export interface GlideConfig {
  // Server
  port: number;
  targetPort: number;
  // Behavior
  historyLimit: number;
  selfWriteDebounceMs: number;
  // Snap engine (browser bridge)
  snapThresholdPx: number;
  maxGapDetection: number;
  maxDistanceIndicator: number;
  // DOM attributes (namespaceable)
  sourceAttribute: string;
  hoverAttribute: string;
  selectedAttribute: string;
  // Editor UI
  editorTheme: GlideEditorTheme;
  // Canvas defaults
  defaultViewport: GlideViewport;
  sidebarWidth: number;
}

export const DEFAULT_CONFIG: GlideConfig = {
  port: 7777,
  targetPort: 5173,
  historyLimit: 100,
  selfWriteDebounceMs: 3000,
  snapThresholdPx: 4,
  maxGapDetection: 500,
  maxDistanceIndicator: 120,
  sourceAttribute: 'data-gl-source',
  hoverAttribute: 'data-glide-hover',
  selectedAttribute: 'data-glide-selected',
  editorTheme: {
    accentColor: '#0c8ce9',
    bgCanvas: '#1e1e1e',
    bgPanel: '#2c2c2c',
    borderColor: '#333333',
    fontFamily: "'Inter', sans-serif",
  },
  defaultViewport: { width: 1440, height: 1024 },
  sidebarWidth: 260,
};

/** Deep-partial so nested overrides (e.g. just editorTheme.accentColor) work. */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Merge user overrides onto DEFAULT_CONFIG. Nested objects are merged one
 * level deep so a partial theme override doesn't wipe the other tokens.
 */
export function resolveConfig(overrides?: DeepPartial<GlideConfig>): GlideConfig {
  if (!overrides) return { ...DEFAULT_CONFIG };
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    editorTheme: {
      ...DEFAULT_CONFIG.editorTheme,
      ...(overrides.editorTheme ?? {}),
    },
    defaultViewport: {
      ...DEFAULT_CONFIG.defaultViewport,
      ...(overrides.defaultViewport ?? {}),
    },
  };
}
```

### 2\. `packages/core/src/config-loader.ts` (NEW)
**Why:** lets consumers drop a `glide.config.*` in their project root to override defaults. JSON is read synchronously; `.ts`/`.js`/`.mjs` are loaded through **`jiti`**, which transpiles TypeScript on the fly so `glide.config.ts` works with zero build step on the consumer's end.
> ✅ **Decision made:** using `jiti` for full `.ts` config support. `jiti` is added as a runtime dependency (see package.json below) and externalized in the esbuild config. It handles `.ts`, `.js`, and `.mjs` uniformly, so we no longer need `pathToFileURL` dynamic-import gymnastics.

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { createJiti } from 'jiti';
import { resolveConfig, GlideConfig, DEFAULT_CONFIG, DeepPartial } from './config.js';

export async function loadConfigFromDisk(projectRoot: string): Promise<GlideConfig> {
  // JSON: read directly, no transpilation needed
  const jsonPath = path.join(projectRoot, 'glide.config.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as DeepPartial<GlideConfig>;
      return resolveConfig(raw);
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  // TS/JS/MJS: jiti transpiles + imports on the fly (TypeScript works with no build step)
  const jiti = createJiti(projectRoot, { interopDefault: true });
  for (const file of ['glide.config.ts', 'glide.config.js', 'glide.config.mjs']) {
    const p = path.join(projectRoot, file);
    if (fs.existsSync(p)) {
      try {
        const mod = await jiti.import<DeepPartial<GlideConfig>>(p, { default: true });
        return resolveConfig(mod);
      } catch {
        return DEFAULT_CONFIG;
      }
    }
  }

  return DEFAULT_CONFIG;
}
```

> Note: uses `jiti` v2 API (`createJiti` + `jiti.import`). If you're on jiti v1, swap to `const jiti = require('jiti')(projectRoot)` and `jiti(p)`. The build script must add `'jiti'` to its `externals` array so esbuild doesn't try to bundle it.
### 3\. `packages/core/src/index.ts` (MODIFIED)
**Why:** re-export config utilities so other packages import from `@srivarsank/core`.

```typescript
// ...existing exports...
export { DEFAULT_CONFIG, resolveConfig } from './config.js';
export type { GlideConfig, GlideEditorTheme, GlideViewport, DeepPartial } from './config.js';
export { loadConfigFromDisk } from './config-loader.js';
```

### 4\. `packages/cli/src/index.ts` (MODIFIED)
**Why:** the CLI should load config from disk, while still honoring explicit CLI args / env vars as the highest-priority override. Precedence: **CLI arg > env var > config file > default.**

Replace the top of the file (the port/server setup) with:

```typescript
#!/usr/bin/env node
import { GlideServer, pushHistory } from '@srivarsank/server';
import { loadConfigFromDisk } from '@srivarsank/core';
// ...rest of existing imports unchanged...

const config = await loadConfigFromDisk(process.cwd());

// Precedence: CLI arg > env var > config file > default
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : config.port;
const targetPort = process.argv[2] ? parseInt(process.argv[2], 10) : config.targetPort;

const server = new GlideServer(port, targetPort, config);
```

> Note: this makes the module top-level `await`. That's fine since the build targets `node20` + ESM. The rest of `server.onEdit(...)` and `server.start()` stay exactly as-is.
### 5\. `packages/server/src/ws-server.ts` (MODIFIED)
**Why:** the server hardcoded `3000` (debounce), `100` (history limit), and only regex-scraped `glide.config.ts` for `historyLimit`. Now it takes the full resolved config.

**a) Constructor + field:**

```typescript
import type { GlideConfig } from '@srivarsank/core';
import { DEFAULT_CONFIG } from '@srivarsank/core';

export class GlideServer {
  // ...existing fields...
  private config: GlideConfig;

  constructor(port = 7777, targetPort = 5173, config: GlideConfig = DEFAULT_CONFIG) {
    this.port = port;
    this.targetPort = targetPort;
    this.config = config;
  }
```

**b) In** **`start()`** **— replace the glide.config.ts regex block with:**

```typescript
clearHistory();
setHistoryLimit(this.config.historyLimit);
```

(Deletes the `configPath`/`readFileSync`/`match` scrape entirely — the loader already handled it upstream.)

**c) Self-write debounce — replace the hardcoded** **`3000`**\*\*\*\***:**

```typescript
if (Date.now() - lastWrite < this.config.selfWriteDebounceMs) {
  console.log(`[Glide] Ignoring self-write change event on ${normPath}`);
  return;
}
```

**d) Editor HTML — pass config through (forward-compat with task #4):**

```typescript
res.end(getEditorHTML(this.config));
```

> Until task #4 lands, keep `getEditorHTML(this.targetPort)` if the signature hasn't changed yet. Flagged so the two PRs don't collide.
### 6\. `packages/core/src/detect.ts` (MODIFIED) — Task #5
**Why:** `generateVSCodeConfig` hardcoded port `4321`, which never matched the real default of `7777`. Straight-up bug.

```typescript
import type { GlideConfig } from './config.js';
import { DEFAULT_CONFIG } from './config.js';

export function generateVSCodeConfig(projectRoot: string, config: GlideConfig = DEFAULT_CONFIG): void {
  const vscodeDir = path.join(projectRoot, '.vscode');
  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true });
  }
  const settingsPath = path.join(vscodeDir, 'settings.json');
  const settings = {
    'glide.enabled': true,
    'glide.editor.port': config.port, // was hardcoded 4321
    'glide.stampOnSave': true,
  };
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}
```

Update any call site to pass the resolved config.
### 7\. `package.json` (MODIFIED) — Task #6
**Why:** unblock public npm publishing, stop shipping vite as a hard dep, enforce Node 18+.

```plain
{
  "publishConfig": {
    "registry": "https://registry.npmjs.org/",
    "access": "public"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    // ...existing deps...
    "jiti": "^2.4.0"    // NEW: transpiles glide.config.ts on the fly
  },
  "peerDependencies": {
    "vite": ">=5.0.0"
  },
  "peerDependenciesMeta": {
    "vite": { "optional": true }
  }
}
```

*   Move `vite` OUT of `dependencies` (it's only needed for the vite-plugin export).
*   Add `jiti` to `dependencies` (runtime need for `.ts` config loading).
*   In `scripts/build-single-package.js`, add `'jiti'` to the `externals` array.
*   **README:** drop the `.npmrc` + `@srivarsank:registry=https://npm.pkg.github.com` + PAT login instructions from Quick Start, since public npm needs no auth. Replace with a plain `npx @srivarsank/glide 5173`.

* * *
## Commit plan
Suggested commits (one per logical unit, so review is clean):

1. `feat(core): add GlideConfig type, defaults, and resolveConfig`
2. `feat(core): add loadConfigFromDisk loader (json/js/mjs)`
3. `refactor(cli,server): consume GlideConfig instead of hardcoded values`
4. `fix(core): generateVSCodeConfig used wrong port (4321 -> config.port)`
5. `chore: publish to public npm, vite as optional peer dep, node>=18`
## Commands to open the PR

```bash
git checkout -b refactor/centralize-config
# ...add the files above, commit per the plan...
git push -u origin refactor/centralize-config

gh pr create \
  --title "Centralize config & remove hardcoded values (tasks 1,2,5,6)" \
  --body-file .github/PR_BODY.md \
  --base main
```

Use the "What this PR does" section above as `PR_BODY.md`.

* * *

## ⚠️ Blocked / needs your input
**Task #3 (bridge script) and #4 (editor HTML):** I've only seen these two files **truncated**. Rewriting ~500 lines of the bridge IIFE or the full editor HTML from a partial read would risk corrupting real logic. Paste the complete contents of:
*   `packages/vite-plugin/src/index.ts`
*   `packages/overlay/src/editor-html.ts`

**Config-loader** **`.ts`** **support:** ✅ Resolved. Using `jiti` for full `.ts`/`.js`/`.mjs`/`.json` support. Loader + package.json sections above updated accordingly.

**Task #7 (tests):** deferred until #3/#4 land, since the test suite should cover the full config surface, not a partial one.

**PR creation itself:** I have read-only GitHub access, so I can't push the branch or open the PR for you. The commands above do it in ~30 seconds once the files are in place.