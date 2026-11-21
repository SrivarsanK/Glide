# C3: Page transitions (View Transitions)

Status: todo · Size: M · Depends on: B1, B5 · Branch: `feat/c3-transitions`

## Goal

Figma's Smart Animate and slide transitions between pages, using the browser's View Transitions API.

## Design

- **Multi-page sites** (Astro without a client router, plain multi-page Vite) get a global CSS rule,
  `@view-transition { navigation: auto; }`. Glide has no CSS-file writer yet, so add a small,
  idempotent one. Find the main stylesheet the way `loadTailwindTheme` finds the Tailwind CSS entry.
- **Shared elements** (Smart Animate) give the matching element on both pages the same
  `view-transition-name`, as a Tailwind arbitrary property `[view-transition-name:hero]` or an inline
  `viewTransitionName`. Each name must be unique on its page.
- **Single-page frameworks** each need their own code: React Router's `viewTransition` on `Link`,
  Next.js's experimental flag, SvelteKit's `onNavigate` with `document.startViewTransition`, Astro's
  client router. Do these one framework at a time, or hand them to the agent through C1.
- **Browser support varies.** Browsers without it simply navigate with no animation, which is
  acceptable. Check current support before building.

## Steps

- [ ] The CSS-rule writer, with tests: appends once and leaves the rest of the file unchanged
- [ ] A "Transition" option on "Go to page" (B1): none, or dissolve via the default cross-fade
- [ ] "Match this element across pages", which writes `view-transition-name`

## Done when

In a multi-page site, going to another page cross-fades, and a matched hero element animates
between the two pages in a supporting browser.
