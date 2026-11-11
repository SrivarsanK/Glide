import { afterEach, expect, test } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { MutationService, contentDigest, type MutationOperation } from '../../packages/server/src/mutation-service.js';
import { HistoryStore } from '../../packages/server/src/history-manager.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

const source = [
  '<script setup lang="ts">',
  'const label = "Hi";',
  '</script>',
  '<template>',
  '  <main class="p-2"><button :disabled="!label">Save</button><span>{{ label }}</span></main>',
  '</template>',
  '',
].join('\n');
const line = 5;
const column = (tag: string) => source.split('\n')[line - 1].indexOf(tag) + 1;

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-vue-'));
  roots.push(root);
  fs.writeFileSync(path.join(root, 'App.vue'), source);
  const store = new HistoryStore();
  const service = new MutationService(root, { onPersist: diffs => store.push({ description: 'Edit', diffs }) });
  const operation = (id: string, tag: string, change: MutationOperation['change']): MutationOperation => ({
    operationId: id, filePath: 'App.vue', expectedDigest: contentDigest(source), line, column: column(tag), change });
  return { service, store, operation, read: () => fs.readFileSync(path.join(root, 'App.vue'), 'utf8') };
}

test('class, style and text edits save to a Vue template and keep the rest of the file', async () => {
  const f = fixture();
  const result = await f.service.execute('vue-1', [
    f.operation('a', '<main', { type: 'class', property: 'padding', value: 16 }),
    f.operation('b', '<button', { type: 'text', value: 'Send' }),
    f.operation('c', '<button', { type: 'style', value: { opacity: '0.5' } }),
  ]);
  expect(result.error).toBeUndefined();
  const after = f.read();
  expect(after).toContain('<main class="p-4">');
  expect(after).toContain('<button :disabled="!label" style="opacity: 0.5">Send</button>');
  expect(after).toContain('<span>{{ label }}</span>');
  expect(after.split('\n').slice(0, 4)).toEqual(source.split('\n').slice(0, 4));
  // Elements after an edit on the same line move; the editor gets their new positions.
  const span = result.selectionRemaps.find(item => item.oldSourceId.endsWith(`App.vue:${line}:${column('<span')}`))!;
  expect(after.split('\n')[line - 1].indexOf('<span') + 1).toBe(span.newCoordinates.column);
  expect(result.selectionRemaps.every(item => /^[a-f0-9]+$/.test(item.newHash))).toBe(true);
});

test('undo restores the Vue file', async () => {
  const f = fixture();
  await f.service.execute('vue-2', [f.operation('a', '<main', { type: 'class', property: 'padding', value: 16 })]);
  const undone = await f.service.restoreHistory('undo-1', f.store, 'undo');
  expect(undone.success).toBe(true);
  expect(f.read()).toBe(source);
});

test('unsupported Vue edits are refused and write nothing', async () => {
  const f = fixture();
  const structural = await f.service.execute('vue-3', [f.operation('a', '<button', { type: 'delete' })]);
  expect(structural.error).toContain('UNSUPPORTED_OPERATION');
  const dynamic = await f.service.execute('vue-4', [f.operation('a', '<span', { type: 'text', value: 'x' })]);
  expect(dynamic.success).toBe(false);
  const missing = await f.service.execute('vue-5', [{ ...f.operation('a', '<main', { type: 'text', value: 'x' }), column: 1 }]);
  expect(missing.error).toContain('NODE_NOT_FOUND');
  expect(f.read()).toBe(source);
});

test('a drag result saves to a Vue template as a relative offset', async () => {
  const f = fixture();
  const result = await f.service.execute('vue-6', [
    f.operation('a', '<button', { type: 'layout', value: { left: '12px', top: '8px' }, layoutPosition: 'static' }),
  ]);
  expect(result.error).toBeUndefined();
  expect(f.read()).toContain('<button :disabled="!label" style="left: 12px; top: 8px; position: relative">Save</button>');
});
