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
