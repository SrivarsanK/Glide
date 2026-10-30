import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createServer, request, type Server } from 'node:http';
import { afterEach, expect, test } from 'vitest';
import WebSocket, { WebSocketServer } from 'ws';
import { GlideServer } from '../../packages/server/src/ws-server.js';
import { DEFAULT_CONFIG } from '../../packages/core/src/index.js';

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

/** A stand-in dev server: answers "app" and runs its own HMR socket, like Vite. */
async function devServer() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-hosted-'));
  fs.writeFileSync(path.join(root, 'App.tsx'), 'export const App = () => <main>A</main>;\n');
  let glideMiddleware: ((req: any, res: any, next: () => void) => void) | null = null;
  const http: Server = createServer((req, res) => {
    const app = () => { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('app'); };
    glideMiddleware ? glideMiddleware(req, res, app) : app();
  });
  const hmr = new WebSocketServer({ noServer: true });
  hmr.on('connection', ws => ws.send('hmr-connected'));
  http.on('upgrade', (req, socket, head) => {
    if (new URL(req.url || '/', 'http://localhost').pathname === '/') hmr.handleUpgrade(req, socket, head, ws => hmr.emit('connection', ws, req));
  });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const port = (http.address() as any).port as number;
  const glide = new GlideServer(port, port, DEFAULT_CONFIG, root);
  glideMiddleware = await glide.attach(http);
  cleanups.push(() => { fs.rmSync(root, { recursive: true, force: true }); });
  cleanups.push(() => new Promise<void>(resolve => {
    for (const client of hmr.clients) client.terminate();
    hmr.close();
    http.closeAllConnections();
    http.close(() => resolve());
  }));
  cleanups.push(() => glide.stop());
  return { http, glide, port, origin: `http://localhost:${port}` };
}

function get(url: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { headers: { Connection: 'close', ...headers } }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode!, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

/** An open socket, with its first message captured from the start so a greeting is not missed. */
function open(url: string, origin: string): Promise<WebSocket & { first: Promise<string> }> {
  const ws = new WebSocket(url, { origin }) as WebSocket & { first: Promise<string> };
  ws.first = new Promise(resolve => ws.once('message', data => resolve(String(data))));
  return new Promise((resolve, reject) => { ws.once('open', () => resolve(ws)); ws.once('error', reject); });
}

test('attached to a dev server, Glide serves only its own paths and leaves the app to the server', async () => {
  const { origin } = await devServer();
  const editor = await get(origin + '/__glide/');
  expect(editor.status).toBe(200);
  expect(editor.body).toContain("window.location.host + \"/__glide/ws\"");
  expect(editor.body).toContain('var appBase = "";');
  expect((await get(origin + '/__glide')).status).toBe(200);
  expect((await get(origin + '/__glide_assets__/lucide.js')).status).toBe(200);
  expect(await get(origin + '/')).toEqual({ status: 200, body: 'app' });
  expect(await get(origin + '/src/App.tsx')).toEqual({ status: 200, body: 'app' });
  expect((await get(origin + '/__glide/unknown')).status).toBe(404);
  expect((await get(origin + '/__glide/', { Host: 'evil.test' })).status).toBe(403);
});

test('the editor socket shares the dev server with its HMR socket and still needs the session token', async () => {
  const { origin } = await devServer();
  const token = (await get(origin + '/__glide/')).body.match(/type: 'hello', token: "([a-f0-9]+)"/)![1];
  const hmr = await open(origin.replace('http', 'ws') + '/', origin);
  expect(await hmr.first).toBe('hmr-connected');
  const editor = await open(origin.replace('http', 'ws') + '/__glide/ws', origin);
  editor.send(JSON.stringify({ type: 'hello', token }));
  expect(JSON.parse(await editor.first)).toMatchObject({ type: 'authenticated', success: true });
  const stranger = await open(origin.replace('http', 'ws') + '/__glide/ws', origin);
  const refused = new Promise(resolve => stranger.once('close', code => resolve(code)));
  stranger.send(JSON.stringify({ type: 'hello', token: 'wrong' }));
  expect(await refused).toBe(1008);
  // A page on another origin cannot open the editor socket.
  await expect(open(origin.replace('http', 'ws') + '/__glide/ws', 'http://evil.test')).rejects.toThrow();
  hmr.close(); editor.close();
});

test('stopping Glide leaves the dev server and its HMR socket running', async () => {
  const { origin, glide } = await devServer();
  await glide.stop();
  expect(await get(origin + '/')).toEqual({ status: 200, body: 'app' });
  const hmr = await open(origin.replace('http', 'ws') + '/', origin);
  expect(await hmr.first).toBe('hmr-connected');
  hmr.close();
});
