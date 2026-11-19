// "Watch the Code": timeline. Camera, the mascot's performance, the cursor, UI state, captions, HUD and sound events.
// No voice: every beat hangs on the music grid (Happy Beats vol. 11, 114.84 BPM; first strong beat 1.60 s).
import { clamp, lerp, seg, ss, eio, eo, back, hash } from '/core/lib.js';

export const BPM = 114.84, B = 60 / BPM, GRID0 = 1.60 % B, DUR = 25.0;
export const EV = [];
const ev = (t, type, o = {}) => EV.push({ t: +t.toFixed(3), type, ...o });

// ───────── typing with a human hand (deterministic jitter); returns the time of each character
function typing(t0, text, cps = 22, seed = 1, kind = 'key') {
  const T = []; let t = t0;
  for (let i = 0; i < text.length; i++) {
    const r = hash(seed * 31 + i * 7.3); t += (1 / cps) * (.6 + r * .8) + (text[i] === ' ' ? .02 : 0);
    T.push(t); if (kind) ev(t, kind, { v: .55 + r * .4 });
  }
  return T;
}
const nTyped = (T, t) => { let n = 0; while (n < T.length && T[n] <= t) n++; return n; };
// text the software writes (no key sounds: it is not the user typing)
function writing(t0, text, cps = 40) { return Array.from(text, (_, i) => t0 + (i + 1) / cps); }

// ───────── camera: one take inside the desktop; a cut only under a wipe
const EASE = { eio, ss, eo, whip: x => { x = clamp(x); return x < .5 ? 16 * x ** 5 : 1 - (-2 * x + 2) ** 5 / 2; } };
export const CAM0 = [630, 1045, .947];
const MOVES = [];
const cam = (t0, d, to, e = 'eio') => { MOVES.push({ t0, d, to, e }); if (e === 'whip') ev(t0 + d * .35, 'whip'); };
const cut = (t, to) => MOVES.push({ t0: t, d: .001, to, e: 'eio' });
const W = 1700;
export function camAt(t) {
  let v = CAM0.slice(); v[2] = Math.log(v[2]);
  for (const m of MOVES) { if (t <= m.t0) break; const p = EASE[m.e]((t - m.t0) / m.d);
    v = [lerp(v[0], m.to[0], p), lerp(v[1], m.to[1], p), lerp(v[2], Math.log(m.to[2]), p)]; }
  const z = Math.max(1080 / W, Math.exp(v[2])), h = 540 / z;          // never show past the edge of the desktop
  return [clamp(v[0] + Math.sin(t * .7) * 1.2, h, W - h), clamp(v[1] + Math.sin(t * .53 + 1) * .9, h, W - h), z];
}

// ───────── the mascot
class Actor {
  constructor(px = 8) { this.px = px; this.segs = []; this.jumps = []; }
  add(s) { this.segs.push(s); return this; }
  stand(t0, t1, at, o = {}) { return this.add({ k: 'stand', t0, t1, at, ...o }); }
  jump(t0, t1, from, to, h = 60, o = {}) { this.jumps.push({ t0, t1 }); ev(t0 - .02, 'jump', { d: t1 - t0 }); ev(t1, o.stomp ? 'stomp' : 'land', { v: o.big ? 1 : .7 });
    return this.add({ k: 'jump', t0, t1, from, to, h, ...o }); }
  hide(t0, t1) { return this.add({ k: 'hide', t0, t1 }); }
  seg(t) { let s = null; for (const x of this.segs) { if (x.t0 <= t && t < x.t1) return x; if (x.t0 <= t) s = x; } return s; }
  eval(t, A) {
    const s = this.seg(t); if (!s || s.k === 'hide') return null;
    const px = s.px || this.px; let pos, legs = 'stand', flip = s.flip || false, sq = 0, arms = 'down', eyes = 'n';
    const P = f => typeof f === 'function' ? f(A, t) : f;
    if (s.k === 'stand') pos = P(s.at);
    if (s.k === 'jump') { const a = P(s.from), b = P(s.to); if (!a || !b) return null; const p = seg(t, s.t0, s.t1);
      const ap = Math.min(a.y, b.y) - s.h, cy = 2 * ap - (a.y + b.y) / 2;
      pos = { x: lerp(a.x, b.x, p), y: (1 - p) ** 2 * a.y + 2 * (1 - p) * p * cy + p * p * b.y };
      legs = 'tuck'; flip = b.x < a.x - 2; sq = p < .5 ? -.22 * (1 - p * 2) : -.12 * (p * 2 - 1); arms = 'up'; eyes = s.eyesAir || 'wide'; }
    if (!pos) return null;
    for (const j of this.jumps) {                                   // wind-up before, squash after
      if (t >= j.t0 - .14 && t < j.t0) sq = Math.max(sq, .28 * ss(seg(t, j.t0 - .14, j.t0)));
      if (t >= j.t1 && t < j.t1 + .22) { const k = seg(t, j.t1, j.t1 + .22); sq = .34 * (1 - k) * Math.cos(k * 7); }
    }
    if (s.k === 'stand') {
      const bp = (((t - GRID0) % B) + B) % B; if (bp < .12) sq += .07 * Math.sin(bp / .12 * Math.PI);   // breathes on the beat
      const bl = Math.floor(t / 2.7), bt = t - bl * 2.7 - hash(bl * 3.7 + this.px) * 1.8; if (bt > 0 && bt < .1) eyes = 'blink';
      if (s.eyes) { const e = typeof s.eyes === 'function' ? s.eyes(t) : s.eyes; if (e && !(eyes === 'blink' && e === 'n')) eyes = e; }
      if (s.arms) arms = typeof s.arms === 'function' ? s.arms(t) : s.arms;
    }
    const x = pos.x;                                                  // no grid snap: float noise during zooms flipped it a sprite pixel back and forth
    return { x, y: pos.y, px, flip, sq, legs, arms, eyes, shadow: s.k === 'jump' ? 0 : 1, jump: s.k === 'jump', sign: !!s.sign };
  }
}

// ───────── the cursor (the user)
class Cursor {
  constructor() { this.moves = []; this.clicks = []; this.vis = []; }
  show(t0, t1) { this.vis.push([t0, t1]); return this; }
  move(t0, t1, to, arc = 30) { this.moves.push({ t0, t1, to, arc }); return this; }
  click(t, kind = 'click') { this.clicks.push(t); ev(t, kind); return this; }
  eval(t, A) {
    let op = 0; for (const [a, b] of this.vis) if (t >= a && t <= b) op = Math.max(op, Math.min(a === 0 ? 1 : seg(t, a, a + .15), b >= DUR ? 1 : 1 - seg(t, b - .2, b)));
    if (op <= 0) return null;
    let p = null, prev = null;
    for (const m of this.moves) { const to = m.to(A, t); if (!to) continue; if (t < m.t0) break;
      if (!prev) { p = to; prev = to; continue; }
      const k = m.t1 > m.t0 ? seg(t, m.t0, m.t1) : 1, e = eio(k), dx = to.x - prev.x, dy = to.y - prev.y, L = Math.hypot(dx, dy) || 1;
      p = { x: lerp(prev.x, to.x, e) - dy / L * m.arc * Math.sin(Math.PI * e), y: lerp(prev.y, to.y, e) + dx / L * m.arc * Math.sin(Math.PI * e), sp: Math.abs(Math.sin(Math.PI * k)) * L / Math.max(.01, m.t1 - m.t0) };
      if (k < 1) break; prev = to; }
    if (!p) return null;
    let sc = 1, ring = 0; for (const c of this.clicks) { if (t >= c && t < c + .1) sc = .82; if (t >= c && t < c + .45) ring = seg(t, c, c + .45); }
    return { ...p, op, sc, ring };
  }
}

// ───────── anchors: a point on a live element; when it is briefly absent, reuse its last position
const at = (key, fx = .5, fy = 0, dx = 0, dy = 0) => { let last = null; return A => { const p = A(key, fx, fy); if (p) last = { x: p.x + dx, y: p.y + dy }; return last; }; };
const pt = (x, y) => () => ({ x, y });
const boxes = {};
export const box = (A, key) => { const p = A(key, 0, 0); if (p) boxes[key] = { x: p.x, y: p.y, w: p.w, h: p.h }; return boxes[key] || null; };

// ───────── the timeline
export const T = {
  apply: 1.10, land0: 1.60, title: 3.70, wipe2: 5.80, md: 6.34, cut3: 8.96, scope: 9.50, pick: 9.85, tab: 10.22, lg: 11.06,
  wipe3: 12.65, drag0: 13.0, drag1: 13.6, rel: 13.70, styleW: 14.12, refuse: 15.05, split: 17.91, beats: [17.91, 18.44, 18.96, 19.49],
  merge: 21.07, cmd: 21.40, enter: 22.65, home: 24.23
};
export const SUBS = [
  [0.00, 2.80, 'I clicked a color'], [2.90, 5.70, 'It edited my code'], [6.40, 9.00, 'Only that class'], [9.80, 12.60, 'Or every lg button'],
  [15.00, 17.55, 'Not exact? Refused'], [18.10, 21.35, 'React, Vue, Svelte, Astro'], [21.45, 23.80, 'Open source'], [24.60, 25.01, 'I clicked a color']
].map(([t0, t1, text]) => ({ t0, t1, text }));
const CH = [[T.wipe2, '02', 'Precise', true], [T.wipe3, '03', 'Layout', true], [T.split, '04', 'Everywhere', false]];
const KEYS = [[5.98, ['7', '2', '⏎'], 'font size', [6.08, 6.18, 6.30]], [10.03, ['1', '8', '⏎'], 'font size', [10.12, 10.20, 10.30]], [22.40, ['⏎'], 'run', [T.enter]]];
const REFUSAL = 'Select one literal text segment. The element has no unique text target.';   // expected; replace with the text from the take
const CMD = 'npx @srivarsank/glide 5173';
const OUT = ['[Glide] Visual design workspace server listening on ws://localhost:7777', '[Glide] Editor: http://localhost:7777  (preview of the dev server on port 5173)'];
const STYLE = 'left-[48px] top-[0px] relative';   // verbatim ast-writer output with Style format = Tailwind (content/diffs.md)

let C; const QC = []; let CUR; const TY = {};
const P0 = pt(900, 1000);                                                     // cursor's frame-0 position (and the loop's last)
function build() {
  for (const t of [6.08, 6.18, 6.30, 10.12, 10.20, 10.30]) ev(t, 'key', { v: .8 });
  TY.brand = writing(1.62, 'text-brand-500'); TY.md7 = writing(6.36, 'md:text-7xl'); TY.lg = writing(11.08, 'text-lg');
  TY.style = writing(T.styleW, STYLE, 60); TY.cmd = typing(T.cmd, CMD, 26, 5);
  ev(T.land0, 'crumble'); ev(T.md, 'crumble'); ev(T.lg, 'crumble'); ev(1.62, 'toast'); ev(T.scope, 'pop'); ev(T.refuse, 'error'); ev(T.refuse, 'toast');
  ev(14.76, 'drop'); ev(17.91, 'resume'); ev(T.split - .23, 'burst'); ev(T.merge, 'burst'); ev(T.enter, 'enter');
  for (const [t0] of CH) if (t0 !== T.split) ev(t0 - .45, 'wipe'); ev(T.home - .45, 'wipe');
  for (const b of [T.land0, T.title, T.md, T.lg, ...T.beats, 24.75]) ev(b, 'chip');            // the mascot's chiptune notes

  // camera
  cam(0, 1.2, [645, 1050, .96], 'ss');
  // follow moves: smoothstep, never shorter than ~0.4 s of film time, arriving on the beat they used to land on
  // (the old quintic whips peaked at 5× their mean speed: 250–730 px in one frame, the "too fast" spots in the motion audit)
  cam(1.08, .58, [430, 1270, 1.45], 'ss');                                    // fall with the mascot to line 24
  cam(2.40, 1.1, [675, 700, .8]);                                            // one calm pull out to the whole window
  cam(3.72, 1.7, [380, 380, 1.6]);                                            // push to the tab title
  cut(T.wipe2, [1030, 470, 1.9]);                                             // panel: breakpoint and size
  cam(5.92, .42, [470, 1270, 1.45], 'ss');                                    // down to the code, landing with the stomp
  cam(7.20, .8, CAM0);
  cam(T.cut3 - .36, .4, [420, 700, 1.6], 'ss');                              // to "View the repo"
  cam(9.14, .5, [1000, 480, 1.7]);                                           // to the scope select
  cam(10.08, .46, [520, 1270, 1.45], 'ss');                                   // to Button.tsx
  cam(11.50, .7, CAM0);
  cut(T.wipe3, [420, 640, 1.6]);                                              // the subtitle
  cam(13.66, .44, [500, 1314, 1.3], 'ss');                                    // to line 25
  cam(14.70, .5, [440, 660, 1.5], 'ss');                                      // to the card and the toast
  cam(15.20, 2.4, [440, 690, 1.65], 'ss');                                    // the freeze: a slow push
  cam(17.40, .62, [850, 850, .635], 'ss');                                    // cell division: the whole desktop
  cam(19.60, 1.4, [850, 870, .7], 'ss');                                      // no dead hold on the four-up: a slow push in
  cam(21.00, .45, [750, 920, 1.0]);
  cam(21.40, 1.25, [750, 920, 1.1], 'ss');
  cut(T.home, CAM0);

  // the mascot
  C = new Actor(8);
  const h1 = at('h1t', .78, 0), slate = at('tk-slate', .5, 0), brand = at('tk-brand', .5, 0), lane24 = at('ln24', .9, 0);
  C.stand(0, 1.25, h1, { eyes: 'd' })
    .jump(1.25, T.land0, h1, slate, 30, { stomp: 1, big: 1 })
    .stand(T.land0, 2.02, brand, { eyes: 'wide' })
    .jump(2.02, 2.30, brand, lane24, 40)                                       // holds happen in the free lane at the line's end
    .stand(2.30, 3.15, lane24, { eyes: 'happy', arms: t => t < 2.9 ? 'up' : 'down', flip: true })
    .jump(3.15, T.title, lane24, at('tabtitle', .25, 0), 90)
    .stand(T.title, T.wipe2, at('tabtitle', .25, 0), { eyes: 'happy', arms: t => t > 3.8 && t < 4.7 ? (Math.floor(t * 6) % 2 ? 'wave' : 'up') : 'down' })
    .hide(T.wipe2, 5.95)
    .stand(5.95, 6.12, at('size', .5, 0), { eyes: 'd' })
    .jump(6.12, T.md, at('size', .5, 0), at('tk-md6', .5, 0), 30, { stomp: 1 })
    .stand(T.md, 6.72, at('tk-md7', .5, 0), { eyes: 'happy' })
    .jump(6.72, 6.98, at('tk-md7', .5, 0), at('tk-5xl', .5, 0), 50)
    .stand(6.98, 7.42, at('tk-5xl', .5, 0), { eyes: 'happy', arms: t => Math.floor(t * 8) % 2 ? 'wave' : 'down' })
    .jump(7.42, 7.70, at('tk-5xl', .5, 0), lane24, 40)
    .stand(7.70, 8.70, lane24, { eyes: 'l', flip: true })
    .jump(8.70, 9.15, lane24, at('btn1', .5, 0), 60)
    .stand(9.15, 9.55, at('btn1', .5, 0), { eyes: 'u' })
    .jump(9.55, 9.85, at('btn1', .5, 0), at('scope', .85, 0), 60)
    .stand(9.85, 10.25, at('scope', .85, 0), { eyes: 'd' })
    .jump(10.25, T.lg, at('scope', .85, 0), at('tk-base', .5, 0), 40, { stomp: 1, big: 1 })
    .stand(T.lg, 11.40, at('tk-lg', .5, 0), { eyes: 'wide' })
    .jump(11.40, 11.66, at('tk-lg', .5, 0), at('ln14', .88, 0), 40)
    .stand(11.66, T.wipe3, at('ln14', .88, 0), { eyes: 'happy', arms: t => t < 12.3 ? 'up' : 'down', flip: true })
    .hide(T.wipe3, 12.85)
    .stand(12.85, 13.75, at('sub', .55, 0), { px: 5, eyes: t => t < 13.0 ? 'n' : 'happy', arms: t => t > 13.0 && t < 13.65 ? 'up' : 'down' })
    .jump(13.75, 14.05, at('sub', .55, 0), at('tk-style', .03, 0), 50)
    .stand(14.05, 14.80, at('tk-style', .03, 0), { eyes: 'happy' })
    .jump(14.80, 15.15, at('tk-style', .03, 0), at('card0', .5, 0), 90)
    .stand(15.15, T.split - .62, at('card0', .5, 0), { eyes: 'stern', arms: t => t > 15.3 ? 'sign' : 'down', sign: true })
    .jump(T.split - .62, T.split - .23, at('card0', .5, 0), pt(850, 850), 120)            // into the middle of the desk, where it divides
    .hide(T.split - .23, T.merge + .05)
    .stand(T.merge + .05, 22.80, at('termbar', .3, 0), { eyes: 'd' })
    .jump(22.80, 23.08, at('termbar', .3, 0), at('out1', .9, 0), 40)
    .stand(23.08, T.home, at('out1', .9, 0), { eyes: 'happy', arms: t => t < 23.8 ? 'up' : 'down', flip: true })
    .hide(T.home, 24.45)
    .stand(24.45, DUR + 1, h1, { eyes: 'd' });
  C.signFrom = 15.3;
  // four clones, one per framework window, each stamping its header on its beat
  T.beats.forEach((b, i) => {
    const q = at('qh' + i, .5, 0), a = new Actor(9);
    if (i === 0) a.stand(T.split - .23, T.merge, q, { eyes: 'happy', arms: t => t > T.split && t < T.split + .5 ? 'up' : 'down' });
    else a.stand(T.split - .23, b - .26, q, { eyes: 'u' }).jump(b - .26, b, q, q, 70, { stomp: 1 }).stand(b, T.merge, q, { eyes: 'happy', arms: t => t < b + .5 ? 'up' : 'down' });
    QC.push(a);
  });

  // the cursor
  CUR = new Cursor();
  CUR.show(0, 3.0).move(0, 0, P0).move(0, 1.0, at('apply', .5, .55)).click(T.apply)
    .show(5.85, 6.40).move(5.85, 5.85, at('size', .3, .6)).click(5.95)
    .show(T.cut3 - .1, 10.25).move(T.cut3 - .1, T.cut3 - .1, pt(520, 760)).move(T.cut3 - .1, 9.06, at('btn1', .6, .6)).click(9.1)
      .move(9.14, 9.44, at('scope', .45, .55)).click(9.47).move(9.55, 9.82, at('opt3', .45, .55)).click(T.pick)
    .show(12.85, 13.95).move(12.85, 12.85, at('sub', .2, .55)).click(12.95, 'press').move(T.drag0, T.drag1, at('sub', .2, .55)).click(T.rel, 'release')
    .show(14.52, 17.6).move(14.52, 14.52, pt(600, 760)).move(14.56, 14.92, at('cardbody0', .4, .5)).click(14.95).click(T.refuse)
    .show(24.40, DUR + 1).move(24.40, 24.40, P0);
}
build();

// ───────── one frame
export function frame(t) {
  const F = { t, hud: {}, fx: [], actors: [C], clones: [], cursor: CUR, cam: camAt(t) };
  const home = t >= T.home;                                                  // the loop: back to frame 0's state
  const tk = (TYt, text, from, cls) => t < from ? { text, n: 0 } : { text, n: nTyped(TYt, t), cls };
  // editor
  const btnStage = t >= T.cut3 && t < T.wipe3 && !home;
  const E = F.ed = {
    file: t >= T.pick && btnStage ? 'Button.tsx' : 'App.tsx',
    sel: home || t < 9.1 ? 'h1' : t < T.wipe3 ? 'btn1' : t >= 12.95 && t < 14.76 ? 'sub' : t >= 14.95 && t < T.split ? 'card' : null,
    h1Col: !home && t >= T.land0 ? '#6d28d9' : '#0f172a', h1Size: !home && t >= T.md ? 72 : 60, btnText: !home && t >= T.lg ? 18 : 16,
    subDX: home ? 0 : 48 * eio(seg(t, T.drag0, T.drag1)), subDY: 0, guide: !home && t > 13.3 && t < 13.8 ? Math.min(seg(t, 13.3, 13.4), 1 - seg(t, 13.7, 13.8)) : 0,
    bp: !home && t >= T.wipe2 && t < T.cut3 ? 'md' : 'Base', props: btnStage && t >= 9.1 ? 'button' : 'h1',
    colorHex: !home && t >= T.land0 ? '#6d28d9' : '#000000',
    picker: home || t < 1.45 ? { op: home ? 1 : 1 - seg(t, 1.30, 1.45), hex: '#6d28d9', press: t >= T.apply && t < T.apply + .12 } : null,
    sizeField: '60', sizeHot: false, toast: null,
    scope: { val: t >= T.pick ? 'Every &lt;Button size="lg"&gt;' : 'This &lt;Button&gt; · App.tsx:27', op: t >= T.scope && t < T.pick + .15 ? Math.min(seg(t, T.scope, T.scope + .12), 1 - seg(t, T.pick, T.pick + .15)) : 0,
      pick: t >= 9.80 ? 3 : -1, hot: t >= 9.45 && t < 10.3 }
  };
  if (!home && t >= 5.95 && t < 6.34) { E.sizeHot = true; E.sizeField = t < 6.08 ? '60' : t < 6.18 ? '7' : '72'; }
  else if (!home && t >= T.md && t < T.cut3) E.sizeField = '72';
  if (E.props === 'button') { E.sizeField = t < 10.12 ? '16' : t < 10.20 ? '1' : '18'; E.sizeHot = t >= 10.03 && t < 10.32; }
  if (!home && t >= 1.62 && t < 3.3) E.toast = { text: '⚡ Instant Mode active: edits write directly to source code on disk immediately.', op: Math.min(seg(t, 1.62, 1.75), 1 - seg(t, 3.1, 3.3)) };
  if (!home && t >= T.refuse && t < T.split - .25) E.toast = { err: 1, text: `<b>⚠</b> ${REFUSAL}`, op: Math.min(seg(t, T.refuse, T.refuse + .12), 1 - seg(t, T.split - .45, T.split - .25)) };
  // code
  const K = {}, onBtn = btnStage && t >= T.tab;
  if (home || t < T.land0) K.slate = { text: 'text-slate-900' }; else K.brand = tk(TY.brand, 'text-brand-500', 1.62, t < 3.6 ? 'new' : '');
  if (!home && t >= 1.55 && t < T.land0) K.brand = { text: 'text-brand-500', n: 0 };
  K['5xl'] = { text: 'text-5xl' };
  if (home || t < T.md) { K.md6 = { text: 'md:text-6xl' }; if (!home && t >= 6.28) K.md7 = { text: 'md:text-7xl', n: 0 }; } else K.md7 = tk(TY.md7, 'md:text-7xl', 6.36, t < 8.5 ? 'new' : '');
  if (t < T.lg) K.base = { text: 'text-base' }; if (t >= 11.0) K.lg = t < T.lg ? { text: 'text-lg', n: 0 } : tk(TY.lg, 'text-lg', 11.08, t < 12.4 ? 'new' : '');
  if (!home && t >= 13.70) K.style = { text: STYLE, n: t < T.styleW ? 0 : nTyped(TY.style, t), cls: 'wrap' + (t < 14.7 ? ' new' : '') };
  F.code = { file: onBtn ? 'Button.tsx' : 'App.tsx', tok: K, scroll: 0,
    mark: { 24: !home && t >= T.land0, 25: !home && t >= 14.0, 14: !home && t >= T.lg } };
  // terminal, four-up
  F.term = !home && t >= T.merge ? { op: eo(seg(t, T.merge, T.merge + .35)), typed: CMD.slice(0, nTyped(TY.cmd, t)), caret: t < T.enter && Math.floor(t * 2.4) % 2 === 0,
    out: OUT.slice(0, t >= T.enter + .06 ? (t >= T.enter + .14 ? 2 : 1) : 0) } : null;
  F.quad = !home && t >= T.split - .23 && t < T.merge + .3 ? { in: [0, 1, 2, 3].map(i => t < T.merge ? back(seg(t, T.split - .23 + i * .05, T.split + .1 + i * .05), 1.2) : 1 - eio(seg(t, T.merge, T.merge + .3))),
    k: T.beats.map(b => t >= b ? 1 : 0) } : null;
  if (F.quad) F.clones = QC;
  F.showMain = !(F.quad && t < T.merge + .2);
  hud(F, t, home);
  return F;
}

function hud(F, t, home) {
  const H = F.hud;
  const s = SUBS.find(x => t >= x.t0 && t < x.t1);
  // asymmetric: a slow, eased entrance that rises out of a vertical blur, then a quicker exit that blurs away (bang-motion: directional blur on every text in/out)
  if (s) { const kin = s.t0 === 0 ? 1 : eo(seg(t, s.t0, s.t0 + .22)), kout = seg(t, s.t1 - .1, s.t1);
    H.cap = { text: s.text, op: s.t0 === 0 ? 1 - kout : s.t1 > DUR ? kin : Math.min(kin, 1 - kout), y: (1 - kin) * 18 - kout * 8, blur: (1 - kin) * 7 + kout * 5 }; }
  for (const [t0, no, nm, wipe] of CH) {
    if (wipe && t >= t0 - .45 && t < t0 + .42) H.wipe = { p: (t - t0 + .45) / .87, no, nm };
    if (t >= t0 + .4 && t < t0 + 2.0) H.chap = { no, nm, op: Math.min(seg(t, t0 + .4, t0 + .6), 1 - seg(t, t0 + 1.8, t0 + 2.0)) };
  }
  for (const [t0, keys, label, press] of KEYS) if (t >= t0 && t < press[press.length - 1] + .6)
    H.keys = { keys, label, op: Math.min(seg(t, t0, t0 + .12), 1 - seg(t, press[press.length - 1] + .4, press[press.length - 1] + .6)), dn: press.findIndex(p => t >= p && t < p + .16) };
  if (!home && t > T.refuse && t < T.split - .2) H.spot = { key: 'card0', op: Math.min(seg(t, T.refuse, T.refuse + .4), 1 - seg(t, T.split - .5, T.split - .2)) };
}

// every text the viewer must read, with its box, for readcheck
// the last caption only restarts the first one for the loop, so it is left out of the check
export function texts(t) { const s = SUBS.find(x => t >= x.t0 && t < x.t1 && x.t1 <= DUR); return s ? [{ id: 'cap' + s.t0, text: s.text }] : []; }
