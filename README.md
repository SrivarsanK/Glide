<p align="center">
  <img src="./logo/ascii-art.png" alt="Glide" width="500">
</p>

---

## What is Glide?

**Glide** is a local visual design tool that sits on top of your existing frontend app. You open it in your browser, click on any element on screen, and edit its styles, layout, and position - just like Figma. The difference? **Every edit is written directly back to your source code** (JSX, TSX, Vue SFC, Svelte, or HTML) as real code.

No cloud. No proprietary formats. No lock-in. Just your code, edited visually.

---

## How It Works

```mermaid
flowchart TD
    App["Your App (port 5173)"] <--> Server["Glide Server (port 7777)"]
    Server <--> Files["Your Source Files"]
    Iframe["Browser iframe"] --> App
    UI["Visual Editor UI"] --> Server
```

1. Your app runs normally (e.g., `npm run dev` on port 5173)
2. Glide's server connects to it and opens a visual editor at `localhost:7777`
3. You click elements on the canvas → Glide highlights them and shows their styles
4. You change a value → Glide rewrites the source file using AST transformations

---

## Quick Start

### Prerequisites

- **Node.js** v18+
- **npm** v8+
- **GitHub Packages Registry Configuration**:
  Since this package is hosted on GitHub Packages under the `@srivarsank` scope, you need to configure `npm` to route requests for this scope to GitHub:
  1. Add or update `.npmrc` in your project root or your global user directory (`~/.npmrc`) with:
     ```ini
     @srivarsank:registry=https://npm.pkg.github.com
     ```
  2. Authenticate by logging in with your GitHub Personal Access Token (PAT) with `read:packages` scope:
     ```bash
     npm login --registry=https://npm.pkg.github.com
     ```
     *Username: Your GitHub username*  
     *Password: Your GitHub Personal Access Token (PAT)*

### Method 1: Run via npx (Easiest)

Once the registry is configured, you can run Glide directly on any frontend project without cloning this repository:

1. Start your frontend app normally (e.g., `npm run dev` on port `5173`).
2. In a separate terminal, run:
   ```bash
   npx @srivarsank/glide 5173
   ```
   *(Replace `5173` with whatever port your frontend app is running on).*
3. Open **http://localhost:7777** in your browser to start editing.

---

### Method 2: Local Development & Source Build

If you want to run Glide from the source files:

1. **Clone and install dependencies**:
   ```bash
   git clone https://github.com/SrivarsanK/Glide.git
   cd Glide
   npm install
   ```

2. **Build Glide**:
   ```bash
   npm run build
   ```

3. **Start your frontend app**:
   In a separate terminal, start your React/Vue/Svelte app normally (e.g., port `5173`).

4. **Start the local Glide CLI**:
   From the Glide repository folder, run:
   ```bash
   node dist/cli.js 5173
   ```

5. **Open the editor**:
   Go to **http://localhost:7777** in your browser.


---

## Features

<p align="center">
    <img src="./ui/guide.png" alt="Glide Visual Editor Guide" width="100%"/>
</p>

| Feature | Description |
|---|---|
| 🎨 **Visual Canvas** | Figma-like workspace - select, drag, resize, zoom, and pan elements |
| 📐 **Smart Snapping** | Automatically snaps to sibling edges, centers, and the pixel grid with guide lines |
| ✍️ **Live Code Write-back** | Every change is saved directly to your JSX/TSX/Vue/Svelte source files |
| ⚡ **Zero-Flicker Drag** | Positions are saved to `glide-positions.json` so dragging doesn't trigger a full HMR reload |
| 🗂️ **Layers Panel** | Hierarchical tree view of all elements, with Lucide-style icons and hover controls (like Figma) |
| 🎛️ **Properties Panel** | Edit geometry (X, Y, W, H), spacing (margin/padding), border, radius, shadows, fills, and typography |
| 🌈 **Color Picker** | Custom popup color picker with presets and hex input - no native OS dialog |
| 📱 **Device Preview** | Switch between presets or enter custom width & height. Clear height in Custom Mode to auto-scale to the full page height, and scroll inside viewports |
| 🌿 **Git Branching Mode** | Safe branching sandbox (`git: <branch> ▾`) to preview and finalise changes before commit |
| 🎛️ **Quick Toggles Navbar** | Compact header tools for snapping object/pixel options, grid layers, rulers, and custom logo/repository view |
| ↩️ **Undo / Redo** | Full undo/redo history for the entire session |

---

## Color Picker

Glide uses a **custom popup color picker** (not the native OS dialog). Click any color swatch to open it. You can:
- Pick from 16 preset colors
- Type a hex code directly
- Use the **🧪 eyedropper button** to sample a color from the screen

> ⚠️ **Known Bug - Eyedropper Tool:** The eyedropper button (`🧪`) is currently buggy in some Chromium versions. It may not close the color picker after picking, or it may fail to register the sampled color. **Avoid using it for now.** Use hex input or presets instead.

---

## Keyboard Shortcuts

| Key | Tool |
|---|---|
| `V` | Select tool |
| `H` | Hand / Pan tool |
| `F` | Frame |
| `R` | Rectangle |
| `O` | Ellipse |
| `T` | Text |
| `C` | Comment |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Escape` | Deselect / Close popup |

---

## Project Structure

```
Glide/
├── packages/
│   ├── cli/            # Entry point - run this to start Glide
│   ├── overlay/        # The visual editor UI (HTML/JS served at localhost:7777)
│   ├── server/         # WebSocket + HTTP server that connects to your app
│   ├── core/           # Shared types, AST scanner utilities
│   ├── ast-writer/     # Writes style changes back to JSX/TSX/Vue/Svelte source
│   └── vite-plugin/    # Vite plugin that stamps elements with source locations
├── docs/               # Extra documentation and design specs
├── logo/               # Logo assets
└── README.md
```

---

## Known Issues

| Issue | Status |
|---|---|
| 🐛 **Eyedropper tool** - may not close or apply the picked color correctly | **Bugged - avoid for now** |
| 🐛 **Element resizing** - canvas resize handles don't consistently apply changes | **Bugged** |
| ⚠️ **Vue / Svelte editing** - only className string replacements are supported, not full style objects | Partial support |
| ⚠️ **Stamping required** - snapping and editing only work on elements tagged with `data-gl-source` by the Vite plugin | By design |
| ⚠️ **Absolute drag positions** - dragged positions are stored in `glide-positions.json`, not written to source layout | By design |

---

## License

This project is licensed under the [Apache License 2.0](LICENSE).