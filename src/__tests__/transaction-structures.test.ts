import { afterEach, expect, test } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parse } from '@babel/parser';
import { MutationService, contentDigest } from '../../packages/server/src/mutation-service.js';
import { HistoryStore } from '../../packages/server/src/history-manager.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
const source = 'const App = () => <main><section><span>A</span><span>B</span></section><aside /></main>; // keep';
function fixture(code = source) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-structure-'));
  roots.push(root);
  const file = path.join(root, 'App.tsx');
  fs.writeFileSync(file, code);
  const history = new HistoryStore();
  const service = new MutationService(root, { onPersist: diffs => history.push({ description: 'Structure', diffs }) });
  const ref = (tag: string) => `App.tsx:1:${code.indexOf(tag) + 1}`;
  const op = (tag: string, change: any) => ({ operationId: 'one', filePath: 'App.tsx', expectedDigest: contentDigest(code), line: 1, column: code.indexOf(tag) + 1, change });
  return { root, file, history, service, ref, op, read: () => fs.readFileSync(file, 'utf8') };
}

test.each(['delete', 'duplicate', 'paste', 'insert', 'group', 'ungroup', 'reorder', 'reparent', 'arrange'])('%s persists valid source and has retry-safe undo/redo', async kind => {
  const baseline = kind === 'ungroup' ? source.replaceAll('section', 'div') : source;
  const f = fixture(baseline);
  const target = ['paste', 'insert'].includes(kind) ? '<aside' : kind === 'ungroup' ? '<div' : '<span>A';
  const changes: Record<string, any> = {
    delete: { type: kind }, duplicate: { type: kind }, paste: { type: kind, source: f.ref('<span>A') },
    insert: { type: kind, elementType: 'rectangle', width: 120, height: 80 },
    group: { type: kind, sources: [f.ref('<span>A'), f.ref('<span>B')] }, ungroup: { type: kind },
    reorder: { type: kind, parentId: f.ref('<section'), siblingId: f.ref('<span>B'), position: 'after' },
    reparent: { type: kind, parentId: f.ref('<aside') }, arrange: { type: kind, action: 'front' },
  };
  const result = await f.service.execute('change', [f.op(target, changes[kind])]);
  expect(result.success, result.error).toBe(true);
  const updated = f.read();
  expect(() => parse(updated, { sourceType: 'module', plugins: ['jsx', 'typescript'] })).not.toThrow();
  expect(updated).toContain('// keep');
  expect(updated).not.toBe(baseline);
  if (kind === 'delete') { expect(updated).not.toContain('>A</span>'); expect(result.deletedSourceIds).toContain(f.ref('<span>A')); }
  if (['duplicate', 'paste'].includes(kind)) expect(updated.match(/>A<\/span>/g)).toHaveLength(2);
  if (['reorder', 'arrange'].includes(kind)) expect(updated.indexOf('>B</span>')).toBeLessThan(updated.indexOf('>A</span>'));
  if (kind === 'insert') expect(updated).toContain('120px');
  const undo = await f.service.restoreHistory('undo', f.history, 'undo');
  expect(undo.success, undo.error).toBe(true);
  expect(f.read()).toBe(baseline);
  expect(await f.service.restoreHistory('undo', f.history, 'undo')).toEqual(undo);
  expect(f.history.getState().currentIndex).toBe(-1);
  expect((await f.service.restoreHistory('redo', f.history, 'redo')).success).toBe(true);
  expect(f.read()).toBe(updated);
});

test.each([
  ['delete', '<main', { type: 'delete' }],
  ['cycle', '<section', { type: 'reparent', parentId: 'App.tsx:1:33' }],
  ['unknown', '<span>A', { type: 'not-an-operation' }],
  ['cross-file', '<aside', { type: 'paste', source: '../other/App.tsx:1:1' }],
  ['bad-target', '<span>A', { type: 'reorder', parentId: 'App.tsx:1:99999' }],
])('rejects %s without source or history changes', async (_name, tag, change) => {
  const f = fixture();
  const result = await f.service.execute('bad', [f.op(tag as string, change)]);
  expect(result.success).toBe(false);
  expect(f.read()).toBe(source);
  expect(f.history.getState().stack).toHaveLength(0);
});

test.each(['<button id="same">A</button>', '<Button {...props} />', '<button>{readValue()}</button>'])('rejects unsafe copy of %s', async element => {
  const code = `const App = () => <main>${element}</main>;`;
  const f = fixture(code);
  const result = await f.service.execute('copy', [f.op(element, { type: 'duplicate' })]);
  expect(result.error).toContain('UNSUPPORTED_OPERATION');
  expect(f.read()).toBe(code);
});

test('relative movement writes source and creates no editor position sidecar', async () => {
  const f = fixture();
  const result = await f.service.execute('move', [f.op('<span>A', { type: 'position', value: { position: 'relative', left: '12px', top: '8px' } })]);
  expect(result.success, result.error).toBe(true);
  expect(f.read()).toContain('12px');
  expect(fs.readdirSync(f.root)).toEqual(['App.tsx']);
});

test.each(['paste', 'reparent'])('rejects %s of a component reference across lexical scopes', async type => {
  const code = 'const A = () => { const Widget = () => <span />; return <main><Widget /></main>; }; const B = () => <aside />;';
  const f = fixture(code);
  const change = type === 'paste' ? { type, source: f.ref('<Widget') } : { type, parentId: f.ref('<aside') };
  const result = await f.service.execute('scope', [f.op(type === 'paste' ? '<aside' : '<Widget', change)]);
  expect(result.error).toContain('lexical bindings');
  expect(f.read()).toBe(code);
  expect(f.history.getState().stack).toHaveLength(0);
});

test.each(['children="existing"', 'dangerouslySetInnerHTML={{ __html: "existing" }}', '{...props}'])('rejects insertion into a destination controlled by %s', async attributes => {
  const code = `const App = () => <main><aside ${attributes} /></main>;`;
  const f = fixture(code);
  const result = await f.service.execute('insert', [f.op('<aside', { type: 'insert', elementType: 'rectangle' })]);
  expect(result.error).toContain('Destination children');
  expect(f.read()).toBe(code);
});

test('remaps original siblings across duplication without assigning the copy their identity', async () => {
  const f = fixture();
  const result = await f.service.execute('duplicate', [f.op('<span>A', { type: 'duplicate' })]);
  expect(result.success, result.error).toBe(true);
  const mappedA = result.selectionRemaps.find(item => item.oldSourceId === f.ref('<span>A'))!;
  const mappedB = result.selectionRemaps.find(item => item.oldSourceId === f.ref('<span>B'))!;
  const next = await f.service.execute('edit-original', [{ operationId: 'edit', filePath: 'App.tsx',
    expectedDigest: mappedB.newDigest, ...mappedB.newCoordinates, hash: mappedB.newHash,
    change: { type: 'text', value: 'Original B' } }]);
  expect(next.success, next.error).toBe(true);
  expect(f.read().match(/>A<\/span>/g)).toHaveLength(2);
  expect(f.read()).toContain('>Original B</span>');
  expect(mappedA.newCoordinates.column).toBe(source.indexOf('<span>A') + 1);
});

test('a structural no-op does not create an empty undo entry', async () => {
  const f = fixture();
  const result = await f.service.execute('already-back', [f.op('<span>A', { type: 'arrange', action: 'back' })]);
  expect(result.success, result.error).toBe(true);
  expect(result.changedFiles).toEqual([]);
  expect(f.history.getState().stack).toHaveLength(0);
});
