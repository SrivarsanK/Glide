# Phase 10 Research: Responsive Preview & Breakpoint Scoped Editing

Research and implementation specifications for active breakpoint classes rewriting and viewport width matching.

## 1. Active Breakpoint Classes Rewriting

Tailwind CSS styles elements conditionally using responsive breakpoint class prefixes:
- `sm:` (min-width: 640px)
- `md:` (min-width: 768px)
- `lg:` (min-width: 1024px)
- `xl:` (min-width: 1280px)

When edits are made under an active breakpoint scope:
1. Target the class names prefixed with `${breakpoint}:`.
2. Filter out old values matching the CSS property prefix under that specific breakpoint prefix.
3. Append the new class name prefixed with `${breakpoint}:`.
4. Ensure default class names (un-prefixed) and class names under other breakpoints are completely left intact.

## 2. Viewport Device Presets

Standard viewport presets:
- Mobile: `375px`
- Tablet: `768px`
- Desktop: `1440px`

Active breakpoint resolution based on viewport width:
- `width < 640`: null (default style)
- `640 <= width < 768`: `sm`
- `768 <= width < 1024`: `md`
- `1024 <= width < 1280`: `lg`
- `width >= 1280`: `xl`
