import { afterEach, expect, test } from 'vitest';
import WebSocket from 'ws';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as net from 'node:net';
import { createServer as createHttpServer, request as httpRequest, type IncomingMessage } from 'node:http';
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

test('malformed scheme-relative request URLs return 400 instead of throwing ERR_INVALID_URL', async () => {
  expect(() => isDevServerUpgrade({ url: '//[::1', headers: {} } as IncomingMessage)).not.toThrow();
  const { port } = await startPair();
  const rawResponse = await new Promise<string>((resolve, reject) => {
    const sock = net.connect(port, '127.0.0.1', () => {
      sock.write(`GET //[::1 HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`);
    });
    let data = '';
    sock.on('data', chunk => { data += chunk.toString('utf8'); });
    sock.on('end', () => resolve(data));
    sock.on('error', reject);
  });
  expect(rawResponse).toContain('HTTP/1.1 400');
  // Server remains healthy after the malformed request.
  const editor = await connectLocal(port);
  editor.close();
});

test('HTML proxy avoids double-prefixing /__glide_proxy__/ and preserves double quotes in WebSocket rewrites', async () => {
  const upstream = createHttpServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    const upstreamPort = (upstream.address() as any).port;
    res.end(`<html><head><script src="http://localhost:${upstreamPort}/src/main.tsx"></script><script>new WebSocket("ws://localhost:${upstreamPort}/hmr")</script></head><body>ok</body></html>`);
  });
  await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const upstreamPort = (upstream.address() as any).port as number;
  try {
    server = new GlideServer(0, upstreamPort);
    await server.start();
    const port = ((server as any).server.address() as { port: number }).port;
    const html = await new Promise<string>((resolve, reject) => {
      httpRequest(`http://localhost:${port}/__glide_proxy__/`, { headers: { Connection: 'close' } }, res => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve(body));
      }).on('error', reject).end();
    });
    expect(html).toContain('src="/__glide_proxy__/src/main.tsx"');
    expect(html).not.toContain('/__glide_proxy__/__glide_proxy__/');
    expect(html).toContain(`new WebSocket("ws://localhost:${upstreamPort}/hmr")`);
  } finally {
    upstream.closeAllConnections();
    await new Promise<void>(resolve => upstream.close(() => resolve()));
  }
});

test('proxy survives mid-body upstream reset without ERR_HTTP_HEADERS_SENT and frames refused chunked WS upgrades cleanly', async () => {
  const upstream = createHttpServer((req, res) => {
    if (req.url === '/reset') {
      res.writeHead(200, { 'Content-Type': 'application/javascript', 'Content-Length': '5000' });
      res.write('console.log(1);');
      // Forcibly reset the TCP socket after headers have been flushed.
      setTimeout(() => req.socket.resetAndDestroy(), 20);
      return;
    }
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.write('denied');
    res.end();
  });
  await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const upstreamPort = (upstream.address() as any).port as number;
  try {
    server = new GlideServer(0, upstreamPort);
    await server.start();
    const port = ((server as any).server.address() as { port: number }).port;

    // 1. Mid-body upstream TCP RST must not crash the GlideServer process.
    await new Promise<void>(resolve => {
      const req = httpRequest(`http://localhost:${port}/reset`, { headers: { Connection: 'close' } }, res => {
        res.on('data', () => {});
        res.on('end', () => resolve());
        res.on('error', () => resolve());
        res.on('close', () => resolve());
      });
      req.on('error', () => resolve());
      req.end();
    });

    // 2. Refused chunked WS upgrade must NOT advertise Transfer-Encoding: chunked over unchunked body bytes.
    const rawRefusal = await new Promise<string>((resolve, reject) => {
      const sock = net.connect(port, '127.0.0.1', () => {
        sock.write(
          `GET /?token=bad HTTP/1.1\r\n` +
          `Host: localhost:${port}\r\n` +
          `Origin: http://localhost:${port}\r\n` +
          `Upgrade: websocket\r\n` +
          `Connection: Upgrade\r\n` +
          `Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n` +
          `Sec-WebSocket-Version: 13\r\n` +
          `Sec-WebSocket-Protocol: vite-hmr\r\n\r\n`
        );
      });
      let out = '';
      sock.on('data', chunk => { out += chunk.toString('utf8'); });
      sock.on('end', () => resolve(out));
      sock.on('error', reject);
    });
    expect(rawRefusal).toContain('HTTP/1.1 403');
    expect(rawRefusal.toLowerCase()).not.toContain('transfer-encoding: chunked');
    expect(rawRefusal).toContain('denied');
  } finally {
    upstream.closeAllConnections();
    await new Promise<void>(resolve => upstream.close(() => resolve()));
  }
});
