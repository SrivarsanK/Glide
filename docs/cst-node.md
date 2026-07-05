# Glide Feature Implementation — Anti-Hallucination Rules

You are implementing features in Glide, a code-native visual editor that writes
edits back to source files via AST/CST manipulation (React/TSX, Vue SFC, Svelte).
Precision matters more than speed: a wrong CST mutation corrupts a user's real
source file. Follow these rules without exception.

## 1. Never assume — always verify against the actual codebase
- Before writing or modifying any function, open and read the actual file first.
  Do not recall or guess its contents from earlier in the conversation if it's
  been more than a few turns — re-read it.
- Before claiming a library function, method, or API exists (Babel, recast,
  tree-sitter, @vue/compiler-sfc, svelte-eslint-parser, etc.), state which
  package and version you're assuming, and flag if you haven't confirmed it
  against that package's actual docs/types in this session.
- If you did not read a file or doc in this conversation, say
  "I haven't verified this against the source" rather than presenting it as fact.
- Never invent a node type, AST/CST field name, or parser method name. If unsure
  whether e.g. a JSXOpeningElement has an `attributes` array vs `attrs`, say so
  explicitly and ask to check the actual parser's type definitions.

## 2. Ground every claim in a specific, checkable location
- When describing how existing code behaves, cite the exact file path and
  function/line. "The resize handler probably does X" is not acceptable —
  either confirm it by reading the file, or say you don't know.
- When proposing a new function, state exactly which existing function/module
  it will be called from, and confirm that call site exists.

## 3. Feature-specific guardrails

### Resizing (instant + fluid)
- Do not assume the current data model for element dimensions (px vs %, flex
  vs absolute) — confirm it from the actual CST/node structure before writing
  resize logic.
- "Instant" resize (drag-commit) and "fluid" resize (live drag) are different
  code paths with different perf constraints. Don't conflate them — fluid
  resize must not trigger full CST reparse/write on every frame; confirm what
  throttling/debouncing mechanism (if any) already exists before adding one.
- Never claim a resize edit "preserves formatting" unless you've traced the
  exact CST mutation path and confirmed only the target token changes.

### Layer rearrangement (merge, push on top, push behind)
- "Merge" is ambiguous — confirm with me what it means in Glide's data model
  (combining two elements into one? grouping into a wrapper?) before writing
  code. Do not silently assume a definition.
- z-order changes ("push on top"/"push behind") may map to sibling reordering
  in the CST *or* a z-index/style property, depending on layout mode. State
  which one you're implementing and why, don't default to one silently.
- Confirm how layer order is currently represented (DOM order vs explicit
  z-index vs a separate layer list) before writing reorder logic.

### Colour changing (instant)
- Confirm whether colors are stored as inline style, CSS var, Tailwind class,
  or theme token before writing the mutation — these require different CST
  patch strategies. Do not assume inline style is the only case.
- "Instant" implies no debounce before disk write — confirm this doesn't
  conflict with existing throttling for rapid color-picker drag events.

### Text — font change, resize
- Confirm whether font-family/size are set via inline style, className, or a
  design-token reference before implementing. Don't assume one uniformly
  across React/Vue/Svelte adapters — check each.
- Text resize may interact with autolayout/flex sizing — confirm current
  behavior before assuming a fixed-size text box model.

### Advanced properties (later)
- Do not pre-build scaffolding for "advanced properties" speculatively unless
  asked. Flag where you're leaving intentional extension points instead of
  guessing at future requirements.

## 4. When uncertain
- If a requirement is ambiguous (e.g., "merge" layers), ask a clarifying
  question rather than picking an interpretation and proceeding.
- If you can't verify something (file not shown, package not inspected),
  say so plainly: "I haven't seen X, so I'm assuming Y — please confirm."
- Prefer "I don't know, let's check" over a plausible-sounding guess.

## 5. Before presenting code as done
- State which files you actually read this session to write this code.
- State any assumption you made that wasn't verified.
- If proposing a CST mutation, state exactly which node type/field you're
  targeting and how you confirmed that's the correct target.