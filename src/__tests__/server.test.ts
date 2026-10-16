import { afterEach, expect, test } from 'vitest';
import { startTestProject, closeTestProjects, request } from './server-fixture.js';

afterEach(closeTestProjects);

test('persists a live edit before acknowledging or notifying observers', async () => {
  const f = await startTestProject();
  const client = await f.connect();
  let observed = '';
  f.server.onEdit(() => { observed = f.read(); });
  const response = await request(client, f.edit({ type: 'text', value: 'Changed' }));
  expect(response.success, response.error).toBe(true);
  expect(f.read()).toContain('>Changed</button>');
  expect(observed).toBe(f.read());
  expect(response.changedFiles).toHaveLength(1);
  expect(response.selectionRemaps.length).toBeGreaterThan(0);
});

test('live and staged style edits have identical source output', async () => {
  const live = await startTestProject(), staged = await startTestProject();
  const first = live.edit({ type: 'class', property: 'padding', value: 16, breakpoint: 'md' });
  const second = staged.edit(first.change);
  expect((await request(await live.connect(), first)).success).toBe(true);
  expect((await request(await staged.connect(), { type: 'batch-edit', batchId: second.transactionId, edits: [second] })).success).toBe(true);
  expect(live.read()).toBe(staged.read());
});

test('rejects malformed JSON and remains responsive', async () => {
  const f = await startTestProject(), client = await f.connect();
  expect((await request(client, 'invalid json')).error).toContain('Malformed JSON');
  expect((await request(client, { type: 'GET_PENDING_OPS' }, 'PENDING_OPS')).pendingCount).toBe(0);
});

test('requires a transaction ID and source digest for every live edit', async () => {
  const f = await startTestProject(), client = await f.connect(), before = f.read();
  const edit: any = f.edit({ type: 'text', value: 'Changed' });
  delete edit.expectedDigest;
  expect((await request(client, edit)).success).toBe(false);
  delete edit.transactionId;
  expect((await request(client, edit)).success).toBe(false);
  expect(f.read()).toBe(before);
});

test('unknown edits and stale revisions do not report success or move history', async () => {
  const f = await startTestProject(), client = await f.connect();
  const edit = f.edit({ type: 'text', value: 'Changed' });
  f.write('App.tsx', f.read() + '// external');
  expect((await request(client, edit)).error).toContain('STALE_DIGEST');
  const unknown = await request(client, f.edit({ type: 'unknown' }));
  expect(unknown.error).toContain('UNSUPPORTED_OPERATION');
  expect((await request(client, { type: 'GET_HISTORY' }, 'HISTORY_UPDATE')).stack).toHaveLength(0);
  expect(f.read()).toContain('// external');
});

test('retries a transaction without another write, observer notification, or history entry', async () => {
  const f = await startTestProject(), client = await f.connect();
  let calls = 0;
  f.server.onEdit(() => { calls++; });
  const edit = f.edit({ type: 'text', value: 'Changed' });
  const first = await request(client, edit);
  expect(await request(client, edit)).toEqual(first);
  expect(calls).toBe(1);
  expect((await request(client, { type: 'GET_HISTORY' }, 'HISTORY_UPDATE')).stack).toHaveLength(1);
});

test('structural control messages persist and undo through the same service', async () => {
  const f = await startTestProject(), client = await f.connect(), before = f.read();
  const edit = f.edit({ type: 'text', value: '' });
  const result = await request(client, { ...edit, type: 'group', selectedIds: ['App.tsx:1:' + (before.indexOf('<button>A') + 1), 'App.tsx:1:' + (before.indexOf('<button>B') + 1)] });
  expect(result.success, result.error).toBe(true);
  expect(f.read()).toContain('<div>');
  expect((await request(client, { type: 'undo', transactionId: 'undo-structure' })).success).toBe(true);
  expect(f.read()).toBe(before);
});

test('isolates history between two simultaneous project servers', async () => {
  const one = await startTestProject(), two = await startTestProject();
  const client = await one.connect(), other = await two.connect();
  expect((await request(client, one.edit({ type: 'text', value: 'One' }))).success).toBe(true);
  expect((await request(other, { type: 'GET_HISTORY' }, 'HISTORY_UPDATE')).stack).toHaveLength(0);
  expect(two.read()).not.toContain('One');
  expect((await request(client, { type: 'GET_HISTORY' }, 'HISTORY_UPDATE')).stack).toHaveLength(1);
});

test('returns tree digests and the requested path alias', async () => {
  const f = await startTestProject(), client = await f.connect();
  const tree = await request(client, { type: 'get-tree', file: 'App.tsx' }, 'tree');
  expect(tree.requestedFile).toBe('App.tsx');
  expect(tree.digest).toMatch(/^[a-f0-9]{64}$/);
  expect(tree.tree.length).toBeGreaterThan(0);
});

test('rejects stale undo and leaves history cursor unchanged', async () => {
  const f = await startTestProject(), client = await f.connect();
  expect((await request(client, f.edit({ type: 'text', value: 'Changed' }))).success).toBe(true);
  f.write('App.tsx', f.read() + '// outside edit');
  expect((await request(client, { type: 'undo', transactionId: 'undo-stale' })).error).toContain('STALE_DIGEST');
  expect(f.read()).toContain('// outside edit');
  expect((await request(client, { type: 'GET_HISTORY' }, 'HISTORY_UPDATE')).currentIndex).toBe(0);
});

test('only one concurrent writer can commit from the same base revision', async () => {
  const f = await startTestProject(), a = await f.connect(), b = await f.connect();
  const results = await Promise.all([request(a, f.edit({ type: 'text', value: 'One' })), request(b, f.edit({ type: 'text', value: 'Two' }))]);
  expect(results.filter(item => item.success)).toHaveLength(1);
  expect(results.find(item => !item.success).error).toContain('STALE_DIGEST');
});

test('history errors acknowledge their transaction so the browser can resume editing', async () => {
  const f = await startTestProject(), client = await f.connect();
  const result = await request(client, { type: 'undo', transactionId: 'empty-history' });
  expect(result).toMatchObject({ transactionId: 'empty-history', success: false, error: expect.stringContaining('INVALID_HISTORY') });
  expect((await request(client, f.edit({ type: 'text', value: 'After error' }))).success).toBe(true);
});

test('zero-based tree references resolve to the same structural target as stamped coordinates', async () => {
  const f = await startTestProject(), client = await f.connect(), before = f.read();
  const edit = f.edit({ type: 'text', value: '' });
  const result = await request(client, { ...edit, type: 'arrange', action: 'front',
    sourceId: 'line:1:col:' + before.indexOf('<button>A') });
  expect(result.success, result.error).toBe(true);
  expect(f.read().indexOf('>B</button>')).toBeLessThan(f.read().indexOf('>A</button>'));
});

test('rejects a structural source reference belonging to a different file', async () => {
  const f = await startTestProject(), client = await f.connect(), before = f.read();
  f.write('Other.tsx', before);
  const result = await request(client, { ...f.edit({ type: 'text', value: '' }), type: 'arrange', action: 'front',
    sourceId: 'Other.tsx:1:' + (before.indexOf('<button>A') + 1) });
  expect(result).toMatchObject({ success: false, error: expect.stringContaining('same file') });
  expect(f.read()).toBe(before);
  expect(f.read('Other.tsx')).toBe(before);
});
