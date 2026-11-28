import { afterEach, describe, expect, test } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { MutationService, contentDigest, type MutationOperation } from '../../packages/server/src/mutation-service.js';
import { HistoryStore } from '../../packages/server/src/history-manager.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function fixture(rename?: typeof fs.renameSync) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-transaction-'));
  roots.push(root);
  const source = 'const A = () => <button className="p-2">A</button>;';
  for (const file of ['A.tsx', 'B.tsx']) fs.writeFileSync(path.join(root, file), source);
  const history: unknown[] = [];
  const service = new MutationService(root, { rename, onPersist: diffs => { history.push(diffs); } });
  const operation = (file: string, id: string): MutationOperation => ({
    operationId: id, filePath: file, expectedDigest: contentDigest(source), line: 1,
    column: source.indexOf('<button') + 1, change: { type: 'class', property: 'padding', value: 16 },
  });
  const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
  return { root, source, service, operation, read, history };
}

describe('Mutation transactions', () => {
  test.each(['external', 'write-failure', 'success'])('restores history safely: %s', async mode => {
    const f = fixture();
    const store = new HistoryStore();
    let calls = 0;
    const service = new MutationService(f.root, {
      onPersist: diffs => store.push({ description: 'Edit two files', diffs }),
      rename: (from, to) => {
        if (mode === 'write-failure' && ++calls === 4) throw new Error('Injected undo failure.');
        fs.renameSync(from, to);
      },
    });
    const result = await service.execute('edit', [f.operation('A.tsx', 'one'), f.operation('B.tsx', 'two')]);
    expect(result.success).toBe(true);
    const after = f.read('A.tsx');
    if (mode === 'external') fs.writeFileSync(path.join(f.root, 'B.tsx'), '// External edit.\n' + after);
    const expectedB = f.read('B.tsx');
    const restored = await service.restoreHistory('undo', store, 'undo');
    expect(restored.success).toBe(mode === 'success');
    expect(store.getState().currentIndex).toBe(mode === 'success' ? -1 : 0);
    expect(f.read('A.tsx')).toBe(mode === 'success' ? f.source : after);
    expect(f.read('B.tsx')).toBe(mode === 'success' ? f.source : expectedB);
  });

  test('resolves same-line targets before a style insertion changes coordinates', async () => {
    const f = fixture();
    const source = 'const A = () => <><button>A</button><button>B</button></>;';
    fs.writeFileSync(path.join(f.root, 'A.tsx'), source);
    const first = { ...f.operation('A.tsx', 'one'), expectedDigest: contentDigest(source),
      column: source.indexOf('<button') + 1, change: { type: 'style', value: { color: 'red' } } };
    const second = { ...first, operationId: 'two', column: source.lastIndexOf('<button') + 1,
      change: { type: 'text', value: 'Second' } };
    const result = await f.service.execute('same-line', [first, second]);
    expect(result.success).toBe(true);
    expect(f.read('A.tsx')).toContain('>A</button>');
    expect(f.read('A.tsx')).toContain('>Second</button>');
    expect(result.selectionRemaps.filter(remap => remap.oldSourceId.startsWith('A.tsx:'))).toHaveLength(2);
  });

  test('keeps every file and history unchanged when operation two fails', async () => {
    const f = fixture();
    const second = f.operation('B.tsx', 'two');
    second.change.type = 'unknown';
    const result = await f.service.execute('batch', [f.operation('A.tsx', 'one'), second]);
    expect(result.success).toBe(false);
    expect(result.operationResults.every(item => !item.ok)).toBe(true);
    expect(f.read('A.tsx')).toBe(f.source);
    expect(f.read('B.tsx')).toBe(f.source);
    expect(f.history).toHaveLength(0);
  });

  test('retries a rename that Windows refuses while another process has the file open', async () => {
    let calls = 0;
    const f = fixture((from, to) => {
      if (++calls <= 2) throw Object.assign(new Error('EPERM: operation not permitted, rename'), { code: 'EPERM' });
      fs.renameSync(from, to);
    });
    const result = await f.service.execute('busy', [f.operation('A.tsx', 'one')]);
    expect(result.success).toBe(true);
    expect(f.read('A.tsx')).not.toBe(f.source);
  });

  test('says there is nothing to undo or redo instead of reporting a history error', async () => {
    const f = fixture();
    const store = new HistoryStore();
    await expect(f.service.restoreHistory('undo', store, 'undo')).rejects.toThrow(/^NOTHING_TO_UNDO: Nothing to undo\.$/);
    await expect(f.service.restoreHistory('redo', store, 'redo')).rejects.toThrow(/^NOTHING_TO_REDO: Nothing to redo\.$/);
  });

  test('restores file one when the second rename fails', async () => {
    let calls = 0;
    const f = fixture((from, to) => {
      if (++calls === 2) throw new Error('Injected write failure.');
      fs.renameSync(from, to);
    });
    const result = await f.service.execute('batch', [f.operation('A.tsx', 'one'), f.operation('B.tsx', 'two')]);
    expect(result.success).toBe(false);
    expect(f.read('A.tsx')).toBe(f.source);
    expect(f.read('B.tsx')).toBe(f.source);
    expect(f.history).toHaveLength(0);
    expect(fs.readdirSync(f.root).sort()).toEqual(['A.tsx', 'B.tsx']);
  });

  test('returns the same result for a retry without another write', async () => {
    const f = fixture();
    const operations = [f.operation('A.tsx', 'one'), f.operation('B.tsx', 'two')];
    const first = await f.service.execute('batch', operations);
    const second = await f.service.execute('batch', operations);
    expect(first.success).toBe(true);
    expect(second).toEqual(first);
    expect(f.history).toHaveLength(1);
  });

  test('preserves an external edit when the expected digest is stale', async () => {
    const f = fixture();
    fs.writeFileSync(path.join(f.root, 'B.tsx'), '// External edit.\n' + f.source);
    const result = await f.service.execute('batch', [f.operation('A.tsx', 'one'), f.operation('B.tsx', 'two')]);
    expect(result.error).toContain('STALE_DIGEST');
    expect(f.read('A.tsx')).toBe(f.source);
    expect(f.read('B.tsx')).toBe('// External edit.\n' + f.source);
    expect(f.history).toHaveLength(0);
  });

  test('rejects invalid restoreHistory actions without redoing, supports no-op jump, invokes onRestore, and cleans failed rollback temps', async () => {
    const f = fixture();
    const store = new HistoryStore();
    const restoredDiffs: string[] = [];
    const service = new MutationService(f.root, {
      onPersist: diffs => store.push({ description: 'Edit', diffs }),
      onRestore: diffs => restoredDiffs.push(...diffs.map(d => d.file)),
    });
    expect((await service.execute('edit-1', [f.operation('A.tsx', 'one')])).success).toBe(true);
    expect((await service.restoreHistory('undo-1', store, 'undo')).success).toBe(true);
    expect(restoredDiffs).toHaveLength(1);

    // Invalid action must throw INVALID_HISTORY rather than silently running redo.
    await expect(service.restoreHistory('bad-1', store, undefined as any)).rejects.toThrow('INVALID_HISTORY');
    await expect(service.restoreHistory('bad-2', store, 1.5 as any)).rejects.toThrow('INVALID_HISTORY');
    expect(store.getState().currentIndex).toBe(-1);

    // Jumping to the current index is a clean no-op.
    const noop = await service.restoreHistory('noop-1', store, -1);
    expect(noop.success).toBe(true);
    expect(noop.changedFiles).toEqual([]);

    // Failed rollback rename cleans up its recovery temp file instead of leaking `.glide-*.tmp`.
    let calls = 0;
    const f2 = fixture((from, to) => {
      calls++;
      if (calls === 2) throw new Error('Second rename failed');
      if (calls === 3) throw new Error('Rollback rename failed');
      fs.renameSync(from, to);
    });
    const failed = await f2.service.execute('rollback-leak', [f2.operation('A.tsx', 'one'), f2.operation('B.tsx', 'two')]);
    expect(failed.success).toBe(false);
    expect(fs.readdirSync(f2.root).filter(name => name.startsWith('.glide-'))).toEqual([]);
  });
});
