# Copilot instructions for Glide

Glide is a code-native visual design tool: people edit their React, Vue, Svelte, Astro or HTML app visually, and Glide writes each change back into their source files. The packages are `core`, `server`, `overlay` (the editor UI), `vite-plugin`, `babel-plugin`, `ast-writer`, `cli` and the framework `adapters`.

## Reviewing pull requests

Report real defects, not preferences. Precision matters more than the number of comments.

- **Critical and high** (bugs, security issues, data loss): always report.
- **Medium** (performance, gaps in error handling, maintainability): report with the context that makes it matter.
- **Low** (style, minor suggestions): report only when clearly worth it.
- Drop a finding you are not confident is real.
- Point to the exact line and describe the concrete input or state that goes wrong.
- When a change alters behavior that existing callers or users rely on (a removed option, a changed default, a different file written), say what happened before, what happens now and who is affected, even if the change is intended.

### General checklist

- **Correctness:** is the logic right, are boundary conditions handled, are errors handled?
- **Security:** injection, XSS, handling of sensitive data, missing permission checks.
- **Performance:** needless loops or repeated work, resources that are never released.
- **Maintainability:** clear names, and code that follows the existing structure of the package it is in.
- **Tests:** critical paths and boundary conditions have tests.

### What matters most in Glide

Glide runs on the developer's machine and rewrites their source, so these deserve the closest look:

- A web page or script that can send edits to the Glide server without the user's action.
- A request that can read or write a file outside the project folder.
- Any way to get the editor session token from another origin.
- An edit that loses or corrupts the user's code: formatting, comments or unrelated code changed by a write.

### Not defects in this codebase

- Inline `style` values: writing styles into the user's source is what Glide does.
- `var` and older JavaScript inside the browser scripts Glide injects as strings (`packages/vite-plugin/src/bridge.ts`, `packages/server/src/ws-server.ts`, `packages/overlay/src/editor-html.ts`).
- `innerHTML` that builds the editor's own static markup. Flag it when page- or user-controlled data reaches it unescaped, or reaches a URL attribute such as `href` or `src` without a check on its scheme: escaping does not stop a `javascript:` URL.

## Deeper local review

For a full review before opening a PR, run `/open-code-review-delegate` in GitHub Copilot CLI. It uses the `ocr` CLI (`npm install -g @alibaba-group/open-code-review`) to pick the files and the rules for each, and Copilot's own model to review them, so no API key is needed.

The review checklists here and in `.github/instructions/` are adapted (modified) from [alibaba/open-code-review](https://github.com/alibaba/open-code-review) v1.14.4, licensed under the [Apache License 2.0](https://github.com/alibaba/open-code-review/blob/main/LICENSE).
