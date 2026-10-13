import { afterEach, expect, test } from 'vitest';
import WebSocket from 'ws';
import { GlideServer } from '../../packages/server/src/ws-server.js';
import { connectLocal } from './ws-client.js';

let server: GlideServer;
const port = 7983;
afterEach(async () => { await server?.stop(); });

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
