# Glide — Installation & Integration Guide

Add **Glide** (`@srivarsank/glide`) — a local code-native visual editor — to any React, Vue, Svelte, Astro, or HTML Vite project.

> **For AI Agents**: See the comprehensive setup skill at `skills/glide-setup/SKILL.md` for autonomous 1-prompt installation with prerequisite checks, troubleshooting, and verification.

---

## Quick Start (3 Steps)

### 1. Install

```bash
npm install -D @srivarsank/glide
```

### 2. Add Vite Plugin

> ⚠️ The export name is **`glideSourceStamping`** — not `glide`.

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';              // ← your framework plugin
import { glideSourceStamping } from '@srivarsank/glide/vite-plugin';

export default defineConfig({
  plugins: [
    react(),              // your existing framework plugin
    glideSourceStamping() // ← add this
  ],
});
```

<details>
<summary><strong>Vue / Svelte / Astro / HTML examples</strong></summary>

**Vue**:
```ts
import vue from '@vitejs/plugin-vue';
import { glideSourceStamping } from '@srivarsank/glide/vite-plugin';
export default defineConfig({ plugins: [vue(), glideSourceStamping()] });
```

**Svelte**:
```ts
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { glideSourceStamping } from '@srivarsank/glide/vite-plugin';
export default defineConfig({ plugins: [svelte(), glideSourceStamping()] });
```

**Astro** (`astro.config.mjs`):
```ts
import { glideSourceStamping } from '@srivarsank/glide/vite-plugin';
export default defineConfig({ vite: { plugins: [glideSourceStamping()] } });
```

**Plain HTML** (no framework plugin needed):
```ts
import { glideSourceStamping } from '@srivarsank/glide/vite-plugin';
export default defineConfig({ plugins: [glideSourceStamping()] });
```

</details>

### 3. Launch

```bash
# Terminal 1 — Start your app
npm run dev

# Terminal 2 — Start Glide editor
npx glide
```

Open **http://localhost:7777** → visually edit your app and write changes directly to source code.

---

## Configuration (Optional)

Create `glide.config.json` in your project root:

```json
{
  "port": 7777,
  "targetPort": 5173,
  "historyLimit": 100,
  "snapThresholdPx": 4
}
```

Also supports `glide.config.ts`, `glide.config.js`, and `glide.config.mjs`.

If your dev server runs on a non-standard port:
```bash
npx glide 3000
```

---

## Auto-Generated Files

| File | Purpose | Commit to Git? |
|---|---|---|
| `glide-positions.json` | Zero-flicker drag positions (CSS injected via HMR) | Optional — commit to share, `.gitignore` if temporary |
| `glide-components.json` | Component registry for layer panel | Usually `.gitignore` |

---

## Package Exports

| Import Path | Export | Purpose |
|---|---|---|
| `@srivarsank/glide` | `GlideServer`, adapters, AST writers | Programmatic API |
| `@srivarsank/glide/vite-plugin` | `glideSourceStamping()` | Vite plugin (source stamping + bridge injection) |
| `@srivarsank/glide/babel-plugin` | default export | Babel plugin for JSX `data-gl-source` stamping |

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `{ glide } is not exported` | Use `{ glideSourceStamping }` — that's the actual export name |
| Blank canvas | Start `npm run dev` first, then `npx glide` |
| Elements not selectable | Ensure `glideSourceStamping()` is in your Vite plugins |
| Port conflict on 7777 | Set `PORT=8888 npx glide` or use `glide.config.json` |
| Edits not writing back | Check target port matches your dev server: `npx glide 3000` |
