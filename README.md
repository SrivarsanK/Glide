# ⚡ Glide

**Code-native visual design tool for React, Vue, and Svelte.**

Glide lets you visually design your web app in a Figma-like editor while writing changes directly back to your source files — no export, no copy-paste, no sync issues.

---

## Features

- 🎨 **Visual Editor** — Figma-style canvas with layers panel, properties panel, and toolbar
- 🔍 **Element Selection** — Click any element in your live app to select it
- 📐 **Full Properties Panel** — Position, size, flex layout, spacing, typography, fill, border, shadow, opacity
- 🏷️ **Smart Layers Panel** — Hierarchical tree with icons, eye/lock toggles, drag-to-reorder
- 📱 **Device Preview** — Switch between Mobile S (320px) → 4K (2560px) + custom width
- ⌨️ **Keyboard Shortcuts** — Arrow nudge, Ctrl+Z undo, Ctrl+0 fit, tool hotkeys (V/H/F/R/O/T/C)
- ✏️ **Live Write-Back** — Edits are written back to your source files via AST, preserving formatting
- ↩️ **Undo/Redo** — Full undo stack, server-side, across all edits
- 🔌 **Zero Runtime** — The overlay and source stamping are dev-only; zero impact in production

---

## Installation

```bash
npm install --save-dev glide-dev
```

---

## Quick Start

### 1. Add the Vite plugin

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { glideSourceStamping } from 'glide-dev'

export default defineConfig({
  plugins: [glideSourceStamping(), react()],
})
```

### 2. Start your dev server

```bash
npm run dev
```

### 3. Start Glide

In a separate terminal, from your project root:

```bash
npx glide
```

This starts the Glide workspace server at `ws://localhost:7777` and opens the visual editor at `http://localhost:7777`.

> **Note:** Point the editor's URL bar to your dev server (e.g. `http://localhost:5173`).

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `V` | Select tool |
| `H` | Hand (pan) tool |
| `F` / `A` | Frame tool |
| `R` | Rectangle tool |
| `O` | Ellipse tool |
| `T` | Text tool |
| `C` | Comment tool |
| `Arrow` | Nudge 1px |
| `Shift+Arrow` | Nudge 10px |
| `Escape` | Deselect |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+0` | Fit canvas |
| `Ctrl+1` | 100% zoom |
| `Ctrl+Scroll` | Zoom in/out |
| `Space+Drag` | Pan canvas |

---

## Config

Create `glide.config.ts` in your project root (optional):

```typescript
export default {
  port: 7777,        // Glide UI server port
  wsPort: 7777,      // WebSocket server port  
  devPort: 5173,     // Your dev server port
  adapter: 'auto',   // 'react' | 'vue' | 'svelte' | 'auto'
  styling: 'auto',   // 'tailwind' | 'cssmodules' | 'css' | 'auto'
  snapGrid: 8,       // Snap grid size in px
}
```

---

## Supported Frameworks

| Framework | Status |
|---|---|
| React / TSX | ✅ Full support |
| Vue SFC | ✅ Full support |
| Svelte | ✅ Full support |
| HTML | ✅ Basic support |
| Astro | 🚧 Planned |

---

## How It Works

1. **Source Stamping** — The Vite plugin adds `data-gl-source` attributes to every JSX element at dev-build time (in-memory, never written to disk)
2. **Bridge** — A script injected into your app's iframe reads element positions and reports them to the editor via `postMessage`
3. **WebSocket Server** — Receives edit commands from the editor
4. **AST Write-Back** — Edits are applied to your source files using Babel AST — format-preserving, no reformatting

---

## License

MIT © Srivarsan K