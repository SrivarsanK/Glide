# Phase 9 Research: CSS Modules & Vue Adapter

Research and technical specifications for parsing and updating Vue Single File Components (SFC) templates and CSS Modules styles.

## 1. Vue SFC Parser

Vue Single File Components (SFCs) are parsed using `@vue/compiler-sfc`.
The compiler exposes `parse(sfcSource)` which parses the file into separate blocks:
- `template`: contains HTML markup.
- `script` / `scriptSetup`: contains JavaScript/TypeScript logic.
- `styles`: contains CSS styles.

We can retrieve the exact text range of the `<template>` block content using `template.loc.start.offset` and `template.loc.end.offset`.
This allows us to isolate template edits, making it extremely non-destructive to script and style blocks.

## 2. CSS Modules Rule Updater

CSS Modules define styles in `.module.css` files.
To update a CSS Modules class definition:
1. Locate the selector rule corresponding to the class name (e.g. `.card { ... }`).
2. If the rule exists, parse the property declarations inside the brackets.
3. Replace existing properties (e.g. `padding`) or append new ones.
4. If the rule does not exist, append it at the bottom of the `.module.css` stylesheet.
