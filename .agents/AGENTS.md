# Workspace Rules: Glide

## Atomic Commits & Version Control Discipline

You must produce atomic commits where each commit represents exactly one logical change, is independently deployable, and leaves the codebase in a working state.

### Core Principles
- **Atomicity**: One commit = one logical unit of work.
- **Independence**: Every commit must compile, pass tests, and be revertable without breaking unrelated functionality.
- **Intentionality**: The commit message describes *why*, not *what*.

### Commit Message Format
```
<type>(<scope>): <imperative summary under 72 chars>

<body — required if change needs context, wrapped at 72 chars>
Explain WHY this change is necessary. What problem does it solve?
What was the previous behavior and why was it wrong or insufficient?

<footer — optional>
Refs: #123
BREAKING CHANGE: <description>
```
- **Types**: feat | fix | refactor | perf | test | docs | style | build | ci | chore
- **Scope**: the module, component, or domain affected (e.g., auth, parser, api/users)
- **Summary**: imperative mood ("add", "fix", "remove" — not "added", "fixes", "removing")

### Decomposition Rules
Before writing any code, decompose the work. When given a task, you MUST:
1. **Identify all logical units** — list every distinct concern the task touches.
2. **Order them by dependency** — foundational changes first.
3. **Assign one commit per unit** — if a commit touches unrelated files, it is not atomic.
4. **Declare the plan** — output the proposed commit sequence before writing code.

### Output Format for Code Tasks
When producing code changes, always structure your output as:
---
**Commit 1 of N** — `type(scope): summary`
*Rationale*: [one sentence on why this change is isolated here]
[file changes]
---
**Commit 2 of N** — `type(scope): summary`
...
Never output all changes in one block and leave sequencing to the user.

### Hard Rules
- Never mix refactoring with feature work in one commit. Refactor first, then build.
- Never commit commented-out code, debug statements, or temporary scaffolding.
- Never bundle a bug fix with a feature.
- Never let formatting/whitespace changes share a commit with logic changes.
- Test commits are siblings, not children.
- Never use "WIP", "misc", "cleanup", "various fixes", or "updates" as commit messages.

---

## CST & Visual Editing Guardrails (Figma-style changes)

### 1. Never assume — always verify against the actual codebase
- Before writing or modifying any function, open and read the actual file first. Do not recall or guess its contents from earlier in the conversation if it's been more than a few turns — re-read it.
- Before claiming a library function, method, or API exists (Babel, recast, tree-sitter, @vue/compiler-sfc, svelte-eslint-parser, etc.), state which package and version you're assuming, and flag if you haven't confirmed it against that package's actual docs/types in this session.
- If you did not read a file or doc in this conversation, say "I haven't verified this against the source" rather than presenting it as fact.
- Never invent a node type, AST/CST field name, or parser method name. If unsure whether e.g. a JSXOpeningElement has an `attributes` array vs `attrs`, say so explicitly and ask to check the actual parser's type definitions.

### 2. Ground every claim in a specific, checkable location
- When describing how existing code behaves, cite the exact file path and function/line. "The resize handler probably does X" is not acceptable — either confirm it by reading the file, or say you don't know.
- When proposing a new function, state exactly which existing function/module it will be called from, and confirm that call site exists.

### 3. Feature-specific guardrails

#### Resizing (instant + fluid)
- Do not assume the current data model for element dimensions (px vs %, flex vs absolute) — confirm it from the actual CST/node structure before writing resize logic.
- "Instant" resize (drag-commit) and "fluid" resize (live drag) are different code paths with different perf constraints. Don't conflate them — fluid resize must not trigger full CST reparse/write on every frame; confirm what throttling/debouncing mechanism (if any) already exists before adding one.
- Never claim a resize edit "preserves formatting" unless you've traced the exact CST mutation path and confirmed only the target token changes.

#### Layer rearrangement (merge, push on top, push behind)
- "Merge" is ambiguous — confirm with me what it means in Glide's data model (combining two elements into one? grouping into a wrapper?) before writing code. Do not silently assume a definition.
- z-order changes ("push on top"/"push behind") may map to sibling reordering in the CST *or* a z-index/style property, depending on layout mode. State which one you're implementing and why, don't default to one silently.
- Confirm how layer order is currently represented (DOM order vs explicit z-index vs a separate layer list) before writing reorder logic.

#### Colour changing (instant)
- Confirm whether colors are stored as inline style, CSS var, Tailwind class, or theme token before writing the mutation — these require different CST patch strategies. Do not assume inline style is the only case.
- "Instant" implies no debounce before disk write — confirm this doesn't conflict with existing throttling for rapid color-picker drag events.

#### Text — font change, resize
- Confirm whether font-family/size are set via inline style, className, or a design-token reference before implementing. Don't assume one uniformly across React/Vue/Svelte adapters — check each.
- Text resize may interact with autolayout/flex sizing — confirm current behavior before assuming a fixed-size text box model.

### 4. When uncertain
- If a requirement is ambiguous (e.g., "merge" layers), ask a clarifying question rather than picking an interpretation and proceeding.
- If you can't verify something (file not shown, package not inspected), say so plainly: "I haven't seen X, so I'm assuming Y — please confirm."
- Prefer "I don't know, let's check" over a plausible-sounding guess.

### 5. Before presenting code as done
- State which files you actually read this session to write this code.
- State any assumption you made that wasn't verified.
- If proposing a CST mutation, state exactly which node type/field you're targeting and how you confirmed that's the correct target.

## Design Context (from PRODUCT.md)

- **Register**: `product` (visual editor UI).
- **Users**: Frontend developers and UI designers editing React/Vue/Svelte apps visually and writing directly to source code.
- **Brand Personality**: Editorial, confident, playful yet precise (Figma-like monochrome frame + bold pastel blocks).
- **Design Principles**:
  1. *Source Code Integrity First*: AST transformations must be clean, minimal, and preserve developer formatting.
  2. *Predictable Precision*: Snapping, resizing, and dragging must behave exactly as predicted, using Kd-Trees and smart guides.
  3. *Clean Chrome, Rich Canvas*: The editor interface is a clear, high-contrast frame so the user's application stands out.
  4. *Unified Component Tree*: Locally resolve custom component definitions in parsed ASTs to render nested sub-components under their instantiation node, preventing duplicate floating root nodes in the layers panel.
- **Anti-references**: SaaS cliches (heavy shadows, gradient card borders, low-contrast gray text on tinted white surfaces).
- **Accessibility & Inclusion**: WCAG AA contrast (>= 4.5:1) for controls, distinct focus states, and support for reduced motion.

