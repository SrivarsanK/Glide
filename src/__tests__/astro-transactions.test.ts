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
  '---',
  "import Card from './Card.astro';",
  'const label = "Hi";',
  'const html = "<main class=\\"fake\\">";',
  '---',
  '<!-- <main class="comment"> -->',
  '<main class="p-2" data-x={label > "a" ? "}" : `>`}><button disabled>Save</button><span>{label}</span><i class:list={["x"]}>i</i><Card {...Astro.props}>c</Card><b {...Astro.props}>b</b></main>',
  '<style>main { color: red; }</style>',
  '',
].join('\n');
const line = 7;
const column = (tag: string) => source.split('\n')[line - 1].indexOf(tag) + 1;

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-astro-'));
  roots.push(root);
  fs.writeFileSync(path.join(root, 'Page.astro'), source);
  const store = new HistoryStore();
  const service = new MutationService(root, { onPersist: diffs => store.push({ description: 'Edit', diffs }) });
  const operation = (id: string, tag: string, change: MutationOperation['change']): MutationOperation => ({
    operationId: id, filePath: 'Page.astro', expectedDigest: contentDigest(source), line, column: column(tag), change });
  return { service, store, operation, read: () => fs.readFileSync(path.join(root, 'Page.astro'), 'utf8') };
}

test('class, style and text edits save to an Astro template and keep the rest of the file', async () => {
  const f = fixture();
  const result = await f.service.execute('astro-1', [
    f.operation('a', '<main', { type: 'class', property: 'padding', value: 16 }),
    f.operation('b', '<button', { type: 'text', value: 'Send' }),
    f.operation('c', '<button', { type: 'style', value: { opacity: '0.5' } }),
  ]);
  expect(result.error).toBeUndefined();
  const after = f.read().split('\n');
  expect(after[line - 1]).toContain('<main class="p-4" data-x={label > "a" ? "}" : `>`}>');
  expect(after[line - 1]).toContain('<button style="opacity: 0.5" disabled>Send</button>');
  expect(after.filter((_, index) => index !== line - 1)).toEqual(source.split('\n').filter((_, index) => index !== line - 1));
  // Elements after an edit on the same line move; the editor gets their new positions.
  const span = result.selectionRemaps.find(item => item.oldSourceId.endsWith(`Page.astro:${line}:${column('<span')}`))!;
  expect(after[line - 1].indexOf('<span') + 1).toBe(span.newCoordinates.column);
});

test('the positions Glide edits are the positions the stamp gives', () => {
  const stamped = stampHTMLTemplate(source, 'Page.astro');
  for (const tag of ['<main', '<button', '<span']) {
    expect(stamped).toContain(`${tag} data-gl-source="Page.astro:${line}:${column(tag)}"`);
  }
});

test('undo restores the Astro file', async () => {
  const f = fixture();
  await f.service.execute('astro-2', [f.operation('a', '<main', { type: 'class', property: 'padding', value: 16 })]);
  expect((await f.service.restoreHistory('undo-1', f.store, 'undo')).success).toBe(true);
  expect(f.read()).toBe(source);
});

test('unsupported Astro edits are refused and write nothing', async () => {
  const f = fixture();
  const refused = async (id: string, tag: string, change: MutationOperation['change'], reason: string) => {
    const result = await f.service.execute(id, [f.operation('a', tag, change)]);
    expect(result.success).toBe(false);
    expect(result.error).toContain(reason);
  };
  await refused('astro-3', '<button', { type: 'delete' }, 'UNSUPPORTED_OPERATION');
  await refused('astro-4', '<span', { type: 'text', value: 'x' }, 'only literal text');
  await refused('astro-5', '<i', { type: 'class', property: 'padding', value: 16 }, 'class directive');
  await refused('astro-6', '<Card', { type: 'class', property: 'padding', value: 16 }, 'Components');
  await refused('astro-7', '<b {', { type: 'class', property: 'padding', value: 16 }, 'spread');
  await refused('astro-8', '<main', { type: 'text', value: 'x' }, 'only literal text');
  const missing = await f.service.execute('astro-9', [{ ...f.operation('a', '<main', { type: 'text', value: 'x' }), line: 4, column: 15 }]);
  expect(missing.error).toContain('NODE_NOT_FOUND');
  expect(f.read()).toBe(source);
});
