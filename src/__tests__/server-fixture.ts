import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';
import type WebSocket from 'ws';
import { GlideServer } from '../../packages/server/src/ws-server.js';
import { contentDigest } from '../../packages/server/src/mutation-service.js';
import { connectLocal } from './ws-client.js';

const cleanups: (() => Promise<void>)[] = [];
export async function closeTestProjects() { for (const cleanup of cleanups.splice(0)) await cleanup(); }
export async function startTestProject(source = 'const App = () => <main><button>A</button><button>B</button></main>;') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-server-'));
  const write = (file: string, code: string) => fs.writeFileSync(path.join(root, file), code);
  const read = (file = 'App.tsx') => fs.readFileSync(path.join(root, file), 'utf8');
  write('App.tsx', source);
  const server = new GlideServer(0, 5173, undefined, root);
  cleanups.push(async () => { await server.stop(); fs.rmSync(root, { recursive: true, force: true }); });
  await server.start();
  const port = (server as any).server.address().port as number;
  const connect = () => connectLocal(port);
  const edit = (change: any, tag = '<button', file = 'App.tsx') => ({ type: 'edit', transactionId: randomUUID(),
    file, line: 1, column: read(file).indexOf(tag) + 1, expectedDigest: contentDigest(read(file)), change });
  return { root, server, port, connect, edit, read, write };
}
export function request(client: WebSocket, payload: any, responseType = 'status'): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { client.off('message', listener); reject(new Error('Server response timed out')); }, 5000);
    const listener = (data: any) => {
      const message = JSON.parse(String(data));
      if (message.type !== responseType) return;
      const id = payload.transactionId || payload.batchId;
      if (id && message.transactionId && message.transactionId !== id) return;
      clearTimeout(timer); client.off('message', listener); resolve(message);
    };
    client.on('message', listener);
    client.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
  });
}
