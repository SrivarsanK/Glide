# Glide Visual Designer - UI Navigation Guide

This guide maps out the user interface of the Glide Code-Native Visual Designer, explaining the function of each panel, widget, and control, with references to their source file implementations.

---

## UI Overview Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│  GLIDE LOGO   [Device Dropdown]  W [1440] x H [Auto]  - 100% + [Fit]   │ ← Header
├───────────────┬────────────────────────────────────────┬───────────────┤
│               │                                        │               │
│               │                                        │  PROPERTIES   │
│               │                                        │  Tag: <DIV>   │
│  LAYERS TREE  │            CANVAS WORKSPACE            │  ───────────  │
│  - Body       │                                        │  Position     │
│  - Header     │            [Device Frame]              │  Layout       │
│  - Main       │            ┌───────────────┐           │  Appearance   │
│    - Section  │            │               │           │  Spacing      │
│    - Section  │            │  App Preview  │           │  Typography   │
│  - Footer     │            │  IFrame       │           │  Fill         │
│               │            │               │           │  Stroke       │
│               │            └───────────────┘           │  Content      │
│               │                                        │               │
├───────────────┴────────────────────────────────────────┴───────────────┤
│  F=Frame  R=Rect  O=Ellipse  T=Text  C=Comment  [Space]+Drag=Hand Pan  │ ← Footer
└────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Top Header (Control Bar)

The Top Header provides canvas-level preview and zoom controls.

| Component | Function | Location in Source |
| :--- | :--- | :--- |
| **Device Dropdown** | Select from device presets (Desktop, MacBook Pro, iPad Mini, iPhone 14 Pro, etc.). Selecting a preset sets fixed dimensions. Selecting **Custom Mode** unlocks free scaling. | [editor-html.ts:L1075](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L1075) |
| **Viewport Dimension inputs (Capsule Widget)** | Real-time width (`W`) and height (`H`) number inputs. Clearing height (leaving it blank/`Auto`) triggers auto-scaling to match the preview document height. | [editor-html.ts:L1086](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L1086) |
| **Zoom Controls** | Adjusts the workspace zoom scale: `-` (Zoom Out), `+` (Zoom In), current percentage indicator, and `Fit` (auto-centers and fits device frame to visible canvas space). | [editor-html.ts:L1089](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L1089) |

---

## 2. Left Sidebar (Layers Tree)

The Left Sidebar displays the document node hierarchy.

| Component | Function | Location in Source |
| :--- | :--- | :--- |
| **Layers Hierarchy Tree** | Lists all HTML/JSX nodes rendered on the page that carry source locator attributes (`data-gl-source`). Highlights active selections. | [editor-html.ts:L1110](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L1110) |
| **Guides Manager** | Lists vertical and horizontal ruler guidelines created by dragging from rulers. Guidelines can be locked or cleared. | [editor-html.ts:L1142](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L1142) |

---

## 3. Right Sidebar (Properties Panel)

The Properties Panel inspects and modifies styles of the selected DOM node. Changes are compiled and written back to source files in real-time.

| Property Group | Control / Action | Location in Source |
| :--- | :--- | :--- |
| **Element Header** | Displays selected node's tag (e.g. `<BUTTON>` or `<DIV>`) and provides settings. | [editor-html.ts:L1306](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L1306) |
| **Quick Alignment** | Top toolbar with quick alignments: Align Left, Center, Right, Distribute spacing. | [editor-html.ts:L1312](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L1312) |
| **Position & Dimensions** | Direct numeric input fields for: `X`, `Y` position, Rotation angle, Width (`W`), Height (`H`). Width/Height can be set to **Fixed**, **Hug (fit-content)**, or **Fill (stretch/100%)**. | [editor-html.ts:L1328](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L1328) |
| **Appearance & Opacity** | Opacity slider (`0%` to `100%`) and CSS blend mode dropdown. | [editor-html.ts:L1424](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L1424) |
| **Spacing (Margin & Padding)** | Visual concentric layout widget to enter values for Margin (Top/Right/Bottom/Left) and Padding (Top/Right/Bottom/Left) individually. | [editor-html.ts:L1460](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L1460) |
| **Content (Text Editing)** | *Appears only when text nodes are selected.* Provides a text area to rewrite code-native text content (e.g. text inside button, headings, spans). Updates preview instantly and commits debounced text edits to the file. | [editor-html.ts:L1500](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L1500) |
| **Typography** | Font Family text field, Weight selection dropdown, Size (`px`), Line Height, Letter Spacing, Text Alignment buttons, and a Font Color swatch picker. | [editor-html.ts:L1513](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L1513) |
| **Fill (Background)** | Background color inputs. Supports solid fills or linear/radial CSS gradient creation with start/end color stops and angle adjustment. | [editor-html.ts:L1570](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L1570) |
| **Stroke (Borders)** | Border color swatch, width slider, border-style dropdown (Solid, Dashed, Dotted, None), and stroke alignment options. | [editor-html.ts:L1640](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L1640) |
| **Corner Radius** | Individual values for Border Radius (Top Left, Top Right, Bottom Right, Bottom Left) corners. | [editor-html.ts:L1700](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L1700) |

---

## 4. Canvas Workspace (Central Area)

The central canvas renders the preview sandbox frame and overlays SVG guidelines.

| Feature | Interaction | Location in Source |
| :--- | :--- | :--- |
| **Rulers** | Horizontal and vertical pixel rulers. Dragging from rulers inserts customizable alignment guidelines. | [editor-html.ts:L1160](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L1160) |
| **Sandbox IFrame** | Renders the live application page (`http://localhost:5173/`). Bypasses cross-origin restrictions to stream styles and code changes. | [editor-html.ts:L1173](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L1173) |
| **Canvas Scrolling** | Scrolling mouse wheel anywhere on the canvas or over the iframe programmatically scrolls the webpage viewport inside the frame via postMessage. This enables standard CSS `position: sticky` and `position: fixed` elements (like headers/navbars) to function natively. | [editor-html.ts:L2308](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L2308) |
| **Canvas Panning** | Select the Hand Tool (`H` or spacebar + drag) and drag the mouse on the canvas to move/pan the entire frame wrapper around the workspace. | [editor-html.ts:L2553](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L2553) |
| **Overlay Selection Boxes** | An SVG layer overlaying the iframe draws blue selection boxes, resizing anchors, hover borders, and measure lines between nodes. | [editor-html.ts:L2805](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L2805) |

---

## 5. Keyboard Shortcuts & Footer Cheat Sheet

The footer bar shows active shortcuts for mouse tool swapping and editor navigation.

| Shortcut Key | Action | Location in Source |
| :--- | :--- | :--- |
| **`Spacebar` + Drag** | Swaps to Hand Tool for panning the canvas view. | [editor-html.ts:L2558](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L2558) |
| **`Ctrl` + Scroll / Wheel** | Zooms workspace in or out. | [editor-html.ts:L2310](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L2310) |
| **`Esc`** | Clears active selection. | [editor-html.ts:L2700](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L2700) |
| **`F` / `R` / `O` / `T` / `C`** | Swap cursor tools: Frame, Rectangle, Ellipse, Text, Comment mode. | [editor-html.ts:L1233](file:///c:/Users/Srivarsan/Desktop/Glide/packages/overlay/src/editor-html.ts#L1233) |
