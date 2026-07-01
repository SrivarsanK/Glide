# Phase 12 Research: Next.js/Nuxt/Astro Adapters & VS Code Extension

Research and design details for framework detection metadata and editor integration.

## 1. Project Framework Detection

Meta-frameworks (Next.js, Nuxt, Astro) structure projects using standard conventions, but package dependencies defined in `package.json` are the most reliable way to identify project types.
Our detection algorithm:
1. Locates `package.json` at the project root.
2. Combines `dependencies` and `devDependencies` lists.
3. Looks up signatures:
   - `next` -> Next.js meta-framework wrapper around React.
   - `nuxt` -> Nuxt meta-framework wrapper around Vue.
   - `astro` -> Astro static/server renderer.
   - `svelte` / `@sveltejs/kit` -> Svelte component or kit setup.
4. Identifies if the project uses a custom nested `src` directory or root-level directory for source codes.

## 2. Editor Settings Companion File

To let Glide connect with VS Code for easy file open actions and stamp on save triggers:
- Create workspace configurations under the `.vscode/` directory.
- Generate `.vscode/settings.json` specifying Glide configurations:
  - `"glide.enabled": true`
  - `"glide.editor.port": 4321`
  - `"glide.stampOnSave": true`
