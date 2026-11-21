# C1: MCP bridge, step 1: read tools and safe edits

Status: todo · Size: L · Depends on: F0 (independent of A and B; can be pulled forward) · Branch: `feat/c1-mcp`

## Goal

A coding agent can see what the user selected on the canvas, read exact source and computed styles,
and make edits through Glide's safe write path (digests, history, Tailwind-aware classes) instead
of editing files blindly. Background: `paper-re/GLIDE-BLUEPRINT.md` (Paper's design, mapped onto Glide).

## Design

- **The server.** Add a Streamable HTTP route at `/mcp` where `GlideServer` handles HTTP requests
  (`packages/server/src/ws-server.ts`), using `@modelcontextprotocol/sdk`. This is a new runtime
  dependency, so add it to the root `package.json`.
- **Security,** which goes further than Paper's default:
  - reuse `trustedRequest()` from `session-security.ts` (Host and Origin checks)
  - refuse requests that carry an `Origin` header
  - require `Authorization: Bearer <token>`, where the token is random per run and written with the
    port to `<project>/node_modules/.cache/glide/mcp.json` (readable only by the user)
- **The CLI bridge,** `glide mcp` in `packages/cli/src/index.ts`:
  - forwards stdio to HTTP
  - reads the run file from `--project <dir>` or the current directory
  - when Glide isn't running, still answers `initialize` and `tools/list` from a tool list bundled in
    the package; tool calls then return "Start Glide and open the editor"
- **Tools in v1:**
  - `get_project_info`: `detectProjectMeta`, the Tailwind version and tokens, the entry file, and the
    routes once B5 exists
  - `get_selection`: asks the editor
  - `get_tree`: `buildComponentTree` / `glide-components.json`
  - `get_node`: tag, classes and props, via `inspectJSXProps`
  - `get_source`: the exact source slice
  - `get_computed_styles`: asks the editor
  - `update_styles`: `class`/`multi-class` edits that follow the Style format, breakpoint and state
  - `set_text`
  - `delete_nodes`
- **Talking to the editor.** A new pair of WebSocket messages, `agent-query` and `agent-query-result`
  with an id. The editor answers DOM questions through its existing `frameAsk()`. With no editor
  open, DOM tools return "Open the Glide editor so the agent can see the live page".
- **Result header.** Every result starts with `{ file, digest }`. Write tools accept an optional
  `expectedDigest` and refuse with `STALE_DIGEST: re-read with get_node and retry`.
- **Agent config in v1:** `glide mcp install --agent claude` writes the project's `.mcp.json`
  (a project-scoped Claude Code config) instead of editing the user's global config. Other agents
  are in C5.

## Steps

- [ ] C1a: the `/mcp` route, token run file and security tests (extend `src/__tests__/server-security.test.ts`)
- [ ] C1b: the source-level read tools, tested against `MutationService` fixtures
- [ ] C1c: the editor round trip, then `get_selection` and `get_computed_styles`
- [ ] C1d: the write tools through `MutationService.execute`, with the digest checks
- [ ] C1e: the `glide mcp` bridge, the static tool list, and `glide mcp install --agent claude`
- [ ] C1f: update `skills/glide/SKILL.md` to prefer these tools when they're available

## Done when

In Claude Code, an agent asked to "make the selected button blue" reads the selection, edits through
Glide, and the canvas updates. A stale file is refused with a message the agent can act on.
