// Glide's mascot: an original 14×13 pixel character. Its head is the tip of Glide's cursor logo; when it moves fast it
// leaves two fading copies behind, like the logo's trailing cursors. Props and effects share the same pixel grid.
export const BODY = '#FF7A1A', SHADE = '#D65F0A', EYE = '#1A1206', GOLD = '#FFD166';

// returns [[c, r, kind]]: 1 body, 2 eye, 3 shade
export function grid({ eyes = 'n', arms = 'down', legs = 'stand' } = {}) {
  const P = new Map(), put = (c, r, v = 1) => P.set(c + ',' + r, v);
  for (let r = 0; r < 3; r++) for (let c = 2; c <= 3 + r; c++) put(c, r);           // cursor-tip head
  for (let r = 3; r <= 10; r++) for (let c = 2; c <= 11; c++) if (!(r === 3 && c === 11)) put(c, r, r === 10 ? 3 : 1);
  const AR = { down: [[0, 7], [1, 7], [0, 8], [1, 8], [12, 7], [13, 7], [12, 8], [13, 8]],
    up: [[0, 3], [0, 4], [1, 5], [1, 6], [13, 3], [13, 4], [12, 5], [12, 6]],
    wave: [[0, 7], [1, 7], [0, 8], [1, 8], [13, 3], [13, 4], [12, 5], [12, 6]],
    sign: [[0, 7], [1, 7], [0, 8], [1, 8], [12, 4], [13, 4], [12, 5], [13, 5]], tuck: [] }[arms] || [];
  for (const [c, r] of AR) put(c, r);
  const L = { stand: [[4, 2], [5, 2], [8, 2], [9, 2]], walkA: [[4, 2], [5, 2], [8, 1], [9, 1]], walkB: [[4, 1], [5, 1], [8, 2], [9, 2]],
    tuck: [[4, 1], [5, 1], [8, 1], [9, 1]], none: [] }[legs];
  for (const [c, h] of L) for (let r = 11; r < 11 + h; r++) put(c, r);
  const E = { n: [[5, 5], [5, 6], [8, 5], [8, 6]], l: [[4, 5], [4, 6], [7, 5], [7, 6]], r: [[6, 5], [6, 6], [9, 5], [9, 6]],
    u: [[5, 4], [5, 5], [8, 4], [8, 5]], d: [[5, 6], [5, 7], [8, 6], [8, 7]], blink: [[5, 6], [8, 6]],
    happy: [[4, 6], [5, 5], [6, 6], [7, 6], [8, 5], [9, 6]], wide: [[5, 4], [5, 5], [5, 6], [8, 4], [8, 5], [8, 6]],
    shut: [[4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6]], stern: [[4, 5], [5, 6], [6, 6], [7, 6], [8, 6], [9, 5]] }[eyes] || [];
  for (const [c, r] of E) put(c, r, 2);
  return [...P].map(([k, v]) => { const [c, r] = k.split(',').map(Number); return [c, r, v]; });
}
const FILL = { 1: BODY, 2: EYE, 3: SHADE };

// x,y = midpoint under the feet (world coords); px = sprite pixel size; sq>0 squash, <0 stretch; flip faces left
export function sprite({ x, y, px = 8, flip = false, sq = 0, rot = 0, op = 1, shadow = 0, tint = null, ...pose }) {
  let s = '';
  for (let [c, r, v] of grid(pose)) { if (flip) c = 13 - c; s += `<rect x="${c}" y="${r}" width="1.04" height="1.04" fill="${tint && v !== 2 ? tint : FILL[v]}"/>`; }
  const sy = 1 - sq, sx = 1 + sq * .7, w = 14 * px * sx, h = 13 * px * sy;
  const sh = shadow > 0 ? `<div style="position:absolute;left:${x - 5.5 * px}px;top:${y - px * .35}px;width:${11 * px}px;height:${px * .7}px;border-radius:50%;background:rgba(0,0,0,${.28 * shadow})"></div>` : '';
  return sh + `<svg class="px" viewBox="0 0 14 13" width="${w}" height="${h}" style="left:${x - w / 2}px;top:${y - h}px;opacity:${op};transform:rotate(${rot}rad);transform-origin:50% 60%" shape-rendering="crispEdges">${s}</svg>`;
}
// the sprite's pixel centres, for split and merge bursts
export function pixels({ x, y, px = 8, flip = false, ...pose }) {
  return grid(pose).map(([c, r, v]) => ({ x: x + ((flip ? 13 - c : c) - 7 + .5) * px, y: y + (r - 13 + .5) * px, v }));
}
export function pixart(rows, { x, y, px = 7, pal, op = 1 }) {
  let s = ''; rows.forEach((row, r) => [...row].forEach((ch, c) => { if (pal[ch]) s += `<rect x="${c}" y="${r}" width="1.04" height="1.04" fill="${pal[ch]}"/>`; }));
  const W = rows[0].length, H = rows.length;
  return `<svg class="px" viewBox="0 0 ${W} ${H}" width="${W * px}" height="${H * px}" style="left:${x}px;top:${y}px;opacity:${op}" shape-rendering="crispEdges">${s}</svg>`;
}
// a pixel sign with "!" held up during the refusal
export const SIGN = (x, y, px = 7, op = 1) => pixart(['kkkkkkk', 'kwwkwwk', 'kwwkwwk', 'kwwkwwk', 'kwwwwwk', 'kwwkwwk', 'kkkkkkk', '...k...', '...k...', '...k...'],
  { x, y, px, op, pal: { w: '#FFF6EC', k: EYE } });
export const SPARK = (x, y, px = 6, col = GOLD, op = 1) => pixart(['..y..', '..y..', 'yy.yy', '..y..', '..y..'], { x: x - 2.5 * px, y: y - 2.5 * px, px, op, pal: { y: col } });
// dust: t 0→1 spreads to both sides
export function dust(x, y, t, px = 6, n = 6, seed = 1) {
  if (t <= 0 || t >= 1) return ''; let s = '';
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, k = (i >> 1) + 1, e = 1 - Math.pow(1 - t, 2);
    const dx = side * (20 + k * 18 + ((seed * 7 + i * 13) % 9)) * e, dy = -(10 + k * 6) * Math.sin(Math.PI * t * .9), sz = px * (1 - t * .7);
    s += `<div style="position:absolute;left:${x + dx - sz / 2}px;top:${y + dy - sz}px;width:${sz}px;height:${sz}px;background:#C9CED8;opacity:${1 - t}"></div>`;
  }
  return s;
}
// a code token breaking into pixels: box {x,y,w,h}, t 0→1
export function crumble(b, t, col, seed = 1) {
  if (!b || t <= 0 || t >= 1) return ''; let s = ''; const n = 22;
  for (let i = 0; i < n; i++) {
    const hx = ((Math.sin(i * 12.9898 + seed) * 43758.5453) % 1 + 1) % 1, hy = ((Math.sin(i * 78.233 + seed * 3) * 12543.13) % 1 + 1) % 1;
    const x0 = b.x + hx * b.w, y0 = b.y + hy * b.h, dx = (hx - .5) * 140 * t, dy = -60 * Math.sin(Math.PI * t) * (.4 + hy) + 90 * t * t, sz = 9 * (1 - t * .6);
    s += `<div style="position:absolute;left:${x0 + dx}px;top:${y0 + dy}px;width:${sz}px;height:${sz}px;background:${col};opacity:${1 - t}"></div>`;
  }
  return s;
}
