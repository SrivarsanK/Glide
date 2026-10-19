import { afterEach, expect, test } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { MutationService, contentDigest } from '../../packages/server/src/mutation-service.js';
import { listWorkspaceObjects } from '../../packages/ast-writer/src/workspace.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function fixture(source = 'const App = () => <main><section /><aside /></main>; // keep') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-workspace-'));
  roots.push(root);
  const file = path.join(root, 'App.tsx');
  fs.writeFileSync(file, source);
  const service = new MutationService(root);
  let id = 0;
  const read = () => fs.readFileSync(file, 'utf8');
  const reference = (tag: string) => {
    const code = read(), offset = code.indexOf(tag);
    if (offset < 0) throw new Error(`Missing fixture target ${tag}`);
    const before = code.slice(0, offset).split('\n');
    return { line: before.length, column: before.at(-1)!.length + 1 };
  };
  const ref = (tag: string) => { const loc = reference(tag); return `App.tsx:${loc.line}:${loc.column}`; };
  const run = (tag: string, change: any) => service.execute(`tx-${++id}`, [{ operationId: 'one', filePath: 'App.tsx',
    expectedDigest: contentDigest(read()), ...reference(tag), change }]);
  return { read, ref, run, objects: () => listWorkspaceObjects(read(), 'App.tsx') };
}

test('creates a source-backed dormant object, edits and moves it, then attaches without losing its identity', async () => {
  const f = fixture();
  let result = await f.run('<section', { type: 'insert', elementType: 'rectangle', width: 160, height: 90,
    detached: true, workspaceId: 'shape-1', x: -220, y: 12 });
  expect(result.success, result.error).toBe(true);
  expect(f.objects()).toMatchObject([{ id: 'shape-1', x: -220, y: 12, width: 160, height: 90, tagName: 'div' }]);
  const beforeEdit = f.objects()[0].source;
  const ast = parse(f.read(), { sourceType: 'module', plugins: ['jsx'] });
  let inactive = false;
  t.traverseFast(ast, node => { if (t.isLogicalExpression(node, { operator: '&&' }) && t.isBooleanLiteral(node.left, { value: false })) inactive = true; });
  expect(inactive).toBe(true);
  result = await f.run('<div', { type: 'style', value: { backgroundColor: '#ff0000' } });
  expect(result.success, result.error).toBe(true);
  expect(result.selectionRemaps.some(item => item.oldSourceId === beforeEdit)).toBe(true);
  result = await f.run('<div', { type: 'workspace-position', x: -120, y: 24 });
  expect(result.success, result.error).toBe(true);
  expect(f.objects()[0]).toMatchObject({ x: -120, y: 24, styles: { backgroundColor: '#ff0000' } });
  result = await f.run('<div', { type: 'attach', parentId: f.ref('<aside'), x: 15, y: 20 });
  expect(result.success, result.error).toBe(true);
  expect(f.objects()).toEqual([]);
  expect(f.read()).not.toContain('false &&');
  expect(f.read()).not.toContain('data-gl-workspace');
  expect(f.read()).toContain('15px');
  expect(f.read()).toContain('#ff0000');
  expect(f.read()).toContain('// keep');
});

test('detach and default attach preserve authored bindings, children and unrelated source exactly', async () => {
  const source = "// preserve\nconst App = ({ label, onClick }) => <main><button onClick={onClick} style={{ color: 'red' }}>{label}<b>Bold</b></button><aside /></main>;\n";
  const f = fixture(source);
  const detached = await f.run('<button', { type: 'detach', workspaceId: 'button-1', x: 1200, y: 40 });
  expect(detached.success, detached.error).toBe(true);
  expect(f.objects()[0]).toMatchObject({ id: 'button-1', children: [{ tagName: 'b', text: 'Bold' }] });
  const attached = await f.run('<button', { type: 'attach' });
  expect(attached.success, attached.error).toBe(true);
  const before = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const after = parse(f.read(), { sourceType: 'module', plugins: ['jsx'] });
  const clean = (value: any) => JSON.parse(JSON.stringify(value, (key, val) => ['start', 'end', 'loc', 'extra', 'tokens'].includes(key) ? undefined : val));
  expect(clean(after)).toEqual(clean(before));
  expect(f.read()).toContain('onClick={onClick}');
  expect(f.read()).toContain('{label}<b>Bold</b>');
  expect(f.read()).toContain('// preserve');
});

test('deleting a detached object removes its whole inactive expression and remaps remaining nodes', async () => {
  const f = fixture('const App = () => <main><span>A</span><span>B</span></main>;');
  expect((await f.run('<span>A', { type: 'detach', workspaceId: 'one', x: -100, y: 0 })).success).toBe(true);
  const source = f.objects()[0].source;
  const deleted = await f.run('<span', { type: 'delete' });
  expect(deleted.success, deleted.error).toBe(true);
  expect(deleted.deletedSourceIds).toContain(source);
  expect(f.read()).not.toContain('false &&');
  expect(f.read()).not.toContain('>A</span>');
  expect(f.read()).toContain('>B</span>');
});

test('newly drawn styled objects can be duplicated and moved', async () => {
  const f = fixture();
  expect((await f.run('<section', { type: 'insert', elementType: 'rectangle', width: 120, height: 90, x: 20, y: 30 })).success).toBe(true);
  const duplicate = await f.run('<div', { type: 'duplicate' });
  expect(duplicate.success, duplicate.error).toBe(true);
  const move = await f.run('<div', { type: 'reparent', parentId: f.ref('<aside') });
  expect(move.success, move.error).toBe(true);
  expect(f.read().match(/120px/g)).toHaveLength(2);
  expect(f.read()).toContain('20px');
});

test('reparenting keeps dynamic bindings in the same scope', async () => {
  const f = fixture('const App = ({ label, onClick }) => <main><section><button onClick={onClick}>{label}</button></section><aside /></main>;');
  const result = await f.run('<button', { type: 'reparent', parentId: f.ref('<aside') });
  expect(result.success, result.error).toBe(true);
  expect(f.read()).toContain('onClick={onClick}>{label}</button>');
});

test('attaching across lexical scopes fails before writing any source', async () => {
  const f = fixture('const A = ({ label }) => <main><span>{label}</span></main>; const B = () => <aside />;');
  expect((await f.run('<span', { type: 'detach', workspaceId: 'one', x: -100, y: 0 })).success).toBe(true);
  const source = f.read();
  const result = await f.run('<span', { type: 'attach', parentId: f.ref('<aside') });
  expect(result.error).toContain('lexical scopes');
  expect(f.read()).toBe(source);
});

test.each([{ x: Number.NaN, y: 2 }, { x: 2 }, { x: 2, y: Infinity }])('rejects invalid canvas coordinates %j without writing', async coordinates => {
  const f = fixture();
  const source = f.read();
  const result = await f.run('<section', { type: 'insert', elementType: 'text', ...coordinates });
  expect(result.success).toBe(false);
  expect(f.read()).toBe(source);
});

test('rejects duplicate workspace identity and moving live nodes with workspace-position', async () => {
  const f = fixture();
  expect((await f.run('<section', { type: 'detach', workspaceId: 'one', x: -100, y: 0 })).success).toBe(true);
  const source = f.read();
  expect((await f.run('<aside', { type: 'detach', workspaceId: 'one', x: -200, y: 0 })).error).toContain('already exists');
  expect((await f.run('<aside', { type: 'workspace-position', x: -200, y: 0 })).error).toContain('detached');
  expect(f.read()).toBe(source);
});
