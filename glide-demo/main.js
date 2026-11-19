import { clamp, seg, eo, ss, lerp, hash } from '/core/lib.js';
import * as UI from './ui.js';
import * as M from './mascot.js';
import * as FM from './film.js';

const Q = new URLSearchParams(location.search), NOSUBS = Q.has('nosubs');
const VW = FM.VW, VH = FM.VH, CX = VW / 2, CY = VH / 2, V = VH > VW;
document.body.classList.add(V ? 'v' : 'h');
const world = document.getElementById('world'), spr = document.getElementById('spr'), hudEl = document.getElementById('hud');
const mbg = document.getElementById('mbg'), mbw = document.getElementById('mbw');
window.DUR = FM.DUR;
window.EV = FM.EV.concat(FM.SUBS.map(s => ({ t: s.t0, type: 'sub', t1: s.t1, text: s.text }))).sort((a, b) => a.t - b.t);   // captions ride along for the .srt
window.SUBS = FM.SUBS;

const tf = ([cx, cy, z]) => `translate(${CX}px,${CY}px) scale(${z}) translate(${-cx}px,${-cy}px)`;
function render(t) {
  const F = FM.frame(t), [cx, cy, z] = F.cam;
  const scrim = F.term ? `<div style="position:absolute;left:0;top:0;width:${UI.WORLD.w}px;height:${UI.WORLD.h}px;background:#0b0e14;opacity:${F.term.op * .82}"></div>` : '';
  world.innerHTML = UI.desk() + (F.showBrowser ? UI.browser(F) : '') + (F.showCode && F.code ? UI.codeWin(F) : '') + scrim + (F.term ? UI.term(F) : '') + (F.quad ? UI.quad(F) : '');
  world.style.transform = spr.style.transform = tf(F.cam);
  // a window mostly off screen fades back, so a sliver at the frame edge reads as background, not as a broken crop
  for (const [sel, r] of [['.bw', UI.BW], ['.cw', UI.CWN]]) {
    const el = world.querySelector(sel); if (!el) continue;
    const x0 = Math.max(r.x, cx - CX / z), x1 = Math.min(r.x + r.w, cx + CX / z), y0 = Math.max(r.y, cy - CY / z), y1 = Math.min(r.y + r.h, cy + CY / z);
    const frac = Math.max(0, x1 - x0) * Math.max(0, y1 - y0) / (r.w * r.h);
    const inside = cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h;
    el.style.opacity = inside ? 1 : (.3 + .7 * ss(clamp((frac - .55) / .35))).toFixed(3);
  }
  if (![cx, cy, z].every(Number.isFinite) || Q.has('dbg')) console.log('cam at', t, JSON.stringify(F.cam));
  const cache = {};
  const A = (key, fx = .5, fy = 0) => { const el = cache[key] !== undefined ? cache[key] : (cache[key] = world.querySelector(`[data-a="${key}"]`));
    if (!el) return null; const r = el.getBoundingClientRect();
    return { x: (r.left + r.width * fx - CX) / z + cx, y: (r.top + r.height * fy - CY) / z + cy, w: r.width / z, h: r.height / z }; };
  // motion blur from camera speed: only fast moves smear
  const [px, py] = FM.camAt(t - 1 / 30), vx = (cx - px) * z, vy = (cy - py) * z;
  if (!Number.isFinite(px + py)) console.log('NaN prev camera at', t, JSON.stringify(FM.camAt(t - 1 / 30)), JSON.stringify(F.cam));
  const bx = Math.min(30, Math.max(0, Math.abs(vx) - 26) * .3), by = Math.min(30, Math.max(0, Math.abs(vy) - 26) * .3);
  mbg.setAttribute('stdDeviation', `${bx.toFixed(2)} ${by.toFixed(2)}`); mbw.style.filter = bx > .6 || by > .6 ? 'url(#mb)' : '';
  spr.innerHTML = sprites(F, t, A, z);
  hud(F, t, A, z, cx, cy);
}

const CH = 21.6;                                   // character advance of the 36 px code font
function sprites(F, t, A, z) {
  let h = '';
  const draw = act => {
    const c = act.eval(t, A); if (!c) return null;
    if (c.jump) [[.05, .38], [.1, .18]].forEach(([dt, op]) => { const g = act.eval(t - dt, A); if (g && g.jump) h += M.sprite({ ...g, op, shadow: 0 }); });  // the logo's trailing copies
    h += M.sprite(c);
    if (c.sign) { const k = eo(seg(t, c.signFrom, c.signFrom + .2)), sp = 7; h += M.SIGN(c.x + 3.2 * c.px, c.y - 12 * c.px - 10 * sp * k, sp, k); }
    for (const j of act.jumps) if (t >= j.t1 && t < j.t1 + .4) { const L = act.eval(j.t1 + .001, A); if (L) h += M.dust(L.x, L.y, seg(t, j.t1, j.t1 + .4), Math.max(5, L.px * .75), 6, j.t1 * 10); }
    return c;
  };
  const c1 = draw(F.actors[0]);
  for (const q of F.clones) draw(q);
  // stomps: the old token crumbles where the new one is written
  for (const [ts, key, len] of F.crumbles) if (t >= ts && t < ts + .7) {
    const b = A(key, 0, 0); if (b) h += M.crumble({ x: b.x, y: b.y, w: len * CH, h: b.h || 48 }, seg(t, ts, ts + .7), '#a5d6ff', ts);
    if (c1 && t < ts + .5) { const k = seg(t, ts, ts + .5); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + .3; h += M.SPARK(c1.x + Math.cos(a) * (40 + k * 70), c1.y - 40 + Math.sin(a) * (24 + k * 46), 6, M.GOLD, 1 - k); } }
  }
  // the four-up arrives: a pixel burst from the middle of the desk
  const burst = (x, y, k, n = 16) => { let s = ''; for (let i = 0; i < n; i++) { const a = hash(i * 2.3) * Math.PI * 2, r = (24 + hash(i * 7.7) * 160) * eo(k), sz = 12 * (1 - k * .6);
    s += `<div style="position:absolute;left:${x + Math.cos(a) * r}px;top:${y + Math.sin(a) * r * .7}px;width:${sz}px;height:${sz}px;background:${i % 3 ? M.BODY : M.GOLD};opacity:${1 - k}"></div>`; } return s; };
  for (const [t0] of F.bursts) if (t >= t0 && t < t0 + .55) { const q = UI.QW; h += burst((q[0].x + q[3].x + 790) / 2, (q[0].y + q[3].y + 790) / 2, seg(t, t0, t0 + .55), 28); }
  const cu = F.cursor.eval(t, A);
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
  const scr = p => ({ x: (p.x - cx) * z + CX, y: (p.y - cy) * z + CY });
  if (H.spot) { const p = A(H.spot.key, .5, .5); if (p) { const s = scr(p), r = Math.max(p.w, p.h) * z * .62 + 60;
    h += `<div class="spot" style="opacity:${H.spot.op};background:radial-gradient(ellipse ${r * 2.1}px ${r * 2.0}px at ${s.x}px ${s.y - 90}px, transparent 50%, rgba(5,7,12,.6) 100%)"></div>`; } }
  if (H.chap && !H.wipe) h += `<div class="chap" style="opacity:${H.chap.op}"><b>${H.chap.no}</b>${H.chap.nm}</div>`;
  if (H.keys) h += `<div class="keys" style="opacity:${H.keys.op}">${H.keys.keys.map((k, i) => `<i class="${H.keys.dn === i ? 'dn' : ''}">${k}</i>`).join('')}<span>${H.keys.label}</span></div>`;
  if (H.card) h += card(H.card.kind, H.card.s);
  if (H.cap && !NOSUBS) h += `<div class="cap" style="opacity:${H.cap.op};transform:translate(-50%,${H.cap.y}px)">${H.cap.text}</div>`;
  if (H.wipe) h += wipe(H.wipe, t);
  hudEl.innerHTML = h;
}
// chapter seam: orange pixel blocks sweep up from the bottom-left, the label shows, then they clear the same way
function wipe(W, t) {
  const S = 60, nc = Math.ceil(VW / S), nr = Math.ceil(VH / S), p = W.p; let s = '<div class="wipe">';
  const pal = ['#FF7A1A', '#F26B0F', '#FF8F3D'];
  for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
    const d = (c / nc) * .5 + ((nr - r) / nr) * .25 + hash(c * 13.1 + r * 7.7) * .12;
    const a = clamp((p / .42 - d) / .18), b = clamp(((p - .55) / .42 - d) / .18), k = a * (1 - b);
    if (k <= 0) continue; const sz = S * k;
    s += `<b style="left:${c * S + (S - sz) / 2}px;top:${r * S + (S - sz) / 2}px;width:${sz + .5}px;height:${sz + .5}px;background:${pal[Math.floor(hash(c * 3.7 + r * 11.3) * 3)]}"></b>`;
  }
  const lo = clamp(Math.min((p - .3) / .1, (.8 - p) / .1));
  if (lo > 0 && W.nm) {
    s += `<div class="wlabel" style="opacity:${lo};transform:translateY(calc(-50% + ${(1 - lo) * 16}px))"><div class="no">${W.no}</div><div class="nm">${W.nm}</div></div>`;
    s += M.sprite({ x: CX - 360 + p * 720, y: CY + 220, px: 7, legs: Math.floor(t * 12) % 2 ? 'walkA' : 'walkB', op: lo, tint: '#FFF6EC' });
  }
  return s + '</div>';
}
// title and end cards: the README's pixel wordmark fades up from the dark, the mascot hops onto the "l", then the lines rise in
function card(kind, s) {
  const k = x => eo(clamp(x)), bg = ss(s / .8), lg = k((s - .3) / .9), l1 = k((s - 1.4) / .5), l2 = k((s - 1.8) / .5), l3 = k((s - 2.2) / .5);
  const LX = CX - 280, LY = CY - 290;                             // logo 560×340 (exactly 2× the 280×170 PNG)
  const rise = (v, top, cls, html, extra = '') => `<div class="${cls}" style="top:${top}px;opacity:${v};transform:${extra}translateY(${(1 - v) * 14}px)">${html}</div>`;
  let h = `<div class="cred" style="opacity:${bg}"><img src="ascii-art.png" style="left:${LX}px;top:${LY}px;opacity:${lg};transform:scale(${1.06 - .06 * lg});filter:blur(${(1 - lg) * 6}px)">`;
  if (kind === 'title') h += rise(l1, CY + 100, 'ctag', 'Visual editing that writes to your source files.') + rise(l2, CY + 172, 'crepo', 'React · Vue · Svelte · Astro');
  else h += rise(l1, CY + 100, 'ctag', 'Glide is open source.') + rise(l2, CY + 172, 'ccmd', 'npx @srivarsank/glide', 'translateX(-50%) ') + rise(l3, CY + 260, 'crepo', 'github.com/SrivarsanK/Glide · Apache 2.0');
  const foot = { x: LX + 125 * 2, y: LY + 9 * 2 };                // top of the "l" in the wordmark
  if (s >= .75) {
    if (s < 1.25) { const p = seg(s, .75, 1.25), a = { x: CX - 420, y: VH + 60 }, cy = foot.y - 140;
      h += M.sprite({ x: lerp(a.x, foot.x, p), y: (1 - p) ** 2 * a.y + 2 * (1 - p) * p * cy + p * p * foot.y, px: 8, legs: 'tuck', arms: 'up', eyes: 'wide', sq: -.15 }); }
    else { const q = seg(s, 1.25, 1.47), sq = s < 1.47 ? .34 * (1 - q) * Math.cos(q * 7) : 0;
      h += M.sprite({ x: foot.x, y: foot.y, px: 8, sq, eyes: s > 1.5 ? 'happy' : 'wide', arms: s > 1.6 && s < 3.4 ? (Math.floor(s * 6) % 2 ? 'wave' : 'up') : 'down' }); }
  }
  return h + '</div>';
}

window.TEXTS = t => { const s = FM.texts(t)[0], el = hudEl.querySelector('.cap'); if (!s || !el) return [];
  const r = el.getBoundingClientRect(); return [{ id: s.id, text: s.text, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }]; };
window.render = render;
await document.fonts.load('16px Inter'); await document.fonts.load('700 16px Inter'); await document.fonts.load('16px Mono');
window.render(+(Q.get('t') || 0));
window.READY = true;
