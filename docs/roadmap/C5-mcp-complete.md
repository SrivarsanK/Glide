# C5: MCP bridge, steps 2–3: writes, presence, one-click setup

Status: **in review** (part 1: HTML tools, guide, project configs) · Size: L · Depends on: C1 · Branch: `feat/c5-mcp-tools`

## Step 2: more tools and agent presence

- [ ] **`insert_markup`.** JSX in the project's own dialect (Tailwind classes, not inline-style HTML).
  Parse it, require static markup, check tags and attributes against the A2/A3 allowlists, and
  insert it as structural changes.
- [x] **`duplicate_element`, `move_element`, `set_attribute` (A2), `retag` (A3) and `extract_component` (C2).**
  No separate `set_interaction`: links, targets and popovers are attributes, so `set_attribute` and
  `retag` with `attributes` cover B1/B2.
- [ ] **`get_screenshot`.** Decide the approach: draw the element to an image in the editor
  (approximate, no extra install), or use Playwright against the dev URL (exact, needs a browser).
  Start with the first.
- [ ] **`find_elements`,** by class, token or text, and **`get_tokens` / `set_tokens`,** which edit
  the Tailwind theme file.
- [ ] **Agent presence.** The editor outlines the elements an agent read or edited (reuse
  `packages/overlay/src/selection-feedback.ts`) and shows a "working" badge until the agent calls
  `finish_working`. The badge clears when the MCP session closes.
- [x] **`get_guide`.** Glide's own guide, built from `skills/glide/SKILL.md` and the interaction
  conventions. Write it in Glide's own words; don't copy Paper's guide text.

## Step 3: one-click setup and distribution

- [x] **Project-scoped configs** first (`glide mcp install --agent claude|cursor|vscode|all`). The two files use different keys:
  - VS Code `.vscode/mcp.json`: `{"servers":{"glide":{"type":"stdio","command":"npx","args":["-y","@srivarsank/glide","mcp"]}}}`
  - Cursor `.cursor/mcp.json`: `{"mcpServers":{"glide":{"command":"npx","args":["-y","@srivarsank/glide","mcp"]}}}`
- [ ] **Codex:** `codex mcp add glide -- npx -y @srivarsank/glide mcp`.
- [ ] **Copilot CLI, opencode, Antigravity:** only on request, because these edit user-level files.
  Preserve comments (JSONC), write atomically, and back the file up first.
- [ ] **Plugins:** a Claude Code plugin marketplace, a Cursor plugin, and a Claude Desktop `.mcpb`.
  Paper's MIT-licensed manifests at github.com/paper-design/agent-plugins show the file shapes.
- [ ] **"Ask agent to wire this"** in the Interactions panel, for logic Glide doesn't write. It copies
  a prompt with the element's source reference and the requested behavior.

## As built (2026-11-21)

- Part 1 on `feat/c5-mcp-tools`: six tools in `packages/core/src/mcp-tools.ts`, each mapped to an existing
  structural or attribute change in `packages/server/src/mcp.ts`, so they share the editor's checks and undo.
  `move_element` takes a parent and optional sibling plus `before`/`after`.
- `get_guide` is a short list of Glide's conventions (`MCP_GUIDE`), written fresh.
- Install merges into an existing config and refuses JSON with comments rather than dropping them.
- Left for part 2: `insert_markup`, `get_screenshot`, `find_elements`, tokens, presence, Codex, plugins.

## Done when

An agent can build a small section from scratch through Glide while the user watches, and setup for
each supported agent is one command.
