# D7: Root AGENTS.md, GLOSSARY.md and an unused-code check

Status: **todo** · Size: S · Depends on: — (can be pulled forward at any point) · Branch: `chore/d7-agent-docs`

## Goal

Every coding agent that opens the repository finds the same rules, commands and vocabulary in one
place, and CI catches dead code. Onlook keeps a root `AGENTS.md`, a `CLAUDE.md` that is only
`@AGENTS.md`, and a `GLOSSARY.md` where each noun means one thing.

## Current state (verified 2026-11-28)

- **The rules are in three places, none at the root.**
  - `.agents/AGENTS.md` (121 lines): commit discipline and visual-editing guardrails.
  - `.github/copilot-instructions.md` (43 lines) and `.github/instructions/*.instructions.md`: review
    guidance.
  - The roadmap README: ground rules, Verify and Gotchas.
- **No root `AGENTS.md` or `CLAUDE.md`.** Claude Code reads only `CLAUDE.md`, so it sees none of this
  unless a session opens the files.
- **Secrets are covered.** GitHub secret scanning and push protection are on for the repository.
  "Non-provider patterns" (generic secrets such as private keys) is off; it is one settings toggle.
- **CI** runs the build, typecheck, tests, `test:artifact`, and the Playwright consumer and hosted
  checks. It has no lint or unused-code check.

## Design

- **`AGENTS.md`** (root): what Glide is (two lines), the commands (`npm test`, `npm run typecheck`,
  `npm run build && npm run test:artifact`, `test:consumer`, `test:hosted`, `verify:release`), the
  package layout, then the roadmap README's Ground rules, Verify and Gotchas, moved here. The roadmap
  README keeps a one-line link in their place. Link to `.agents/AGENTS.md` for commit discipline, and
  to `CONTRIBUTING.md`.
- **`CLAUDE.md`** (root): the single line `@AGENTS.md`.
- **`GLOSSARY.md`** (root), one meaning per term, with the code name where it differs:
  - **stamp**: the `data-gl-source="path:line:col"` attribute
  - **source reference**: a parsed stamp, `SourceReference`
  - **node hash** and **digest**: `STALE_NODE` and `STALE_DIGEST`
  - **transaction**
  - **structural change**
  - **Style format**: Auto, Tailwind or Inline
  - **edit scope**: `MutationScope`
  - **Instant** and **Staged**
  - **pasteboard**
  - **frame**: an element drawn with the Frame tool. It is never the app's iframe, which is the
    **preview**
  - **bridge**
  - **editor**
  - **attached mode**: the editor the Vite plugin serves at `/__glide/`, `hosted` in code. Its opposite
    is **standalone mode** (`npx @srivarsank/glide`, through a proxy)
  - **branch mode**
  - **registry**: `glide-components.json`
  - **skills**: `glide`, `glide-component-segregator`, `glide-setup`
  - **MCP bridge**
  - **agent badge**
  - **refusal**: `CODE: message`, file unchanged
- **knip** as a dev dependency, with a `knip.json` that names the npm workspaces (`packages/*`,
  `packages/adapters/*`) and the entry points: each package's `src/index.ts`, the root `src/`, and
  `scripts/`. Code that `editor-html.ts` injects with `${fn.toString()}` is referenced normally, so it
  won't be flagged; check that on the first run.

## Steps

- [ ] D7a: `AGENTS.md` and `CLAUDE.md`, and the pointer in the roadmap README
- [ ] D7b: `GLOSSARY.md`, checking each definition against the code
- [ ] D7c: run `npx knip`, then fix or ignore each finding with a reason
- [ ] D7d: add knip to CI after the build step, and an `npm run knip` script
- [ ] D7e (settings, no code): turn on secret scanning's non-provider patterns

## Tests

None beyond CI: knip passing is the check. Read `AGENTS.md` once in a fresh Claude Code session and
confirm it loads through `CLAUDE.md`.

## Done when

A fresh Claude Code session in the repository knows the ground rules and the verify commands without
being pointed at the roadmap, and CI fails on an unused export.

## Out of scope

Moving review guidance out of `.github/copilot-instructions.md` (Copilot reads it there), and adding a
linter. Both are worth their own decision.
