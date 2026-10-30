# Figma UI evidence for Glide

Date: 2026-10-19. Scope: editor shell, tools, layers, frames, zoom, properties. This is a behavior study, not a claim of Figma source recovery.

## REA target and limit

The bounded installed-app search found one artifact:

`C:\Users\Srivarsan\AppData\Local\Figma\app-126.6.14\resources\app.asar`

Used `reverse-engineer-anything` and called REA `analyze_javascript_application` with `detail: summary` and a 60-second per-source limit. REA rejected the archive with `artifact_operation_failed`, reason `format`: `ASAR entry range is outside its container: .codesign`.

A bounded alternate archive route used `open_binary`, which validated ASAR identity and returned SHA-256 `3b490c32953923f9199f7f4ad23677cd8011ed3ddd5f166d24f128fd5ec4ea6f`. `inspect_artifact` then failed with the same format error for `.codesign`.

No Evidence ID or graph was returned. This proves an analysis limit, not a corrupt Figma install. No app files were changed, no software was installed, and no debug endpoint was guessed. The UI conclusions below use official Figma documentation. Runtime behavior and internal renderer architecture remain unverified.

## Observed documentation

| Area | Documented behavior | Evidence |
|---|---|---|
| Shell | Current Figma has a left navigation rail, left and right panels, toolbar, and canvas. File and Assets entry points moved to the rail. | [Navigation and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar) |
| Tools | UI3 puts the toolbar at the bottom. Panels can resize. Property labels are optional. Layout controls group dimensions, resizing, direction, alignment, and spacing. | [Figma UI3 guide](https://www.figma.com/blog/making-the-move-to-ui3-a-guide-to-figmas-next-chapter/) |
| Selection | The right panel changes with the selected layer type. Design properties and prototype connections have separate tabs. With no selection, page-level settings are available. | [Navigate design files](https://help.figma.com/hc/en-us/articles/30925881896727-FD4B-Navigate-Figma-Design-files) |
| Navigation | Space plus drag pans. H selects the Hand tool. Ctrl plus wheel zooms on Windows. | [Navigate design files](https://help.figma.com/hc/en-us/articles/30925881896727-FD4B-Navigate-Figma-Design-files) |
| Zoom | Fit is the default opening view. Shift+1 fits the page; Shift+2 fits the selection. A custom zoom value is available. Canvas zoom and interface scale are separate. | [Zoom and view options](https://help.figma.com/hc/en-us/articles/360041065034-Adjust-your-zoom-and-view-options) |
| Frames | Frames are parents. They support dimensions, fill, stroke, effects, auto layout, constraints, and clipping. Clip Content hides child portions beyond frame bounds. Enter selects a child; Tab and Shift+Tab move among siblings. | [Frames](https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design) |

The course page states that its navigation illustration predates the new rail. Use the current navigation article for shell placement.

## Glide design decisions (inference)

- Use a compact left rail and a clear layer tree. Keep page structure separate from component assets.
- Keep the tool dock below the canvas. Show one active tool and its shortcut. Reuse Glide's existing SVG icons.
- Keep editor chrome at a fixed scale. Apply pan and zoom only to canvas content and its selection overlay.
- Put position and size together. Group layout controls. Keep text, fill, border, and effects in clear sections.
- Use the right panel for selection state. Show a useful page state when nothing is selected.
- Keep source changes, pending edits, history, and Preview visible. These are Glide operations; do not label them as Figma prototype features.
- Keep off-frame objects in the layer model. Do not confuse hidden overflow with a detached object.
- Preserve source scope checks. A repeated JSX template is not an independent Figma layer. Show that limit before a destructive edit.
- Use restrained separators, consistent field heights, and strong focus states. These are Glide styling choices, not extracted Figma tokens.

## Coverage

Shell, tools, frame model, selection properties, and pan/zoom are supported by official documentation. Exact colors, spacing tokens, animation timing, rendering internals, and source-edit semantics are not recovered. The source-preserving implementation and regression tests must establish Glide behavior independently.
