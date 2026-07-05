import { describe, expect, test } from 'vitest';
import {
  resolveObjectSnap,
  resolvePixelGridSnap,
  snapToGrid,
  OUR_SNAP_THRESHOLD_PX,
} from '../../packages/overlay/src/snap.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function rect(left: number, top: number, width: number, height: number) {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveObjectSnap
// ─────────────────────────────────────────────────────────────────────────────
// Dragged element: 50×30 at (100, 400).
// Siblings placed far on Y (y=900) so Y never snaps when we test X-only.

describe('resolveObjectSnap', () => {
  const drag = rect(100, 400, 50, 30);
  // Sibling at (200, 900) — X candidates: left=200, right=250, hCenter=225.
  // Y is at 900 which is ≥500 away, so Y never snaps in X-axis tests.
  const sib  = rect(200, 900, 50, 30);

  // ── X axis ────────────────────────────────────────────────────────────────

  test('snaps right edge of dragged to left edge of sibling within threshold', () => {
    // drag.right at dx=48: 100+50+48=198. sib.left=200. delta=2 ≤ 4 → snap.
    // snapped dx = 48 + (200 - 198) = 50.
    const r = resolveObjectSnap(drag, 48, 0, [sib]);
    expect(r.dx).toBe(50);
    expect(r.dy).toBe(0);
    expect(r.guides).toHaveLength(1);
    expect(r.guides[0]).toEqual({ axis: 'x', position: 200 });
  });

  test('does NOT snap when delta is exactly threshold + 1 (constraint #6)', () => {
    // drag.right at dx=45: 195. sib.left=200. delta=5 = 4+1 → no snap.
    // Also check all other X combos: drag.left=145 (sib.right=250, delta=105),
    // drag.hCenter=170 (sib.hCenter=225, delta=55). All out of threshold.
    const r = resolveObjectSnap(drag, 45, 0, [sib]);
    expect(r.dx).toBe(45);
    expect(r.dy).toBe(0);
    expect(r.guides).toHaveLength(0);
  });

  test('DOES snap when delta equals threshold exactly', () => {
    // drag.right at dx=46: 196. sib.left=200. delta=4 = threshold → snap.
    const r = resolveObjectSnap(drag, 46, 0, [sib]);
    expect(r.dx).toBe(50);
    expect(r.guides).toHaveLength(1);
    expect(r.guides[0].axis).toBe('x');
  });

  test('snaps left edge of dragged to right edge of sibling', () => {
    // drag.left at dx=148: 248. sib.right=250. delta=2 → snap to dx=150.
    const r = resolveObjectSnap(drag, 148, 0, [sib]);
    expect(r.dx).toBe(150);
    expect(r.guides[0]).toEqual({ axis: 'x', position: 250 });
  });

  test('snaps horizontal center to horizontal center of sibling', () => {
    // drag.hCenter at dx=100: 100+25+100=225. sib.hCenter=225. delta=0.
    // drag.right at dx=100: 250. sib.right=250. delta=0. Both delta=0.
    // Tie-break: edge (drag.right ↔ sib.right) beats center. guide=250, dx keeps raw.
    // To isolate center-only: use a sibling whose edges are all far but center=225 is close.
    // sib2: left=175, right=275, hCenter=225 (width=100). right=275 (delta=|250-275|=25). left=175 (delta=|250-175|=75). center=225 (delta=0).
    // drag.right at dx=100: 250. sib2.right=275 (delta=25). sib2.left=175 (delta=75). Only center fires.
    const sib2 = rect(175, 900, 100, 30); // left=175, right=275, hCenter=225
    const r = resolveObjectSnap(drag, 100, 0, [sib2]);
    // drag.hCenter at dx=100: 225. sib2.hCenter=225. delta=0 → snap.
    // drag.left at dx=100: 200. sib2.left=175 (delta=25). sib2.right=275 (delta=75). None fire.
    // drag.right at dx=100: 250. sib2.right=275 (delta=25). None fire.
    expect(r.dx).toBe(100);
    expect(r.guides[0]).toEqual({ axis: 'x', position: 225 });
  });

  // ── Y axis ────────────────────────────────────────────────────────────────
  // drag at (100, 400, 50×30): top=400, bottom=430, vCenter=415.

  test('snaps top edge of dragged to top edge of sibling (Y axis)', () => {
    // sibY.top=402; drag.top at dy=0: 400. delta=2 ≤ 4 → snap dy=2.
    // sibY.bottom=432; drag.bottom at dy=0: 430. delta=2 ≤ 4 — ALSO fires.
    // Tie: both delta=2. Edge wins either way; the smaller guide-position wins in iteration order.
    // So use a sib where only top is in threshold and bottom is not:
    // drag.top+dy=400, need sibTop=402 (delta=2), sibBottom=402+10=412 (delta=|430-412|=18).
    const sibY = rect(900, 402, 50, 10); // top=402, bottom=412
    const r = resolveObjectSnap(drag, 0, 0, [sibY]);
    // drag.top=400, sibY.top=402, delta=2 → snap dy=2 (drag.top would reach 402).
    // Actually: dy stays 0, but we snap. The anchor adjustment = 402 - 400 = +2.
    expect(r.dy).toBe(2);
    expect(r.guides.find(g => g.axis === 'y')?.position).toBe(402);
  });

  test('snaps bottom edge of dragged to bottom edge of sibling (Y axis)', () => {
    // drag.bottom at dy=0: 430. sib2.bottom=432. delta=2 → snap dy=2.
    // sib2.top=422 (height=10). drag.top=400, sib2.top=422, delta=22 > 4 — no top snap.
    const sib2 = rect(900, 422, 50, 10); // top=422, bottom=432
    const r = resolveObjectSnap(drag, 0, 0, [sib2]);
    expect(r.dy).toBe(2);
    expect(r.guides.find(g => g.axis === 'y')?.position).toBe(432);
  });

  test('snaps vertical center to vertical center of sibling (Y axis)', () => {
    // drag.vCenter at dy=0: 415.
    // Use sib with vCenter=415 but top and bottom far: top=405,bottom=425 (height=20).
    // drag.top=400 vs sib.top=405: delta=5 > 4. drag.bottom=430 vs sib.bottom=425: delta=5 > 4.
    // drag.vCenter=415 vs sib.vCenter=415: delta=0 → snap.
    const sib3 = rect(900, 405, 50, 20); // top=405, bottom=425, vCenter=415
    const r = resolveObjectSnap(drag, 0, 0, [sib3]);
    expect(r.dy).toBe(0);
    expect(r.guides.find(g => g.axis === 'y')?.position).toBe(415);
  });

  test('X and Y snap independently', () => {
    // sib for X at (200,900): X snaps at dx=48.
    // sibY for Y (900, 402): Y snaps at dy=0.
    const sibX = rect(200, 900, 50, 30);
    const sibY = rect(900, 402, 50, 10);
    const r = resolveObjectSnap(drag, 48, 0, [sibX, sibY]);
    expect(r.dx).toBe(50);
    expect(r.dy).toBe(2);
    expect(r.guides).toHaveLength(2);
    expect(r.guides.some(g => g.axis === 'x')).toBe(true);
    expect(r.guides.some(g => g.axis === 'y')).toBe(true);
  });

  test('tie-break: edge preferred over center when same delta', () => {
    // drag.left at dx=50: 150.
    // sib1.right=148 (edge, isCenter=false): delta=|150-148|=2.
    // sib2.hCenter=148 (center, isCenter=true): delta=2.
    // Edge wins → snap to 148. dx = 50 + (148-150) = 48.
    const sib1 = rect(98, 900, 50, 30);   // left=98, right=148, isCenter=false
    const sib2 = rect(98, 800, 100, 30);  // hCenter=148, isCenter=true
    const r = resolveObjectSnap(drag, 50, 0, [sib1, sib2]);
    expect(r.dx).toBe(48);
    expect(r.guides.find(g => g.axis === 'x')?.position).toBe(148);
  });

  test('no snap if no sibling within threshold on any axis', () => {
    const farSib = rect(500, 500, 50, 30);
    // drag at dx=0,dy=0: left=100,right=150,hCenter=125 vs farSib left=500,right=550,hCenter=525 → all >4.
    // drag top=400,bottom=430,vCenter=415 vs farSib top=500,bottom=530,vCenter=515 → all >4.
    const r = resolveObjectSnap(drag, 0, 0, [farSib]);
    expect(r.dx).toBe(0);
    expect(r.dy).toBe(0);
    expect(r.guides).toHaveLength(0);
  });

  test('empty siblings: never snaps, returns raw deltas unchanged', () => {
    const r = resolveObjectSnap(drag, 17, -33, []);
    expect(r.dx).toBe(17);
    expect(r.dy).toBe(-33);
    expect(r.guides).toHaveLength(0);
  });

  test('custom threshold: snap fires at delta ≤ custom value, not above', () => {
    // sib.left=200; drag.right at dx=48: 198. delta=2.
    const r1 = resolveObjectSnap(drag, 48, 0, [sib], 1); // threshold=1: 2>1 → no snap
    expect(r1.dx).toBe(48);
    const r2 = resolveObjectSnap(drag, 48, 0, [sib], 2); // threshold=2: 2≤2 → snap
    expect(r2.dx).toBe(50);
  });

  test('OUR_SNAP_THRESHOLD_PX exported constant is 4', () => {
    expect(OUR_SNAP_THRESHOLD_PX).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resolvePixelGridSnap — separate pass, rounds to nearest integer
// ─────────────────────────────────────────────────────────────────────────────
describe('resolvePixelGridSnap', () => {
  test('rounds fractional positions to nearest pixel', () => {
    expect(resolvePixelGridSnap(10.4, 20.6)).toEqual({ x: 10, y: 21 });
    expect(resolvePixelGridSnap(10.5, 20.5)).toEqual({ x: 11, y: 21 });
    expect(resolvePixelGridSnap(0, 0)).toEqual({ x: 0, y: 0 });
    expect(resolvePixelGridSnap(-1.7, 3.2)).toEqual({ x: -2, y: 3 });
  });

  test('integers are unchanged', () => {
    expect(resolvePixelGridSnap(42, 99)).toEqual({ x: 42, y: 99 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// snapToGrid — legacy, kept for backward compat
// Math.round(4/8)=Math.round(0.5)=1 in JS → 1*8=8
// ─────────────────────────────────────────────────────────────────────────────
describe('Canvas Grid Snapping Helper (legacy)', () => {
  test('snaps coordinates to nearest grid step', () => {
    expect(snapToGrid(4, 5)).toEqual({ x: 8, y: 8 });   // round(0.5)=1 → 8; round(0.625)=1 → 8
    expect(snapToGrid(3, 11)).toEqual({ x: 0, y: 8 });  // round(0.375)=0 → 0; round(1.375)=1 → 8
    expect(snapToGrid(15, 23)).toEqual({ x: 16, y: 24 });
    expect(snapToGrid(14, 26, 10)).toEqual({ x: 10, y: 30 });
  });
});
