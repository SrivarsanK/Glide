# D2: Requests pinned to elements, for agents

Status: **todo** · Size: M · Depends on: C1 (pairs well with D1) · Branch: `feat/d2-element-requests`

## Goal

The user points at an element, types what they want ("make this a two-column grid"), and their agent
picks the request up with everything it needs: the element's source reference, tag and classes. Today
the user has to switch to the terminal and describe the element in words. Onlook's main interaction is
the same idea: double-click an element, type, and the element rides along as a chip.

## Current state (verified 2026-11-28)

- **Comments are pinned to canvas coordinates, not to elements.** A comment is
  `{ id, x, y, author, text, timestamp }`, saved in the browser's `localStorage` under
  `glide_canvas_comments` (the comments code in `packages/overlay/src/editor-html.ts`).
- **The agent can already read editor state.** `get_selection` asks the editor through `agent-query`,
  and C5 shows an agent badge while an agent works.

## Design

- **A request is a comment with an element and a flag.** When a comment pin lands on a stamped element,
  store its source reference and tag with it. A "For the agent" toggle in the comment card marks it
  `kind: 'request'`. Pins that land on empty canvas stay plain comments.
- **Storage doesn't change.** Requests stay in `localStorage` with the other comments. No file in the
  project gets them, which keeps the ground rule that only source files hold design data.
- **`get_requests`** (MCP, read-only): the open requests, each with `id`, `text`, `author`, the time,
  the source reference, the tag and the current classes. The server asks the editor through
  `agent-query`. With no editor open, it says to open the editor.
- **`resolve_request`**: `{ id, note? }`. The editor marks the request done and shows the note in the
  comment thread, so the user can see what the agent did.
- **On the canvas:** a request's pin uses a different look from a comment, and turns into a check when
  resolved. A request whose element is gone (its source reference no longer matches) shows as
  detached and is still listed, with its last known reference.
- **Testable logic:** put anchoring and serialization in a small module injected with
  `${fn.toString()}`, as the README's Gotchas describe.

## Steps

- [ ] D2a: anchor comments to the element under the pin; old comments load unchanged
- [ ] D2b: the "For the agent" toggle and the request pin style
- [ ] D2c: `get_requests` and `resolve_request`, with the `agent-query` round trip
- [ ] D2d: `skills/glide/SKILL.md`: "do my Glide requests" means call `get_requests`, edit, then
  `resolve_request` with a one-line note

## Tests

- The comments module reads old comments (no source) and new ones, and keeps the anchor across a save.
- `get_requests` returns only open requests; `resolve_request` with an unknown id is refused.

## Done when

The user pins "make this blue" to a button. In Claude Code, "do my Glide requests" turns the button
blue through Glide, and the pin shows as resolved with the agent's note.

## Out of scope

Sharing requests between browsers or people (they live in one browser's storage, like comments), and
pushing a request into a running agent. MCP clients only act when the user prompts them.
