---
name: glide-setup
description: >
  Zero-error setup guide for AI agents to install and configure @srivarsank/glide
  visual editor on any React, Vue, Svelte, Astro, or HTML Vite project in one prompt.
  Covers the Vite plugin, the editor address, CLI startup, automatic skill installation,
  and troubleshooting.
---

# Glide Setup — Agent Installation Skill

> **CRITICAL**: The Vite plugin export is `glideSourceStamping`, NOT `glide`.
> Import path: `@srivarsank/glide/vite-plugin`
> Import statement: `import { glideSourceStamping } from '@srivarsank/glide/vite-plugin';`

---

## Prerequisites (Check Before Install)

1. **Node.js ≥ 18** — verify with `node -v`
2. **Vite-based project** — Glide integrates with Vite dev servers. Confirm `vite` is in dependencies.
3. **Package manager** — detect from lockfile:
   - `package-lock.json` → `npm`
   - `pnpm-lock.yaml` → `pnpm`
   - `yarn.lock` → `yarn`
   - `bun.lockb` → `bun`

---

## Step-by-Step Setup

### Step 1 — Install Package

```bash
npm install -D @srivarsank/glide
```

### Step 2 — Configure Vite Plugin

Open `vite.config.ts` (or `vite.config.js`). Add `glideSourceStamping()`:

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

**Plain HTML / Vanilla Vite**:
```ts
import { defineConfig } from 'vite';
import { glideSourceStamping } from '@srivarsank/glide/vite-plugin';

export default defineConfig({
  plugins: [glideSourceStamping()],
});
```

The plugin is necessary. It stamps each element with its source position in dev mode. Without it, elements can be selected but not edited.

---

### Step 3 — Install Agent Skills

```bash
npx @srivarsank/glide --install-skills
```

This installs:
- `.agents/skills/glide/SKILL.md` (Architecture & Visual Editing)
- `.agents/skills/glide-component-segregator/SKILL.md` (Component Registry & Targeting)
- `.agents/skills/glide-setup/SKILL.md` (Project Setup Guide)

---

### Step 4 — Configure `.gitignore`

Add the auto-generated registry file:

```gitignore
glide-components.json
```

---

### Step 5 — Run Glide Visual Editor

**Option A — inside the dev server (default with the plugin):**

```bash
npm run dev
```

Open the address in the `[Glide] Editor: ...` line that the dev server prints, for example **http://127.0.0.1:5173/__glide/**. The editor uses the IP address `127.0.0.1` and the app stays on `localhost`; this keeps app scripts away from the editor. `http://localhost:5173/__glide/` redirects to the IP address.

**Option B — standalone command:**

```bash
# Terminal 1 — Start your app
npm run dev

# Terminal 2 — Start Glide targeting your app's port (e.g. 5173)
npx @srivarsank/glide 5173
```

Open **http://localhost:7777**.

To use only Option B, pass `glideSourceStamping({ editor: false })`.

---

## What Can Be Saved

| File type | Class, inline style, text, drag/resize | Structural edits |
|:---|:---|:---|
| JSX / TSX | Yes | Yes |
| Vue, Svelte, Astro | Yes | No |
| HTML | Yes, in projects with no UI framework | No |

Dynamic values (`:class`, `class={...}`, `{...spread}`) are refused with a clear message. Edit those in source.

---

## Verification Checklist

1. [ ] The editor loads at `/__glide/` (Option A) or `http://localhost:7777` (Option B).
2. [ ] Elements show a blue selection boundary on hover/click.
3. [ ] The properties panel is active for a selected element. If it is inactive, the plugin is not installed or the dev server was not restarted.
4. [ ] Editing a color or class updates the source file and the canvas.
5. [ ] `glide-components.json` is generated in the project root.

## Troubleshooting

| Symptom | Cause and fix |
|:---|:---|
| Editor shows "Disconnected" | Open the editor from the printed address (`127.0.0.1` with Option A; `localhost` or `127.0.0.1` with Option B). Other hosts are refused unless `remoteAccess` is set in `glide.config.json`. |
| App behaves differently in the preview | With Option A the app must be reachable at `localhost` on the dev server's port. |
| Selection works, panel is inactive | No source stamps. Add the plugin and restart the dev server. |
| `STALE_DIGEST` on save | The file changed after selection. Select the element again. |
| `UNSUPPORTED_OPERATION` on save | Glide cannot make this edit exactly. The message gives the reason; edit in source. |
