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
}, 15000);

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

import { trustedRequest } from '../../packages/server/src/session-security.js';

test('a dev server over TLS accepts its own https origin and still refuses others', () => {
  const req = (origin: string, encrypted: boolean) =>
    ({ headers: { host: 'localhost:5173', origin }, socket: { encrypted } }) as any;
  expect(trustedRequest(req('https://localhost:5173', true), 5173)).toBe(true);
  expect(trustedRequest(req('http://localhost:5173', false), 5173)).toBe(true);
  expect(trustedRequest(req('https://localhost:5173', false), 5173)).toBe(false);
  expect(trustedRequest(req('https://evil.test', true), 5173)).toBe(false);
});

test('resolve_component and open_component stay contained inside projectRoot and ignore process.cwd()', async () => {
  const outer = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'glide-contain-')));
  const project = path.join(outer, 'project');
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(path.join(outer, 'Secret.tsx'), 'export function Secret() { return <div />; }\n');
  fs.writeFileSync(path.join(project, 'App.tsx'), "import { Secret } from '../Secret';\nexport const App = () => <Secret />;\n");
  try {
    server = new GlideServer(port, 5173, undefined, project);
    await server.start();
    const client = await connectLocal(port);

    // 1. Relative file that exists in process.cwd() (package.json) does NOT exist in projectRoot.
    const openCwd = new Promise<any>(resolve => client.once('message', d => resolve(JSON.parse(String(d)))));
    client.send(JSON.stringify({ type: 'open_component', file: 'package.json', line: 1, column: 1 }));
    expect(await openCwd).toMatchObject({ type: 'open_component_status', success: false });

    // 2. resolve_component following relative import outside projectRoot must not disclose/open outer file.
    const resolveOut = new Promise<any>(resolve => client.once('message', d => resolve(JSON.parse(String(d)))));
    client.send(JSON.stringify({ type: 'resolve_component', file: 'App.tsx', componentName: 'Secret', openInEditor: false }));
    expect(await resolveOut).toMatchObject({ type: 'resolved_component', success: false });

    // 3. git-branch-create in a temp project with no .git must fail instead of falling back to process.cwd()!
    const gitOut = new Promise<any>(resolve => client.once('message', d => resolve(JSON.parse(String(d)))));
    client.send(JSON.stringify({ type: 'git-branch-create', branchName: 'glide-should-not-create-in-cwd' }));
    expect(await gitOut).toMatchObject({ type: 'git-status', success: false, action: 'create' });

    client.close();
  } finally {
    fs.rmSync(outer, { recursive: true, force: true });
  }
});
