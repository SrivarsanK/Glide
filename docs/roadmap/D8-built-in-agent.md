# D8: Decide whether to build an agent into the editor

Status: **todo** (a decision, not a build) · Size: — · Depends on: D1, D2 · Branch: none

## The question

Should Glide's editor host a chat with a coding agent, as Onlook 2.0 does? Or should it stay as it is
now: the user's own agent (Claude Code, Cursor, VS Code) drives Glide through the MCP bridge?

## Context

- **Onlook 2.0** hosts the user's agent inside the app. Its harness is the Claude Agent SDK or Codex's
  app-server, it has a project chat and an inline chat on an element, and it registers its own MCP
  tools. That host is about 84 files (`apps/studio/src/main/agent-host/` in onlook-dev/onlook).
- **Glide today.** Agents reach Glide through the MCP bridge (C1, C5), and their edits go through the
  same checked transactions and undo as the editor's. D1 lets them see the page; D2 lets the user hand
  them an element.
- **A constraint.** Anthropic's Agent SDK overview (https://code.claude.com/docs/en/agent-sdk/overview,
  read 2026-11-28) says: "Unless previously approved, Anthropic does not allow third party developers to
  offer claude.ai login or rate limits for their products, including agents built on the Claude Agent
  SDK. Use the API key authentication methods described in the Quickstart instead."

## Options

1. **Stay MCP-only.** Keep improving the hand-off (D1, D2). No new subsystem and no model costs, and it
   works with whatever agent the user already runs.
2. **Built-in chat on the Claude Agent SDK, using the user's own API key.** It runs in Glide's Node
   server and registers the MCP tools in-process. Users pay per token on their API account, not
   through their Claude subscription.
3. **Ask Anthropic for approval to offer claude.ai login.** This is what would let users chat on their
   subscription, as Onlook advertises.
4. **Codex's app-server (ChatGPT login).** Check OpenAI's terms for third-party apps first, the same
   way.

## How to decide

- **Demand.** Do users ask for chat inside the editor, in issues or feedback, after D1 and D2 ship?
- **Cost to users.** Will users accept paying per token with an API key, when their agent already runs
  on a subscription they pay for?
- **Maintenance.** Who maintains a harness, and possibly two?
- **Security.** An agent with shell access would be started by a dev dependency.
- **Fit.** "Clean chrome, rich canvas" (`PRODUCT.md`): a chat panel competes with the canvas for room.

## Recommendation (default until revisited)

Option 1. Revisit when D1 and D2 have shipped and users ask for in-editor chat. If that happens,
prototype option 2 behind a flag and write it up as a new spec.

## Done when

The decision, its date and its reasons are recorded below, and the status board row says `done`.

## Decision

_Not decided yet._
