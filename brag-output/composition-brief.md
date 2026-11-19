# Hyperframes Composition Brief: Glide × SrivarsanK

## Objective
A ~45s portfolio launch film for SrivarsanK told through Glide, for X and LinkedIn (muted autoplay: every idea must read without sound).

## Output
- Composition: `brag-output/composition/` → `brag-output/brag.mp4`
- Landscape 1920x1080, 30fps, 45.3s

## Source material
- Project root: `Glide/` — README.md, PRODUCT.md, `.github/assets/social-preview.png` (wordmark), `logo/Glide Logo.png`
- Real editor captures: `work/shots/*.png` (Glide main @794aa17 built locally, running on a demo copy of `glide-test-apps/react-app`)
- Verbatim copy: "Design visually. Ship real source code." · "Instant Mode active: edits write directly to source code on disk immediately." · scope options `Every <Button> · Button.tsx:23`, `This <Button> · App.tsx:27`, `Every <Button variant="primary">`, `Every <Button size="lg">` · `npx @srivarsank/glide 5173`
- Verbatim diffs: App.tsx:24 `text-slate-900` → `text-brand-500`; Button.tsx:14 `lg: 'h-12 px-6 text-base',` → `lg: 'h-12 px-6 text-lg',`
- Stats (verified 2026-11-15): 183 stars (GitHub API), 505 commits (`git rev-list`), 408 tests passing / 47 files (`vitest run`), 3 releases, Apache 2.0, 8 packages
- Bio (GitHub): "Full-Stack/AI Developer & Video Editor | Building Glide | B.Tech AI '28 @ SRMIST"

## Creative direction
See `brag-plan.md`. Preset polished; monochrome white/black frames with sky accent, mono tags, product footage first. Avoid generic SaaS language and invented claims.

## Visual identity
Dark #0b0e14 · light #ffffff · accent #38bdf8 · demo token violet #6d28d9 · Inter (variable) + JetBrains Mono, bundled as woff2.

## Storyboard
1. Hook 0–4.91 — JSX token swap + headline turns violet; "Edited on a canvas. Written to source."
2. Reveal 4.91–9.29 — pixel wordmark, tagline, React · Vue · Svelte · Astro
3. Editor 9.29–18.02 — click heading, toast, picker, hex, apply, App.tsx diff
4. Edit scopes 18.02–26.74 — select Button, real scope menu, size="lg", both grow, Button.tsx diff
5. Under the hood 26.74–31.65 — three README engineering facts
6. Proof 31.65–35.47 — 183 stars · 505 commits · 408 tests
7. Open source 35.47–39.82 — contributions welcome, npx line, repo URL
8. Hire card 39.82–45.3 — logo mark, SrivarsanK, bio line, "Open to roles", github.com/SrivarsanK

## Audio
- Music: `assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` at 0.32, fade-in 0.4s, fade-out 2s
- Cues: bundled preset (109.96 BPM). Locks: 4.91 wordmark, 9.29 editor cut, 22.93 Button diff (strongest cue), 35.47 CTA
- SFX (only the `ui/` pack is installed): `click2`, `click3`, `mouseclick1`, `rollover2`; plus `thud.wav` synthesized locally (58 Hz + 116 Hz sine, exp decay) for the two big reveals
- Audio-reactive: unavailable — the `media-use` skill (extraction helper) is not installed; skipped per brag guidance

## Hyperframes notes
Hyperframes skills are not installed in this environment; built from `hyperframes docs` + the scaffold's CLAUDE.md rules, gated by `hyperframes check` and verified with `snapshot`.
