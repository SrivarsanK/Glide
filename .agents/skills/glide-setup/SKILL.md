---
name: glide-setup
description: >
  Zero-error setup guide for AI agents to install and configure @srivarsank/glide
  visual editor on any React, Vue, Svelte, Astro, or HTML Vite project in one prompt.
  Covers CLI startup, automatic skill installation, Vite plugin options, and
  troubleshooting.
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

---

### Step 3 — Install Agent Skills

Install Glide agent skills into your project:

```bash
# Automated install via Glide CLI:
npx @srivarsank/glide --install-skills
```

This installs:
- `.agents/skills/glide/SKILL.md` (Architecture & Visual Editing)
- `.agents/skills/glide-component-segregator/SKILL.md` (Component Registry & Targeting)
- `.agents/skills/glide-setup/SKILL.md` (Project Setup Guide)

---

### Step 4 — Configure `.gitignore`

Add auto-generated cache and registry files:

```gitignore
glide-positions.json
glide-components.json
```

---

### Step 5 — Run Glide Visual Editor

```bash
# Terminal 1 — Start your app
npm run dev

# Terminal 2 — Start Glide targeting your app's port (e.g. 5173)
npx @srivarsank/glide 5173
```

Open **http://localhost:7777** in your browser.

---

## Verification Checklist

1. [ ] App loads at `http://localhost:7777` with Glide visual overlay frame.
2. [ ] Elements show blue selection boundary on hover/click.
3. [ ] `glide-components.json` is generated in project root.
4. [ ] Editing a color or class updates source file and reflects immediately on canvas.
