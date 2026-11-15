---
name: glide-setup
description: >
  How to install and configure the Glide visual editor (@srivarsank/glide) in a Vite or Astro
  project, and how to fix a setup that does not work. Use this skill whenever the user asks to add,
  install, set up, enable, start or open Glide or "the visual editor"; when they ask how to reach
  the editor (`/__glide/`, port 7777); and when Glide is installed but the editor does not load,
  cannot connect, shows an empty preview, or lets them select elements but not edit them.
---

# Glide setup

Glide needs two things in a project: the package, and its Vite plugin. The plugin is the part that
matters most. In dev mode it marks each element with its source position, and it serves the editor
from the dev server. Without the plugin the user can see and select elements but cannot edit them,
which looks like a broken install.

## Before you start

- **Node.js 20 or later.** Check with `node -v`.
- **A Vite-based project**: Vite, Astro, SvelteKit, or another tool that takes Vite plugins. Look
  for `vite` or `astro` in `package.json`. Glide does not support Webpack or Next.js projects.
- **The package manager**: use the one whose lockfile is present (`package-lock.json` → npm,
  `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` → bun).

## Steps

### 1. Install the package

```bash
npm install -D @srivarsank/glide
```

### 2. Add the plugin

The export is `glideSourceStamping`, from `@srivarsank/glide/vite-plugin`. Add it to the existing
plugin list; do not replace the framework plugin.

```ts
// vite.config.ts — React, Vue, Svelte, or plain HTML
import { glideSourceStamping } from '@srivarsank/glide/vite-plugin';

export default defineConfig({
  plugins: [/* the plugins already here, such as react(), vue() or svelte() */ glideSourceStamping()],
});
```

```js
// astro.config.mjs — Astro takes Vite plugins under `vite`
import { glideSourceStamping } from '@srivarsank/glide/vite-plugin';

export default defineConfig({
  vite: { plugins: [glideSourceStamping()] },
});
```

The plugin does nothing in a production build: no stamps and no editor are in the output.

### 3. Ignore the generated file

Glide writes a component index in the project root. Add it to `.gitignore`:

```gitignore
glide-components.json
```

### 4. Start and open the editor

Start the dev server as usual (`npm run dev`). The terminal prints a line like:

```
[Glide] Editor: http://127.0.0.1:5173/__glide/
```

Tell the user to open that address. Use the address as printed: the editor runs on `127.0.0.1` and
the app stays on `localhost`. The two are different origins for the browser, which keeps scripts in
the app away from the editor. `http://localhost:5173/__glide/` redirects there.

### 5. Check that it works

Ask the user to click an element in the preview. A working setup shows a selection outline and an
active properties panel, and a change in the panel changes the source file.

## Optional

- **Skills for AI agents.** `npx @srivarsank/glide install-skills` copies the Glide skills into
  `.agents/skills/`, and into `.claude/skills/` when the project uses Claude Code. Add
  `--agent claude`, `--agent agents` or `--agent all` to choose. Nothing is installed unless this
  command is run.
- **The separate command.** `npx @srivarsank/glide` starts the editor on its own port
  (`http://localhost:7777`) and shows the app through a proxy. With no port argument it looks for
  the dev server on the common ports; `npx @srivarsank/glide 4321` names one. Use this when the
  editor cannot be served from the dev server. Pass `glideSourceStamping({ editor: false })` to
  turn off the editor at `/__glide/` and keep only the stamps.
- **Settings.** `glide.config.json` in the project root can set `port` (the separate command's
  port), `targetPort`, and `defaultViewport: { "width": 1440, "height": 1024 }`.

## What works after setup

| File type | Class, inline style, text, drag and resize | Insert, delete, move, group |
|:---|:---|:---|
| JSX / TSX | Yes | Yes |
| Vue, Svelte, Astro | Yes | No |
| HTML | Yes, in projects with no UI framework | No |

## When it does not work

| The user sees | Cause | Fix |
|:---|:---|:---|
| No `[Glide] Editor:` line in the terminal | The plugin is not in the config that the dev server uses | Check the import and the plugin list; restart the dev server |
| Elements select, but the properties panel is inactive | No source stamps | Same as above. A dev server that was already running must be restarted |
| "Could not reach dev server" at port 7777 | The separate command points at the wrong port | Type the app's address in the editor's URL field and press Enter, or restart with the port as argument |
| The editor says "Disconnected" | It was opened from a host that is not allowed | Open the printed address. Other hosts need `remoteAccess` in `glide.config.json` |
| A Svelte or Astro page fails to compile after the plugin was added | An old Glide version stamped tags that it must not | Update `@srivarsank/glide` |
| A save gives `UNSUPPORTED_OPERATION` | Glide cannot make that edit exactly | Not a setup problem. See the `glide` skill |

A script checks the basic setup and prints what is missing:

```bash
node <glide skill folder>/scripts/verify-setup.mjs
```
