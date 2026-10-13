import { afterEach, describe, expect, test } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { MutationService, contentDigest, type MutationOperation } from '../../packages/server/src/mutation-service.js';

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
});
