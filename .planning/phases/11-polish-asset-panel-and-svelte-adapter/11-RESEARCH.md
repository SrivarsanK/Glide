# Phase 11 Research: Polish, Asset Panel & Svelte Adapter

Research and technical specifications for Svelte class mutations and local asset file storage.

## 1. Svelte SFC Template Class Transformer

Svelte Single File Components (SFCs) contain `<script>`, `<style>`, and HTML markup elements in a single file.
Like Vue, we can locate Svelte element tags carrying `data-cf-source` coordinates.
Since Svelte HTML template blocks do not require specialized range offset tracking (they live directly in the file alongside scripts and styles), we can run tag matches on the entire Svelte source file.
This translates to matching:
`<tagName ... data-cf-source="targetId" ... >`
And replacing the `class="..."` attribute values within the matched tag.

## 2. Asset Saving Pipeline

To support visual image uploads in design layouts:
1. When an image file is added/uploaded, copy it from its source path on the filesystem to the project's web-accessible assets folder (e.g. `public/assets/`).
2. Generate the relative web URL for the image (e.g. `/assets/image.png`) so it can be set as the `src` attribute of standard `<img>` tags in JSX/HTML.
3. Use Node's `fs` or `fs/promises` module to handle folder checks, directory creation, and file copying operations.
