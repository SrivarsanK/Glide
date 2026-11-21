import { afterEach, expect, test } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { handleMcp, parseReference } from '../../packages/server/src/mcp.js';
import { MutationService, contentDigest } from '../../packages/server/src/mutation-service.js';
import { ProjectPaths } from '../../packages/server/src/project-paths.js';
import { GlideServer } from '../../packages/server/src/ws-server.js';
import { offlineMcpReply, MCP_TOOLS } from '../../packages/core/src/mcp-tools.js';
import { DEFAULT_CONFIG } from '../../packages/core/src/config.js';

const roots: string[] = [];
let server: GlideServer | undefined;
afterEach(async () => {
  await server?.stop(); server = undefined;
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});
function project(code = 'const App = () => (\n  <main>\n    <h1 className="text-lg">Hi</h1>\n  </main>\n);\n') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-mcp-'));
  roots.push(root);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { react: '19' } }));
  fs.writeFileSync(path.join(root, 'App.tsx'), code);
  const ctx = { paths: new ProjectPaths(root), mutations: new MutationService(root), entryFile: () => path.join(root, 'App.tsx'),
    askEditor: async () => { throw new Error('NO_EDITOR: Open the Glide editor so the agent can see the live page.'); } };
  return { root, ctx, read: () => fs.readFileSync(path.join(root, 'App.tsx'), 'utf8') };
}
const call = async (ctx: any, name: string, args: unknown = {}) => {
  const reply: any = await handleMcp({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, ctx);
  return { error: !!reply.result.isError, text: reply.result.content[0].text as string, data: reply.result.isError ? null : JSON.parse(reply.result.content[0].text) };
};

test('speaks MCP: initialize, tools/list, notifications and unknown methods', async () => {
  const { ctx } = project();
  const init: any = await handleMcp({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, ctx as any);
  expect(init.result).toMatchObject({ protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'glide' } });
  expect(await handleMcp({ jsonrpc: '2.0', method: 'notifications/initialized' }, ctx as any)).toBeNull();
  const list: any = await handleMcp([{ jsonrpc: '2.0', id: 2, method: 'tools/list' }, { jsonrpc: '2.0', method: 'notifications/x' }], ctx as any);
  expect(list).toHaveLength(1);
  expect(list[0].result.tools.map((tool: any) => tool.name)).toEqual(MCP_TOOLS.map(tool => tool.name));
  expect(await handleMcp({ jsonrpc: '2.0', id: 3, method: 'resources/list' }, ctx as any)).toMatchObject({ error: { code: -32601 } });
});

test('reads the tree and an element, then edits through the safe write path', async () => {
  const { ctx, read } = project();
  const tree = await call(ctx, 'get_tree', { file: 'App.tsx' });
  const heading = tree.data.elements[0].children[0];
  expect(heading).toMatchObject({ name: 'h1', source: 'App.tsx:3:5', className: 'text-lg' });
  const source = await call(ctx, 'get_source', { source: heading.source });
  expect(source.data).toMatchObject({ code: '<h1 className="text-lg">Hi</h1>', digest: contentDigest(read()) });
  // No Tailwind theme in this project, so styles are written inline, like the editor would.
  const styled = await call(ctx, 'update_styles', { source: heading.source, styles: { color: '#ff0000' }, expectedDigest: source.data.digest });
  expect(styled.error, styled.text).toBe(false);
  expect(read()).toMatch(/color: "#ff0000"/);
  expect((await call(ctx, 'set_text', { source: heading.source, text: 'Hello' })).error).toBe(false);
  expect(read()).toContain('>Hello</h1>');
});

test('edit refusals come back as readable tool errors', async () => {
  const { ctx } = project();
  const stale = await call(ctx, 'update_styles', { source: 'App.tsx:3:5', styles: { color: 'red' }, expectedDigest: 'old' });
  expect(stale).toMatchObject({ error: true });
  expect(stale.text).toMatch(/STALE_DIGEST.*get_source/s);
  expect((await call(ctx, 'get_source', { source: 'App.tsx:99:1' })).text).toMatch(/INVALID_TARGET/);
  expect((await call(ctx, 'get_source', { source: '../outside.tsx:1:1' })).error).toBe(true);
  expect((await call(ctx, 'get_selection')).text).toMatch(/NO_EDITOR/);
  expect(() => parseReference('App.tsx')).toThrow(/INVALID_TARGET/);
});

test('the HTTP endpoint needs the run-file token and refuses browsers', async () => {
  const { root } = project();
  server = new GlideServer(7984, 5173, DEFAULT_CONFIG, root);
  await server.start();
  const run = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/.cache/glide/mcp.json'), 'utf8'));
  expect(run.url).toBe('http://127.0.0.1:7984/__glide/mcp');
  const post = (headers: Record<string, string>) => fetch(run.url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
  expect((await post({})).status).toBe(401);
  expect((await post({ authorization: 'Bearer nope' })).status).toBe(401);
  expect((await post({ authorization: `Bearer ${run.token}`, origin: 'http://127.0.0.1:7984' })).status).toBe(403);
  const ok = await post({ authorization: `Bearer ${run.token}` });
  expect(ok.status).toBe(200);
  expect((await ok.json()).result.tools.length).toBe(MCP_TOOLS.length);
  await server.stop(); server = undefined;
  expect(fs.existsSync(path.join(root, 'node_modules/.cache/glide/mcp.json'))).toBe(false);
}, 15000);

test('without a running Glide, `glide mcp` still lists the tools', () => {
  expect(offlineMcpReply({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, '2.0.4', '/p')).toMatchObject({ result: { tools: MCP_TOOLS } });
  expect(offlineMcpReply({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_tree' } }, '2.0.4', '/p'))
    .toMatchObject({ result: { isError: true } });
  expect(offlineMcpReply({ jsonrpc: '2.0', method: 'notifications/initialized' }, '2.0.4', '/p')).toBeNull();
});
