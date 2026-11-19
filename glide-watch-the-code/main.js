import { clamp, seg, eo, ss, lerp, hash } from '/core/lib.js';
import * as UI from './ui.js';
import * as M from './mascot.js';
import * as FM from './film.js';

const Q = new URLSearchParams(location.search), NOSUBS = Q.has('nosubs');
const world = document.getElementById('world'), spr = document.getElementById('spr'), hudEl = document.getElementById('hud');
const mbg = document.getElementById('mbg'), mbw = document.getElementById('mbw');
const cmbg = document.getElementById("cmbg");
// Pacing: film.js is authored at the 25 s cut's speed (film time u). After the hook's payoff (1.6 s) the picture plays 1.5× slower;
// 1.5 maps every beat of the 114.84 BPM grid onto an eighth-note of the same grid, so beat locks stay on the music.
const W0 = 1.6, K = 1.5, U_END = 24.2;                          // film time stops before the old loop wipe (23.78) and reset (24.23)
const U = t => t < W0 ? t : Math.min(U_END, W0 + (t - W0) / K), Tof = u => u < W0 ? u : W0 + (u - W0) * K;
const CRED = 34.6, DUR = 40;                                      // end card: crossfade from the terminal, then hold
const CEV = [[CRED + .3, 'wipe'], [CRED + .75, 'jump', { d: .5 }], [CRED + 1.25, 'land', { v: 1 }], [CRED + 1.3, 'chip'], [CRED + 1.9, 'chip'], [CRED + 2.4, 'chip']];
window.DUR = DUR;
window.EV = FM.EV.filter(e => e.t < 23.7).map(e => ({ ...e, t: +Tof(e.t).toFixed(3) }))
  .concat(CEV.map(([t, type, o]) => ({ t, type, ...o }))).sort((a, b) => a.t - b.t);
window.SUBS = FM.SUBS.filter(s => s.t1 <= FM.DUR).map(s => ({ ...s, t0: Tof(s.t0), t1: Tof(s.t1) }));
window.T = FM.T;

const PROBE = window.PROBE = {};
const tf = ([cx, cy, z]) => `translate(540px,540px) scale(${z}) translate(${-cx}px,${-cy}px)`;
function render(tr) {
  const t = U(tr);
  const F = FM.frame(t), [cx, cy, z] = F.cam;
  const quadFull = F.quad && t >= FM.T.split + .2 && t < FM.T.merge;
  world.innerHTML = UI.desk(t) + (quadFull ? '' : UI.browser(F) + UI.codeWin(F)) + (F.term ? `<div style="position:absolute;left:0;top:0;width:1700px;height:1700px;background:#0b0e14;opacity:${F.term.op * .82}"></div>` + UI.term(F) : '') + (F.quad ? UI.quad(F) : '');
  world.style.transform = spr.style.transform = tf(F.cam);
  if (F.quad && !quadFull) { const k = 1 - seg(t, FM.T.split - .34, FM.T.split - .08); for (const el of world.querySelectorAll(".bw, .cw")) el.style.opacity = k.toFixed(3); }   // the editor gives way as the four windows divide out
  const cache = {};
  const A = (key, fx = .5, fy = 0) => { const el = cache[key] !== undefined ? cache[key] : (cache[key] = world.querySelector(`[data-a="${key}"]`));
    if (!el) return null; const r = el.getBoundingClientRect();
    return { x: (r.left + r.width * fx - 540) / z + cx, y: (r.top + r.height * fy - 540) / z + cy, w: r.width / z, h: r.height / z }; };
  // motion blur from camera speed: only whips smear
  const [px, py] = FM.camAt(U(tr - 1 / 30)), vx = (cx - px) * z, vy = (cy - py) * z;
  const bx = Math.min(12, Math.max(0, Math.abs(vx) - 60) * .12), by = Math.min(12, Math.max(0, Math.abs(vy) - 60) * .12);   // a hint of smear on fast follows, never a smudge
  mbg.setAttribute('stdDeviation', `${bx.toFixed(2)} ${by.toFixed(2)}`); mbw.style.filter = bx > .6 || by > .6 ? 'url(#mb)' : '';
  PROBE.cam = F.cam; PROBE.u = t;
  spr.innerHTML = sprites(F, t, A, z);
  hud(F, t, A, z, cx, cy);
  if (tr >= CRED) hudEl.innerHTML += credits(tr - CRED);
}

// end card: the README's pixel wordmark fades up from the dark, the mascot hops onto the "l", then the line, command and repo
function credits(s) {
  const k = x => eo(clamp(x)), bg = ss(s / .8), lg = k((s - .3) / .9), ln = k((s - 1.4) / .5), cm = k((s - 1.8) / .5), rp = k((s - 2.2) / .5);
  const LX = 260, LY = 250;                                       // logo 560×340 (exactly 2× the 280×170 PNG), centred at x 540
  let h = `<div class="cred" style="opacity:${bg}"><div class="cglow" style="left:${90 + 120 * Math.sin(s * .5)}px;top:${-60 + 80 * Math.sin(s * .37 + 1)}px"></div>
    <img src="ascii-art.png" style="left:${LX}px;top:${LY}px;opacity:${lg};transform:scale(${1.06 - .06 * lg});filter:blur(${(1 - lg) * 6}px)">
    <div class="ctag" style="top:640px;opacity:${ln};transform:translateY(${(1 - ln) * 14}px)">Design visually. Ship real source code.</div>
    <div class="ccmd" style="top:712px;opacity:${cm};transform:translate(-50%,${(1 - cm) * 14}px)">npx @srivarsank/glide</div>
    <div class="crepo" style="top:800px;opacity:${rp};transform:translateY(${(1 - rp) * 14}px)">github.com/SrivarsanK/Glide · Apache 2.0</div>`;
  const foot = { x: LX + 125 * 2, y: LY + 9 * 2 };                // top of the "l" in the wordmark
  if (s >= .75) {
    if (s < 1.25) { const p = seg(s, .75, 1.25), a = { x: 120, y: 1120 }, cy = foot.y - 140;
      h += M.sprite({ x: lerp(a.x, foot.x, p), y: (1 - p) ** 2 * a.y + 2 * (1 - p) * p * cy + p * p * foot.y, px: 8, legs: 'tuck', arms: 'up', eyes: 'wide', sq: -.15 }); }
    else { const q = seg(s, 1.25, 1.47), sq = s < 1.47 ? .34 * (1 - q) * Math.cos(q * 7) : 0, wave = s > 1.6 && s < 3.4;
      h += M.sprite({ x: foot.x, y: foot.y, px: 8, sq, eyes: s > 1.5 ? 'happy' : 'wide', arms: wave ? (Math.floor(s * 6) % 2 ? 'wave' : 'up') : 'down' }); }
  }
  return h + '</div>';
}

const CH = 21.6;                                   // character advance of the 36 px code font
function sprites(F, t, A, z) {
  const T = FM.T; let h = '';
  const draw = act => {
    const c = act.eval(t, A); if (!c) return null;
    if (c.jump) [[.05, .38], [.1, .18]].forEach(([dt, op]) => { const g = act.eval(t - dt, A); if (g && g.jump) h += M.sprite({ ...g, op, shadow: 0 }); });  // the logo's trailing copies
    h += M.sprite(c);
    if (c.sign && t > 15.3) { const k = eo(seg(t, 15.3, 15.5)), sp = 7; h += M.SIGN(c.x + 3.2 * c.px, c.y - 12 * c.px - 10 * sp * k, sp, k); }
    for (const j of act.jumps) if (t >= j.t1 && t < j.t1 + .4) { const L = act.eval(j.t1 + .001, A); if (L) h += M.dust(L.x, L.y, seg(t, j.t1, j.t1 + .4), Math.max(5, L.px * .75), 6, j.t1 * 10); }
    return c;
  };
  const c1 = F.showMain ? draw(F.actors[0]) : null;
  PROBE.m = c1 ? { x: (c1.x - F.cam[0]) * z + 540, y: (c1.y - F.cam[1]) * z + 540, wx: c1.x, wy: c1.y, jump: c1.jump } : null;   // motion audit (probe.mjs)
  for (const q of F.clones) draw(q);
  // stomps: the old token crumbles where the new one is written
  for (const [ts, key, len] of [[T.land0, 'tk-brand', 14], [T.md, 'tk-md7', 11], [T.lg, 'tk-lg', 9]]) if (t >= ts && t < ts + .7) {
    const b = A(key, 0, 0); if (b) h += M.crumble({ x: b.x, y: b.y, w: len * CH, h: b.h || 48 }, seg(t, ts, ts + .7), '#a5d6ff', ts);
    if (c1 && t < ts + .5) { const k = seg(t, ts, ts + .5); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + .3; h += M.SPARK(c1.x + Math.cos(a) * (40 + k * 70), c1.y - 40 + Math.sin(a) * (24 + k * 46), 6, M.GOLD, 1 - k); } }
  }
  // cell division and merge: pixel bursts
  const burst = (x, y, k, n = 16) => { let s = ''; for (let i = 0; i < n; i++) { const a = hash(i * 2.3) * Math.PI * 2, r = (24 + hash(i * 7.7) * 120) * eo(k), sz = 10 * (1 - k * .6);
    s += `<div style="position:absolute;left:${x + Math.cos(a) * r}px;top:${y + Math.sin(a) * r * .7}px;width:${sz}px;height:${sz}px;background:${i % 3 ? M.BODY : M.GOLD};opacity:${1 - k}"></div>`; } return s; };
  if (t >= T.split - .23 && t < T.split + .3) { const p = A('qh0', .5, 0) || { x: 440, y: 300 }; h += burst(850, 850, seg(t, T.split - .23, T.split + .3), 28); }
  if (t >= T.merge && t < T.merge + .5) h += burst(UI.TW.x + 270, UI.TW.y - 40, seg(t, T.merge, T.merge + .5), 22);
  const cu = F.cursor.eval(t, A);
  PROBE.cu = cu ? { x: (cu.x - F.cam[0]) * z + 540, y: (cu.y - F.cam[1]) * z + 540, wx: cu.x, wy: cu.y, op: cu.op } : null;
  if (cu) {
    if (cu.sp > 900) for (let i = 1; i <= 4; i++) { const g = F.cursor.eval(t - i * .012, A); if (g) h += cursorSvg(g.x, g.y, 1, cu.op * .16 * (5 - i) / 4, z); }
    if (cu.ring > 0) h += `<div class="ring" style="left:${cu.x - 26 * cu.ring / z - 4}px;top:${cu.y - 26 * cu.ring / z - 4}px;width:${(52 * cu.ring) / z + 8}px;height:${(52 * cu.ring) / z + 8}px;opacity:${(1 - cu.ring) * .8};border-width:${3 / z}px"></div>`;
    h += cursorSvg(cu.x, cu.y, cu.sc, cu.op, z);
  }
  return h;
}
// constant on-screen size, like screen-recorder software's enlarged cursor
const cursorSvg = (x, y, sc, op, z) => { const s = 1.5 * sc / z;
  return `<svg style="position:absolute;left:${x - 2 * s}px;top:${y - 2 * s}px;opacity:${op};filter:drop-shadow(0 ${2 / z}px ${3 / z}px rgba(0,0,0,.35))" width="${22 * s}" height="${30 * s}" viewBox="0 0 22 30"><path d="M2 2 L2 24 L7.5 18.5 L11 27 L15 25.2 L11.6 17 L19 17 Z" fill="#fff" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/></svg>`; };

function hud(F, t, A, z, cx, cy) {
  const H = F.hud; let h = '';
  const scr = p => ({ x: (p.x - cx) * z + 540, y: (p.y - cy) * z + 540 });
  if (H.spot) { const p = A(H.spot.key, .5, .5); if (p) { const s = scr(p), r = Math.max(p.w, p.h) * z * .62 + 60;
    h += `<div class="spot" style="opacity:${H.spot.op};background:radial-gradient(ellipse ${r * 2.1}px ${r * 2.0}px at ${s.x}px ${s.y - 90}px, transparent 50%, rgba(5,7,12,.6) 100%)"></div>`; } }
  if (H.chap && !H.wipe) h += `<div class="chap" style="opacity:${H.chap.op}"><b>${H.chap.no}</b>${H.chap.nm}</div>`;
  if (H.keys) h += `<div class="keys" style="opacity:${H.keys.op}">${H.keys.keys.map((k, i) => `<i class="${H.keys.dn === i ? 'dn' : ''}">${k}</i>`).join('')}<span>${H.keys.label}</span></div>`;
  const cb = H.cap && !NOSUBS ? H.cap.blur : 0; cmbg.setAttribute("stdDeviation", `0 ${cb.toFixed(2)}`);
  if (H.cap && !NOSUBS) h += `<div class="cap" style="opacity:${H.cap.op};transform:translate(-50%,${H.cap.y}px);${cb > .3 ? "filter:url(#cmb)" : ""}">${H.cap.text}</div>`;
  if (H.wipe) h += wipe(H.wipe, t);
  hudEl.innerHTML = h;
}
// chapter seam: orange pixel blocks sweep up from the bottom-left, the label shows, then they clear the same way
function wipe(W, t) {
  const S = 60, n = 18, p = W.p; let s = '<div class="wipe">';
  const pal = ['#FF7A1A', '#F26B0F', '#FF8F3D'];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const d = (c / n) * .5 + ((n - r) / n) * .25 + hash(c * 13.1 + r * 7.7) * .12;
    const a = clamp((p / .42 - d) / .18), b = clamp(((p - .55) / .42 - d) / .18), k = a * (1 - b);
    if (k <= 0) continue; const sz = S * k;
    s += `<b style="left:${c * S + (S - sz) / 2}px;top:${r * S + (S - sz) / 2}px;width:${sz + .5}px;height:${sz + .5}px;background:${pal[Math.floor(hash(c * 3.7 + r * 11.3) * 3)]}"></b>`;
  }
  const lo = clamp(Math.min((p - .3) / .1, (.8 - p) / .1));
  if (lo > 0 && W.nm) {
    s += `<div class="wlabel" style="opacity:${lo};transform:translateY(calc(-50% + ${(1 - lo) * 16}px))"><div class="no">${W.no}</div><div class="nm">${W.nm}</div></div>`;
    s += M.sprite({ x: 180 + p * 720, y: 760, px: 7, legs: Math.floor(t * 12) % 2 ? 'walkA' : 'walkB', op: lo, tint: '#FFF6EC' });
  }
  return s + '</div>';
}

// model sheet (?sheet=model): turnaround-free pixel character, so poses, expressions and the palette
function modelSheet() {
  document.getElementById('stage').style.background = '#121722';
  const poses = [['stand', {}], ['crouch', { sq: .28 }], ['jump', { legs: 'tuck', arms: 'up', eyes: 'wide', sq: -.2 }], ['land', { sq: .32 }],
    ['cheer', { arms: 'up', eyes: 'happy' }], ['pat', { arms: 'wave', eyes: 'happy' }], ['guard', { arms: 'sign', eyes: 'stern' }], ['walk', { legs: 'walkA' }]];
  const eyes = ['n', 'l', 'r', 'u', 'd', 'wide', 'happy', 'shut', 'stern', 'blink'];
  let h = `<div style="position:absolute;left:48px;top:40px;font:700 40px Inter;color:#fff">Glide's mascot</div>
    <div style="position:absolute;left:48px;top:96px;font:500 22px Inter;color:#9aa4b8">14 × 13 sprite pixels · born from the cursor-trail logo · one hue no UI element uses</div>`;
  poses.forEach(([nm, o], i) => { const x = 130 + (i % 4) * 250, y = 380 + Math.floor(i / 4) * 250;
    h += M.sprite({ x, y, px: 11, shadow: 1, ...o }); if (nm === 'guard') h += M.SIGN(x + 3.2 * 11, y - 12 * 11 - 70, 7);
    if (nm === 'jump') [[.38, -40], [.18, -80]].forEach(([op, dx]) => h += M.sprite({ x: x + dx, y: y + 10, px: 11, op, ...o }));
    h += `<div style="position:absolute;left:${x - 100}px;top:${y + 18}px;width:200px;text-align:center;font:600 20px Mono;color:#c9d1d9">${nm}</div>`; });
  eyes.forEach((e, i) => { const x = 90 + i * 98; h += M.sprite({ x, y: 870, px: 6, eyes: e }); h += `<div style="position:absolute;left:${x - 45}px;top:${884}px;width:90px;text-align:center;font:500 16px Mono;color:#9aa4b8">${e}</div>`; });
  [[M.BODY, 'body'], [M.SHADE, 'shade'], [M.EYE, 'eye'], [M.GOLD, 'spark'], ['#FFF6EC', 'sign']].forEach(([c, nm], i) => {
    h += `<div style="position:absolute;left:${560 + i * 100}px;top:960px;width:80px;height:40px;border-radius:8px;background:${c};box-shadow:0 0 0 1px rgba(255,255,255,.2)"></div>
      <div style="position:absolute;left:${560 + i * 100}px;top:1008px;width:80px;text-align:center;font:500 15px Mono;color:#9aa4b8">${nm}</div>`; });
  // the real cursor, for contrast with the mascot at the same scale
  h += `<div style="position:absolute;left:66px;top:960px;font:500 18px Inter;color:#9aa4b8;width:420px">The cursor is the user (white, no face). The mascot is Glide.</div>` +
    `<svg style="position:absolute;left:470px;top:950px" width="44" height="60" viewBox="0 0 22 30"><path d="M2 2 L2 24 L7.5 18.5 L11 27 L15 25.2 L11.6 17 L19 17 Z" fill="#fff" stroke="#000" stroke-width="1.6"/></svg>`;
  hudEl.innerHTML = h;
}

window.TEXTS = t => { const s = FM.texts(U(t))[0], el = hudEl.querySelector('.cap'); if (!s || !el) return [];
  const r = el.getBoundingClientRect(); return [{ id: s.id, text: s.text, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }]; };
window.render = Q.get('sheet') === 'model' ? modelSheet : render;
await document.fonts.load('16px Inter'); await document.fonts.load('700 16px Inter'); await document.fonts.load('16px Mono');
window.render(+(Q.get('t') || 0));
window.READY = true;
