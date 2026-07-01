# Figma to Code Reference Guide (Glide Integration)

This guide maps visual Figma Design properties and tools to their direct code-native equivalents supported by Glide.

---

## 1. Auto Layout ➜ Flexbox Layout

Figma's **Auto Layout** is built directly on CSS Flexbox models.

| Figma Visual Parameter | Tailwind Class Equivalent | CSS Style Property |
| :--- | :--- | :--- |
| **Direction: Vertical (↓)** | `flex flex-col` | `display: flex; flex-direction: column;` |
| **Direction: Horizontal (→)** | `flex flex-row` | `display: flex; flex-direction: row;` |
| **Gap / Space between** | `gap-{value}` | `gap: {value}px;` |
| **Align: Top Left** | `justify-start items-start` | `justify-content: flex-start; align-items: flex-start;` |
| **Align: Center** | `justify-center items-center` | `justify-content: center; align-items: center;` |
| **Align: Space Between** | `justify-between` | `justify-content: space-between;` |
| **Wrap** | `flex-wrap` | `flex-wrap: wrap;` |

---

## 2. Spacing & Boundaries ➜ Padding, Margin & Size

Figma properties panel spacing handles match the standard Box Model:

| Figma Visual Handle | Tailwind Class Equivalent | CSS Style Property |
| :--- | :--- | :--- |
| **Padding (All sides)** | `p-{value}` | `padding: {value}px;` |
| **Padding X (Horizontal)** | `px-{value}` | `padding-left: {value}px; padding-right: ...` |
| **Padding Y (Vertical)** | `py-{value}` | `padding-top: {value}px; padding-bottom: ...` |
| **Margin (All sides)** | `m-{value}` | `margin: {value}px;` |
| **Width (Fixed / Hug)** | `w-{value}` / `w-fit` | `width: {value}px;` / `width: fit-content;` |
| **Height (Fixed / Hug)** | `h-{value}` / `h-fit` | `height: {value}px;` / `height: fit-content;` |

---

## 3. Typography ➜ Font Properties

Figma Text layers properties map directly to CSS text definitions:

| Figma Text Parameter | Tailwind Class Equivalent | CSS Style Property |
| :--- | :--- | :--- |
| **Font Family** | `font-{name}` | `font-family: "{name}";` |
| **Font Weight (e.g. Bold)** | `font-bold` (or weight value) | `font-weight: 700;` |
| **Font Size** | `text-{size}` | `font-size: {value}px;` |
| **Line Height** | `leading-{value}` | `line-height: {value};` |
| **Text Align (Left/Center/Right)** | `text-left` / `text-center` / `text-right` | `text-align: left;` / ... |

---

## 4. Components & Layers ➜ JSX AST Trees

- **Figma Layers Panel**: Corresponds directly to Glide's Component Tree (`buildComponentTree`) which parses nesting tags.
- **Figma Component Instances**: Match React/Vue/Svelte import elements.
- **Figma Variants & Properties**: Maps to framework-level Props and variables.
- **Figma Constraints**: Relate to absolute positioning rules (`absolute`, `top-0`, `left-0`).
