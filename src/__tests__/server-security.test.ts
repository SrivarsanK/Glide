import { afterEach, expect, test } from 'vitest';
import WebSocket from 'ws';
import { GlideServer } from '../../packages/server/src/ws-server.js';
import { connectLocal } from './ws-client.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

let server: GlideServer;
const port = 7983;
afterEach(async () => { await server?.stop(); });

test('rejects outside files on every structural mutation route before reading or writing', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-outside-'));
  const file = path.join(root, 'App.tsx');
  const source = 'const App = () => <div><span>A</span><span>B</span></div>;';
  fs.writeFileSync(file, source);
  try {
    server = new GlideServer(port);
    await server.start();
    const client = await connectLocal(port);
    for (const type of ['insert', 'reorder', 'reparent', 'group', 'ungroup', 'arrange']) {
      const response = new Promise<any>(resolve => client.once('message', data => resolve(JSON.parse(String(data)))));
      client.send(JSON.stringify({ type, file, transactionId: `escape-${type}`, expectedDigest: 'not-used',
        targetId: `${file}:1:19`, sourceId: `${file}:1:19`, groupId: `${file}:1:19`, parentId: `${file}:1:19`,
        elementType: 'rectangle', selectedIds: [`${file}:1:19`] }));
      expect(await response).toMatchObject({ type: 'status', success: false, error: expect.stringContaining('INVALID_PATH') });
      expect(fs.readFileSync(file, 'utf8')).toBe(source);
    }
    client.close();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('binds only to loopback and rejects a foreign Host header', async () => {
  server = new GlideServer(port);
  await server.start();
  expect((server as any).server.address().address).toBe('127.0.0.1');
  const client = new WebSocket(`ws://127.0.0.1:${port}`, { headers: { Host: `untrusted.example:${port}` } });
  const outcome = await new Promise<string>(resolve => {
    client.on('open', () => resolve('open'));
    client.on('error', () => resolve('rejected'));
  });
  client.terminate();
  expect(outcome).toBe('rejected');
});

test('closes an oversized message without reaching callbacks', async () => {
  server = new GlideServer(port);
  let calls = 0;
  server.onEdit(() => { calls++; });
  await server.start();
  const client = await connectLocal(port);
  const closed = new Promise<number>(resolve => client.once('close', resolve));
  client.send('x'.repeat(256 * 1024 + 1));
  expect(await closed).toBe(1009);
  expect(calls).toBe(0);
});

test('does not send broadcasts before authentication', async () => {
  server = new GlideServer(port);
  await server.start();
  const client = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise<void>(resolve => client.once('open', resolve));
  const received: unknown[] = [];
  client.on('message', value => received.push(value));
  server.broadcast({ type: 'tree', file: 'private.tsx' });
  client.send(JSON.stringify({ type: 'hello', token: 'wrong' }));
  await new Promise<void>(resolve => client.once('close', () => resolve()));
  expect(received).toHaveLength(1);
  expect(String(received[0])).toContain('UNAUTHORIZED');
});

test('rejects an untrusted browser origin during upgrade', async () => {
  server = new GlideServer(port);
  await server.start();
  const client = new WebSocket(`ws://127.0.0.1:${port}`, { origin: 'https://untrusted.example' });
  const outcome = await new Promise<string>(resolve => {
    client.on('open', () => resolve('open'));
    client.on('error', () => resolve('rejected'));
  });
  client.terminate();
  expect(outcome).toBe('rejected');
});

test('blocks mutation callbacks before a session handshake', async () => {
  server = new GlideServer(port);
  let calls = 0;
  server.onEdit(() => { calls++; });
  await server.start();
  const client = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise<void>(resolve => client.on('open', resolve));
  const response = new Promise<any>(resolve => client.once('message', data => resolve(JSON.parse(String(data)))));
  client.send(JSON.stringify({ type: 'edit', file: 'src/App.tsx', line: 1, column: 1, change: { type: 'text', value: 'Unsafe' } }));
  expect((await response).success).toBe(false);
  expect(calls).toBe(0);
  client.terminate();
});
