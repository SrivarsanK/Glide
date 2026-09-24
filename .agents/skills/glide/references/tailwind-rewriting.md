# Surgical Tailwind Token Rewriting Guide

Glide provides non-destructive Tailwind class rewriting via `rewriteTailwindToken` and `rewriteClassNameToken` in `packages/ast-writer/src/css.ts`.

---

## 1. The Surgical Rewriting Principle

When an agent or user changes a single property (e.g. changing background from blue to red), a naive replacement of the whole `className` risks removing responsive utilities, hover states, or layout classes.

Glide's surgical rewriter:
1. Parses the target JSX element's `className` attribute.
2. Identifies any existing token matching the property's prefix (e.g. `bg-`).
3. If found, swaps only that token with the new token (`bg-indigo-600`).
4. If not found, appends the new token to the class list.
5. If the new value is empty, removes the token cleanly without leaving double spaces.

---

## 2. Supported Utility Prefixes

| CSS Property | Tailwind Prefix | Example Old Token | Example Replacement |
|:---|:---|:---|:---|
| Background Color | `bg-` | `bg-white` | `bg-slate-900` |
| Text Color | `text-` | `text-gray-800` | `text-white` |
| Width | `w-` | `w-full` | `w-[360px]` |
| Height | `h-` | `h-12` | `h-auto` |
| Padding (All) | `p-` | `p-4` | `p-6` |
| Padding X / Y | `px-`, `py-` | `px-3` | `px-5` |
| Margin | `m-`, `mx-`, `my-` | `mb-2` | `mb-4` |
| Border Radius | `rounded-` | `rounded-md` | `rounded-xl` |
| Border Width | `border-` | `border` | `border-2` |
| Border Color | `border-` | `border-gray-200` | `border-indigo-500` |
| Shadow | `shadow-` | `shadow-sm` | `shadow-2xl` |
| Opacity | `opacity-` | `opacity-75` | `opacity-100` |

---

## 3. Handling Arbitrary Values & Complex Modifiers

Tailwind allows bracketed arbitrary values:
- Colors: `bg-[#0f172a]`, `text-[#f43f5e]`
- Sizes: `w-[calc(100%-2rem)]`, `h-[480px]`
- Coordinates: `top-[12px]`, `left-[24px]`

The regex parser matches both standard tokens and arbitrary values:
```regex
\bprefix-(?:\[[^\]]+\]|[a-zA-Z0-9._/-]+)
```

### State & Responsive Variants
Tokens with prefixes like `hover:bg-blue-600` or `md:w-1/2` are treated as separate variant classes. The default property rewriter targets only base classes unless a variant is explicitly requested.
