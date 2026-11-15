---
name: glide
description: >
  How to change UI in a project that uses the Glide visual editor (@srivarsank/glide), and how to
  explain what Glide did. Use this skill whenever the project has `glideSourceStamping` in its Vite
  or Astro config, a `glide-components.json` file, or `data-gl-source` attributes; whenever the user
  mentions Glide, the visual editor, the canvas, `/__glide/`, or port 7777; and whenever the user asks
  why a Glide edit was refused (`UNSUPPORTED_OPERATION`, `STALE_DIGEST`, `STALE_NODE`) or why an
  element cannot be selected or edited. Also use it before you edit JSX, Vue, Svelte, Astro or HTML
  markup in such a project, so that your edits and the user's canvas edits do not conflict.
---

# Glide

Glide is a visual editor that runs next to the dev server. The user selects an element on a live
preview of the app, changes it, and Glide writes the change into the source file. There is no
second copy of the design: the source file is the only record.

You do not drive the canvas. You edit source files, and Glide watches the project and updates the
canvas. So your job in a Glide project is to (1) find the right element fast, (2) edit it in a way
that Glide and the user can keep working with, and (3) explain Glide's behavior when the user asks.

## Find the element

Do not guess file paths. If `glide-components.json` is in the project root, it lists every
component with its file and its elements, each with a line and column.

```bash
node <this skill folder>/scripts/query-components.mjs --list          # all components
node <this skill folder>/scripts/query-components.mjs --name Card     # one component, as JSON
```

In each component, the element with `isRoot: true` is the outer wrapper: use it for background,
outer padding and size. A capitalized `tagName` (`<UserAvatar>`) is another component; look up its
own entry to change what it renders. For the file format and edge cases, read the
`glide-component-segregator` skill.

If the file is missing, Glide is not running. Read the source files directly; do not create the
file by hand, because Glide overwrites it.

## Edit so that Glide can keep working

The user may have the editor open while you work. Four rules keep your edits and theirs compatible.

**Change one thing, keep the rest.** For a Tailwind change, replace only the class for that
property and keep the others. `md:`, `hover:` and similar classes are separate decisions the user
made; an edit to the base padding must not remove `md:p-8`. Keep arbitrary values such as
`w-[420px]`, and prefer the project's theme tokens over raw values. Details and the prefix table:
[references/tailwind-rewriting.md](references/tailwind-rewriting.md).

**Keep static things static.** Glide can only save an edit when it can point at one literal in the
source. If you turn `class="p-4"` into a computed value, the user can no longer edit that element
on the canvas. Use a dynamic class only where the behavior needs it.

**Leave the pasteboard alone.** A block like
`{false && <div data-gl-workspace-id="..." data-gl-workspace-x="..." ...>}` is an element the user
moved off the page to keep for later. It never renders. Do not delete it as dead code.

**Expect a conflict after you write.** Each canvas edit carries a digest of the file. If you change
a file after the user selected an element in it, their next save is refused with `STALE_DIGEST` and
nothing is written. This is the safety working. Tell the user to select the element again.

## What Glide can save

| File type | Class, inline style, text, drag and resize | Insert, delete, move, group |
|:---|:---|:---|
| JSX / TSX | Yes | Yes |
| Vue, Svelte, Astro | Yes | No |
| HTML | Yes, in projects with no UI framework | No |

Glide refuses an edit that it cannot make exactly, and says why. This is intended: a wrong guess in
source code is worse than a refusal. The common causes:

- The class or style is computed: `:class`, `class={...}`, `class:list`, a `{...spread}`.
- The text has an expression (`{count}`, `{{ count }}`) or child elements.
- A condition, or a `cva` definition that other code also uses, would override the new class.
- The element is a component (`<Card>`) in a Vue, Svelte or Astro template.
- The element was added by a script at runtime, so it has no source position.

When the user reports a refusal, read the message, find the cause in the source, and offer the
source edit that does what they wanted. The limits for each file type are in
[references/framework-adapters.md](references/framework-adapters.md).

## When something does not work

| The user sees | Likely cause | What to do |
|:---|:---|:---|
| Elements select, but the properties panel is inactive | No source stamps | Add `glideSourceStamping()` to the Vite config and restart the dev server (see the `glide-setup` skill) |
| "Could not reach dev server" on port 7777 | The `glide` command points at the wrong port | Type the app's address in the editor's URL field, or start with `npx @srivarsank/glide <port>` |
| `STALE_DIGEST` or `STALE_NODE` | The file changed after selection | Select the element again |
| `UNSUPPORTED_OPERATION` | See the list above | Edit in source |
| Editor says "Disconnected" | Opened from a host that is not allowed | Use the address in the `[Glide] Editor:` line of the terminal |

## Reference files

Read these only when the task needs them.

| File | Read it when |
|:---|:---|
| [references/framework-adapters.md](references/framework-adapters.md) | You need the exact support and refusal rules for one file type |
| [references/tailwind-rewriting.md](references/tailwind-rewriting.md) | You change Tailwind classes, scoped variants, or `cn` / `cva` expressions |
| [references/staged-edits.md](references/staged-edits.md) | The user asks about Instant and Staged mode, or how a drag is saved |
| [references/architecture.md](references/architecture.md) | You debug Glide itself: transactions, the file watcher, the socket messages |
