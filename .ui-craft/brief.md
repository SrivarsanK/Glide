# Glide editor brief

User: a developer who edits a local site on a canvas and expects source changes to persist.
Reference: Figma's canvas-focused editor, layer hierarchy, context inspector, tool dock and direct manipulation. Evidence is recorded in docs/reports/FIGMA_REA_EVIDENCE.md; inferred design choices are not claims about Figma internals.

Keep all current source operations, staged/live modes, history, workspace objects, comments, export, viewport controls, preview, shortcuts and mapping checks. No changes to the mutation protocol or source writer in this UI pass.

Use existing Inter, Lucide and Glide logo assets. No new network assets. Use compact neutral panels, one configured accent, clear active/focus states and short labels. Avoid canvas entrance motion. Match the existing dark theme. Craft level 8, low motion, dense desktop UI, low layout variance follow the user's Figma reference and polished-tool requirement.

Success: controls remain reachable at 1280 and 1600px, tools and staged edits do not overlap, text input is safe from shortcuts, zoom affects the canvas only, and installed-package source-edit checks pass.
