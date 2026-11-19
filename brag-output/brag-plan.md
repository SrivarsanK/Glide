# Brag Plan: Glide × SrivarsanK

## What is this?
A portfolio film for SrivarsanK, told through Glide: an open-source local visual editor for React, Vue, Svelte and Astro that writes canvas edits straight back to source files.

## The angle
"Show, don't claim." The hire-ability case is the product working: a real click on a canvas becomes a one-token diff in a real file. Then the engineering underneath (digests, atomic writes, minimal diffs), the public proof (stars, commits, releases, tests), an open invitation to contribute, and a hire card. Modeled on the referenced patch.gg launch film: monochrome white/black alternation, small mono tags, big numbers, real product footage carrying the middle.

## Hook (0–4.9s)
White frame. A real line of JSX from the demo file, set large in mono. A cursor clicks; `text-slate-900` is struck out and `text-brand-500` types in, the headline beside it turns violet. Caption: "Edited on a canvas. Written to source."

## Key moments
- The real Glide editor: click the hero heading → selection handles + the real toast "Instant Mode active: edits write directly to source code on disk immediately."
- Color picker: type `#6d28d9`, Apply → headline turns violet → the real diff card slides in (`App.tsx`: `text-slate-900` → `text-brand-500`; Glide matched the hex to the project's Tailwind theme token).
- Edit scopes: select a `<Button>` → the real scope list (`Every <Button> · Button.tsx:23`, `This <Button> · App.tsx:27`, `Every <Button variant="primary">`, `Every <Button size="lg">`) → pick `size="lg"`, font 16→18 → both large buttons grow → diff in `Button.tsx`: `lg: 'h-12 px-6 text-base'` → `'h-12 px-6 text-lg'`.

## Outro / punchline
"Open source. Contributions welcome." with `npx @srivarsank/glide` typed in, then the hire card: SrivarsanK · Full-Stack / AI Developer · Building Glide · Open to roles · github.com/SrivarsanK.

## User flow worth showing
Select element on live canvas → change a property in the panel → the exact source line changes (and every usage, when the scope says so).

## Tone
- Preset: polished (with cinematic-scale number cards)
- Creative direction: open-source launch film, monochrome, mono labels, product footage first (after patch.gg)
- Interpretation: confident, few words per frame, fast motion with full reading holds; no hype adjectives — the diffs are the flex.

## Format: landscape — 1920x1080, 30fps
## Duration: ~45.3s (user-requested; above brag's 25s default)

## Visual identity (from the project)
- Dark: #0b0e14 (social preview / README art background)
- Light: #ffffff with ink #0b0e14 (inspiration's white frames, Glide logo is black-on-white)
- Accent: #38bdf8 (Glide sky blue: "React · Vue · Svelte · Astro", editor selection)
- Demo accent: #6d28d9 (the demo project's `brand-500` token — only used where the edit produces it)
- Display/body: Inter (variable); labels/code: JetBrains Mono
- Strongest visuals: the cursor-trail logo mark, the pixel "glide" wordmark, the real editor UI

## Share copy (draft)
I built Glide: click an element on a live canvas, and it edits the exact line in your React/Vue/Svelte/Astro source. Open source, Apache 2.0. Contributions welcome, and I'm open to roles.

## Audio direction
- Role: steady clean bed with sparse, motion-matched UI accents
- Music: happy-beats-business-moves-vol-12 (109.96 BPM, bundled cue preset)
- Music treatment: from 0s at ~0.32, 0.4s fade-in, 2s fade-out under the hire card
- Music cue guidance: preset `assets/music/cues/…vol-12….music-cues.json`. Scene cuts on bar lines (0, 4.91, 9.29, 18.02, 26.74, 31.10, 35.47, 39.82). Strong-cue locks: wordmark at 4.91, product cut at 9.29, CTA at 35.47. Number cards on every other beat from 31.65 (31.65, 32.74, 33.83).
- Audio-reactive treatment: subtle; accent glow behind the wordmark/hire card breathes with bed RMS. No visualizer graphics.
- SFX posture: sparse; clicks on simulated clicks, soft drops on card/diff arrivals, key ticks on typed tokens, one bell on the hire card.
- Restraint rule: no stacked hits, nothing harsh; SFX sit under the bed.

## Storyboard

### Scene 1 — Hook — 0–4.91s (white)
Real JSX line `<h1 className="… text-slate-900">Building Glide.</h1>` large in mono. Cursor glides in, clicks the token; it strikes out, `text-brand-500` types in (violet). Caption fades up: "Edited on a canvas. Written to source." (hold ≥2s)
Sequential/interaction: yes — click, strike, type.
Audio: click + key ticks. Transition: hard cut to black.

### Scene 2 — Reveal — 4.91–9.29s (black)
Pixel "glide" wordmark lands (beat-locked 4.91). Under it: "Design visually. Ship real source code." then mono tags React · Vue · Svelte · Astro one by one.
Audio: soft impact on wordmark. Transition: cut on strong cue 9.29.

### Scene 3 — Real editor: color → code — 9.29–18.02s
Editor frame (real captures). Cursor clicks the heading → selected state + toast. Push in on the properties panel → picker → hex typed → Apply → headline violet. Diff card slides in: `App.tsx:24` − / + lines. Tag: "one click → one token".
Sequential/interaction: yes. Audio: click, key ticks, drop on diff.

### Scene 4 — Edit scopes — 18.02–26.74s
Editor frame. Click "View the repo" → scope menu opens showing the four real options → cursor picks `Every <Button size="lg">` → font 16 → 18 → both buttons grow → diff card for `Button.tsx`. Tag: "Edit scopes · cva variants".
Audio: click, select, drop.

### Scene 5 — Under the hood — 26.74–31.10s (black)
Four mono rows from the README, revealed every other beat then held: "SHA-256 digest on every write", "All-or-nothing transactions", "Minimal diffs. Comments and quotes kept.", "127.0.0.1 only. Session token handshake."
Audio: soft ticks on first and last row.

### Scene 6 — Proof — 31.10–35.47s (white)
Big numbers count up, one by one: 183 GitHub stars · 505 commits · 3 releases (+ tests passing if verified). Small mono source tags.
Audio: chip-lay on each landing.

### Scene 7 — Open source — 35.47–39.82s (black)
"Open source. Contributions welcome." Terminal line types `npx @srivarsank/glide 5173`. Repo URL github.com/SrivarsanK/Glide · Apache 2.0.
Audio: key ticks.

### Scene 8 — Hire card — 39.82–45.3s (white)
Cursor-trail logo mark → "SrivarsanK" → "Full-Stack / AI Developer · Building Glide" → violet-free accent pill "Open to roles" → github.com/SrivarsanK. Hold to end.
Audio: bell on the pill; music fades.

**Music mood:** steady, clean, upbeat-professional
**Audio summary:** a clean bed that lifts at the product cut, UI clicks where the cursor acts, one bell on the hire card, then a 2s fade.

## Notes
- The canvas content is a demo page made for this film (copy of the React test app; text from the GitHub bio and the README). All edits shown were really made by Glide on 2026-11-15 against current main (built locally); diffs are verbatim.
- No personal data beyond the public GitHub handle, bio and repo URL.
