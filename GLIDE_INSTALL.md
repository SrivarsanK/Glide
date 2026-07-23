# Quick Installation & Integration Guide for Agents & Developers

Add **Glide** (`@srivarsank/glide`) — local code-native visual editor — to any React, Vue, Svelte, Astro, or HTML Vite project in 1 step.

---

## ⚡ 1-Prompt Agent Installation Workflow

Run this single command sequence in your project root:

```bash
# 1. Install package
npm install -D @srivarsank/glide
```

### 2. Update `vite.config.ts`

Add `glide()` to `plugins`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { glide } from '@srivarsank/glide/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    glide(),
  ],
});
```

*(For Vue replace `react()` with `vue()`; for Svelte replace with `svelte()`; for Astro add `vite: { plugins: [glide()] }` in `astro.config.mjs`)*

### 3. Launch & Edit

```bash
# Terminal 1: Start your app
npm run dev

# Terminal 2: Start Glide visual editor
npx glide
```

Open `http://localhost:7777` in browser!

---

## 🎯 Features Included Out of the Box

- ⚡ **Zero-Flicker Dragging**: Drag positions write to `glide-positions.json` with HMR injection
- ⚡ **Bake to Source**: Click `⚡ Bake to Source` in the Design Panel to graduate positions into source inline styles
- 📦 **Component Segregation**: `glide-components.json` is auto-generated & watched to resolve component layers
- ⚛️ **Multi-Framework Writeback**: Native class, style, and text writeback for React, Vue, Svelte, Astro, HTML
