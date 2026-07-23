---
name: glide-setup
description: >
  Zero-error setup guide for AI agents to install and configure @srivarsank/glide
  visual editor on any React, Vue, Svelte, Astro, or HTML Vite project in one prompt.
---

# Glide Setup Skill (One-Prompt Installation Guide)

This skill instructs AI agents how to seamlessly install and configure **Glide** (`@srivarsank/glide`) — a local code-native visual design editor for React, Vue, Svelte, Astro, and HTML Vite projects.

---

## 1-Prompt Autonomous Setup Instructions for Agents

When requested to add, install, or integrate Glide in a project, perform these exact steps in order:

### Step 1: Install Package

Run terminal command:
```bash
npm install -D @srivarsank/glide
```
*(or `pnpm add -D @srivarsank/glide` / `yarn add -D @srivarsank/glide` depending on package manager present)*

---

### Step 2: Configure `vite.config.ts` (or `vite.config.js`)

Inspect `vite.config.ts` or `vite.config.js`. Import `glide` from `@srivarsank/glide/vite-plugin` and add it to the `plugins` array:

#### React / TSX Example
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { glide } from '@srivarsank/glide/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    glide(), // ← Add Glide plugin
  ],
});
```

#### Vue Example
```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { glide } from '@srivarsank/glide/vite-plugin';

export default defineConfig({
  plugins: [
    vue(),
    glide(),
  ],
});
```

#### Svelte / SvelteKit Example
```ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { glide } from '@srivarsank/glide/vite-plugin';

export default defineConfig({
  plugins: [
    svelte(),
    glide(),
  ],
});
```

#### Astro Example
```ts
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { glide } from '@srivarsank/glide/vite-plugin';

export default defineConfig({
  vite: {
    plugins: [glide()],
  },
});
```

---

### Step 3: Add NPM Script in `package.json`

Add `"glide"` to `"scripts"` in `package.json`:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "glide": "glide"
}
```

---

### Step 4: Verification & Usage

1. Start your dev server: `npm run dev` (runs on `localhost:5173`)
2. Start Glide visual editor: `npx glide` (runs on `localhost:7777`)
3. Open `http://localhost:7777` in browser to visually edit your UI and write back to source code in real time!

---

## Technical Specifications & Defaults

- **Glide Port**: `7777` (default)
- **Target Vite Port**: `5173` (default)
- **Custom Ports Command**: `npx glide --port 7777 --target-port 3000`
- **Positions File**: `glide-positions.json` (created automatically for zero-flicker live dragging; click `⚡ Bake to Source` in overlay to graduate drag positions to source inline styles)
- **Component Registry**: `glide-components.json` (auto-generated & watched for component segregation)
