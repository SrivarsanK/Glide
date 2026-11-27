# D1: Screenshot and inspect tools for agents

Status: **todo** · Size: S–M · Depends on: C1, C5 · Branch: `feat/d1-agent-screenshot`

## Goal

An agent that edits through Glide can look at the result: a picture of an element or the page, plus
the element's box and computed styles. Today it edits blind and has to ask the user how it looks.
Onlook's agent does this with `capture_frame` and `read_frame` after every change.

## Current state (verified 2026-11-28)

- **14 MCP tools, all text.** Definitions are in `packages/core/src/mcp-tools.ts`, and
  `packages/server/src/mcp.ts` only ever returns `type: 'text'` content.
- **The editor already answers agent questions.** The server sends `agent-query` and the editor replies
  with `agent-query-result` (`ws-server.ts`, `editor-html.ts`). That is how `get_selection` works.
- **Export already renders an element to PNG.** `triggerExport()` in `editor-html.ts` calls
  `frameAsk('export', { source })`. `exportData()` in `packages/core/src/frame-queries.ts` returns the
  markup, the CSS and the size, and the editor draws them through an SVG `foreignObject` onto a canvas.
- **Computed styles exist only for the selection.** `get_selection` returns them. C1 planned a
  `get_computed_styles` tool, but it was not built.

## Design

- **`capture_screenshot`.** Input: `{ source?, scale? }`. With no `source` it captures the visible page.
  The server asks the editor through `agent-query`. The editor runs the export path, but returns a
  base64 PNG instead of downloading it. The result is MCP `image` content (`data`, `mimeType`), then a
  text part with `{ file, label, width, height }`. Cap the long side at 1568 px, Claude's size limit
  before it resizes, and scale down when the capture is larger.
- **`inspect_element`.** Input: `{ source }`. Returns the element's box in page pixels, the computed
  styles `get_selection` already reports, and its child count. It reuses the selection code in
  `frame-queries.ts` for any stamped element, not only the selected one.
- **No editor open:** both tools return "Open the Glide editor so the agent can see the live page",
  as the other DOM tools do.
- **Refactor, don't copy.** Split `triggerExport()` so the rendering part (data → PNG blob) is one
  function used by both the download and the agent. Put it in a small module injected with
  `${fn.toString()}` (see Gotchas in the README) so it can be tested.

## Steps

- [ ] D1a: image content in `mcp.ts`, and the two tool definitions in `mcp-tools.ts` (the CLI's static
  tool list picks them up)
- [ ] D1b: move the export rendering into a module, and reuse it in `triggerExport()`
- [ ] D1c: `capture_screenshot` through `agent-query`, with the size cap
- [ ] D1d: `inspect_element`
- [ ] D1e: `skills/glide/SKILL.md`: after a visual edit, capture the element and check it

## Tests

- `mcp.ts` returns well-formed `image` content, and refuses when no editor is connected.
- The size cap scales a 3000 px capture down to 1568 px on its long side.
- An `agent-query` round trip with a fake editor socket returns the PNG, as `get_selection`'s test does.

## Done when

In Claude Code, an agent asked to "make the hero heading larger" edits it, calls `capture_screenshot`
on the heading, and describes what it sees.

## Out of scope

Pixel-perfect captures. The export path has known limits: cross-origin images taint the canvas, and
fonts that load from another origin may not render inside the SVG. The tool reports a failed capture
as text rather than returning a broken image.
