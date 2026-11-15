---
name: glide-component-segregator
description: >
  How to read `glide-components.json`, the component index that the Glide visual editor writes, to
  find a component or element by name without searching the file tree. Use this skill whenever a
  project has `glide-components.json` and the user asks to change, find, restyle or inspect a
  component ("make the Card background darker", "where is the Header defined", "which components
  use this button"), and whenever you need the file, line and column of a UI element. Use it also
  when the registry looks wrong, empty or out of date.
---

# Glide component registry

Glide scans the project and writes `glide-components.json` in the project root. Each component is
one entry with its file and the elements it renders. Reading this file is faster and more exact
than a search through the source tree, because each element already has its line and column.

Glide writes the file when the editor server starts (the dev server with the Glide plugin, or the
`glide` command) and again within 300 ms of a source change. Treat it as read-only: Glide
overwrites manual changes.

## The file

```ts
interface ComponentRegistry {
  projectRoot: string;
  generatedAt: string;                 // ISO time of the last scan
  framework: 'react' | 'vue' | 'svelte' | 'astro' | 'html' | 'unknown';
  buckets: ComponentBucket[];          // one per component
}

interface ComponentBucket {
  name: string;                        // "Card", "Header"; "Anonymous" for an unnamed default export
  file: string;                        // absolute path
  exportType: 'default' | 'named' | 'anonymous' | 'sfc' | 'html';
  line: number;                        // where the component is declared
  column: number;
  elements: RegistryElement[];
  cssFiles: string[];                  // stylesheets next to the file with the same name
}

interface RegistryElement {
  id: string;                          // "file:line:col", the same value as the element's data-gl-source
  tagName: string;                     // "div", "button", or a component such as "Card.Header"
  line: number;
  column: number;
  isRoot: boolean;                     // the outer element that the component returns
  classNames: string[];                // static classes only; empty when the class is computed
  text?: string;                       // the first 25 characters of direct text
}
```

## How to use it

A script in the `glide` skill prints the parts you need, so you do not have to load the whole file:

```bash
node <glide skill folder>/scripts/query-components.mjs --list
node <glide skill folder>/scripts/query-components.mjs --name Card
```

Or read the JSON directly. Then:

1. **Find the component** by `name`. Go to `bucket.file` at `bucket.line`.
2. **Pick the element.**
   - For background, outer padding or size, use the element with `isRoot: true`.
   - For a part inside, match on `tagName`, `classNames` or `text`.
3. **Edit at `element.line` and `element.column`** in `bucket.file`. That position is the `<` of the
   opening tag.
4. **For a CSS Modules component**, the styles are in `bucket.cssFiles[0]`, not in the markup.
5. **For a capitalized `tagName`** (`<Button>`), the element is another component. To change what it
   renders, find the entry with that name. To change only this one use of it, edit here.

After you add or rename a component, wait a moment and read the file again; the scan runs 300 ms
after the change.

## Limits to keep in mind

- **Static classes only.** `classNames` is empty for a computed class (`cn(...)`, `:class`). Empty
  does not mean the element has no classes; read the source.
- **Several components can share a name** in different files. Check `file` before you edit.
- **Template files** (`.vue`, `.svelte`, `.astro`) have one entry per file, with `exportType: 'sfc'`.
- **Folders that are skipped:** `node_modules`, `dist`, `build`, `.next`, `.nuxt`, `coverage`, and
  test folders.

## When the file is missing or wrong

| Problem | Cause | What to do |
|:---|:---|:---|
| No `glide-components.json` | Glide has not run in this project | Start the dev server (with the Glide plugin) or run `npx @srivarsank/glide`. Until then, read the source files |
| A new component is not listed | The scan runs 300 ms after a change, and only while Glide runs | Read the file again; check `generatedAt` |
| A component has no elements | The file did not parse, or it returns no markup | Open the file and check it for a syntax error |
| The user's canvas edit was refused after your change | You changed a file they had selected | Normal. Tell them to select the element again |
