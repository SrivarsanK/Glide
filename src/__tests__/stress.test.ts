/**
 * stress.test.ts — Glide Stress & Bug Regression Suite
 *
 * Coverage targets:
 *   1. Concurrent WebSocket connections (50 clients simultaneous)
 *   2. Rapid-fire LWW flood (500 sequential edits, same property)
 *   3. Cross-property independence under load (10 properties × 100 edits)
 *   4. SceneGraph build/hitTest performance on 1 000-node tree
 *   5. SceneGraph deep nesting (depth 20, ensures no stack overflow)
 *   6. Path traversal blocked by isSafeFilePath (regression)
 *   7. HistoryStore: push beyond maxHistory cap keeps consistent index
 *   8. HistoryStore: squash collapses rapid edits to same key
 *   9. DeltaQueue: concurrent race — same prop, two clients, last wins
 *  10. DeltaQueue: deferred queue drains in order after burst of acks
 *  11. Server: burst 200 rapid edits processed without hang (timeout guard)
 *  12. Server: 50 parallel clients all get scene_update broadcast
 *  13. SceneGraph: patchMany 500 updates under 5 ms
 *  14. PropertyDeltaQueue: 1 000 concurrent properties never collide
 *  15. Server: path traversal payload rejected (SECURITY regression)
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import {
  SceneGraph,
  SceneRect,
  SceneNodeData,
  toSceneRect,
} from '../../packages/overlay/src/scene-graph.js';
import { GlideServer } from '../../packages/server/src/ws-server.js';
import { PropertyDeltaQueue } from '../../packages/server/src/delta-queue.js';
import { HistoryStore } from '../../packages/server/src/history-manager.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function r(left: number, top: number, w: number, h: number): SceneRect {
  return { left, top, right: left + w, bottom: top + h, width: w, height: h };
}

function node(id: string, rect: SceneRect, children: SceneNodeData[] = []): SceneNodeData {
  return { id, tag: 'div', rect, children };
}

/** Open a WS client and wait for the 'open' event. */
async function openClient(port: number): Promise<WebSocket> {
  const ws = new WebSocket(`ws://localhost:${port}`);
  await new Promise<void>((res) => ws.on('open', res));
  return ws;
}

/** Send a JSON message and wait for the next message response. */
async function sendAndAwait(ws: WebSocket, payload: object): Promise<any> {
  ws.send(JSON.stringify(payload));
  return new Promise<any>((res) => {
    ws.once('message', (d) => res(JSON.parse(d.toString())));
  });
}

const BASE_PORT = 7900;
let portCounter = BASE_PORT;
function nextPort() { return portCounter++; }

// ─── 1. Concurrent connections ────────────────────────────────────────────────

describe('[Stress] Concurrent 50 WebSocket clients', () => {
  let server: GlideServer;
  let port: number;

  beforeEach(async () => {
    port = nextPort();
    server = new GlideServer(port);
    server.onEdit(() => {});
    await server.start();
  });

  afterEach(async () => { await server.stop(); });

  test('all 50 clients connect and receive successful edit ack', async () => {
    const N = 50;
    const clients = await Promise.all(Array.from({ length: N }, () => openClient(port)));

    const results = await Promise.all(
      clients.map((ws, i) =>
        sendAndAwait(ws, {
          type: 'edit',
          file: `src/Component${i}.tsx`,
          line: i + 1,
          column: 1,
          change: { type: 'class', property: 'className', value: `text-${i}` },
        })
      )
    );

    for (const res of results) {
      expect(res.success).toBe(true);
    }

    await Promise.all(clients.map((ws) => new Promise<void>((res) => { ws.close(); ws.on('close', res); })));
  }, 15_000);
});

// ─── 2. Rapid-fire LWW flood ──────────────────────────────────────────────────

describe('[Stress] LWW rapid-fire flood — same property', () => {
  let server: GlideServer;
  let port: number;

  beforeEach(async () => {
    port = nextPort();
    server = new GlideServer(port);
    server.onEdit(() => {});
    await server.start();
  });

  afterEach(async () => { await server.stop(); });

  test('500 sequential edits to same prop — only ascending timestamps accepted', async () => {
    const ws = await openClient(port);
    const ITERS = 500;
    let accepted = 0;
    let rejected = 0;

    for (let i = 0; i < ITERS; i++) {
      const ts = i % 3 === 0 ? i * 10 : (ITERS - i) * 10; // intentionally scrambled
      const resp = await sendAndAwait(ws, {
        type: 'edit',
        file: 'src/App.tsx',
        line: 5,
        column: 2,
        timestamp: ts,
        change: { type: 'style', value: { width: `${i * 2}px` } },
      });
      if (resp.success) accepted++;
      else rejected++;
    }

    // At least 1 accepted (first always passes), some rejected (stale timestamps)
    expect(accepted).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0);
    expect(accepted + rejected).toBe(ITERS);

    ws.close();
  }, 30_000);
});

// ─── 3. Cross-property independence under load ────────────────────────────────

describe('[Stress] Cross-property independence — 10 props × 100 edits', () => {
  let server: GlideServer;
  let port: number;

  beforeEach(async () => {
    port = nextPort();
    server = new GlideServer(port);
    server.onEdit(() => {});
    await server.start();
  });

  afterEach(async () => { await server.stop(); });

  test('distinct properties never block each other', async () => {
    const ws = await openClient(port);
    const PROPS = ['width', 'height', 'color', 'fontSize', 'padding',
                   'margin', 'opacity', 'borderRadius', 'zIndex', 'flex'];
    const ITERS = 100;

    for (let i = 0; i < ITERS; i++) {
      const results = await Promise.all(
        PROPS.map((prop) =>
          sendAndAwait(ws, {
            type: 'edit',
            file: 'src/App.tsx',
            line: 1,
            column: 1,
            timestamp: Date.now() + i * 100,
            change: { type: 'style', value: { [prop]: `${i}px` } },
          })
        )
      );
      // Every property-level write should succeed independently
      for (const res of results) {
        expect(res.success).toBe(true);
      }
    }

    ws.close();
  }, 60_000);
});

// ─── 4. SceneGraph build/hitTest performance ──────────────────────────────────

describe('[Perf] SceneGraph 1 000-node build + hitTest', () => {
  test('builds 1 000 nodes and runs 1 000 hitTests in under 200 ms', () => {
    const N = 1000;
    const nodes: SceneNodeData[] = Array.from({ length: N }, (_, i) => ({
      id: `node-${i}`,
      tag: 'div',
      rect: r(i * 2, i * 2, 50, 50),
      children: [],
    }));

    const sg = new SceneGraph();
    const t0 = performance.now();
    sg.build(nodes);
    const buildMs = performance.now() - t0;
    expect(buildMs).toBeLessThan(200);
    expect(sg.size).toBe(N);

    const t1 = performance.now();
    for (let i = 0; i < N; i++) {
      sg.hitTest(i * 2 + 10, i * 2 + 10);
    }
    const hitMs = performance.now() - t1;
    expect(hitMs).toBeLessThan(200);
  });
});

// ─── 5. SceneGraph deep nesting (depth 20) ───────────────────────────────────

describe('[Stress] SceneGraph deep nesting — 20 levels', () => {
  test('builds depth-20 tree without stack overflow', () => {
    function mkNested(depth: number): SceneNodeData {
      const side = 500 - depth * 20;
      const offset = depth * 10;
      if (depth === 0) return node(`leaf`, r(offset, offset, side, side));
      return node(`level-${depth}`, r(offset, offset, side, side), [mkNested(depth - 1)]);
    }

    const sg = new SceneGraph();
    expect(() => sg.build([mkNested(20)])).not.toThrow();
    expect(sg.size).toBe(21);

    const hit = sg.hitTest(200, 200);
    expect(hit).not.toBeNull();
    expect(hit?.id).toBe('leaf');
  });
});

// ─── 6. Path traversal security regression ───────────────────────────────────

describe('[Security] Path traversal blocked in server', () => {
  let server: GlideServer;
  let port: number;

  beforeEach(async () => {
    port = nextPort();
    server = new GlideServer(port);
    server.onEdit(() => {});
    await server.start();
  });

  afterEach(async () => { await server.stop(); });

  test('../../etc/passwd path traversal payload does NOT write and returns error', async () => {
    const ws = await openClient(port);

    const resp = await sendAndAwait(ws, {
      type: 'edit',
      file: '../../etc/passwd',
      line: 1,
      column: 1,
      change: { type: 'class', property: 'className', value: 'evil' },
    });

    // Must NOT succeed — path traversal must be blocked
    expect(resp.success).toBe(false);

    ws.close();
  });

  test('Windows UNC path traversal blocked', async () => {
    const ws = await openClient(port);

    const resp = await sendAndAwait(ws, {
      type: 'edit',
      file: '..\\..\\Windows\\System32\\calc.exe',
      line: 1,
      column: 1,
      change: { type: 'class', property: 'className', value: 'evil' },
    });

    expect(resp.success).toBe(false);

    ws.close();
  });
});

// ─── 7. HistoryStore: push beyond maxHistory cap ─────────────────────────────

describe('[Stress] HistoryStore: beyond maxHistory cap', () => {
  test('capped at maxHistory (50) — index stays valid and undo works', () => {
    const store = new HistoryStore();
    store.setLimit(50);

    for (let i = 0; i < 200; i++) {
      store.push({
        description: `change-${i}`,
        diffs: [{ file: 'App.tsx', before: `v${i}`, after: `v${i + 1}` }],
      });
    }

    const state = store.getState();
    expect(state.stack.length).toBe(50);
    expect(state.currentIndex).toBe(49);

    // Undo should return valid diffs
    const diffs = store.undo();
    expect(diffs).not.toBeNull();
    expect(diffs!.length).toBe(1);
  });
});

// ─── 8. HistoryStore: squash collapses rapid edits ───────────────────────────

describe('[Unit] HistoryStore: squash window collapses rapid edits', () => {
  test('multiple rapid edits with same squashKey collapse into one entry', () => {
    const store = new HistoryStore();
    const BASE_TS = Date.now();

    const push = (i: number, overrideTs?: number) => {
      // We monkey-patch the clock by using squashWindowMs large enough
      store.push({
        description: `Width drag ${i}`,
        squashKey: 'node-1::width',
        squashWindowMs: 60_000, // 60 s window — all pushes collapse
        diffs: [{ file: 'App.tsx', before: `${i}px`, after: `${i + 10}px` }],
      });
    };

    push(0);
    push(1);
    push(2);
    push(3);

    const state = store.getState();
    expect(state.stack.length).toBe(1); // all 4 collapsed
    expect(state.currentIndex).toBe(0);
    expect(state.stack[0].description).toBe('Width drag 3'); // latest description
  });

  test('different squashKeys produce distinct entries', () => {
    const store = new HistoryStore();

    store.push({ description: 'Width', squashKey: 'node::width', squashWindowMs: 60_000, diffs: [] });
    store.push({ description: 'Height', squashKey: 'node::height', squashWindowMs: 60_000, diffs: [] });

    const state = store.getState();
    expect(state.stack.length).toBe(2);
  });
});

// ─── 9. DeltaQueue: concurrent race — same prop, two clients ─────────────────

describe('[Stress] DeltaQueue: two-client concurrent race', () => {
  test('last timestamp wins when two clients race same property', () => {
    const q = new PropertyDeltaQueue();

    // Client A records timestamp=1000
    q.recordApplied('node-x', 'background', 'red', 1000);

    // Client B arrives at 999 (stale) → rejected
    expect(q.canApplyLWW('node-x', 'background', 999)).toBe(false);

    // Client B arrives at 2000 (newer) → accepted
    expect(q.canApplyLWW('node-x', 'background', 2000)).toBe(true);
    q.recordApplied('node-x', 'background', 'blue', 2000);

    // Client A tries again at 1500 (now stale) → rejected
    expect(q.canApplyLWW('node-x', 'background', 1500)).toBe(false);
  });
});

// ─── 10. DeltaQueue: deferred queue drains in order ─────────────────────────

describe('[Stress] DeltaQueue: deferred drain order', () => {
  test('deferred callbacks execute in FIFO order after ack', async () => {
    const q = new PropertyDeltaQueue();
    q.enqueuePending('node-y', 'opacity', 0.5);

    const order: number[] = [];

    for (let i = 0; i < 5; i++) {
      const capturedI = i;
      q.defer('node-y', 'opacity', {
        opId: `op-${i}`,
        nodeId: 'node-y',
        prop: 'opacity',
        value: i * 0.1,
        timestamp: Date.now(),
      }, () => {
        order.push(capturedI);
      });
    }

    expect(q.getStats().deferredCount).toBe(5);
    q.ackPending('node-y', 'opacity');

    await new Promise<void>((res) => setTimeout(res, 20));

    expect(order).toEqual([0, 1, 2, 3, 4]);
    expect(q.getStats().deferredCount).toBe(0);
  });
});

// ─── 11. Server: burst 200 rapid edits without hang ─────────────────────────

describe('[Stress] Server: 200 rapid edits burst on single connection', () => {
  let server: GlideServer;
  let port: number;

  beforeEach(async () => {
    port = nextPort();
    server = new GlideServer(port);
    server.onEdit(() => {});
    await server.start();
  });

  afterEach(async () => { await server.stop(); });

  test('200 edit messages processed — each returns status + HISTORY_UPDATE (400 total msgs)', async () => {
    const ws = await openClient(port);
    const N = 200;
    // Each edit sends 2 messages: 'status' + 'HISTORY_UPDATE'
    const EXPECTED_MSGS = N * 2;
    const responses: any[] = [];

    const done = new Promise<void>((res) => {
      ws.on('message', (d) => {
        responses.push(JSON.parse(d.toString()));
        if (responses.length >= EXPECTED_MSGS) res();
      });
    });

    for (let i = 0; i < N; i++) {
      ws.send(JSON.stringify({
        type: 'edit',
        file: 'src/App.tsx',
        line: i % 100 + 1,
        column: 1,
        timestamp: Date.now() + i,
        change: { type: 'class', property: 'className', value: `cls-${i}` },
      }));
    }

    await Promise.race([done, new Promise<void>((_, rej) => setTimeout(() => rej(new Error('Timeout: burst edits not processed in 5s')), 5000))]);

    const statusMsgs = responses.filter(r => r.type === 'status');
    const historyMsgs = responses.filter(r => r.type === 'HISTORY_UPDATE');

    // Every edit produces exactly one status + one HISTORY_UPDATE
    expect(statusMsgs.length).toBe(N);
    expect(historyMsgs.length).toBe(N);
    for (const r of statusMsgs) {
      expect(typeof r.success).toBe('boolean');
    }

    ws.close();
  }, 10_000);
});

// ─── 12. Server: 50 clients all get scene_update broadcast ──────────────────

describe('[Stress] Server: broadcast reaches all 50 clients', () => {
  let server: GlideServer;
  let port: number;

  beforeEach(async () => {
    port = nextPort();
    server = new GlideServer(port);
    server.onEdit(() => {});
    await server.start();
  });

  afterEach(async () => { await server.stop(); });

  test('scene_update broadcast received by all 50 connected clients', async () => {
    const N = 50;
    const clients = await Promise.all(Array.from({ length: N }, () => openClient(port)));

    const received: Promise<any>[] = clients.map(
      (ws) => new Promise<any>((res) => {
        ws.on('message', (d) => {
          const msg = JSON.parse(d.toString());
          if (msg.type === 'scene_update') res(msg);
        });
      })
    );

    server.broadcast({
      type: 'scene_update',
      file: 'src/App.tsx',
      elements: [{ id: 'root', tag: 'div', line: 1, col: 1 }],
      generation: 99,
    });

    const msgs = await Promise.race([
      Promise.all(received),
      new Promise<any>((_, rej) => setTimeout(() => rej(new Error('Broadcast timeout')), 3000)),
    ]);

    expect(msgs.length).toBe(N);
    for (const m of msgs) {
      expect(m.generation).toBe(99);
    }

    await Promise.all(clients.map((ws) => new Promise<void>((res) => { ws.close(); ws.on('close', res); })));
  }, 10_000);
});

// ─── 13. SceneGraph: patchMany 500 updates under 5 ms ───────────────────────

describe('[Perf] SceneGraph.patchMany 500 nodes under 5 ms', () => {
  test('patchMany on 500-node flat graph completes within 5 ms', () => {
    const N = 500;
    const sg = new SceneGraph();
    sg.build(Array.from({ length: N }, (_, i) => node(`n${i}`, r(i, 0, 50, 50))));

    const patches = Array.from({ length: N }, (_, i) => ({
      id: `n${i}`,
      rect: r(i + 1, 1, 52, 52),
    }));

    const t0 = performance.now();
    sg.patchMany(patches);
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(5);
    expect(sg.getById('n0')!.rect.left).toBe(1);
    expect(sg.getById('n499')!.rect.width).toBe(52);
  });
});

// ─── 14. DeltaQueue: 1 000 independent properties never collide ──────────────

describe('[Stress] DeltaQueue: 1 000 independent properties', () => {
  test('1 000 distinct property keys never conflict with each other', () => {
    const q = new PropertyDeltaQueue();
    const N = 1000;
    const TS = 5000;

    for (let i = 0; i < N; i++) {
      q.recordApplied('node-z', `prop-${i}`, i, TS);
    }

    // Each property should accept newer timestamps independently
    for (let i = 0; i < N; i++) {
      expect(q.canApplyLWW('node-z', `prop-${i}`, TS + 1)).toBe(true);
      // Stale timestamps rejected per-property
      expect(q.canApplyLWW('node-z', `prop-${i}`, TS - 1)).toBe(false);
    }

    const stats = q.getStats();
    expect(stats.appliedCount).toBe(N);
  });
});

// ─── 15. Empty/null edge cases in SceneGraph ─────────────────────────────────

describe('[Bug] SceneGraph: edge case IDs and zero-size nodes', () => {
  test('zero-size node is built but not hit-tested as a leaf', () => {
    const sg = new SceneGraph();
    sg.build([
      node('zero', r(10, 10, 0, 0)),
      node('real', r(10, 10, 100, 100)),
    ]);
    expect(sg.size).toBe(2);
    const hit = sg.hitTest(50, 50);
    // Should hit 'real', not 'zero' (zero-area node can't contain point)
    expect(hit?.id).toBe('real');
  });

  test('node with id containing colons (AST source ref) resolves correctly', () => {
    const sg = new SceneGraph();
    const id = '/src/components/Card.tsx:42:8';
    sg.build([node(id, r(0, 0, 200, 200))]);
    expect(sg.getById(id)?.isStamped).toBe(true);
  });

  test('getById on empty graph returns null without throwing', () => {
    const sg = new SceneGraph();
    expect(() => sg.getById('anything')).not.toThrow();
    expect(sg.getById('anything')).toBeNull();
  });

  test('patchMany with unknown IDs is a silent no-op', () => {
    const sg = new SceneGraph();
    sg.build([node('A', r(0, 0, 100, 100))]);
    expect(() => sg.patchMany([{ id: 'GHOST', rect: r(0, 0, 1, 1) }])).not.toThrow();
    expect(sg.size).toBe(1);
  });
});

// ─── 16. HistoryStore: jumpTo out-of-bounds safety ──────────────────────────

describe('[Bug] HistoryStore: jumpTo boundary safety', () => {
  test('jumpTo(-2) returns empty without throwing', () => {
    const store = new HistoryStore();
    store.push({ description: 'A', diffs: [{ file: 'f', before: '1', after: '2' }] });
    expect(() => store.jumpTo(-2)).not.toThrow();
    expect(store.jumpTo(-2)).toEqual([]);
  });

  test('jumpTo beyond stack end returns empty without throwing', () => {
    const store = new HistoryStore();
    store.push({ description: 'A', diffs: [{ file: 'f', before: '1', after: '2' }] });
    expect(() => store.jumpTo(999)).not.toThrow();
    expect(store.jumpTo(999)).toEqual([]);
  });

  test('setLimit(0) clamped to 1 — push still works', () => {
    const store = new HistoryStore();
    store.setLimit(0); // should clamp to 1
    store.push({ description: 'X', diffs: [] });
    store.push({ description: 'Y', diffs: [] });
    expect(store.getState().stack.length).toBe(1);
    expect(store.getState().stack[0].description).toBe('Y');
  });
});

// ─── 17. Server: unknown message types handled gracefully ────────────────────

describe('[Bug] Server: unknown message type', () => {
  let server: GlideServer;
  let port: number;

  beforeEach(async () => {
    port = nextPort();
    server = new GlideServer(port);
    server.onEdit(() => {});
    await server.start();
  });

  afterEach(async () => { await server.stop(); });

  test('unknown message type does not crash server', async () => {
    const ws = await openClient(port);

    ws.send(JSON.stringify({ type: 'totally_unknown_op', data: 'xyzzy' }));

    // Allow server to process
    await new Promise<void>((res) => setTimeout(res, 100));

    // Server should still be alive — send a valid ping
    const pong = await sendAndAwait(ws, { type: 'GET_PENDING_OPS' });
    expect(pong.type).toBe('PENDING_OPS');

    ws.close();
  });
});
