import { afterEach, expect, test } from 'vitest';
import WebSocket from 'ws';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { IncomingMessage } from 'node:http';
import { createServer, type ViteDevServer } from 'vite';
import { GlideServer, isDevServerUpgrade } from '../../packages/server/src/ws-server.js';
import { connectLocal } from './ws-client.js';

// Vite's HMR client connects to the page's host. Through the preview proxy that
// is Glide's editor port, so Glide must hand those sockets to the dev server.
let server: GlideServer | undefined;
let vite: ViteDevServer | undefined;
let root: string | undefined;
afterEach(async () => {
  await server?.stop();
  await vite?.close();
  if (root) fs.rmSync(root, { recursive: true, force: true });
  server = vite = root = undefined;
});

async function startPair() {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-hmr-'));
  fs.writeFileSync(path.join(root, 'index.html'), '<html><body></body></html>');
  vite = await createServer({ root, configFile: false, logLevel: 'silent', server: { host: '127.0.0.1', port: 0 } });
  await vite.listen();
  const targetPort = (vite.httpServer!.address() as { port: number }).port;
  server = new GlideServer(0, targetPort);
  await server.start();
  const port = ((server as any).server.address() as { port: number }).port;
  return { port, token: vite.config.webSocketToken };
}

function opened(client: WebSocket): Promise<string> {
  return new Promise(resolve => {
    client.once('open', () => resolve('open'));
    client.once('unexpected-response', (_req, res) => resolve(`refused ${res.statusCode}`));
    client.once('error', () => resolve('error'));
  });
}

test('routes Vite subprotocols and other paths to the dev server, and the editor socket to Glide', () => {
  const upgrade = (url: string, protocol?: string) => ({ url, headers: protocol ? { 'sec-websocket-protocol': protocol } : {} }) as IncomingMessage;
  expect(isDevServerUpgrade(upgrade('/'))).toBe(false);
  expect(isDevServerUpgrade(upgrade('/?session=1'))).toBe(false);
  expect(isDevServerUpgrade(upgrade('/?token=abc', 'vite-hmr'))).toBe(true);
  expect(isDevServerUpgrade(upgrade('/', 'vite-ping'))).toBe(true);
  expect(isDevServerUpgrade(upgrade('/', 'other, vite-hmr'))).toBe(true);
  expect(isDevServerUpgrade(upgrade('/_next/webpack-hmr'))).toBe(true);
});

test('an HMR socket on the editor port reaches Vite in both directions', async () => {
  const { port, token } = await startPair();
  const client = new WebSocket(`ws://127.0.0.1:${port}/?token=${token}`, 'vite-hmr', { origin: `http://127.0.0.1:${port}` });
  const first = new Promise<any>(resolve => client.once('message', data => resolve(JSON.parse(String(data)))));
  expect(await opened(client)).toBe('open');
  expect(client.protocol).toBe('vite-hmr');
  expect(await first).toEqual({ type: 'connected' });

  const fromClient = new Promise<unknown>(resolve => vite!.ws.on('glide:test-up', data => resolve(data)));
  client.send(JSON.stringify({ type: 'custom', event: 'glide:test-up', data: { n: 1 } }));
  expect(await fromClient).toEqual({ n: 1 });

  const toClient = new Promise<any>(resolve => client.once('message', data => resolve(JSON.parse(String(data)))));
  vite!.ws.send({ type: 'custom', event: 'glide:test-down', data: { n: 2 } });
  expect(await toClient).toEqual({ type: 'custom', event: 'glide:test-down', data: { n: 2 } });
  client.close();
});

test("Vite's restart ping reaches Vite", async () => {
  const { port } = await startPair();
  const ping = new WebSocket(`ws://127.0.0.1:${port}/`, 'vite-ping', { origin: `http://127.0.0.1:${port}` });
  expect(await opened(ping)).toBe('open');
  // Vite closes a ping socket as soon as it opens.
  expect(await new Promise<number>(resolve => ping.once('close', resolve))).toBe(1000);
});

test("relays Vite's refusal of a bad token", async () => {
  const { port } = await startPair();
  const client = new WebSocket(`ws://127.0.0.1:${port}/?token=wrong`, 'vite-hmr', { origin: `http://127.0.0.1:${port}` });
  expect(await opened(client)).toBe('refused 400');
});

test('refuses an HMR socket from an untrusted origin before it reaches the dev server', async () => {
  const { port, token } = await startPair();
  let reached = false;
  vite!.ws.on('connection', () => { reached = true; });
  const client = new WebSocket(`ws://127.0.0.1:${port}/?token=${token}`, 'vite-hmr', { origin: 'https://untrusted.example' });
  expect(await opened(client)).toBe('refused 403');
  expect(reached).toBe(false);
});

test('the editor socket still authenticates with Glide while HMR is proxied', async () => {
  const { port } = await startPair();
  const editor = await connectLocal(port);
  const reply = new Promise<any>(resolve => editor.once('message', data => resolve(JSON.parse(String(data)))));
  editor.send(JSON.stringify({ type: 'get-tree', file: 'missing.tsx' }));
  expect((await reply).type).toBe('tree');
  editor.close();
});

test('stop closes open proxied sockets instead of waiting on them', async () => {
  const { port, token } = await startPair();
  const client = new WebSocket(`ws://127.0.0.1:${port}/?token=${token}`, 'vite-hmr', { origin: `http://127.0.0.1:${port}` });
  expect(await opened(client)).toBe('open');
  const closed = new Promise<void>(resolve => client.once('close', () => resolve()));
  await server!.stop();
  server = undefined;
  await closed;
});
