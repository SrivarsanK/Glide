// "Glide in two minutes": the demo. One engine, two cuts (?cut=yt | reel), two shapes (16:9 side by side, 9:16 stacked).
// Scenes are written in their own local seconds; a cut lists scenes, and each scene's start time is added when it is built.
// No voice: captions carry the story. Music: Happy Beats vol. 11 (114.84 BPM).
import { clamp, lerp, seg, ss, eio, eo, back, hash } from '/core/lib.js';
import * as UI from './ui.js';

const Q = new URLSearchParams(location.search);
export const VW = innerWidth, VH = innerHeight, AR = VW >= VH ? '16x9' : '9x16', CUT = Q.get('cut') === 'reel' ? 'reel' : 'yt';
UI.layout(AR);
export const BPM = 114.84, B = 60 / BPM, GRID0 = 1.60 % B;
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
const writing = (t0, text, cps = 40) => Array.from(text, (_, i) => t0 + (i + 1) / cps);

// ───────── camera: rectangles of the world, fitted to the frame; a cut only under a wipe
const EASE = { eio, ss, eo };
const fit = r => [r.x + r.w / 2, r.y + r.h / 2, Math.min(VW / r.w, VH / r.h)];
const MOVES = [];
const cam = (t0, d, r, e = 'eio') => MOVES.push({ t0, d, to: fit(r), e });
const cut = (t, r) => MOVES.push({ t0: t, d: .001, to: fit(r), e: 'eio' });
export function camAt(t) {
  let v = MOVES.length ? MOVES[0].to.slice() : [VW / 2, VH / 2, 1]; v[2] = Math.log(v[2]);
  for (const m of MOVES) { if (t <= m.t0) break; const p = EASE[m.e]((t - m.t0) / m.d);
    v = [lerp(v[0], m.to[0], p), lerp(v[1], m.to[1], p), lerp(v[2], Math.log(m.to[2]), p)]; }
  const z = Math.max(VW / UI.WORLD.w, VH / UI.WORLD.h, Math.exp(v[2])), hw = VW / 2 / z, hh = VH / 2 / z;   // never show past the desktop
  return [clamp(v[0] + Math.sin(t * .7) * 1.2, hw, UI.WORLD.w - hw), clamp(v[1] + Math.sin(t * .53 + 1) * .9, hh, UI.WORLD.h - hh), z];
}
const pad = (r, p) => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });
const union = (a, b) => { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }; };
const { BW, CWN, TW, QW } = UI;
const R = {
  split: pad(union(BW, CWN), 24), browser: pad(BW, 30), code: pad(CWN, 24), term: pad(TW, 40),
  codeTop: { x: CWN.x - 20, y: CWN.y - 10, w: CWN.w + 40, h: 560 },
  panel: AR === '16x9' ? { x: BW.x + BW.w - 1100, y: BW.y + 60, w: 1100, h: 620 } : { x: BW.x + 560, y: BW.y + 70, w: 620, h: 640 },
  hero: { x: BW.x + 20, y: BW.y + 160, w: 820, h: 560 },
  canvas: AR === '16x9' ? { x: BW.x - 20, y: BW.y + 70, w: 1200, h: 900 } : { x: BW.x, y: BW.y + 90, w: 840, h: 860 },
  vite: { x: CWN.x - 20, y: CWN.y - 10, w: CWN.w + 40, h: 760 },
  quad: pad(union(QW[0], { x: QW[3].x, y: QW[3].y, w: 790, h: 790 }), 30),
};

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
    const x = Math.round(pos.x / (px / 2)) * (px / 2);
    return { x, y: pos.y, px, flip, sq, legs, arms, eyes, shadow: s.k === 'jump' ? 0 : 1, jump: s.k === 'jump', sign: s.signFrom !== undefined && t >= s.signFrom, signFrom: s.signFrom };
  }
}
const wave = (a, b) => t => t > a && t < b ? (Math.floor(t * 6) % 2 ? 'wave' : 'up') : 'down';

// ───────── the cursor (the user)
class Cursor {
  constructor() { this.moves = []; this.clicks = []; this.vis = []; }
  show(t0, t1) { this.vis.push([t0, t1]); return this; }
  move(t0, t1, to, arc = 30) { this.moves.push({ t0, t1, to, arc }); return this; }
  click(t, kind = 'click') { this.clicks.push(t); ev(t, kind); return this; }
  eval(t, A) {
    let op = 0; for (const [a, b] of this.vis) if (t >= a && t <= b) op = Math.max(op, Math.min(seg(t, a, a + .2), 1 - seg(t, b - .25, b)));
    if (op <= 0) return null;
    let p = null, prev = null;
    for (const m of this.moves) { if (t < m.t0) break; const to = m.to(A, t); if (!to) continue;
      if (!prev || m.t1 <= m.t0) { p = to; prev = to; continue; }
      const k = seg(t, m.t0, m.t1), e = eio(k), dx = to.x - prev.x, dy = to.y - prev.y, L = Math.hypot(dx, dy) || 1;
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

// ───────── the starting state of the editor and the files (the demo app as committed, Style format = Tailwind)
const SLATE = '#0f172a', BRAND = '#6d28d9', RED = '#ef4444';
const DEF = () => ({
  ed: { file: 'App.tsx', sel: null, h1Col: SLATE, h1Size: 60, h1Text: 'Building Glide.', subText: 'Design visually. Ship real source code.', subSize: 20, subDX: 0, subDY: 0, guide: 0,
    btnText: 16, bp: 'Base', props: 'h1', colorHex: SLATE, picker: null, sizeField: '60', sizeHot: false, toast: null, mode: 'instant', staged: null, history: null,
    scope: { val: 'This &lt;Button&gt; · App.tsx:27', op: 0, pick: -1, hot: false } },
  code: { file: 'App.tsx', from: 22, mark: {}, tok: { '5xl': { text: 'text-5xl' }, md6: { text: 'md:text-6xl' }, slate: { text: 'text-slate-900' }, h1txt: { text: 'Building Glide.' },
    xl: { text: 'text-xl' }, subtxt: { text: 'Design visually. Ship real source code' }, subend: { text: '.' }, base: { text: 'text-base' } } },
});
const clone = o => JSON.parse(JSON.stringify(o));
const tk = (TYt, text, from, t, cls) => t < from ? { text, n: 0 } : { text, n: nTyped(TYt, t), cls };
const REFUSAL = 'Select one literal text segment. The element has no unique text target.';   // verbatim, ast-writer mutateText (content/diffs.md)
const STYLE = 'left-[48px] top-[0px] relative';                                              // verbatim ast-writer layout output, Style format = Tailwind
const INSTANT = '⚡ Instant Mode active: edits write directly to source code on disk immediately.';
const toastIn = (t, a, b) => t >= a && t < b ? Math.min(seg(t, a, a + .15), 1 - seg(t, b - .2, b)) : 0;

// ───────── scenes: (o, ctx) → { dur, state(l, S) } ; ctx.C is the mascot, ctx.U the cursor
const SUBS = [], CRUMBLES = [], BURSTS = [], KEYS = [], CARDS = [], SPOTS = [];
const sub = (a, b, text) => SUBS.push({ t0: a, t1: b, text });
const key = (t0, keys, label, press) => KEYS.push([t0, keys, label, press]);

const SC = {};
SC.cold = (o, { C, U }) => {
  const TY = writing(o + 1.62, 'text-brand-500');
  cut(o, R.split); cam(o + .3, 7.4, pad(R.split, -30), 'ss');
  U.show(o, o + 3.2).move(o, o, at('h1t', 1.2, 2)).move(o + .1, o + 1.0, at('apply', .5, .55)).click(o + 1.1);
  const h1 = at('h1t', .78, 0);
  C.stand(o, o + 1.25, h1, { eyes: 'd' }).jump(o + 1.25, o + 1.6, h1, at('tk-slate', .5, 0), 30, { stomp: 1, big: 1 })
    .stand(o + 1.6, o + 2.6, at('tk-brand', .5, 0), { eyes: 'wide' }).jump(o + 2.6, o + 2.95, at('tk-brand', .5, 0), at('ln24', .9, 0), 40)
    .stand(o + 2.95, o + 8, at('ln24', .9, 0), { eyes: 'happy', arms: wave(o + 3.2, o + 4.4), flip: true });
  CRUMBLES.push([o + 1.6, 'tk-brand', 14]); ev(o + 1.6, 'crumble'); ev(o + 1.6, 'chip'); ev(o + 1.62, 'toast');
  sub(o, o + 3.5, 'Click an element. Change its color.'); sub(o + 3.6, o + 7.5, 'Glide writes it to your source file.');
  return { dur: 8, end: S => { S.ed.h1Col = BRAND; S.ed.colorHex = BRAND; delete S.code.tok.slate; S.code.tok.brand = { text: 'text-brand-500' }; },
    state(l, S) { const E = S.ed, K = S.code.tok;
      E.sel = 'h1'; E.picker = l < 1.45 ? { op: 1 - seg(l, 1.3, 1.45), hex: '#6d28d9', press: l >= 1.1 && l < 1.22 } : null;
      if (l >= 1.6) { E.h1Col = BRAND; E.colorHex = BRAND; delete K.slate; K.brand = tk(TY, 'text-brand-500', o + 1.62, o + l, l < 6 ? 'new' : ''); S.code.mark[24] = 1; }
      else if (l >= 1.55) K.brand = { text: 'text-brand-500', n: 0 };
      const op = toastIn(l, 1.62, 3.4); if (op) E.toast = { text: INSTANT, op };
    } };
};
SC.title = (o, ctx, kind = 'title') => {
  const dur = kind === 'title' ? (CUT === 'reel' ? 4.5 : 5) : (CUT === 'reel' ? 6.5 : 7.5);
  CARDS.push({ t0: o, kind, dur });
  ev(o + .3, 'wipe'); ev(o + .73, 'jump', { d: .5 }); ev(o + 1.25, 'land', { v: 1 }); ev(o + 1.3, 'chip'); ev(o + 1.9, 'chip');
  ctx.C.hide(o + .3, o + 99);
  return { dur, state() {} };
};
SC.setup = (o, { C, U }) => {
  const c1 = 'npm install -D @srivarsank/glide', c2 = 'npm run dev';
  const T1 = typing(o + .5, c1, 18, 3), T2 = typing(o + 9.0, c2, 13, 7);
  const IMP = `import { glideSourceStamping } from '@srivarsank/glide/vite-plugin'`, PLG = ', glideSourceStamping()';
  const TI = typing(o + 4.4, IMP, 34, 11), TP = typing(o + 7.0, PLG, 20, 13);
  ev(o + 2.9, 'enter'); ev(o + 9.95, 'enter');
  cut(o, R.term); cam(o + 3.7, .8, R.vite); cam(o + 8.4, .8, R.term);
  const OUT = ['', '  VITE v8.3.6  ready in 312 ms', '', '  ➜  Local:   http://localhost:5173/', '  [Glide] Editor: http://127.0.0.1:5173/__glide/'];
  U.show(o + 11.6, o + 14.6).move(o + 11.6, o + 11.6, at('trow2', .5, 3)).move(o + 11.7, o + 12.5, at('trow7', .55, .55)).click(o + 12.7);
  C.stand(o, o + 2.95, at('termbar', .3, 0), { eyes: 'd' }).jump(o + 2.95, o + 3.3, at('termbar', .3, 0), at('trow1', AR === '16x9' ? .85 : .95, 0), 50)
    .stand(o + 3.3, o + 3.7, at('trow1', AR === '16x9' ? .85 : .95, 0), { eyes: 'happy' }).hide(o + 3.7, o + 4.5)
    .stand(o + 4.5, o + 8.3, at('ln8', .3, 1), { eyes: t => t < o + 8.0 ? 'u' : 'happy', arms: t => t > o + 8.0 ? 'up' : 'down' }).hide(o + 8.3, o + 9.2)
    .stand(o + 9.2, o + 10.5, at('termbar', .3, 0), { eyes: 'd' }).jump(o + 10.5, o + 10.9, at('termbar', .3, 0), at('trow7', .95, 0), 60)
    .stand(o + 10.9, o + 20, at('trow7', .95, 0), { eyes: 'happy', arms: wave(o + 11.0, o + 12.4), flip: true });
  ev(o + 10.9, 'chip'); ev(o + 3.3, 'chip');
  sub(o + .4, o + 3.4, 'Install Glide.'); sub(o + 3.8, o + 8.0, 'Add one plugin to vite.config.ts.'); sub(o + 8.4, o + 11.3, 'Start your dev server.');
  sub(o + 11.4, o + 14.8, 'Open the editor link it prints.'); sub(o + 14.9, o + 19.0, 'No Vite? Run npx @srivarsank/glide 5173');
  return { dur: 19.4, hideBrowser: true, end: S => { Object.assign(S, DEF()); },
    state(l, S) { const t = o + l;
      const rows = [{ p: c1.slice(0, nTyped(T1, t)), caret: l < 2.9 }];
      if (l >= 3.2) rows.push({ text: 'added 1 package in 2s' });
      if (l >= 8.9) rows.push({ p: c2.slice(0, nTyped(T2, t)), caret: l < 9.95 });
      OUT.forEach((x, i) => { if (l >= 10.25 + i * .08) rows.push({ text: x, hi: i === 4 && l >= 10.9 }); });
      const vis = l < 3.7 ? seg(l, 0, .35) : l < 8.4 ? 1 - seg(l, 3.7, 4.0) : seg(l, 8.4, 8.75);
      S.term = { op: vis, rows };
      S.code = { file: 'vite.config.ts', tabs: ['vite.config.ts'], from: 1, dirty: l > 4.4 && l < 8.1, mark: { 4: l >= 6.6, 7: l >= 7.9 },
        tok: { vimp: tk(TI, IMP, o + 4.4, t, 'wrap'), vplug: tk(TP, PLG, o + 7.0, t, 'wrap') } };
      if (l >= 4.4 && l < 6.6) S.code.tok.vimp.caret = 1; if (l >= 7.0 && l < 8.1) S.code.tok.vplug.caret = 1;
    } };
};
SC.edit = (o, { C, U }) => {
  const TH = typing(o + 1.6, ' with', 8, 17), TW1 = writing(o + 3.17, 'Building with Glide.'), TB = writing(o + 9.52, 'text-brand-500'), THX = typing(o + 7.5, '6d28d9', 9, 19);
  ev(o + 2.8, 'enter');
  cut(o, R.split); cam(o + 6.2, .9, R.panel); cam(o + 8.8, .7, R.split);
  U.show(o + .3, o + 9.3).move(o + .3, o + .3, at('sub', .9, 1.6)).move(o + .35, o + .85, at('h1t', .53, .55)).click(o + .95).click(o + 1.07)
    .move(o + 6.3, o + 6.85, at('color', .3, .5)).click(o + 6.9).move(o + 8.0, o + 8.6, at('apply', .5, .55)).click(o + 8.7);
  const h1 = at('h1t', .97, 0);
  C.stand(o, o + 2.85, h1, { eyes: t => t < o + 1.6 ? 'd' : 'happy', flip: true }).jump(o + 2.85, o + 3.15, h1, at('tk-h1txt', .5, 0), 50, { stomp: 1 })
    .stand(o + 3.15, o + 6.2, at('tk-h1txt', .5, 0), { eyes: 'happy', arms: wave(o + 3.4, o + 4.6) })
    .jump(o + 6.2, o + 6.75, at('tk-h1txt', .5, 0), at('color', .85, 0), 80).stand(o + 6.75, o + 9.0, at('color', .85, 0), { eyes: 'd' })
    .jump(o + 9.0, o + 9.5, at('color', .85, 0), at('tk-slate', .5, 0), 60, { stomp: 1, big: 1 })
    .stand(o + 9.5, o + 11.0, at('tk-brand', .5, 0), { eyes: 'wide' }).jump(o + 11.0, o + 11.35, at('tk-brand', .5, 0), at('ln24', .9, 0), 40)
    .stand(o + 11.35, o + 20, at('ln24', .9, 0), { eyes: 'happy', arms: wave(o + 11.6, o + 13), flip: true });
  CRUMBLES.push([o + 3.15, 'tk-h1txt', 20], [o + 9.5, 'tk-brand', 14]); ev(o + 3.15, 'crumble'); ev(o + 9.5, 'crumble'); ev(o + 2.95, 'toast');
  sub(o + .3, o + 3.6, 'Double-click text to edit it.'); sub(o + 3.7, o + 7.0, 'Press Enter. It’s in the file.');
  sub(o + 7.1, o + 10.0, 'Set a color in the panel.'); sub(o + 10.1, o + 13.8, 'Glide writes your theme’s class.');
  return { dur: 16, end: S => { S.ed.h1Text = 'Building with Glide.'; S.code.tok.h1txt = { text: 'Building with Glide.' }; S.ed.h1Col = BRAND; S.ed.colorHex = BRAND; delete S.code.tok.slate; S.code.tok.brand = { text: 'text-brand-500' }; },
    state(l, S) { const E = S.ed, K = S.code.tok, t = o + l;
      if (l >= .95) E.sel = 'h1';
      if (l >= 1.07 && l < 2.8) E.h1Edit = 1;
      if (l >= 1.6 && l < 2.8) E.h1Text = 'Building' + ' with'.slice(0, nTyped(TH, t)) + ' Glide.';
      if (l >= 2.8) E.h1Text = 'Building with Glide.';
      if (l >= 3.15) { K.h1txt = tk(TW1, 'Building with Glide.', o + 3.17, t, l < 8 ? 'new' : ''); S.code.mark[24] = 1; }
      let op = toastIn(l, 2.95, 4.7); if (op) E.toast = { text: INSTANT, op };
      if (l >= 6.9 && l < 9.05) E.picker = { op: Math.min(seg(l, 6.9, 7.05), 1 - seg(l, 8.85, 9.05)), hex: '#' + '6d28d9'.slice(0, nTyped(THX, t)), col: l >= 8.2 ? BRAND : SLATE, press: l >= 8.7 && l < 8.82 };
      if (l >= 8.75) { E.h1Col = BRAND; E.colorHex = BRAND; }
      if (l >= 9.5) { delete K.slate; K.brand = tk(TB, 'text-brand-500', o + 9.52, t, l < 14 ? 'new' : ''); }
      else if (l >= 9.4) K.brand = { text: 'text-brand-500', n: 0 };
    } };
};
SC.precise = (o, { C, U }) => {
  const T7 = writing(o + 3.47, 'md:text-7xl');
  cut(o, R.panel); cam(o + 2.6, .8, R.codeTop);
  for (const t of [1.55, 1.7, 1.95]) ev(o + t, 'key', { v: .8 });
  key(o + 1.4, ['7', '2', '⏎'], 'font size', [o + 1.55, o + 1.7, o + 1.95]);
  U.show(o + .1, o + 2.6).move(o + .1, o + .1, at('h1t', .9, .5)).move(o + .15, o + .55, at('bp', .5, .55)).click(o + .6).move(o + .8, o + 1.2, at('size', .3, .6)).click(o + 1.3);
  C.stand(o, o + 3.0, at('size', .5, 0), { eyes: 'd' }).jump(o + 3.0, o + 3.45, at('size', .5, 0), at('tk-md6', .5, 0), 50, { stomp: 1 })
    .stand(o + 3.45, o + 4.5, at('tk-md7', .5, 0), { eyes: 'happy' }).jump(o + 4.5, o + 4.85, at('tk-md7', .5, 0), at('tk-5xl', .5, 0), 50)
    .stand(o + 4.85, o + 6.6, at('tk-5xl', .5, 0), { eyes: 'happy', arms: t => Math.floor(t * 8) % 2 ? 'wave' : 'down' })
    .jump(o + 6.6, o + 6.95, at('tk-5xl', .5, 0), at('tk-brand', .5, 0), 50)
    .stand(o + 6.95, o + 8.6, at('tk-brand', .5, 0), { eyes: 'happy', arms: t => Math.floor(t * 8) % 2 ? 'wave' : 'down' })
    .jump(o + 8.6, o + 8.95, at('tk-brand', .5, 0), at('ln24', .9, 0), 40).stand(o + 8.95, o + 20, at('ln24', .9, 0), { eyes: 'happy', flip: true });
  CRUMBLES.push([o + 3.45, 'tk-md7', 11]); ev(o + 3.45, 'crumble'); ev(o + 3.45, 'chip');
  sub(o + .3, o + 3.6, 'Change the size at md only.'); sub(o + 3.7, o + 6.9, 'Only md:text-6xl changes.'); sub(o + 7.0, o + 10.4, 'Every other class stays.');
  return { dur: 11, end: S => { S.ed.h1Size = 72; delete S.code.tok.md6; S.code.tok.md7 = { text: 'md:text-7xl' }; },
    state(l, S) { const E = S.ed, K = S.code.tok, t = o + l;
      E.sel = 'h1'; S.code.from = 24; if (l >= .6 && l < 3) E.bp = 'md';
      if (l >= 1.3 && l < 2.0) { E.sizeHot = true; E.sizeField = l < 1.55 ? '60' : l < 1.7 ? '7' : '72'; } else if (l >= 2.0) E.sizeField = '72';
      if (l >= 2.0) E.h1Size = 72;
      if (l >= 3.45) { delete K.md6; K.md7 = tk(T7, 'md:text-7xl', o + 3.47, t, l < 10 ? 'new' : ''); S.code.mark[24] = 1; }
      else if (l >= 3.35) K.md7 = { text: 'md:text-7xl', n: 0 };
    } };
};
SC.layout = (o, { C, U }) => {
  const TS = writing(o + 2.97, STYLE, 50);
  cut(o, R.hero); cam(o + 2.15, .8, R.codeTop);
  U.show(o + .2, o + 2.3).move(o + .2, o + .2, at('btn2', .5, .5)).move(o + .25, o + .85, at('sub', .2, .55)).click(o + .95, 'press').move(o + 1.0, o + 1.6, at('sub', .2, .55)).click(o + 1.7, 'release');
  ev(o + 1.72, 'drop');
  C.stand(o, o + 2.6, at('sub', .62, 0), { px: 5, eyes: t => t < o + 1.0 ? 'n' : 'happy', arms: t => t > o + 1.0 && t < o + 1.65 ? 'up' : 'down' })
    .jump(o + 2.6, o + 2.95, at('sub', .62, 0), at('tk-style', .03, 0), 50, { stomp: 1 })
    .stand(o + 2.95, o + 20, at('tk-style', .03, 0), { eyes: 'happy', arms: wave(o + 3.2, o + 4.4) });
  sub(o + .3, o + 3.4, 'Drag an element to move it.'); sub(o + 3.5, o + 7.4, 'Glide saves the offset as classes.');
  return { dur: 10, end: S => { S.ed.subDX = 48; S.code.tok.style = { text: STYLE }; },
    state(l, S) { const E = S.ed, t = o + l;
      S.code.from = 24; if (l >= .95) { E.sel = 'sub'; E.props = 'p'; }
      E.subDX = 48 * eio(seg(l, 1.0, 1.6)); E.guide = l > 1.3 && l < 1.85 ? Math.min(seg(l, 1.3, 1.4), 1 - seg(l, 1.75, 1.85)) : 0;
      if (l >= 2.95) { S.code.tok.style = { text: STYLE, n: nTyped(TS, t), cls: 'wrap' + (l < 9 ? ' new' : '') }; S.code.mark[25] = 1; }
    } };
};
SC.scopes = (o, { C, U }) => {
  const TL = writing(o + 5.22, 'text-lg');
  cut(o, R.hero); cam(o + 1.0, .8, R.panel); cam(o + 4.3, .8, R.code); cam(o + 9.4, 1.0, R.split);
  for (const t of [3.45, 3.55, 3.7]) ev(o + t, 'key', { v: .8 });
  key(o + 3.3, ['1', '8', '⏎'], 'font size', [o + 3.45, o + 3.55, o + 3.7]);
  U.show(o + .1, o + 4.3).move(o + .1, o + .1, at('sub', .5, 1.5)).move(o + .15, o + .5, at('btn1', .6, .6)).click(o + .55)
    .move(o + 1.0, o + 1.35, at('scope', .45, .55)).click(o + 1.4).move(o + 1.7, o + 2.4, at('opt3', .45, .55)).click(o + 2.5)
    .move(o + 2.8, o + 3.2, at('size', .3, .6)).click(o + 3.25);
  ev(o + 1.45, 'pop');
  C.stand(o, o + 1.6, at('btn1', .5, 0), { eyes: 'u' }).jump(o + 1.6, o + 2.0, at('btn1', .5, 0), at('scope', .85, 0), 60)
    .stand(o + 2.0, o + 4.75, at('scope', .85, 0), { eyes: 'd' }).jump(o + 4.75, o + 5.2, at('scope', .85, 0), at('tk-base', .5, 0), 50, { stomp: 1, big: 1 })
    .stand(o + 5.2, o + 7.0, at('tk-lg', .5, 0), { eyes: 'wide' }).jump(o + 7.0, o + 7.35, at('tk-lg', .5, 0), at('ln14', .88, 0), 40)
    .stand(o + 7.35, o + 20, at('ln14', .88, 0), { eyes: 'happy', arms: wave(o + 7.6, o + 9.0), flip: true });
  CRUMBLES.push([o + 5.2, 'tk-lg', 9]); ev(o + 5.2, 'crumble'); ev(o + 5.2, 'chip');
  sub(o + .3, o + 3.9, 'Inside a component, pick a scope.'); sub(o + 4.0, o + 8.2, 'This usage, the component, or a variant.'); sub(o + 8.4, o + 12.6, 'Every lg button grows. One line changes.');
  return { dur: 14, end: S => { S.ed.btnText = 18; S.code.tok.lg = { text: 'text-lg' }; delete S.code.tok.base; },
    state(l, S) { const E = S.ed, K = S.code.tok, t = o + l;
      if (l >= .55) { E.sel = 'btn1'; E.props = 'button'; E.sizeField = '16'; }
      E.scope = { val: l >= 2.55 ? 'Every &lt;Button size="lg"&gt;' : 'This &lt;Button&gt; · App.tsx:27', op: l >= 1.4 && l < 2.75 ? Math.min(seg(l, 1.4, 1.52), 1 - seg(l, 2.55, 2.75)) : 0, pick: l >= 2.4 ? 3 : -1, hot: l >= 1.35 && l < 3.6 };
      if (l >= 3.25 && l < 3.8) { E.sizeHot = true; E.sizeField = l < 3.45 ? '16' : l < 3.55 ? '1' : '18'; } else if (l >= 3.8) E.sizeField = '18';
      if (l >= 3.75) E.btnText = 18;
      if (l >= 4.3) { S.code.file = 'Button.tsx'; E.file = 'Button.tsx'; }
      if (l >= 5.2) { delete K.base; K.lg = tk(TL, 'text-lg', o + 5.22, t, l < 12 ? 'new' : ''); S.code.mark[14] = 1; }
      else if (l >= 5.1) K.lg = { text: 'text-lg', n: 0 };
    } };
};
SC.review = (o, { C, U }) => {
  const TR = writing(o + 9.32, 'text-red-500'), T2 = writing(o + 9.4, 'text-2xl');
  cut(o, R.browser); cam(o + 8.3, .9, R.split); cam(o + 12.8, .8, R.browser);
  for (const t of [1.95, 2.05, 2.25]) ev(o + t, 'key', { v: .8 });
  key(o + 1.8, ['2', '4', '⏎'], 'font size', [o + 1.95, o + 2.05, o + 2.25]);
  key(o + 11.0, ['Ctrl', 'Z'], 'undo', [o + 11.2]); key(o + 12.0, ['Ctrl', '⇧', 'Z'], 'redo', [o + 12.2]); ev(o + 11.2, 'key', { v: .9 }); ev(o + 12.2, 'key', { v: .9 });
  U.show(o + .1, o + 14.6).move(o + .1, o + .1, at('h1t', .5, 2)).move(o + .15, o + .45, at('staged', .5, .55)).click(o + .55)
    .move(o + .8, o + 1.25, at('sub', .4, .55)).click(o + 1.3).move(o + 1.4, o + 1.6, at('size', .3, .6)).click(o + 1.65)
    .move(o + 2.5, o + 2.95, at('h1t', .4, .55)).click(o + 3.0).move(o + 3.1, o + 3.45, at('color', .3, .5)).click(o + 3.5)
    .move(o + 3.7, o + 4.1, at('sw4', .5, .5)).click(o + 4.2).move(o + 4.3, o + 4.55, at('apply', .5, .55)).click(o + 4.6)
    .move(o + 5.0, o + 5.5, at('sprev', .5, .55)).click(o + 5.6).click(o + 6.9).move(o + 7.2, o + 7.9, at('sapply', .5, .55)).click(o + 8.0)
    .move(o + 12.6, o + 13.3, at('histbtn', .5, .6)).click(o + 13.4);
  C.stand(o, o + 2.4, at('staged', .5, 0), { eyes: 'd' }).jump(o + 2.4, o + 2.8, at('staged', .5, 0), at('sbar', .1, 0), 60)
    .stand(o + 2.8, o + 4.65, at('sbar', .1, 0), { eyes: 'happy' }).jump(o + 4.65, o + 4.95, at('sbar', .1, 0), at('sbar', .1, 0), 40)
    .stand(o + 4.95, o + 8.1, at('sbar', .1, 0), { eyes: t => t > o + 5.6 && t < o + 6.9 ? 'l' : 'happy' })
    .jump(o + 8.1, o + 9.3, at('sbar', .1, 0), at('tk-brand', .5, 0), 140, { stomp: 1, big: 1 })
    .stand(o + 9.3, o + 12.6, at('tk-brand', .5, 0), { eyes: t => t > o + 11.2 && t < o + 12.2 ? 'wide' : 'happy' })
    .jump(o + 12.6, o + 13.3, at('tk-brand', .5, 0), at('histbtn', .5, 0), 80).stand(o + 13.3, o + 20, at('histbtn', .5, 0), { eyes: 'happy', arms: wave(o + 13.6, o + 14.8) });
  CRUMBLES.push([o + 9.3, 'tk-brand', 14], [o + 9.3, 'tk-xl', 7]); ev(o + 9.3, 'crumble'); ev(o + 2.4, 'chip'); ev(o + 4.7, 'chip'); ev(o + 13.45, 'pop');
  sub(o + .3, o + 3.9, 'Want to review first? Use Staged.'); sub(o + 4.0, o + 7.7, 'Staged edits wait. Compare them.');
  sub(o + 7.8, o + 11.0, 'Apply writes them all at once.'); sub(o + 11.1, o + 14.6, 'Undo, redo, and a full history.');
  return { dur: 16.5, end: S => { S.ed.h1Col = RED; S.ed.colorHex = RED; S.ed.subSize = 24; delete S.code.tok.xl; S.code.tok['2xl'] = { text: 'text-2xl' }; S.code.tok.brand = { text: 'text-red-500' }; },
    state(l, S) { const E = S.ed, K = S.code.tok, t = o + l;
      if (l >= .55) E.mode = 'staged';
      if (l >= 1.3 && l < 3.0) { E.sel = 'sub'; E.props = 'p'; E.sizeField = '20'; } else if (l >= 3.0) { E.sel = 'h1'; E.props = 'h1'; }
      if (l >= 1.65 && l < 2.3) { E.sizeHot = true; E.sizeField = l < 1.95 ? '20' : l < 2.05 ? '2' : '24'; } else if (l >= 2.3 && l < 3.0) E.sizeField = '24';
      const before = l >= 5.6 && l < 6.9, applied = l >= 9.3, undone = l >= 11.2 && l < 12.2;
      if (l >= 2.3 && !before && !undone) E.subSize = 24;
      if (l >= 4.65 && !before && !undone) { E.h1Col = RED; E.colorHex = RED; }
      if (l >= 3.5 && l < 4.85) E.picker = { op: Math.min(seg(l, 3.5, 3.65), 1 - seg(l, 4.65, 4.85)), hex: l >= 4.2 ? RED : BRAND, sw: l >= 4.2 ? 4 : -1, press: l >= 4.6 && l < 4.72 };
      if (l >= 2.35 && l < 8.3) E.staged = { n: l >= 4.7 ? 2 : 1, op: Math.min(seg(l, 2.35, 2.55), 1 - seg(l, 8.1, 8.3)), label: before ? 'After' : 'Before', hot: (l >= 5.6 && l < 5.72) || (l >= 6.9 && l < 7.02) ? 'prev' : l >= 8.0 && l < 8.12 ? 'apply' : '' };
      if (applied && !undone) { K.brand = tk(TR, 'text-red-500', o + 9.32, t, l < 11 ? 'new' : ''); delete K.xl; K['2xl'] = tk(T2, 'text-2xl', o + 9.4, t, l < 11 ? 'new' : ''); S.code.mark[24] = S.code.mark[25] = 1; }
      else if (l >= 9.2 && l < 9.3) { K.brand = { text: 'text-red-500', n: 0 }; }
      if (l >= 13.45) E.history = { op: seg(l, 13.45, 13.7), n: 1, cur: 0 };
      if (l >= 12.6 && l < 13.6) E.histBtn = 1;
    } };
};
SC.sync = (o, { C, U }) => {
  const TA = typing(o + .8, ', fast', 9, 23);
  cut(o, R.split);
  key(o + 1.85, ['Ctrl', 'S'], 'save', [o + 2.0]); ev(o + 2.0, 'key', { v: .9 });
  C.stand(o, o + 2.4, at('sub', .97, 0, 0, 0), { px: 6, eyes: 'd', flip: true }).jump(o + 2.4, o + 2.75, at('sub', .97, 0), at('sub', .97, 0), 40)
    .stand(o + 2.75, o + 7.1, at('sub', .97, 0), { px: 6, eyes: 'happy', arms: wave(o + 2.9, o + 4.2), flip: true });
  ev(o + 2.42, 'chip');
  sub(o + .3, o + 3.2, 'Edit the file yourself.'); sub(o + 3.3, o + 6.8, 'The canvas follows. No reload.');
  return { dur: 7, end: S => { S.ed.subText = 'Design visually. Ship real source code, fast.'; S.code.tok.subadd = { text: ', fast' }; },
    state(l, S) { const K = S.code.tok, t = o + l;
      if (l >= .5) { K.subadd = { text: ', fast', n: nTyped(TA, t), caret: l < 2.0, cls: l < 2.0 ? 'dirty' : l < 6.5 ? 'new' : '' }; S.code.dirty = l < 2.0; }
      if (l >= 2.0) S.code.mark[25] = 1;
      if (l >= 2.4) S.ed.subText = 'Design visually. Ship real source code, fast.';
    } };
};
SC.refuse = (o, { C, U }, cont) => {
  if (cont) cam(o, .9, R.canvas); else cut(o, R.canvas);
  U.show(o + .1, o + 8.6).move(o + .1, o + .1, at('sub', .3, 2)).move(o + .3, o + .9, at('cardbody0', .4, .5)).click(o + 1.0).click(o + 1.12);
  ev(o + 1.2, 'error'); ev(o + 1.2, 'toast');
  const from = cont ? at('sub', .97, 0) : at('h1t', .9, 0);
  C.jump(o + .2, o + .75, from, at('card0', .5, 0), 90).stand(o + .75, o + 20, at('card0', .5, 0), { eyes: t => t < o + 1.2 ? 'd' : 'stern', arms: t => t > o + 1.4 ? 'sign' : 'down', signFrom: o + 1.4 });
  SPOTS.push([o + 1.2, o + 8.8, 'card0']);
  sub(o + 1.3, o + 4.6, 'Can’t be exact? Glide refuses.'); sub(o + 4.7, o + 8.0, 'Your file stays untouched.');
  return { dur: 9, state(l, S) { const E = S.ed;
      if (l >= 1.0) E.sel = 'card';
      const op = toastIn(l, 1.2, 8.8); if (op) E.toast = { err: 1, text: `<b>⚠</b> ${REFUSAL}`, op };
    } };
};
SC.quad = (o, { C }) => {
  cut(o, R.quad);
  const beats = [o + 1.0, o + 1.6, o + 2.2, o + 2.8];
  BURSTS.push([o, 'center']);
  C.hide(o, o + 99);
  beats.forEach((b, i) => { const q = at('qh' + i, .5, 0), a = new Actor(9);
    a.stand(o, b - .3, q, { eyes: 'u' }).jump(b - .3, b, q, q, 70, { stomp: 1 }).stand(b, o + 20, q, { eyes: 'happy', arms: t => t < b + .6 ? 'up' : 'down' });
    QC.push(a); ev(b, 'chip'); });
  sub(o + .6, o + 4.0, 'React, Vue, Svelte, Astro.'); sub(o + 4.2, o + 8.4, 'Insert, move and group: JSX and TSX only.');
  return { dur: 9, quad: true, state(l, S) { S.quad = { in: [0, 1, 2, 3].map(i => back(seg(l, i * .06, .4 + i * .06), 1.2)), k: beats.map(b => o + l >= b ? 1 : 0) }; } };
};
const QC = [];

// ───────── the cuts: [scene, chapter label for the wipe before it (null = no wipe), options]
const CUTS = {
  yt: [['cold'], ['title', null, { fade: 1 }], ['setup', '01 Setup', { reset: 1 }], ['edit', '02 Edit'], ['precise', '03 Precise'], ['layout', '04 Layout'],
    ['scopes', '05 Components'], ['review', '06 Review'], ['sync', '07 Safety'], ['refuse', null, { cont: 1 }], ['quad', '08 Everywhere'], ['outro', null, { fade: 1 }]],
  reel: [['cold'], ['title', null, { fade: 1 }], ['precise', '01 Precise'], ['scopes', '02 Components'], ['refuse', '03 Safety'], ['quad', '04 Everywhere'], ['outro', null, { fade: 1 }]],
};
export const SCENES = []; const WIPES = [];
const C = new Actor(8), U = new Cursor();
{
  let o = 0; const base = DEF();
  for (const [name, wipe, opt = {}] of CUTS[CUT]) {
    if (opt.reset) Object.assign(base, DEF());
    if (wipe) { WIPES.push([o, wipe]); ev(o - .45, 'wipe'); C.hide(o - .45, o + .5); }
    const fn = name === 'outro' ? (oo, c) => SC.title(oo, c, 'outro') : SC[name];
    const s = fn(o, { C, U }, opt.cont);
    if (wipe) C.segs.forEach(x => { if (x.t0 >= o && x.t0 < o + .5 && x.k === 'stand') x.t0 = Math.max(x.t0, o + .5); });
    SCENES.push({ name, o, dur: s.dur, s, base: clone(base) });
    if (s.end) s.end(base);
    o += s.dur;
  }
  C.segs.sort((a, b) => a.t0 - b.t0);
  for (let i = 0; i < C.segs.length - 1; i++) C.segs[i].t1 = Math.min(C.segs[i].t1, C.segs[i + 1].t0);   // a scene's last pose ends where the next segment starts
}
export const DUR = +(SCENES.at(-1).o + SCENES.at(-1).dur).toFixed(2);

// ───────── one frame
export function frame(t) {
  let sc = SCENES[0]; for (const s of SCENES) if (t >= s.o) sc = s;
  const S = clone(sc.base), l = t - sc.o;
  sc.s.state(l, S);
  const F = { t, ed: S.ed, code: S.code, term: S.term || null, quad: S.quad || null, cam: camAt(t), actors: [C], clones: sc.s.quad ? QC : [], cursor: U,
    showBrowser: !sc.s.hideBrowser && !sc.s.quad, showCode: !sc.s.quad, crumbles: CRUMBLES, bursts: BURSTS, hud: {} };
  if (sc.s.quad) F.code = null;
  hud(F, t);
  return F;
}
function hud(F, t) {
  const H = F.hud;
  const s = SUBS.find(x => t >= x.t0 && t < x.t1);
  if (s) H.cap = { text: s.text, op: s.t0 === 0 ? 1 - seg(t, s.t1 - .15, s.t1) : Math.min(seg(t, s.t0, s.t0 + .12), 1 - seg(t, s.t1 - .15, s.t1)), y: s.t0 === 0 ? 0 : (1 - eo(seg(t, s.t0, s.t0 + .2))) * 12 };
  for (const [t0, label] of WIPES) {
    const [no, ...nm] = label.split(' ');
    if (t >= t0 - .45 && t < t0 + .42) H.wipe = { p: (t - t0 + .45) / .87, no, nm: nm.join(' ') };
    if (t >= t0 + .4 && t < t0 + 2.2) H.chap = { no, nm: nm.join(' '), op: Math.min(seg(t, t0 + .4, t0 + .6), 1 - seg(t, t0 + 2.0, t0 + 2.2)) };
  }
  for (const [t0, keys, label, press] of KEYS) if (t >= t0 && t < press[press.length - 1] + .6)
    H.keys = { keys, label, op: Math.min(seg(t, t0, t0 + .12), 1 - seg(t, press[press.length - 1] + .4, press[press.length - 1] + .6)), dn: press.findIndex(p => t >= p && t < p + .16) };
  for (const [a, b, k] of SPOTS) if (t > a && t < b) H.spot = { key: k, op: Math.min(seg(t, a, a + .4), 1 - seg(t, b - .4, b)) };
  for (const c of CARDS) if (t >= c.t0 && t < c.t0 + c.dur) H.card = { kind: c.kind, s: t - c.t0 };
}

export { SUBS };
// every caption the viewer must read, for readcheck
export function texts(t) { const s = SUBS.find(x => t >= x.t0 && t < x.t1); return s ? [{ id: 'cap' + s.t0.toFixed(2), text: s.text }] : []; }
