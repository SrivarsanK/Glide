import { afterEach, expect, test } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parse } from '@babel/parser';
import { MutationService, contentDigest } from '../../packages/server/src/mutation-service.js';
import { HistoryStore } from '../../packages/server/src/history-manager.js';
import { defaultTailwindTheme } from '../../packages/core/src/tailwind-tokens.js';

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

test.each(['before', 'after'])('an insert joins the layout %s the nearest child instead of floating over it', async position => {
  const f = fixture();
  const result = await f.service.execute('insert', [f.op('<section', { type: 'insert', elementType: 'rectangle', width: 120, height: 80,
    siblingId: f.ref('<span>B'), position })]);
  expect(result.success, result.error).toBe(true);
  const code = f.read(), inserted = code.indexOf('<div');
  expect(inserted).toBeGreaterThan(code.indexOf('>A</span>'));
  if (position === 'before') expect(inserted).toBeLessThan(code.indexOf('>B</span>'));
  else expect(inserted).toBeGreaterThan(code.indexOf('>B</span>'));
  expect(inserted).toBeLessThan(code.indexOf('</section>'));
  expect(code).not.toContain('absolute');
});

test('an insert writes its starting styles in the project format, like an edit', async () => {
  // A project theme: Tailwind is installed and sky-400 is #38bdf8.
  const theme = () => ({ ...defaultTailwindTheme(), version: 4 as const,
    colors: new Map([...defaultTailwindTheme().colors, ['sky-400', '#38bdf8']]) });
  const f = fixture();
  const auto = await new MutationService(f.root, { theme }).execute('auto', [f.op('<aside', { type: 'insert', elementType: 'ellipse', width: 96, height: 80 })]);
  expect(auto.success, auto.error).toBe(true);
  expect(f.read()).toContain('<aside><div className="w-24 h-20 bg-sky-400 rounded-[50%]"></div></aside>');
  const g = fixture();
  const inline = await new MutationService(g.root, { theme }).execute('inline', [{ ...g.op('<aside', { type: 'insert', elementType: 'frame', width: 96, height: 80 }), authoringRepresentation: 'inline' }]);
  expect(inline.success, inline.error).toBe(true);
  expect(g.read()).not.toContain('className');
  expect(g.read()).toMatch(/style=\{\{\s*width: "96px",\s*height: "80px",\s*display: "flex",\s*flexDirection: "column",\s*gap: "16px"\s*\}\}/);
});

test('a frame lays out what is drawn into it, and text hugs its content', async () => {
  const theme = () => ({ ...defaultTailwindTheme(), version: 4 as const });
  const f = fixture();
  const frame = await new MutationService(f.root, { theme }).execute('frame', [f.op('<aside', { type: 'insert', elementType: 'frame', width: 96, height: 80 })]);
  expect(frame.success, frame.error).toBe(true);
  expect(f.read()).toContain('<aside><div className="w-24 h-20 flex flex-col gap-4"></div></aside>');
  const g = fixture();
  const text = await new MutationService(g.root, { theme }).execute('text', [g.op('<aside', { type: 'insert', elementType: 'text' })]);
  expect(text.success, text.error).toBe(true);
  expect(g.read()).toContain('<aside><span>New text</span></aside>');
});

test.each(['before', 'after', 'last'])('an insert %s a child gets its own line, indented like its siblings', async where => {
  const code = 'const App = () => (\n  <main>\n    <section>\n      <span>A</span>\n      <span>B</span>\n    </section>\n  </main>\n);\n';
  const f = fixture(code);
  const at = (tag: string) => { const before = code.slice(0, code.indexOf(tag)).split('\n'); return { line: before.length, column: before.at(-1)!.length + 1 }; };
  const b = at('<span>B');
  const change = { type: 'insert', elementType: 'frame', width: 40, height: 40,
    ...(where === 'last' ? {} : { siblingId: `App.tsx:${b.line}:${b.column}`, position: where }) };
  const result = await f.service.execute('lines', [{ operationId: 'one', filePath: 'App.tsx', expectedDigest: contentDigest(code), ...at('<section'), change }]);
  expect(result.success, result.error).toBe(true);
  const lines = f.read().split('\n');
  const inserted = lines.findIndex(line => line.startsWith('      <div'));
  expect(inserted, f.read()).toBeGreaterThan(0);
  expect(lines.find(line => line.includes('<span>B</span>'))).toBe('      <span>B</span>');
  expect(lines.indexOf('    </section>')).toBeGreaterThan(inserted);
  if (where === 'before') expect(inserted).toBeLessThan(lines.indexOf('      <span>B</span>'));
  else expect(inserted).toBeGreaterThan(lines.indexOf('      <span>B</span>'));
});

test('an insert beside a child inside a fragment goes beside the fragment, not last', async () => {
  const code = 'const App = () => (\n  <section>\n    <>\n      <span>A</span>\n      <span>B</span>\n    </>\n    <span>C</span>\n  </section>\n);\n';
  const f = fixture(code);
  const at = (tag: string) => { const before = code.slice(0, code.indexOf(tag)).split('\n'); return { line: before.length, column: before.at(-1)!.length + 1 }; };
  const b = at('<span>B');
  const result = await f.service.execute('fragment', [{ operationId: 'one', filePath: 'App.tsx', expectedDigest: contentDigest(code), ...at('<section'),
    change: { type: 'insert', elementType: 'frame', width: 40, height: 40, siblingId: `App.tsx:${b.line}:${b.column}`, position: 'before' } }]);
  expect(result.success, result.error).toBe(true);
  const out = f.read();
  expect(out.indexOf('<div'), out).toBeLessThan(out.indexOf('<>'));
});

test('a pasteboard draft gets its own line and leaves the closing tag on its own line', async () => {
  const code = 'const App = () => (\n  <main>\n    <section>\n      <span>A</span>\n    </section>\n  </main>\n);\n';
  const f = fixture(code);
  const before = code.slice(0, code.indexOf('<section')).split('\n');
  const result = await f.service.execute('draft', [{ operationId: 'one', filePath: 'App.tsx', expectedDigest: contentDigest(code),
    line: before.length, column: before.at(-1)!.length + 1,
    change: { type: 'insert', elementType: 'rectangle', detached: true, workspaceId: 'draft-1', x: -200, y: 10 } }]);
  expect(result.success, result.error).toBe(true);
  const lines = f.read().split('\n');
  const draft = lines.findIndex(line => line.startsWith('      {false && <div'));
  expect(draft, f.read()).toBeGreaterThan(lines.indexOf('      <span>A</span>'));
  expect(lines.indexOf('    </section>')).toBeGreaterThan(draft);
});

test('the first child of an empty parent written over several lines gets its own line', async () => {
  const code = 'const App = () => (\n  <main>\n    <div\n      style={{ width: "300px" }}></div>\n  </main>\n);\n';
  const f = fixture(code);
  const before = code.slice(0, code.indexOf('<div')).split('\n');
  const result = await f.service.execute('first', [{ operationId: 'one', filePath: 'App.tsx', expectedDigest: contentDigest(code),
    line: before.length, column: before.at(-1)!.length + 1, change: { type: 'insert', elementType: 'rectangle', width: 40, height: 40 } }]);
  expect(result.success, result.error).toBe(true);
  const lines = f.read().split('\n');
  const child = lines.findIndex(line => line.startsWith('      <div'));
  expect(child, f.read()).toBeGreaterThan(lines.findIndex(line => line.includes('width: "300px"')));
  expect(lines.slice(child).find(line => line.trim() === '</div>')).toBe('    </div>');
});

test('text created by a click, not a drag, has no fixed width', async () => {
  const f = fixture();
  const result = await f.service.execute('click', [f.op('<aside', { type: 'insert', elementType: 'text', width: 120, height: 32, drawn: false })]);
  expect(result.success, result.error).toBe(true);
  expect(f.read()).toContain('<aside><span>New text</span></aside>');
  const g = fixture();
  await g.service.execute('drag', [g.op('<aside', { type: 'insert', elementType: 'text', width: 240, height: 32 })]);
  expect(g.read()).toMatch(/width: "240px"/);
});
