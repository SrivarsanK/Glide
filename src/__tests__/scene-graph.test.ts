import { describe, test, expect, beforeEach } from 'vitest';
import {
  SceneGraph,
  SceneNode,
  SceneNodeData,
  SceneRect,
  containsPoint,
  isContainedBy,
  toSceneRect,
} from '../../packages/overlay/src/scene-graph.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function rect(left: number, top: number, width: number, height: number): SceneRect {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

function node(
  id: string,
  r: SceneRect,
  children: SceneNodeData[] = [],
  tag = 'div',
): SceneNodeData {
  return { id, tag, rect: r, children };
}

// ── containsPoint ─────────────────────────────────────────────────────────────

describe('containsPoint', () => {
  const r = rect(10, 20, 100, 80); // right=110 bottom=100

  test('returns true for interior point', () => {
    expect(containsPoint(r, 50, 60)).toBe(true);
  });

  test('returns true for top-left corner (inclusive)', () => {
    expect(containsPoint(r, 10, 20)).toBe(true);
  });

  test('returns true for bottom-right corner (inclusive)', () => {
    expect(containsPoint(r, 110, 100)).toBe(true);
  });

  test('returns false for point just outside left edge', () => {
    expect(containsPoint(r, 9, 60)).toBe(false);
  });

  test('returns false for point just outside right edge', () => {
    expect(containsPoint(r, 111, 60)).toBe(false);
  });

  test('returns false for point above top edge', () => {
    expect(containsPoint(r, 50, 19)).toBe(false);
  });

  test('returns false for point below bottom edge', () => {
    expect(containsPoint(r, 50, 101)).toBe(false);
  });
});

// ── isContainedBy ─────────────────────────────────────────────────────────────

describe('isContainedBy', () => {
  const outer = rect(0, 0, 200, 200);
  const inner = rect(10, 10, 100, 100);
  const partial = rect(150, 150, 100, 100); // overlaps but not contained

  test('inner is contained by outer', () => {
    expect(isContainedBy(inner, outer)).toBe(true);
  });

  test('outer is NOT contained by inner', () => {
    expect(isContainedBy(outer, inner)).toBe(false);
  });

  test('partially overlapping rect is not contained', () => {
    expect(isContainedBy(partial, outer)).toBe(false);
  });

  test('equal rects: self-containment is true', () => {
    expect(isContainedBy(outer, outer)).toBe(true);
  });
});

// ── toSceneRect ───────────────────────────────────────────────────────────────

describe('toSceneRect', () => {
  test('computes right/bottom when not provided', () => {
    const r = toSceneRect({ left: 5, top: 10, width: 50, height: 30 });
    expect(r.right).toBe(55);
    expect(r.bottom).toBe(40);
  });

  test('preserves explicit right/bottom', () => {
    const r = toSceneRect({ left: 0, top: 0, right: 100, bottom: 80, width: 100, height: 80 });
    expect(r.right).toBe(100);
    expect(r.bottom).toBe(80);
  });
});

// ── SceneGraph.build ──────────────────────────────────────────────────────────

describe('SceneGraph.build', () => {
  test('builds index with correct size', () => {
    const sg = new SceneGraph();
    sg.build([
      node('A', rect(0, 0, 200, 200), [
        node('B', rect(10, 10, 50, 50)),
        node('C', rect(70, 10, 50, 50)),
      ]),
    ]);
    expect(sg.size).toBe(3);
  });

  test('getById finds a nested node', () => {
    const sg = new SceneGraph();
    sg.build([node('ROOT', rect(0, 0, 400, 400), [node('CHILD', rect(10, 10, 100, 100))])]);
    const found = sg.getById('CHILD');
    expect(found).not.toBeNull();
    expect(found!.tag).toBe('div');
    expect(found!.parent?.id).toBe('ROOT');
  });

  test('isStamped true for real AST ids', () => {
    const sg = new SceneGraph();
    sg.build([node('/src/App.tsx:5:3', rect(0, 0, 100, 100))]);
    expect(sg.getById('/src/App.tsx:5:3')?.isStamped).toBe(true);
  });

  test('isStamped false for synthetic CST ids', () => {
    const sg = new SceneGraph();
    sg.build([node('__glide_cst_body > div:nth-of-type(1)', rect(0, 0, 100, 100))]);
    expect(sg.getById('__glide_cst_body > div:nth-of-type(1)')?.isStamped).toBe(false);
  });

  test('rebuild replaces old index', () => {
    const sg = new SceneGraph();
    sg.build([node('OLD', rect(0, 0, 100, 100))]);
    sg.build([node('NEW', rect(0, 0, 200, 200))]);
    expect(sg.getById('OLD')).toBeNull();
    expect(sg.getById('NEW')).not.toBeNull();
    expect(sg.size).toBe(1);
  });

  test('isEmpty is true before build', () => {
    expect(new SceneGraph().isEmpty).toBe(true);
  });

  test('isEmpty is false after build', () => {
    const sg = new SceneGraph();
    sg.build([node('A', rect(0, 0, 100, 100))]);
    expect(sg.isEmpty).toBe(false);
  });
});

// ── SceneGraph.patch ──────────────────────────────────────────────────────────

describe('SceneGraph.patch', () => {
  test('updates rect of existing node', () => {
    const sg = new SceneGraph();
    sg.build([node('A', rect(0, 0, 100, 100))]);
    sg.patch('A', rect(50, 50, 200, 200));
    expect(sg.getById('A')!.rect.left).toBe(50);
    expect(sg.getById('A')!.rect.width).toBe(200);
  });

  test('patchMany updates multiple nodes', () => {
    const sg = new SceneGraph();
    sg.build([node('A', rect(0, 0, 100, 100)), node('B', rect(200, 0, 100, 100))]);
    sg.patchMany([
      { id: 'A', rect: rect(10, 10, 50, 50) },
      { id: 'B', rect: rect(210, 0, 80, 80) },
    ]);
    expect(sg.getById('A')!.rect.left).toBe(10);
    expect(sg.getById('B')!.rect.width).toBe(80);
  });

  test('no-ops on unknown id', () => {
    const sg = new SceneGraph();
    sg.build([node('A', rect(0, 0, 100, 100))]);
    expect(() => sg.patch('MISSING', rect(0, 0, 1, 1))).not.toThrow();
    expect(sg.size).toBe(1);
  });
});

// ── SceneGraph.hitTest ────────────────────────────────────────────────────────

describe('SceneGraph.hitTest', () => {
  /**
   * Layout:
   *   PARENT: 0,0 → 300,300
   *     CHILD_A: 10,10 → 110,110  (stamped)
   *     CHILD_B: 150,10 → 250,110 (stamped)
   *       GRANDCHILD: 160,20 → 240,100 (stamped)
   */
  let sg: SceneGraph;

  beforeEach(() => {
    sg = new SceneGraph();
    sg.build([
      node('PARENT', rect(0, 0, 300, 300), [
        node('CHILD_A', rect(10, 10, 100, 100)),
        node('CHILD_B', rect(150, 10, 100, 100), [
          node('GRANDCHILD', rect(160, 20, 80, 80)),
        ]),
      ]),
    ]);
  });

  test('returns null for empty graph', () => {
    expect(new SceneGraph().hitTest(50, 50)).toBeNull();
  });

  test('returns null for point outside all nodes', () => {
    expect(sg.hitTest(400, 400)).toBeNull();
  });

  test('returns leaf node when point is inside it', () => {
    // (200, 60) is inside GRANDCHILD (160→240, 20→100)
    const hit = sg.hitTest(200, 60);
    expect(hit?.id).toBe('GRANDCHILD');
  });

  test('returns intermediate node when point in child but not grandchild', () => {
    // (155, 15) is inside CHILD_B but outside GRANDCHILD
    const hit = sg.hitTest(155, 15);
    expect(hit?.id).toBe('CHILD_B');
  });

  test('returns correct sibling (CHILD_A) for point in its area', () => {
    // (50, 50) is in CHILD_A but not CHILD_B or GRANDCHILD
    const hit = sg.hitTest(50, 50);
    expect(hit?.id).toBe('CHILD_A');
  });

  test('returns parent when point is in parent but outside all children', () => {
    // (5, 5) is in PARENT but none of the children start at <10
    const hit = sg.hitTest(5, 5);
    expect(hit?.id).toBe('PARENT');
  });

  test('prefers stamped over synthetic at same depth', () => {
    const sg2 = new SceneGraph();
    // Both at same rect — stamped should win
    sg2.build([
      node('CONTAINER', rect(0, 0, 200, 200), [
        node('__glide_cst_div:nth(1)', rect(10, 10, 100, 100)),
        node('/app/src/App.tsx:5:3', rect(10, 10, 100, 100)),
      ]),
    ]);
    const hit = sg2.hitTest(50, 50);
    expect(hit?.isStamped).toBe(true);
    expect(hit?.id).toBe('/app/src/App.tsx:5:3');
  });

  test('returns point exactly on border (inclusive)', () => {
    // (10, 10) is the top-left corner of CHILD_A
    const hit = sg.hitTest(10, 10);
    expect(hit?.id).toBe('CHILD_A');
  });
});

// ── SceneGraph.nodesAtDepth ───────────────────────────────────────────────────

describe('SceneGraph.nodesAtDepth', () => {
  test('depth 0 returns roots', () => {
    const sg = new SceneGraph();
    sg.build([node('A', rect(0, 0, 100, 100)), node('B', rect(200, 0, 100, 100))]);
    const depth0 = sg.nodesAtDepth(0);
    expect(depth0.map(n => n.id).sort()).toEqual(['A', 'B']);
  });

  test('depth 1 returns first-level children', () => {
    const sg = new SceneGraph();
    sg.build([
      node('ROOT', rect(0, 0, 300, 300), [
        node('C1', rect(0, 0, 100, 100)),
        node('C2', rect(100, 0, 100, 100)),
      ]),
    ]);
    const depth1 = sg.nodesAtDepth(1);
    expect(depth1.map(n => n.id).sort()).toEqual(['C1', 'C2']);
  });
});
