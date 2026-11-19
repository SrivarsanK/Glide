# Treatment: Watch the Code

Style: **Mascot Screencast** (`living-screencast`). Format: 1080 × 1080, 30 fps, 25.0 s, English. For X, where video autoplays muted in the feed.

Brief decisions (no questions were left open):
- Topic and claims: Glide, from its README and the real editor UI (labels copied from `packages/overlay/src/editor-html.ts` and the 15 Nov captures).
- **No voice.** X starts muted; burned-in caption pills carry the story, and the subtitles also ship as `subtitles_en.srt`. The voice steps are dropped.
- Music: "Happy Beats / Business Moves vol. 11" by Sascha Ende (CC BY 4.0), 114.84 BPM, chosen in the brag plan because its first strong beat (1.60 s) can carry the hook. It is the film's hi-fi layer; the mascot gets its own chiptune voice on top.
- Mascot: an original character (Glide has none), described below.
- Storyboard: requested, so production stops after the storyboard sheet for approval.

## 1. Three structures

1. **The relay (chosen).** The user acts on the canvas; the mascot carries each change down into the exact source line and stamps it in. Four relays, each wider than the last (one token, one class among three, every variant in another file, a drag), then the one edit it refuses, then the split into four frameworks and the return to where it started.
2. **The race.** Two windows: the old way (a mockup handed off, then edited by hand) against Glide, with the mascot winning. Rejected: it needs an invented "old way" UI, the first 3 s go to set-up instead of the payoff, and a straw man reads as an ad.
3. **One restyle, one take.** The mascot runs ahead of the cursor while a whole page is redesigned in 25 s. Rejected: too many changes to read at the caption pace this library enforces, and no turn.

**Why the relay:** it puts cause and effect in every frame (cursor up top, mascot and code below), the payoff lands in under 2 s, and the repetition teaches the viewer where to look, so each new relay can be faster. The opening image is the canvas and the code in one view. The ending puts the mascot back on the heading where it started, so the film loops. The score keeps the band steady and lets the chiptune voice grow from single notes to a four-note run at the split.

## 2. Logline and arc

A pixel helper carries every change you make on Glide's canvas into the exact line of your source code, and refuses the one change it can't make exactly.

- **Setup (0–5.8 s):** a click on the canvas; the mascot leaps into the code and stamps the new class in. The window title says "Glide".
- **Development (5.8–14.8 s):** it changes only the class you touched, then every large button in another file, then rides a dragged line of text.
- **Turn (14.8–17.9 s):** an edit it can't make exactly. It plants itself on the line, holds up a sign, and the file stays as it was.
- **Ending (17.9–25 s):** it splits into four, one per framework, merges, the command is typed, and it hops back onto the heading where it began.

## 3. Benchmark

- **Linear's product release films.** Learn: real UI redrawn as vector, one state change per beat, camera pushes that land on the exact field that changes, generous holds on the result. Don't take: their UI, layouts, palette, music or type.
- **Lemmings (1991).** Learn: tiny characters that treat the top edges of the world as floors, stepped motion that reads at thumbnail size, a crowd splitting into jobs. Don't take: the characters, sprites, sounds or levels.

## 4. Shot list

The camera is a recording-software camera inside one desktop: the Glide editor in a browser window above, a code editor window overlapping its lower edge, a terminal window that slides up in chapter 04. Zoom never goes below the full desktop. Cuts only under chapter wipes.

| # | Time | Framing | Move | Why |
|---|---|---|---|---|
| 1 | 0.00–1.25 | Medium: the heading, the picker and line 24 of `App.tsx` in one view | Slow drift right | Frame 0 is the poster: the question (a click) and the answer (the code) are both on screen before anything moves |
| 2 | 1.25–2.40 | Close on line 24 | Push-in to the token as the mascot falls toward it, whip blur on the fall | "This is where it happens"; the payoff is the token, so it fills the frame |
| 3 | 2.40–3.70 | Medium again, heading violet above, new class below | Pull back on the beat | Before and after in one frame, for the viewer who missed the stomp |
| 4 | 3.70–5.80 | Full desktop, both windows | Pull back to the full window; mascot lands on the browser tab title "Glide — Code-Native Visual Designer" on the downbeat | Diegetic title: the brand arrives as real UI, after the proof |
| 5 | 5.80–8.96 | Medium on the Typography panel (breakpoint `md`, size field), then close on line 24 | Pixel wipe in (chapter 02), push-in to the size field, whip down to the code | The cause is a number, the effect is one token among three |
| 6 | 8.96–12.65 | Medium on "View the repo" and the scope select, then the code window switching to `Button.tsx` | Whip-pan canvas → panel → code | Cause here, effect in another file: the whip is the distance |
| 7 | 12.65–14.76 | Medium on the subtitle line | Track with the dragged text (the mascot rides it), then whip down to the code | The drag is a moving floor; the mascot makes the motion legible |
| 8 | 14.76–17.91 | Close on the refusal toast and the untouched line | Push-in plus vignette freeze; slow | The one promise to remember. The film's breath |
| 9 | 17.91–21.07 | Four windows in a 2 × 2 split | Split-window reframe (cell division) | The signature shot: one mascot becomes four, one per framework |
| 10 | 21.07–24.23 | Terminal window, medium | Slow push to the caret as the command types | The call to action is typed, by the user, in the real command |
| 11 | 24.23–25.00 | Back to shot 1's framing | Pixel wipe; the mascot hops onto the heading | The ending echoes the opening; the last frame matches frame 0 |

Camera moves used: drift, push-in, pull back, whip-pan, track, push-in + vignette freeze, split-window reframe (seven).

## 5. Beat sheet

| Time | Picture | Caption |
|---|---|---|
| 0.00 | Heading "Building Glide." selected (blue handles), picker open with `#6d28d9`, cursor gliding toward Apply. The mascot stands on the heading's top edge, eyes down at the code | "I clicked a color." |
| 1.10 | Click Apply. Mascot crouches | |
| 1.25 | Mascot springs off the heading; whip down | |
| 1.60 | Lands on `text-slate-900`: the token crumbles to pixel dust and `text-brand-500` types in. Up top, the heading turns violet | |
| 2.40 | Pull back: violet heading above, new line below. Mascot cheers (arms up) | |
| 2.90 | | "It edited my code." |
| 3.70 | Full desktop. Mascot lands on the browser tab title "Glide — Code-Native Visual Designer" | |
| 5.80 | Pixel wipe. Chapter pill "02 · Precise". Typography panel, breakpoint `md` | |
| 6.00 | Cursor types `72` in the size field (key HUD: `7 2 ⏎`) | |
| 6.34 | Heading grows. On line 24 the mascot stomps `md:text-6xl` into `md:text-7xl`, then hops over `text-5xl` and `text-brand-500` with a pat each (eyes happy) | "Only that class." (6.40) |
| 8.96 | Whip to the canvas: cursor clicks "View the repo" | |
| 9.50 | The scope select opens; cursor picks `Every <Button size="lg">` | |
| 10.20 | Key HUD `1 8 ⏎`. Whip to the code window: the tab switches to `Button.tsx` | "Or every lg button." (9.80) |
| 11.06 | Mascot stomps `text-base` into `text-lg` on line 14; both large buttons grow above | |
| 12.65 | Pixel wipe. Pill "03 · Layout". Cursor drags the subtitle right; the mascot rides it; a snap guide flashes | |
| 13.70 | Release. Mascot jumps to line 25; the `style={{ left: …, top: …, position: 'relative' }}` attribute types in | |
| 14.76 | Music drops to room tone for half a second. Cursor tries an edit Glide can't make exactly | |
| 15.00 | Refusal toast (verbatim text from the take). Mascot plants itself on the line, holds up a pixel "!" sign; the line does not change. Push-in, vignette | "Not exact? Refused." |
| 17.91 | Pixel burst. The view splits into four windows, `App.tsx`, `App.vue`, `App.svelte`, `index.astro`; the mascot splits into four | |
| 17.91 · 18.44 · 18.96 · 19.49 | Each mascot stomps its heading violet, one per beat | "React, Vue, Svelte, Astro." (18.10) |
| 21.07 | The four merge into one. A terminal window slides up | |
| 21.40 | `npx @srivarsank/glide 5173` types in (key HUD) | "Open source." (21.45) |
| 22.65 | Enter. The real output prints: `[Glide] Editor: http://localhost:7777  (preview of the dev server on port 5173)` | |
| 24.23 | Pixel wipe back to the opening framing; the mascot hops onto the heading | |
| 24.60–25.00 | Frame matches frame 0 | "I clicked a color." |

## 6. Cue map

Tempo 114.84 BPM: a beat is 0.5225 s, a bar 2.09 s. Downbeats from the track's cue preset: 1.60, 3.70, 5.80, 7.91, 10.01, 12.12, 14.22, 16.34, 18.44, 20.54, 22.65, 24.75. Strong cues: 1.60, 3.70, 5.80, 6.34, 8.96, 9.50, 12.65, 17.91, 22.65, 24.23.

| Cue | What lands |
|---|---|
| 1.60 (strong) | Mascot lands; token swap; heading turns violet |
| 3.70 (strong, downbeat) | Mascot lands on the tab title |
| 5.80 (strong, downbeat) | Chapter 02 wipe |
| 6.34 (strong) | `md:text-7xl` stomp |
| 8.96 (strong) | Whip to the canvas |
| 9.50 (strong) | Scope select opens |
| 11.06 (beat) | `text-lg` stomp |
| 12.65 (strong) | Chapter 03 wipe |
| 14.76 (beat) | Drop to room tone |
| 17.91 (strong) | Cell division |
| 18.44 / 18.96 / 19.49 (beats) | Stomps 2, 3, 4 |
| 21.07 (beat) | Merge |
| 22.65 (strong, downbeat) | Enter |
| 24.23 (strong) | Wipe home |

Pace: fast through chapters 01–02 (a relay every 3 s), a held breath at the refusal, an acceleration at the split (four stomps on four beats), then a slower close.

## 7. Sound design

| Section | Ambience bed | Main foley | Music state |
|---|---|---|---|
| 01 Edit (0–5.8) | Quiet room tone | Trackpad click on Apply; 8-bit crouch, jump, land; 8-bit crunch as the token breaks; soft typing ticks as the new class appears | Band in from 0 (0.1 s fade); chiptune note on the landing (1.60) and on the tab title (3.70) |
| 02 Precise (5.8–12.65) | Room tone | Keyboard thock + click for `72 ⏎` and `18 ⏎` (human jitter); pane swish on each whip; popup pop for the scope select; 8-bit stomps; tiny pats | Band; chiptune note per stomp |
| 03 Layout (12.65–14.76) | Room tone | Trackpad drag; 8-bit ride squeak; landing | Band; chiptune glide up during the ride |
| Refusal (14.76–17.91) | Room tone alone for 0.5 s | Popup pop and one muted error blip for the toast; 8-bit sign raise | Band low-passed and ducked about 12 dB under a single held pad, back in on 17.91 |
| 04 Everywhere (17.91–25) | Room tone | 8-bit burst on the split and the merge; keyboard on the command; Enter | Band full; four rising chiptune notes on 17.91–19.49 (the duet); one last chiptune note as the mascot lands home; band fades over 0.6 s from 24.4 |

Loudness −14 LUFS, true peak ≤ −1 dBTP. No foley on caption pops. Never two hits within 0.15 s.

## 8. Captions and title

- **Caption pills**: neutral frosted glass, white Inter 700 at about 46 px, bottom-centre but above the bottom 12 % of the frame (X's player controls sit there). Never over the element that changes, never under the mascot. Each holds at least 1.8 s and at least (letters ÷ 15 + 1.5) s.

| Caption | Letters | Needs | Holds |
|---|---|---|---|
| I clicked a color. | 18 | 2.70 s | 0.00–2.80 |
| It edited my code. | 18 | 2.70 s | 2.90–5.70 |
| Only that class. | 16 | 2.57 s | 6.40–9.00 |
| Or every lg button. | 19 | 2.77 s | 9.80–12.60 |
| Not exact? Refused. | 19 | 2.77 s | 15.00–17.85 |
| React, Vue, Svelte, Astro. | 26 | 3.23 s | 18.10–21.35 |
| Open source. | 12 | 2.30 s | 21.45–23.80 |

  Chapter 03's drag has no caption: the picture says it, and a fourth line in 9 s would break the reading pace.
- **Chapter pill**: top-left, "02 · Precise", "03 · Layout", "04 · Everywhere", in on the wipe, out after 1.5 s. Chapter 01 has none, so the poster frame stays clean.
- **Key HUD**: top-right, KeyCastr-style, for `7 2 ⏎`, `1 8 ⏎` and the command.
- **Title**: diegetic only, the browser tab "Glide — Code-Native Visual Designer" (the editor's real page title).

## 9. Mascot

An original pixel character built from Glide's logo, three cursors trailing each other: a chunky pixel arrowhead (about 12 × 12 sprite pixels) with two square eyes and stubby legs, in a saturated orange (#ff7a1a) that no main UI element uses. When it moves fast it leaves two fading pixel copies of itself behind, the logo's trail. Expressions: neutral, down, wide, happy, shut; poses: stand, crouch, jump, land, cheer, pat, hold sign, ride. The real cursor stays the user's: white with a black outline, no legs, no eyes.

Risk to check in the model sheet: a cursor-shaped mascot next to the real cursor. If it reads as a second cursor at thumbnail size, round the body further and keep only the arrow's tip as an ear.

## 10. Production notes

- The UI is redrawn in HTML, so text stays sharp at every zoom; no screen recording goes into the film. Before animating, rerun each edit in the real editor on `brag-output/work/demo-app` (line 24 restaged to `mt-4 text-5xl md:text-6xl font-bold tracking-tight text-slate-900`) and copy every diff, toast and refusal message verbatim into `content/diffs.md`. Nothing on screen claims more than the README does.
- The verbatim `Button.tsx:14` diff (`lg: 'h-12 px-6 text-base'` → `'h-12 px-6 text-lg'`) is from the 15 Nov run.
- Deliver per the library: `watch-the-code.mp4`, `poster.jpg` (frame 0), `subtitles_en.srt`, this treatment, `CREDITS`, the source and a one-command `build.sh`.
