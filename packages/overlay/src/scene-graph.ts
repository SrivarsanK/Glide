/**
 * Glide SceneGraph — In-Memory Spatial Index
 *
 * Replaces `document.elementFromPoint` with a deterministic, zoom-aware,
 * cached spatial index built from `getBoundingClientRect` snapshots.
 *
 * Design rules:
 *  - Zero DOM dependency: all inputs are plain data so this is fully testable.
 *  - Immutable nodes: `build()` replaces the index atomically.
 *  - Hit-test returns the deepest (most specific) stamped node at a point,
 *    preferring nodes with a `data-gl-source` id over synthetic CST ids.
 *  - `patch()` updates individual node rects without a full rebuild (used by
 *    the future bidirectional sync pass).
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface SceneRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface SceneNode {
  /** `data-gl-source` value (path:line:col) or synthetic `__glide_cst_...` id */
  id: string;
  /** HTML tag name, lower-cased */
  tag: string;
  /** Bounding rect in iframe-local coordinates */
  rect: SceneRect;
  /** Whether this node has a real AST stamp (vs synthetic CST id) */
  isStamped: boolean;
  children: SceneNode[];
  parent: SceneNode | null;
}

// Serialised form sent over postMessage — no parent ref, rects included.
export interface SceneNodeData {
  id: string;
  tag: string;
  rect: SceneRect;
  children: SceneNodeData[];
}

// ── SceneGraph ────────────────────────────────────────────────────────────────

export class SceneGraph {
  /** Flat id→node index for O(1) patch */
  private index: Map<string, SceneNode> = new Map();
  /** Root-level nodes (direct children of <body>) */
  private roots: SceneNode[] = [];
  /** Timestamp of the last full build */
  private lastBuildAt = 0;

  // ── Build ──────────────────────────────────────────────────────────────────

  /**
   * Atomically replace the entire graph from a fresh snapshot.
   * Called when `glide:scene-nodes` postMessage arrives.
   */
  build(nodes: SceneNodeData[]): void {
    const nextIndex = new Map<string, SceneNode>();
    const nextRoots = nodes.map(n => this._hydrate(n, null, nextIndex));
    this.index = nextIndex;
    this.roots = nextRoots;
    this.lastBuildAt = Date.now();
  }

  private _hydrate(
    data: SceneNodeData,
    parent: SceneNode | null,
    index: Map<string, SceneNode>,
  ): SceneNode {
    const node: SceneNode = {
      id: data.id,
      tag: data.tag,
      rect: { ...data.rect },
      isStamped: !data.id.startsWith('__glide_cst_'),
      children: [],
      parent,
    };
    index.set(data.id, node);
    node.children = data.children.map(c => this._hydrate(c, node, index));
    return node;
  }

  // ── Patch ─────────────────────────────────────────────────────────────────

  /**
   * Update rect for a single node by id — used by future bidirectional sync.
   * No-ops if the id is not in the index.
   */
  patch(id: string, rect: SceneRect): void {
    const node = this.index.get(id);
    if (node) node.rect = { ...rect };
  }

  /** Patch multiple nodes in one call. */
  patchMany(updates: Array<{ id: string; rect: SceneRect }>): void {
    for (const u of updates) this.patch(u.id, u.rect);
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  /**
   * Return the deepest SceneNode whose rect contains (x, y).
   *
   * Preference order (matching v0's hit-test strategy):
   *   1. Deepest node with a real AST stamp (`isStamped = true`)
   *   2. Deepest node overall (synthetic CST ids)
   *
   * @param x  X coordinate in iframe-local pixels
   * @param y  Y coordinate in iframe-local pixels
   */
  hitTest(x: number, y: number): SceneNode | null {
    // DFS: try to find the deepest node that contains (x, y).
    // At each level, prefer a stamped node over a synthetic one.
    const search = (nodes: SceneNode[]): SceneNode | null => {
      // Iterate in reverse — later siblings render on top (z-order).
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        if (!containsPoint(node.rect, x, y)) continue;

        // Try to go deeper first.
        const deeperHit = search(node.children);
        if (deeperHit !== null) {
          // If we found a deeper stamped node, always prefer it.
          // If deeper is synthetic and current is stamped, prefer current.
          if (deeperHit.isStamped || !node.isStamped) return deeperHit;
          return node; // current is stamped, deeper is synthetic
        }

        // No deeper match — this node is the deepest hit.
        return node;
      }
      return null;
    };

    return search(this.roots);
  }

  /**
   * Find a node by exact id.
   */
  getById(id: string): SceneNode | null {
    return this.index.get(id) ?? null;
  }

  /**
   * Return all nodes at the given depth (0 = roots).
   */
  nodesAtDepth(depth: number): SceneNode[] {
    const results: SceneNode[] = [];
    const visit = (nodes: SceneNode[], d: number) => {
      for (const n of nodes) {
        if (d === depth) { results.push(n); continue; }
        visit(n.children, d + 1);
      }
    };
    visit(this.roots, 0);
    return results;
  }

  get size(): number { return this.index.size; }
  get buildTime(): number { return this.lastBuildAt; }
  get isEmpty(): boolean { return this.index.size === 0; }
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

/** True if (x, y) lies within rect (inclusive edges). */
export function containsPoint(rect: SceneRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * True if `inner` is fully contained by `outer` — used to prefer
 * the deepest node when two rects both contain the test point.
 */
export function isContainedBy(inner: SceneRect, outer: SceneRect): boolean {
  return (
    inner.left >= outer.left &&
    inner.right <= outer.right &&
    inner.top >= outer.top &&
    inner.bottom <= outer.bottom
  );
}

/**
 * Convert a DOMRect (or any rect-like) to a plain SceneRect.
 * Safe to call in both browser and Node (test) environments.
 */
export function toSceneRect(r: {
  left: number; top: number; right?: number; bottom?: number;
  width: number; height: number;
}): SceneRect {
  return {
    left: r.left,
    top: r.top,
    right: r.right ?? r.left + r.width,
    bottom: r.bottom ?? r.top + r.height,
    width: r.width,
    height: r.height,
  };
}
