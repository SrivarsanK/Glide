# Hyperframes Composition Brief: Glide (X marketing cut)

> **Superseded for production (19 Nov):** the film is now built in the Lemo-Opuscar Mascot Screencast style in `glide-watch-the-code/` (see its TREATMENT.md). This file stays as the source of the angle, music choice and X copy.

## Objective
Create a 25-second square launch video for Glide that works on X with the sound off: every beat shows a canvas edit on top and the source line changing underneath.

## Output
- Composition directory: `brag-output-2026-11-19-145222/composition/`
- Rendered video: `brag-output-2026-11-19-145222/brag.mp4`
- Format: square — 1080x1080, 30 fps
- Duration: 25.0 seconds
- Delivery for X: H.264 High, yuv420p, about 8 Mbps, AAC 48 kHz 128 kbps stereo, `-movflags +faststart`, loudness about -14 LUFS integrated with true peak at or under -1 dBTP. Poster baked as frame 0.

## Source Material
- Project root: `c:\Users\Srivarsan\Desktop\Glide`
- Primary files read: `README.md`, `packages/overlay/src/editor-html.ts` (UI labels), `brag-output/work/demo-app/src/App.tsx`, `brag-output/work/demo-app/src/components/Button.tsx`, the 15 Nov editor shots
- Product name: Glide
- Tagline / strongest claim: "Select elements on a live canvas, adjust styles and layout visually, and write changes directly back to your source files." (README)
- Key UI moment to recreate: the headline color edit in the real editor, with `App.tsx:24` changing underneath
- Captures: `captures/` in this folder, shot per the list below. Until they exist, build an animatic from `brag-output/composition/assets/shots/` (1920×1080, real editor, demo app).
- Copy that must appear verbatim:
  - I clicked a color.
  - It changed my source code.
  - Design visually. Ship real source code.
  - Only the class you touched changes.
  - One button, or every lg button.
  - Drag it. It's saved to source.
  - If it can't be exact, it refuses.
  - React · Vue · Svelte · Astro
  - Open source.
  - npx @srivarsank/glide
  - github.com/SrivarsanK/Glide · Apache 2.0
- Code lines: set as type, copied from `captures/diffs.txt` (verbatim `git diff -U0` after each take). Known-good line from 15 Nov: `Button.tsx:14` `lg: 'h-12 px-6 text-base'` → `'h-12 px-6 text-lg'`.

### Shoot list (all at 2× device scale, so crops survive the square punch-in)
| File | Scene | What |
|---|---|---|
| `s1-a-select.png`, `s1-b-picker.png`, `s1-c-violet.png` | 1 | Headline selected; picker with `#6d28d9`; after Apply |
| `s3-a-md.png`, `s3-b-grown.png` | 3 | Breakpoint `md`, font size 60; after 72 |
| `s4-a-select.png`, `s4-b-scopes.png`, `s4-c-applied.png` | 4 | "View the repo" selected; scope list open; both large buttons at 18 |
| `s5-drag.mp4` (60 fps, 3 s), `s5-after.png` | 5 | Drag the subtitle with the snap guide; after reload |
| `s6-refused.png`, `s6-git.txt` | 6 | The refusal message; `git status` output |
| `s7-react.png`, `s7-vue.png`, `s7-svelte.png`, `s7-astro.png` | 7 | Headline violet in each app |
| `diffs.txt` | all | `git diff -U0` after every take |

## Creative Direction
- Tone preset: chaotic (pacing only)
- Creative direction: X-native dev-tool demo. Captions-first for muted autoplay, a cut or punch-in on every strong beat, proof under every claim, loopable end.
- Interpretation: 8 scenes, hard cuts, nothing over 5s; typography stays clean (mixed case, Inter 800 captions in a white pill), never all caps or tilted.
- Angle: "Watch the code." Canvas on top, source underneath, and they change at the same instant, five times over. Each highlight answers a developer's next question: real code, my other classes, components, layout, safety, my framework.
- Hook: frame 0 is the poster with "I clicked a color." already on screen and the cursor already moving; the payoff (violet headline + token swap) lands on the 1.60s strong cue.
- Outro / punchline: "Open source." → `npx @srivarsank/glide` → repo line → match-cut to frame 0.
- Motion system (from the motion-design skill, Energetic personality): signature ease-out-expo `cubic-bezier(0.16, 1, 0.3, 1)` for entrances; exits ease-in `cubic-bezier(0.3, 0, 1, 1)` at about 70% of the entrance time. Durations: 120 ms (caption swaps, clicks), 250 ms (punch-ins, panels), 600 ms (wordmark). Entrance pattern: zoom-cut 1.08 → 1.0 with a 12 px rise. Punch-ins stay at or under 1.15×. Three layers in every scene: primary (the edit), secondary (the diff and caption), ambient (slow canvas dot-grid drift and the music-reactive glow).
- X safe zones: keep captions and key code out of the bottom 12% (player controls) and the top-left corner; captions sit on the seam between canvas and code.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign
  - Any claim the README does not make (no star counts, no speed claims)
  - A logo intro before the hook

## Visual Identity
- Background: #0b0e14
- Text: #e8ecf2 on dark; captions #0b0e14 on a white pill
- Accent: #38bdf8 (selection, snap guide, "kept" glow)
- Edit result: #6d28d9 (`brand-500`), only where an edit produces it
- Display font: Inter (variable, `brag-output/composition/assets/fonts/inter-latin-wght-normal.woff2`)
- Body / code font: JetBrains Mono (`brag-output/composition/assets/fonts/jetbrains-mono-latin-wght-normal.woff2`)
- Visual references from the project: the pixel wordmark (`brag-output/composition/assets/img/wordmark.png`), the cursor-trail logo (`brag-output/composition/assets/img/logo.png`), the real editor UI

## Storyboard
Use the storyboard in `brag-output-2026-11-19-145222/brag-plan.md` as the creative contract. Boards: https://claude.ai/artifact/NjYpYXBfYLDm4TagpbykQW

Scene summary:
1. Hook — 3.70s — headline turns violet; `text-slate-900` → `text-brand-500`; "I clicked a color." → "It changed my source code."
2. Reveal — 2.10s — wordmark + "Design visually. Ship real source code."
3. Only what you touched — 3.16s — `md:text-6xl` → `md:text-7xl`, the other two classes glow as kept
4. Edit scopes — 3.69s — scope list, `Every <Button size="lg">`, both buttons grow, `Button.tsx:14` diff
5. Drag — 2.63s — subtitle slides on a snap guide, style line appears
6. Refusal — 2.63s — refusal message, clean `git status`
7. Frameworks — 2.11s — React, Vue, Svelte, Astro four-up
8. CTA and loop — 4.98s — "Open source.", command, repo line, match-cut to frame 0

## Audio
- Audio role: dense rhythmic layer, cuts on the beat
- Audio arc: full energy from the first frame, steady through the highlights, a short fade as the frame returns to its start
- Music: `happy-beats-business-moves-vol-11-by-ende-dot-app.mp3` (from `<brag-skill-dir>/assets/music/`)
- Music treatment: 0.1s fade-in at 0, bed about 0.35, duck about 3 dB under typing, 0.6s fade-out from 24.4s
- Music cue guidance: preset `<brag-skill-dir>/assets/music/cues/happy-beats-business-moves-vol-11-by-ende-dot-app.music-cues.json`. Strong-cue locks: 1.60 (hook payoff), 3.70 (wordmark), 9.50 (scope pick). Cuts near 5.80, 8.96, 12.65, 17.91. Command lands 22.65. Loop match-cut 24.23. Beat-grid accents 18.44 / 18.96 / 19.49 for the framework panels.
- Audio-reactive treatment: subtle; the sky glow behind the wordmark and the CTA breathes with bed RMS. No waveform or bars.
- Audio-coupled moments:
  - Scene 1 — simulated click on Apply, key ticks on `text-brand-500`
  - Scene 2 — low thud on the wordmark
  - Scene 4 — dropdown tick, click on the pick
  - Scene 5 — soft drop on release
  - Scene 6 — one muted error blip
  - Scene 7 — light tick per panel
  - Scene 8 — key ticks on the command
- SFX selection guidance: reuse `brag-output/composition/assets/sfx/` (click2, click3, mouseclick1, rollover2, thud) where they fit; never two hits within 0.15s; no SFX on caption swaps.
- SFX analysis guidance: `<brag-skill-dir>/assets/sfx/sfx-analysis.md` if present; prefer low high-frequency-risk sounds for repeated clicks.
- Exact SFX choice: Hyperframes chooses filenames, timestamps, density and volume from the implemented animation.
- Audio files: copy the music and chosen SFX into `composition/assets/`.
- Credit: "Music: Sascha Ende, ende.app (CC BY 4.0)" in the post or the video description.

## Hyperframes Instructions
Load the composition-building Hyperframes skills — `hyperframes` (composition contract + `data-*` timing, `references/format.md`; motion, eases and seek-safe keyframes in `references/motion.md`; look in `references/look.md`), `hyperframes-registry` (ready-made effects, transitions, titles), `media-use` (music, SFX, audio-reactive data), and `hyperframes-cli` (lint/check/render). /brag is its own workflow: skip the `hyperframes` storyline step: don't read `references/types/*` or `references/story.md`, don't propose storylines, and don't write a `SPEC.md`. The brag plan and composition brief replace them, including the LOOK line `references/look.md` asks for. Also skip its `usage`, `history`, `feedback` and REVIEW.md steps; `check` is brag's gate. Do not route into its generic launch-video workflow. Prefer native Hyperframes conventions over anything in `/brag`. If those skills are not installed, build from `npx hyperframes docs` and gate with `check` and `snapshot`, as on 15 Nov.

Requirements:
- Show real editor captures in scenes 1, 3, 4, 5, 6 and 7.
- Keep all text readable in the final render at 1080×1080 on a phone.
- Keep the video at 25.0 seconds.
- Include the planned music and SFX layer.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet. Choose SFX after the visual animation exists.
- Treat music cue metadata as optional timing hints; ignore cues that hurt readability or pacing.
- Major reveals may move toward nearby strong cues within about 0.15s. Smaller entrances may align to nearby beat points within about 0.10s.
- The last frame must match frame 0 (the hook's poster state).
- Use local assets for audio, fonts and GSAP (`brag-output/composition/assets/gsap.min.js`).
- Run `hyperframes check` before render — it is brag's single gate.
- Keep creation and rendering local. Publishing to X is the user's step.
