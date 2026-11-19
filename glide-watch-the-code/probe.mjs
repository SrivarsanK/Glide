// Motion audit, reanimate-style: sample every frame at 30 fps, write [t_ms, value] series for reanimate's easing.ts,
// and flag what reads as "broken": the mascot sliding or teleporting while it stands, popping in or out outside a wipe,
// the cursor jumping, and camera moves faster or jerkier than a whip.
//   node probe.mjs            (run from anywhere; needs the Lemo-Opuscar library at LEMO)
import fs from 'fs'; import path from 'path'; import { fileURLToPath, pathToFileURL } from 'url';
const LEMO = process.env.LEMO || 'C:/Users/Srivarsan/lemo-opuscar';
const { openDemo, closeServer } = await import(pathToFileURL(path.join(LEMO, 'core/render/page.mjs')).href);
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out', 'probe'); fs.mkdirSync(OUT, { recursive: true });
const { browser, page } = await openDemo(HERE, { w: 1080, h: 1080 });
const DUR = await page.evaluate(() => window.DUR), FPS = 30, N = Math.round(DUR * FPS);
const S = [];
for (let i = 0; i <= N; i++) {
  const t = i / FPS;
  S.push(await page.evaluate(t => { window.render(t); const P = window.PROBE; return { t, u: P.u, cam: P.cam, m: P.m, cu: P.cu, hud: !!document.querySelector('#hud .wipe, #hud .cred') }; }, t));
}
await browser.close(); closeServer();

const series = (f) => S.filter(s => f(s) != null).map(s => [Math.round(s.t * 1000), +f(s).toFixed(2)]);
for (const [k, f] of Object.entries({ cam_x: s => s.cam[0], cam_y: s => s.cam[1], cam_z: s => s.cam[2], mascot_x: s => s.m?.x, mascot_y: s => s.m?.y, cursor_x: s => s.cu?.x, cursor_y: s => s.cu?.y }))
  fs.writeFileSync(path.join(OUT, k + '.json'), JSON.stringify(series(f)));

const flags = [];
const flag = (t, kind, v) => flags.push({ t: +t.toFixed(2), kind, v: +v.toFixed(1) });
for (let i = 1; i < S.length; i++) {
  const a = S[i - 1], b = S[i];
  // camera: on-screen speed of the world, and how fast that speed changes (jerk reads as a snap)
  const sp = (s, r) => Math.hypot(s.cam[0] - r.cam[0], s.cam[1] - r.cam[1]) * b.cam[2];
  const v = sp(b, a), dz = Math.abs(Math.log(b.cam[2] / a.cam[2]));
  if (v > 140) flag(b.t, 'camera fast (px/frame)', v);
  if (dz > .06) flag(b.t, 'camera zoom snap (log/frame)', dz * 100);
  if (i > 1) { const v0 = sp(a, S[i - 2]); if (Math.abs(v - v0) > 70) flag(b.t, 'camera jerk (Δpx/frame)', v - v0); }
  // mascot: standing still in the world means world position constant; popping means presence changes outside a wipe or the credits
  if (!!a.m !== !!b.m && !a.hud && !b.hud) flag(b.t, b.m ? 'mascot pops in' : 'mascot pops out', 0);
  if (a.m && b.m && !a.m.jump && !b.m.jump) { const d = Math.hypot(b.m.wx - a.m.wx, b.m.wy - a.m.wy); if (d > 3) flag(b.t, 'mascot moves while standing (world px)', d); }
  if (a.cu && b.cu) { const d = Math.hypot(b.cu.wx - a.cu.wx, b.cu.wy - a.cu.wy); if (d > 90) flag(b.t, 'cursor jump (world px)', d); }
}
// merge runs of the same kind into ranges
const runs = [];
for (const f of flags) { const r = runs.at(-1); if (r && r.kind === f.kind && f.t - r.t1 <= .07) { r.t1 = f.t; r.max = Math.max(r.max, Math.abs(f.v)); r.n++; } else runs.push({ kind: f.kind, t0: f.t, t1: f.t, max: Math.abs(f.v), n: 1 }); }
fs.writeFileSync(path.join(OUT, 'flags.json'), JSON.stringify(runs, null, 1));
console.log(`frames ${S.length}, dur ${DUR}s, flagged runs ${runs.length}`);
for (const r of runs) console.log(`${r.t0.toFixed(2)}–${r.t1.toFixed(2)}  ${r.kind}  max ${r.max.toFixed(1)}  (${r.n} frames)`);
