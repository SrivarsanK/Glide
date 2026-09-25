# Contributing to Glide

Welcome! Thank you for your interest in contributing to **Glide**. This guide provides everything you need to set up your environment, understand our architecture, write tests, and submit your contributions smoothly.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Architecture Overview](#architecture-overview)
3. [Local Development Setup](#local-development-setup)
4. [Available Scripts](#available-scripts)
5. [Pull Request & Commit Discipline](#pull-request--commit-discipline)
6. [Testing & Quality Standards](#testing--quality-standards)
7. [Dual Registry Publishing (Maintainers)](#dual-registry-publishing-maintainers)

---

## Code of Conduct

We expect all contributors to adhere to a respectful and inclusive environment. Please ensure all interactions are constructive, professional, and free of harassment.

---

## Architecture Overview

Glide is organized as an npm workspace monorepo where individual modular packages feed into the unified distribution bundle:

```
Glide/
├── packages/
│   ├── core/           # Core CST engine, Kd-Tree spatial index, snapping & guides
│   ├── ast-writer/     # AST/CST transformers (Babel & Recast for JSX, Vue, Svelte, Astro)
│   ├── overlay/        # In-browser editor chrome, selection canvas, inspector UI
│   ├── server/         # WebSocket bridge between canvas and local filesystem
│   ├── vite-plugin/    # Vite dev server plugin with hot module update coordination
│   ├── babel-plugin/   # Source-location attribute injector (data-glide-id)
│   ├── adapters/       # Framework adapters (React, Vue, Svelte runtime connectors)
│   └── cli/            # Command-line executable (`glide <port>`)
├── src/                # Root bundling & unified package entrypoints
├── skills/             # Bundled AI agent skills and architectural references
└── scripts/            # Build and single-package bundler scripts
```

### Core Invariants

1. **Source Code Integrity First**: AST transformations must be clean, minimal, and preserve developer formatting (indentation, line breaks, comment preservation).
2. **Predictable Precision**: Canvas snapping and resizing must behave deterministically using Kd-Trees and smart guides.
3. **Clean Chrome, Rich Canvas**: The editor frame is high-contrast and unobtrusive so the user's application stands out.

---

## Local Development Setup

### Prerequisites

- **Node.js**: `>=18.0.0`
- **npm**: `>=8.0.0`
- **Git**

### Step-by-Step Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/Glide.git
   cd Glide
   ```

2. **Install all dependencies:**
   ```bash
   npm install
   ```

3. **Verify the type definitions and build:**
   ```bash
   npm run typecheck
   npm run build
   ```

4. **Run the test suite:**
   ```bash
   npm test
   ```

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run build` | Builds unified distribution bundles in `dist/` with type definitions |
| `npm run typecheck` | Runs `tsc --noEmit` across all workspace packages without emitting files |
| `npm test` | Runs the full Vitest suite once (125+ tests) |
| `npm run test:watch` | Launches Vitest in interactive watch mode for TDD |
| `npm run dev` | Runs the single-package builder in development mode |
| `npm run publish:npm` | Publishes package to standard npm (`registry.npmjs.org`) with public access |
| `npm run publish:gpr` | Publishes package to GitHub Packages (`npm.pkg.github.com`) |
| `npm run publish:all` | Sequentially publishes to both npm and GitHub Packages |

---

## Pull Request & Commit Discipline

We practice strict **Atomic Commits** and **Conventional Commits**:

### Commit Message Format

```
<type>(<scope>): <imperative summary under 72 chars>

<optional body explaining WHY this change is necessary>
```

- **Types**: `feat` | `fix` | `refactor` | `perf` | `test` | `docs` | `style` | `build` | `ci` | `chore`
- **Scopes**: e.g., `core`, `ast-writer`, `overlay`, `server`, `vite-plugin`, `adapters`, `cli`, `repo`
- **Example**:
  ```
  feat(ast-writer): preserve multiline comments during JSX attribute update
  ```

### Pull Request Checklist

Before submitting a PR:
- [ ] Run `npm run typecheck` and ensure zero TypeScript errors.
- [ ] Run `npm test` and ensure all tests pass.
- [ ] Add unit tests in `src/__tests__/` or `packages/<pkg>/__tests__/` covering new behavior.
- [ ] Ensure your PR focuses on a single logical change (atomic).

---

## Testing & Quality Standards

- **Vitest**: Used as the test runner. Tests are colocated in `src/__tests__/` and package directories.
- **Strict TypeScript**: Never use `any` unless interacting with dynamic AST node dictionaries where specifically isolated.
- **No Format Pollution**: Do not mix formatting/whitespace changes with logic changes.

---

## Dual Registry Publishing (Maintainers)

Glide is published to both **npm** (`registry.npmjs.org`) and **GitHub Packages** (`npm.pkg.github.com`) under `@srivarsank/glide`.

### Automated Release via GitHub Actions

When a new version tag (e.g. `v1.0.48`) is pushed or a GitHub Release is created:
1. `.github/workflows/ci.yml` runs full validation (`typecheck`, `test`, `build`).
2. `.github/workflows/publish.yml` automatically triggers parallel jobs:
   - `publish-npm`: Publishes to public npm with provenance using `NPM_TOKEN`.
   - `publish-github`: Publishes to GitHub Packages using the repository `GITHUB_TOKEN`.

### Manual CLI Release

Maintainers can publish manually if needed:

```bash
# Publish to public npm
npm run publish:npm

# Publish to GitHub Packages (requires GITHUB_TOKEN or auth in ~/.npmrc)
npm run publish:gpr

# Or publish to both registries in one command
npm run publish:all
```
