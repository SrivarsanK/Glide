/**
 * Glide Canvas Snap Engine
 *
 * Two independent, composable passes:
 *   1. resolveObjectSnap  — snap to sibling element edges/centers
 *   2. resolvePixelGridSnap — round result to nearest whole pixel
 *
 * Apply in that order; never merge them.
 */

// ── Threshold ────────────────────────────────────────────────────────────────
// OUR choice for the snap capture radius. Figma does not publish its value.
// 4 px felt right in manual testing; change it here and the whole engine follows.
export const OUR_SNAP_THRESHOLD_PX = 4;

// ── Rect type (mirrors DOMRect fields we actually use) ───────────────────────
export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

// ── Axis snap result ─────────────────────────────────────────────────────────
export interface AxisSnapResult {
  /** The snapped coordinate value (absolute, same space as input). */
  value: number;
  /** Whether a snap actually fired. False ⇒ raw value was returned unchanged. */
  snapped: boolean;
  /** The matched edge/center on the candidate element, for guide-line drawing. */
  guidePosition: number | null;
}

// ── Snap guide line descriptor (for the parent editor to draw) ───────────────
export interface SnapGuide {
  /** 'x' = vertical line at this x coordinate; 'y' = horizontal line at this y. */
  axis: 'x' | 'y';
  /** Pixel position of the guide line in iframe coordinates. */
  position: number;
}

// ── Candidate edges ──────────────────────────────────────────────────────────
// Closed set per spec: left, right, hCenter, top, bottom, vCenter.
// No other heuristics.

function xCandidates(r: Rect): Array<{ pos: number; isCenter: boolean }> {
  return [
    { pos: r.left,                    isCenter: false },
    { pos: r.right,                   isCenter: false },
    { pos: r.left + r.width / 2,      isCenter: true  },
  ];
}

function yCandidates(r: Rect): Array<{ pos: number; isCenter: boolean }> {
  return [
    { pos: r.top,                     isCenter: false },
    { pos: r.bottom,                  isCenter: false },
    { pos: r.top + r.height / 2,      isCenter: true  },
  ];
}

// ── Dragged element's own snap anchors ───────────────────────────────────────
// The dragged element offers the same 6 edges as snap points.
// We snap dragEdge → candidateEdge when |dragEdge + dx - candidateEdge| ≤ threshold.

function dragXAnchors(dragRect: Rect, dx: number): Array<{ anchor: number; isCenter: boolean }> {
  return [
    { anchor: dragRect.left  + dx,                   isCenter: false },
    { anchor: dragRect.right + dx,                   isCenter: false },
    { anchor: dragRect.left  + dx + dragRect.width / 2, isCenter: true  },
  ];
}

function dragYAnchors(dragRect: Rect, dy: number): Array<{ anchor: number; isCenter: boolean }> {
  return [
    { anchor: dragRect.top    + dy,                    isCenter: false },
    { anchor: dragRect.bottom + dy,                    isCenter: false },
    { anchor: dragRect.top    + dy + dragRect.height / 2, isCenter: true  },
  ];
}

// ── Core snap resolver for one axis ─────────────────────────────────────────
// Selection rule: smallest |delta|; ties broken by preferring edge over center.
// Equal-rank (same delta, same type) → first winner stands.
// If no candidate is within threshold, returns raw value unchanged (constraint #6).

function resolveAxis(
  rawOffset: number,          // current dx or dy
  dragAnchors: Array<{ anchor: number; isCenter: boolean }>,
  siblingCandidatePositions: Array<{ pos: number; isCenter: boolean }>,
  threshold: number,
): { snappedOffset: number; guidePosition: number | null } {
  let bestDelta = Infinity;
  let bestGuide: number | null = null;
  let bestIsCenter = true;  // tracks whether current best match came from a center anchor/candidate
  let bestAnchorOffset = 0; // delta to add to rawOffset so dragAnchor === candidatePos

  for (const da of dragAnchors) {
    for (const cp of siblingCandidatePositions) {
      const delta = Math.abs(da.anchor - cp.pos);
      if (delta > threshold) continue;

      // Tie-break rule (spec): at equal delta, prefer snapping to a candidate EDGE
      // over a candidate CENTER. The drag anchor's type doesn't affect priority.
      const currentIsCenter = cp.isCenter;   // is the CANDIDATE a center position?
      const currentIsEdge   = !currentIsCenter;

      let isBetter: boolean;
      if (delta < bestDelta) {
        // Strictly closer — always take it.
        isBetter = true;
      } else if (delta === bestDelta) {
        // Same distance: upgrade only if current is edge and prior best was center.
        isBetter = currentIsEdge && bestIsCenter;
      } else {
        isBetter = false;
      }

      if (isBetter) {
        bestDelta        = delta;
        bestGuide        = cp.pos;
        bestIsCenter     = currentIsCenter;
        bestAnchorOffset = cp.pos - da.anchor;
      }
    }
  }

  if (bestGuide === null) {
    // No snap fired — leave raw offset untouched (constraint #6).
    return { snappedOffset: rawOffset, guidePosition: null };
  }

  return { snappedOffset: rawOffset + bestAnchorOffset, guidePosition: bestGuide };
}


// ── Public: object snap ──────────────────────────────────────────────────────
/**
 * Resolve snap for both axes independently.
 *
 * @param dragRect   Live rect of the element being dragged (before any dx/dy).
 *                   Must come from a fresh getBoundingClientRect() call in the
 *                   same operation — never a cached value from a prior frame.
 * @param dx         Current drag delta X (pixels from drag start).
 * @param dy         Current drag delta Y.
 * @param siblings   Live rects of candidate sibling elements, each also from a
 *                   fresh getBoundingClientRect().
 * @param threshold  Capture radius in pixels. Defaults to OUR_SNAP_THRESHOLD_PX.
 * @returns Snapped dx/dy and any guide lines to draw. If snapped is false on an
 *          axis, the raw delta is returned unchanged for that axis.
 */
export function resolveObjectSnap(
  dragRect: Rect,
  dx: number,
  dy: number,
  siblings: Rect[],
  threshold: number = OUR_SNAP_THRESHOLD_PX,
): {
  dx: number;
  dy: number;
  guides: SnapGuide[];
} {
  // Collect all candidate positions from every sibling rect.
  const xCands: Array<{ pos: number; isCenter: boolean }> = [];
  const yCands: Array<{ pos: number; isCenter: boolean }> = [];
  for (const s of siblings) {
    xCands.push(...xCandidates(s));
    yCands.push(...yCandidates(s));
  }

  const xResult = resolveAxis(dx, dragXAnchors(dragRect, dx), xCands, threshold);
  const yResult = resolveAxis(dy, dragYAnchors(dragRect, dy), yCands, threshold);

  const guides: SnapGuide[] = [];
  if (xResult.guidePosition !== null) {
    guides.push({ axis: 'x', position: xResult.guidePosition });
  }
  if (yResult.guidePosition !== null) {
    guides.push({ axis: 'y', position: yResult.guidePosition });
  }

  return { dx: xResult.snappedOffset, dy: yResult.snappedOffset, guides };
}

// ── Public: pixel-grid snap (separate final pass) ────────────────────────────
/**
 * Round x and y to nearest whole pixel.
 *
 * This is always a separate, final pass applied after object-snap.
 * Never merge this calculation with resolveObjectSnap.
 */
export function resolvePixelGridSnap(x: number, y: number): { x: number; y: number } {
  return { x: Math.round(x), y: Math.round(y) };
}

// ── Legacy grid snap (kept for backward compat) ───────────────────────────────
/** @deprecated Use resolvePixelGridSnap for pixel-perfect snapping. */
export function snapToGrid(
  x: number,
  y: number,
  gridSize: number = 8,
): { x: number; y: number } {
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
}
