# Contributing to Glide

Welcome! Thank you for your interest in contributing to Glide. Setting up healthy guidelines helps ensure a smooth process for everyone.

Please review this document before submitting your first pull request or opening an issue.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [How Can I Contribute?](#how-can-i-contribute)
   - [Reporting Bugs](#reporting-bugs)
   - [Suggesting Enhancements](#suggesting-enhancements)
   - [Submitting Pull Requests](#submitting-pull-requests)
3. [Local Development Setup](#local-development-setup)
4. [Pull Request Guidelines](#pull-request-guidelines)
5. [Style Guide](#style-guide)

---

## Code of Conduct

We expect all contributors to adhere to a respectful and inclusive environment. Please ensure all interactions are constructive, professional, and free of harassment.

---

## How Can I Contribute?

### Reporting Bugs

If you find a bug, please open a GitHub Issue with the following details:
* A clear, descriptive title.
* Numbered steps to reproduce the issue.
* Expected vs. actual behavior.
* Environment details (Node.js version, OS, browser, target framework).

### Suggesting Enhancements

We welcome suggestions for new features! To request an enhancement:
* Search existing issues to ensure it hasn't been suggested already.
* Explain the problem Glide does not currently solve, and why your proposed feature is a good solution.

### Submitting Pull Requests

1. Fork the repository and create your branch from `main`.
2. Follow the [Local Development Setup](#local-development-setup) to install dependencies and verify the build.
3. Add tests for any new logic or bug fixes.
4. Ensure all tests pass before submitting.
5. Keep pull requests focused on a single logical change.

---

## Local Development Setup

To get Glide running locally, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/glide.git
   cd glide
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the compiler and server:**
   ```bash
   npm run build
   ```

4. **Run TypeScript compiler in watch mode (optional):**
   ```bash
   npm run dev
   ```

5. **Run the Vitest unit tests:**
   ```bash
   npm test
   ```

---

## Pull Request Guidelines

* **Testing:** All pull requests must pass the existing Vitest test suite (`npm test`). If you write new code, please add corresponding unit tests in `src/__tests__/`.
* **Branch Naming:** Use descriptive branch names (e.g., `fix/snapping-offset` or `feat/layers-menu`).
* **Commit Messages:** Write clear, concise commit messages. Prefer conventional commit formats (e.g., `feat(canvas): ...` or `fix(compiler): ...`).
* **Documentation:** If you change user-facing behavior, please update the `README.md` or files inside the `docs/` directory accordingly.

---

## Style Guide

* **TypeScript:** Write type-safe code using the strict configuration defined in `tsconfig.json`.
* **ES Modules (ESM):** We use `"type": "module"`. When importing other local modules, always specify the file extension (e.g., `import { snapToGrid } from './snap.js';`).
* **AST Preservation:** When editing AST transformers in `src/writer.ts` or framework helpers, prioritize preserving user code formatting (indentation, line breaks, comments).
