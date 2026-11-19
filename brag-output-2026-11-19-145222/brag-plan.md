# Brag Plan: Glide (X marketing cut)

> **Superseded for production (19 Nov):** the film is now built in the Lemo-Opuscar Mascot Screencast style in `glide-watch-the-code/` (see its TREATMENT.md). This file stays as the source of the angle, music choice and X copy.

## What is this app?
Glide is a local visual editor for React, Vue, Svelte and Astro: you change an element on a live canvas and it writes that change to the exact line of your source file.

## The angle
"Watch the code." Every beat is the same split: the canvas on top, the source line underneath. Something changes on top, and the line changes below at the same instant. Repeating that rhyme five times proves the claim without stating it, and it reads with the sound off, which is how X plays video in the feed. Each highlight answers the next question a developer would ask: does it write real code (hook), does it trash my classes (surgical), what about components (scopes), can I move things (drag), will it break my file (refusal), does it work with my stack (frameworks).

## Hook (0–3.7s)
Frame 0 is the poster: the "Building Glide." headline in slate, line 24 of `App.tsx` underneath, and the caption "I clicked a color." already on screen. The cursor is already moving. It clicks Apply, and on the strong cue at 1.60s the headline turns violet while `text-slate-900` is struck out and `text-brand-500` types in below. The caption swaps to "It changed my source code." No logo, no intro.

Hook alternates for a second post or an A/B test (same footage, caption swap only):
- B: "Design tools export mockups." → "This one edits your code."
- C: "Watch line 24." → (no second caption; the line change is the payoff)

## Key moments
- Surgical Tailwind: at the `md` breakpoint, font size 60 → 72. Only `md:text-6xl` becomes `md:text-7xl`; `text-5xl` and `text-brand-500` on the same line stay, and they glow sky blue to show they were kept.
- Edit scopes: select "View the repo", open the scope list (`Every <Button>`, `This <Button>`, `Every <Button variant=…>`, `Every <Button size="lg">`), pick `size="lg"`, font 16 → 18. Both large buttons grow, and the diff lands in `Button.tsx`, not `App.tsx`: `lg: 'h-12 px-6 text-base'` → `'h-12 px-6 text-lg'` (verbatim from the 15 Nov capture).
- Drag: the subtitle slides right along a snap guide; the line gains `left`, `top` and `position: 'relative'`.
- Refusal: an edit Glide can't make exactly shows its reason, and `git status` stays clean.
- Frameworks: four panels, React, Vue, Svelte, Astro, the same headline turning violet in each.

## Outro / punchline
"Open source." Then `npx @srivarsank/glide` types in and `github.com/SrivarsanK/Glide · Apache 2.0` lands. The last 0.77s match-cuts back to the frame-0 composition, so a replay feels continuous.

## User flow worth showing
Select an element on the canvas → change one property in the panel → the exact source line changes (and, with a scope, every matching usage).

## Tone
- Preset: chaotic (pacing only)
- Creative direction: X-native dev-tool demo. Captions-first for muted autoplay, a cut or punch-in on every strong beat, proof under every claim, and a loopable end.
- Interpretation: chaotic's rhythm (8 scenes, none over 5s, hard cuts) with clean typography: mixed case, bold, never all caps, no tilted words. Every caption is one idea and at most 7 words, slams in, then holds to its reading floor.

## Format: square — 1080x1080
Square takes more of the mobile feed than 16:9, and the canvas-over-code split fits it.

## Duration: 25.0s

## Visual identity (from the project)
- Background: #0b0e14 (README art and social preview)
- Editor chrome: the real Glide editor's dark UI, from the captures
- Accent: #38bdf8 (Glide's selection sky blue), used for "kept" glows and the snap guide
- Edit result color: #6d28d9 (the demo app's `brand-500` token), only where an edit produces it
- Captions: white pill, #0b0e14 text, Inter 800
- Code: JetBrains Mono, removed tokens #f97066 struck, added tokens #47cd89
- Strongest visual element: the stacked canvas / code split, and the pixel "glide" wordmark (`brag-output/composition/assets/img/wordmark.png`)

## Share copy (draft)
I built a visual editor that writes to your real source code. Click an element, change it, and Glide edits that exact line in your React, Vue, Svelte or Astro files. Open source.

## Audio direction
- Role: dense rhythmic layer, with the cuts on the beat
- Music: `happy-beats-business-moves-vol-11-by-ende-dot-app.mp3` (114.84 BPM). It has strong cues from 1.60s, so the hook can land on the music; vol-12 was the last film's track.
- Music treatment: starts at 0s with a 0.1s fade-in (no slow build; the hook needs the energy). Bed around 0.35, ducked about 3 dB while keys type. 0.6s fade-out from 24.4s.
- Music cue guidance: preset `assets/music/cues/happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.json`. Strong-cue locks: hook payoff 1.60, wordmark 3.70, scope pick 9.50. Scene cuts on strong cues 5.80, 8.96, 12.65, 17.91. Command lands 22.65; loop match-cut starts 24.23. Framework panels land on the beat grid 18.44 / 18.96 / 19.49 (accents only; the labels hold to 20.0).
- Audio-reactive treatment: subtle. The sky glow behind the wordmark and the CTA breathes with bed RMS. No visualizer.
- SFX posture: moderate and motion-matched: a click on every simulated click, key ticks on typed tokens, a soft whoosh on punch-ins, a low thud on the wordmark, a dropdown tick on the scope list, one muted error blip on the refusal.
- Audio-coupled moments: hook click + token typing; wordmark slam; scope list opening; drag release; refusal; framework panels; command typing.
- Restraint rule: no SFX on caption swaps; never two hits within 0.15s; nothing louder than the click.

## Storyboard

### Scene 1 — Hook — 0.00–3.70s (3.70s)
Stacked split. Top: canvas crop of the demo app, "Building Glide." in slate with selection handles; the picker is open with `#6d28d9` typed. Bottom: `App.tsx:24` with `className="mt-4 text-5xl md:text-6xl font-bold tracking-tight text-slate-900"`. Caption from frame 0: "I clicked a color." Cursor clicks Apply at 1.35; on 1.60 the headline turns violet, `text-slate-900` strikes, `text-brand-500` types in, and the code half punches in 1.0 → 1.12. Caption swaps at 1.75: "It changed my source code." (holds to 3.60).
Sequential/interaction: yes. Click, strike, type.
Audio intent: the first beat of the song lands with the payoff.
Audio-coupled idea: click on Apply, key ticks as `text-brand-500` types.
Music: in from 0.
Transition mood: hard → Scene 2 on 3.70.

### Scene 2 — Reveal — 3.70–5.80s (2.10s)
#0b0e14. The pixel "glide" wordmark slams in (1.15 → 1.0). Under it: "Design visually. Ship real source code." (the demo app's own subtitle, 6 words, holds 3.95–5.75).
Sequential/interaction: none.
Audio intent: the brand moment.
Audio-coupled idea: low thud on the slam.
Transition mood: hard → Scene 3 on 5.80.

### Scene 3 — Only what you touched — 5.80–8.96s (3.16s)
Top: the panel's breakpoint select on `md`, Font size 60 → 72; the headline grows. Bottom: the same line 24; at 6.34 `md:text-6xl` strikes and `md:text-7xl` types; `text-5xl` and `text-brand-500` get a sky underline that reads "kept". Caption: "Only the class you touched changes." (6.45–8.90).
Sequential/interaction: yes. Field value changes, then the token swaps.
Audio-coupled idea: key tick on the value, whoosh on the punch-in.
Transition mood: hard → Scene 4 on 8.96.

### Scene 4 — Edit scopes — 8.96–12.65s (3.69s)
Top: "View the repo" selected, the scope list opening at the top of the properties panel. The four options appear quickly and hold as a set; `Every <Button size="lg">` is picked around 10.0. Font 16 → 18: both large buttons grow. Bottom: `Button.tsx:14` `lg: 'h-12 px-6 text-base'` → `'h-12 px-6 text-lg'`. Caption: "One button, or every lg button." (10.70–12.60).
Sequential/interaction: yes. List reveal (accents on the grid, then held), pick, grow.
Audio-coupled idea: dropdown tick on open, click on pick.
Transition mood: hard → Scene 5 on 12.65.

### Scene 5 — Drag — 12.65–15.28s (2.63s)
Top: the subtitle slides right along a sky snap guide (speed-ramped: fast start, eased landing). Bottom: line 25 gains `style={{ left: '24px', top: '8px', position: 'relative' }}` (use the real line from the take). Caption: "Drag it. It's saved to source." (13.10–15.20).
Sequential/interaction: yes. Drag and release.
Audio-coupled idea: soft drop on release.
Transition mood: hard → Scene 6.

### Scene 6 — Refusal — 15.28–17.91s (2.63s)
Top: an edit Glide can't make exactly, with its reason shown in the toast (real text from the take). Bottom: terminal `$ git status` → `nothing to commit, working tree clean`. Caption: "If it can't be exact, it refuses." (15.45–17.85).
Sequential/interaction: yes. Attempt, refusal, clean status.
Audio-coupled idea: one muted error blip.
Transition mood: hard → Scene 7 on 17.91.

### Scene 7 — Frameworks — 17.91–20.02s (2.11s)
2×2 grid: React, Vue, Svelte, Astro. Each panel's headline turns violet on the beat grid (18.44 / 18.96 / 19.49; React is already violet). Labels hold from 18.1 to 20.0. No caption.
Sequential/interaction: yes. Four panels, one by one.
Audio-coupled idea: light tick per panel.
Transition mood: hard → Scene 8.

### Scene 8 — CTA and loop — 20.02–25.00s (4.98s)
#0b0e14. "Open source." (20.15–21.20). `npx @srivarsank/glide` types in (21.2–22.4) and lands on 22.65 with `github.com/SrivarsanK/Glide · Apache 2.0`; both hold to 24.2. On 24.23 the frame match-cuts back to the Scene 1 composition at its frame-0 state, caption "I clicked a color." included, so the last frame equals the first.
Sequential/interaction: yes. Typed command.
Audio-coupled idea: key ticks on typing; music fades from 24.4.
Transition mood: match-cut → loop.

**Music mood for this video:** upbeat, driving
**Audio summary:** the song hits with the hook's payoff, cuts ride the strong beats, clicks and key ticks sit on the actions, and the bed fades out as the frame returns to its start.

## Notes
- Shoot everything new on `brag-output/work/demo-app` and the vue / svelte / astro test apps. The 15 Nov shots in `brag-output/composition/assets/shots/` are 1920×1080 and go soft under a square punch-in; use them only for an animatic.
- Code on screen is set as type in the composition (crisp at any zoom), copied verbatim from `git diff` after each take. Nothing on screen claims more than the README does.
