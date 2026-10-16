import { expect, test } from 'vitest';
import { createMutationTransport } from '../../packages/overlay/src/mutation-transport.js';
import { createSourceMapping } from '../../packages/overlay/src/source-mapping.js';
import { getEditorHTML } from '../../packages/overlay/src/editor-html.js';
import * as vm from 'node:vm';

function fixture() {
  const sent: any[] = [], errors: string[] = [], rejected: string[] = [];
  let id = 0;
  const transport = createMutationTransport({ send: value => sent.push(JSON.parse(value)), digest: () => 'before',
    currentFile: () => 'App.tsx', id: () => `tx-${++id}`, error: value => errors.push(value),
    rejected: value => rejected.push(value), mapping: createSourceMapping() });
  const edit = (column = 5) => transport.send(JSON.stringify({ type: 'edit', file: 'App.tsx', line: 1, column, change: { type: 'text', value: 'New' } }));
  transport.connected();
  return { transport, sent, errors, rejected, edit };
}
test('serializes edits, remaps queued targets, and retries the exact transaction on reconnect', () => {
  const f = fixture();
  f.edit(); f.edit();
  expect(f.sent).toHaveLength(1);
  f.transport.disconnected();
  f.transport.connected();
  expect(f.sent[1]).toEqual(f.sent[0]);
  f.transport.accept({ type: 'status', transactionId: 'tx-1', success: true, selectionRemaps: [
    { oldSourceId: 'App.tsx:1:5', oldHash: 'aaaaaaaa', newHash: 'bbbbbbbb', newDigest: 'after', newCoordinates: { line: 2, column: 7 } },
  ] });
  expect(f.sent[2].edits[0]).toMatchObject({ line: 2, column: 7, hash: 'bbbbbbbb', expectedDigest: 'after' });
  expect(f.errors).toEqual([]);
});
test('does not commit queued changes after a rejected revision', () => {
  const f = fixture(); f.edit(); f.edit();
  f.transport.accept({ type: 'status', transactionId: 'tx-1', success: false });
  expect(f.sent).toHaveLength(1);
  expect(f.transport.pending()).toBe(0);
  expect(f.errors[0]).toContain('cancelled');
  expect(f.rejected).toEqual(['tx-2']);
});
test('normalizes structural controls and preserves paste destination', () => {
  const f = fixture();
  f.transport.send(JSON.stringify({ type: 'reparent', file: 'App.tsx', sourceId: 'App.tsx:2:4', newParentId: 'App.tsx:1:1' }));
  expect(f.sent[0].edits[0]).toMatchObject({ line: 2, column: 4, expectedDigest: 'before', change: { type: 'reparent', parentId: 'App.tsx:1:1' } });
});
test('keeps staged retry identifiers and rejects history while source writes are pending', () => {
  const f = fixture();
  const batch = JSON.stringify({ type: 'batch-edit', batchId: 'staged', edits: [{ file: 'App.tsx', line: 1, column: 1, expectedDigest: 'captured', change: { type: 'text', value: 'New' } }] });
  f.transport.send(batch); f.transport.send(batch);
  expect(f.sent[1]).toEqual(f.sent[0]);
  expect(f.sent[0].edits[0].expectedDigest).toBe('captured');
  f.transport.send(JSON.stringify({ type: 'undo' }));
  expect(f.errors[0]).toContain('Wait');
});

test.each(['source', 'parentId', 'siblingId', 'sources'])('cancels a queued structural edit when its %s reference was deleted', key => {
  const f = fixture();
  f.edit();
  const ref = 'App.tsx:1:9';
  f.transport.send(JSON.stringify({ type: 'edit', file: 'App.tsx', line: 1, column: 5,
    change: { type: 'paste', [key]: key === 'sources' ? [ref] : ref } }));
  f.transport.accept({ type: 'status', transactionId: 'tx-1', success: true,
    deletedSourceIds: [ref], selectionRemaps: [
      { oldSourceId: 'App.tsx:1:5', oldHash: 'aaaaaaaa', newHash: 'bbbbbbbb', newDigest: 'after', newCoordinates: { line: 1, column: 9 } },
    ] });
  expect(f.sent).toHaveLength(1);
  expect(f.transport.pending()).toBe(0);
  expect(f.errors[0]).toContain('deleted');
});

test('does not attach a fresh digest to a queued reference with a mismatched node hash', () => {
  const f = fixture();
  f.edit();
  f.transport.send(JSON.stringify({ type: 'edit', file: 'App.tsx', line: 1, column: 5, hash: 'cccccccc',
    change: { type: 'text', value: 'Wrong target' } }));
  f.transport.accept({ type: 'status', transactionId: 'tx-1', success: true, selectionRemaps: [
    { oldSourceId: 'App.tsx:1:5', oldHash: 'aaaaaaaa', newHash: 'bbbbbbbb', newDigest: 'after', newCoordinates: { line: 2, column: 7 } },
  ] });
  expect(f.sent).toHaveLength(1);
  expect(f.transport.pending()).toBe(0);
  expect(f.errors[0]).toContain('remapped safely');
});

test('the served transport releases a cancelled Apply without discarding staged changes', () => {
  const script = getEditorHTML().match(/<script>\s*([\s\S]*?)<\/script>/)![1];
  const start = script.indexOf('if (!sourceTransport) sourceTransport =');
  const initializer = script.slice(start, script.indexOf('socket.send =', start));
  const context = vm.createContext({ createSourceMapping });
  vm.runInContext(`
    let sourceTransport = null;
    const sourceMapping = createSourceMapping();
    const sent = [], errors = [];
    const socket = { sendRaw: value => sent.push(JSON.parse(value)) };
    const fileDigests = new Map([['App.tsx', 'before']]);
    const normalizePathSlash = value => value;
    let currentFile = 'App.tsx';
    const crypto = { randomUUID: () => 'live' };
    const showToast = (kind, value) => errors.push(value);
    let pendingBatch = { batchId: 'staged' };
    const stagedEdits = new Map([['target', 'unsaved']]);
    let refreshed = false;
    const updateStagingBarUI = () => { refreshed = true; };
    ${initializer}
    sourceTransport.connected();
    const edit = { file: 'App.tsx', line: 1, column: 1, change: { type: 'text', value: 'New' } };
    sourceTransport.send(JSON.stringify({ type: 'edit', ...edit }));
    sourceTransport.send(JSON.stringify({ type: 'batch-edit', batchId: 'staged', edits: [edit] }));
    sourceTransport.accept({ type: 'status', transactionId: 'edit:live', success: false });
    if (pendingBatch !== null || !refreshed || stagedEdits.get('target') !== 'unsaved' || sent.length !== 1) {
      throw new Error('Served Apply state was not preserved and released');
    }
  `, context);
});
