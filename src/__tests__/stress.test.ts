/**
 * Stress and edge-case tests for the server: concurrent source writes, path traversal,
 * history limits, broadcast to many clients, and unknown messages.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { connectLocal } from './ws-client.js';
import { startTestProject, closeTestProjects, request } from './server-fixture.js';
afterEach(closeTestProjects);
import { GlideServer } from '../../packages/server/src/ws-server.js';
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
  const ws = await connectLocal(port);
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

describe('[Stress] Revision-checked source writes', () => {
  test('50 clients commit edits to distinct source files', async () => {
    const f = await startTestProject();
    const clients = await Promise.all(Array.from({ length: 50 }, () => f.connect()));
    const results = await Promise.all(clients.map((client, index) => {
      const file = 'Component' + index + '.tsx';
      f.write(file, f.read());
      return request(client, f.edit({ type: 'text', value: 'Client ' + index }, '<button', file));
    }));
    expect(results.every(result => result.success)).toBe(true);
    for (let i = 0; i < clients.length; i++) expect(f.read('Component' + i + '.tsx')).toContain('Client ' + i);
  }, 30000);

  test('500 sequential writes advance the actual file revision', async () => {
    const f = await startTestProject(), client = await f.connect();
    for (let i = 0; i < 500; i++) {
      const result = await request(client, f.edit({ type: 'text', value: 'Revision ' + i }));
      expect(result.success, result.error).toBe(true);
    }
    expect(f.read()).toContain('Revision 499');
  }, 30000);

  test('independent files do not conflict under concurrent writes', async () => {
    const f = await startTestProject();
    const clients = await Promise.all(Array.from({ length: 10 }, () => f.connect()));
    clients.forEach((_, i) => f.write('File' + i + '.tsx', f.read()));
    for (let revision = 0; revision < 100; revision++) {
      const results = await Promise.all(clients.map((client, i) => request(client,
        f.edit({ type: 'text', value: 'Revision ' + revision }, '<button', 'File' + i + '.tsx'))));
      expect(results.every(result => result.success)).toBe(true);
    }
    clients.forEach((_, i) => expect(f.read('File' + i + '.tsx')).toContain('Revision 99'));
  }, 30000);
});


// ─── 5. SceneGraph deep nesting (depth 20) ───────────────────────────────────


// ─── 6. Path traversal security regression ───────────────────────────────────

describe('[Security] Path traversal blocked in server', () => {
  let server: GlideServer;
  let port: number;

  beforeEach(async () => {
    port = nextPort();
    server = new GlideServer(port);

    await server.start();
  });

  afterEach(async () => { await server.stop(); });

  test('../../etc/passwd path traversal payload does NOT write and returns error', async () => {
    const ws = await openClient(port);
    try {
      const resp = await sendAndAwait(ws, {
        type: 'edit', transactionId: 'invalid-path', expectedDigest: 'unused',
        file: '../../etc/passwd',
        line: 1,
        column: 1,
        change: { type: 'class', property: 'className', value: 'evil' },
      });

      // Must NOT succeed — path traversal must be blocked
      expect(resp.success).toBe(false);
    } finally {
      ws.close();
    }
  });

  test('Windows UNC path traversal blocked', async () => {
    const ws = await openClient(port);
    try {
      const resp = await sendAndAwait(ws, {
        type: 'edit', transactionId: 'invalid-path', expectedDigest: 'unused',
        file: '..\\..\\Windows\\System32\\calc.exe',
        line: 1,
        column: 1,
        change: { type: 'class', property: 'className', value: 'evil' },
      });

      expect(resp.success).toBe(false);
    } finally {
      ws.close();
    }
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


// ─── 10. DeltaQueue: deferred queue drains in order ─────────────────────────


// ─── 11. Server: burst 200 rapid edits without hang ─────────────────────────

describe('[Stress] Concurrent edits from one base revision', () => {
  test('200 burst requests yield one commit and 199 stale-revision rejections', async () => {
    const f = await startTestProject(), client = await f.connect();
    const payloads = Array.from({ length: 200 }, (_, i) => f.edit({ type: 'text', value: 'Change ' + i }));
    const responses: any[] = [];
    const complete = new Promise<void>(resolve => client.on('message', data => {
      const message = JSON.parse(String(data));
      if (message.type === 'status') responses.push(message);
      if (responses.length === 200) resolve();
    }));
    payloads.forEach(payload => client.send(JSON.stringify(payload)));
    await complete;
    expect(responses.filter(item => item.success)).toHaveLength(1);
    expect(responses.filter(item => item.error?.includes('STALE_DIGEST'))).toHaveLength(199);
    expect(f.read()).toContain('Change 0');
  }, 30000);
});

describe('[Stress] Server: broadcast reaches all 50 clients', () => {
  let server: GlideServer;
  let port: number;

  beforeEach(async () => {
    port = nextPort();
    server = new GlideServer(port);

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


// ─── 14. DeltaQueue: 1 000 independent properties never collide ──────────────


// ─── 15. Empty/null edge cases in SceneGraph ─────────────────────────────────


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

    await server.start();
  });

  afterEach(async () => { await server.stop(); });

  test('unknown message type does not crash server', async () => {
    const ws = await openClient(port);

    ws.send(JSON.stringify({ type: 'totally_unknown_op', data: 'xyzzy' }));

    // Allow server to process
    await new Promise<void>((res) => setTimeout(res, 100));

    // Server should still be alive — send a valid ping
    const pong = await sendAndAwait(ws, { type: 'GET_HISTORY' });
    expect(pong.type).toBe('HISTORY_UPDATE');

    ws.close();
  });
});
