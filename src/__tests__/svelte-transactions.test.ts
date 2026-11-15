import { afterEach, expect, test } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { MutationService, contentDigest, type MutationOperation } from '../../packages/server/src/mutation-service.js';
import { HistoryStore } from '../../packages/server/src/history-manager.js';
import { stampHTMLTemplate } from '../../packages/core/src/utils.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

const source = [
  '<script lang="ts">',
  '  let label: string = "Hi";',
  '  let tone = "red";',
  '</script>',
  '<svelte:head><title>Demo</title></svelte:head>',
  '{#if label}',
  '  <main class="p-2"><button disabled={!label}>Save</button><span>{label}</span><i class="x {tone}">i</i></main>',
  '{/if}',
  '<style>main { color: red; }</style>',
  '',
].join('\n');
const line = 7;
const column = (tag: string) => source.split('\n')[line - 1].indexOf(tag) + 1;

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-svelte-'));
  roots.push(root);
  fs.writeFileSync(path.join(root, 'App.svelte'), source);
  const store = new HistoryStore();
  const service = new MutationService(root, { onPersist: diffs => store.push({ description: 'Edit', diffs }) });
  const operation = (id: string, tag: string, change: MutationOperation['change']): MutationOperation => ({
    operationId: id, filePath: 'App.svelte', expectedDigest: contentDigest(source), line, column: column(tag), change });
  return { service, store, operation, read: () => fs.readFileSync(path.join(root, 'App.svelte'), 'utf8') };
}

test('class, style and text edits save to a Svelte template and keep the rest of the file', async () => {
  const f = fixture();
  const result = await f.service.execute('svelte-1', [
    f.operation('a', '<main', { type: 'class', property: 'padding', value: 16 }),
    f.operation('b', '<button', { type: 'text', value: 'Send' }),
    f.operation('c', '<button', { type: 'style', value: { opacity: '0.5' } }),
  ]);
  expect(result.error).toBeUndefined();
  const after = f.read().split('\n');
  expect(after[line - 1]).toContain('<main class="p-4">');
  expect(after[line - 1]).toContain('<button style="opacity: 0.5" disabled={!label}>Send</button>');
  expect(after[line - 1]).toContain('<span>{label}</span>');
  expect(after.filter((_, index) => index !== line - 1)).toEqual(source.split('\n').filter((_, index) => index !== line - 1));
  // Elements after an edit on the same line move; the editor gets their new positions.
  const span = result.selectionRemaps.find(item => item.oldSourceId.endsWith(`App.svelte:${line}:${column('<span')}`))!;
  expect(after[line - 1].indexOf('<span') + 1).toBe(span.newCoordinates.column);
});

test('undo restores the Svelte file', async () => {
  const f = fixture();
  await f.service.execute('svelte-2', [f.operation('a', '<main', { type: 'class', property: 'padding', value: 16 })]);
  expect((await f.service.restoreHistory('undo-1', f.store, 'undo')).success).toBe(true);
  expect(f.read()).toBe(source);
});

test('unsupported Svelte edits are refused and write nothing', async () => {
  const f = fixture();
  const structural = await f.service.execute('svelte-3', [f.operation('a', '<button', { type: 'delete' })]);
  expect(structural.error).toContain('UNSUPPORTED_OPERATION');
  const dynamicText = await f.service.execute('svelte-4', [f.operation('a', '<span', { type: 'text', value: 'x' })]);
  expect(dynamicText.success).toBe(false);
  const dynamicClass = await f.service.execute('svelte-5', [f.operation('a', '<i', { type: 'class', property: 'padding', value: 16 })]);
  expect(dynamicClass.error).toContain('dynamic Svelte class');
  const missing = await f.service.execute('svelte-6', [{ ...f.operation('a', '<main', { type: 'text', value: 'x' }), column: 1 }]);
  expect(missing.error).toContain('NODE_NOT_FOUND');
  expect(f.read()).toBe(source);
});

test('stamping leaves namespaced tags such as <svelte:head> intact', () => {
  const stamped = stampHTMLTemplate(source, 'App.svelte');
  expect(stamped).toContain('<svelte:head>');
  // The Svelte compiler rejects an attribute on <title>.
  expect(stamped).toContain('<svelte:head><title>Demo</title></svelte:head>');
  expect(stamped).toContain(`<main data-gl-source="App.svelte:${line}:${column('<main')}"`);
});
