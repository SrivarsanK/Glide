---
name: glide-setup
description: >
  Zero-error setup guide for AI agents to install and configure @srivarsank/glide
  visual editor on any React, Vue, Svelte, Astro, or HTML Vite project in one prompt.
---

# Glide Setup — Agent Installation Skill

> **CRITICAL**: The Vite plugin export is `glideSourceStamping`, NOT `glide`.
> Import path: `@srivarsank/glide/vite-plugin`
> Import statement: `import { glideSourceStamping } from '@srivarsank/glide/vite-plugin';`

---

## Prerequisites (Check Before Install)

1. **Node.js ≥ 18** — run `node -v` to confirm
2. **Vite-based project** — Glide requires Vite. Check for `vite` in `devDependencies` of `package.json`. If missing: `npm install -D vite`
3. **Package manager** — detect from lockfile:
   - `package-lock.json` → use `npm`
   - `pnpm-lock.yaml` → use `pnpm`
   - `yarn.lock` → use `yarn`

---

## Step-by-Step Setup (Execute In Order)

### Step 1 — Install

```bash
npm install -D @srivarsank/glide
```

### Step 2 — Add Vite Plugin

Open `vite.config.ts` (or `.js`). Add `glideSourceStamping()` to `plugins`:

**React**:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { glideSourceStamping } from '@srivarsank/glide/vite-plugin';

export default defineConfig({
  plugins: [react(), glideSourceStamping()],
});
```

**Vue**:
```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { glideSourceStamping } from '@srivarsank/glide/vite-plugin';

export default defineConfig({
  plugins: [vue(), glideSourceStamping()],
});
```

**Svelte**:
```ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { glideSourceStamping } from '@srivarsank/glide/vite-plugin';

export default defineConfig({
  plugins: [svelte(), glideSourceStamping()],
});
```

**Astro** (`astro.config.mjs`):
```ts
import { defineConfig } from 'astro/config';
import { glideSourceStamping } from '@srivarsank/glide/vite-plugin';

export default defineConfig({
  vite: {
    plugins: [glideSourceStamping()],
  },
});
```

**Plain HTML** (vanilla Vite project — no framework plugin needed):
```ts
import { defineConfig } from 'vite';
import { glideSourceStamping } from '@srivarsank/glide/vite-plugin';

export default defineConfig({
  plugins: [glideSourceStamping()],
});
```

### Step 3 — Add `.gitignore` Entries (Optional)

Glide creates two auto-generated files. Add these if you don't want them in version control:

```gitignore
glide-positions.json
glide-components.json
```

If drag positions should persist across team members, **do commit `glide-positions.json`**.

### Step 4 — Optional Config File

Create `glide.config.json` (or `.ts`/`.js`/`.mjs`) in project root to override defaults:

```json
{
  "port": 7777,
  "targetPort": 5173,
  "historyLimit": 100,
  "snapThresholdPx": 4
}
```

Full config shape:

| Key | Type | Default | Description |
|---|---|---|---|
| `port` | number | `7777` | Glide editor server port |
| `targetPort` | number | `5173` | Your Vite dev server port |
| `historyLimit` | number | `100` | Max undo/redo history entries |
| `snapThresholdPx` | number | `4` | Snap-to-element pixel threshold |
| `sourceAttribute` | string | `data-gl-source` | HTML attribute for source mapping |

### Step 5 — Launch

```bash
# Terminal 1: Start your Vite dev server
npm run dev

# Terminal 2: Start Glide visual editor
npx glide
```

If your dev server runs on a non-default port (e.g. 3000):
```bash
npx glide 3000
```

Open **http://localhost:7777** in browser.

### Step 6 — Verify Working

Check for these signs that Glide is active:
1. Browser shows Glide editor chrome (sidebar, canvas, toolbar) at `:7777`
2. Your app renders inside the canvas iframe from `:5173`
3. Hovering elements shows blue outline
4. Clicking an element selects it and populates the Design Panel
5. Terminal shows `[Glide] Server started on port 7777, proxying to 5173`

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `glideSourceStamping is not a function` | Wrong import path | Use `@srivarsank/glide/vite-plugin`, NOT `@srivarsank/glide` |
| `{ glide } is not exported` | Wrong export name | The export is `glideSourceStamping`, not `glide` |
| Blank canvas / no app visible | Dev server not running | Start `npm run dev` first, then `npx glide` |
| Elements not selectable | Stamping failed | Check Vite config has `glideSourceStamping()` in plugins |
| Port conflict | Another process on 7777 | Use `PORT=8888 npx glide` or set in `glide.config.json` |
| Edits don't persist | Wrong target port | Pass your dev server port: `npx glide 3000` |

---

## Auto-Generated Files

| File | Purpose | Git? |
|---|---|---|
| `glide-positions.json` | Zero-flicker drag position storage (CSS injected via HMR) | Optional |
| `glide-components.json` | Component registry for layer panel resolution | Usually ignore |

---

## Package Exports Reference

```
@srivarsank/glide              → Main API (GlideServer, adapters, AST writer)
@srivarsank/glide/vite-plugin  → glideSourceStamping() Vite plugin
@srivarsank/glide/babel-plugin → Babel AST plugin for JSX stamping
```
