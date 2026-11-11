import { afterEach, expect, test } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { MutationService, contentDigest, type MutationOperation } from '../../packages/server/src/mutation-service.js';
import { HistoryStore } from '../../packages/server/src/history-manager.js';
import { glideSourceStamping } from '../../packages/vite-plugin/src/index.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

const source = [
  '<!doctype html>',
  '<html lang="en">',
  '<head><title>Demo</title><script>const html = "<main class=\\"fake\\">";</script></head>',
  '<body>',
  '  <!-- <main class="comment"> -->',
  '  <main class="p-2"><button disabled>Save {now}</button><p>One <b>two</b></p><img src="a.png"></main>',
  '</body>',
  '</html>',
  '',
].join('\n');
const line = 6;
const column = (tag: string) => source.split('\n')[line - 1].indexOf(tag) + 1;

function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'glide-html-')));
  roots.push(root);
  fs.writeFileSync(path.join(root, 'index.html'), source);
  const store = new HistoryStore();
  const service = new MutationService(root, { onPersist: diffs => store.push({ description: 'Edit', diffs }) });
  const operation = (id: string, tag: string, change: MutationOperation['change']): MutationOperation => ({
    operationId: id, filePath: 'index.html', expectedDigest: contentDigest(source), line, column: column(tag), change });
  return { root, service, store, operation, read: () => fs.readFileSync(path.join(root, 'index.html'), 'utf8') };
}

function devPlugin(root: string) {
  const plugin = glideSourceStamping({ editor: false }) as any;
  plugin.configResolved({ command: 'serve', root });
  return plugin;
}

test('class, style and text edits save to an HTML page and keep the rest of the file', async () => {
  const f = fixture();
  const result = await f.service.execute('html-1', [
    f.operation('a', '<main', { type: 'class', property: 'padding', value: 16 }),
    f.operation('b', '<button', { type: 'text', value: 'Send' }),
    f.operation('c', '<button', { type: 'style', value: { opacity: '0.5' } }),
  ]);
  expect(result.error).toBeUndefined();
  const after = f.read().split('\n');
  expect(after[line - 1]).toBe('  <main class="p-4"><button style="opacity: 0.5" disabled>Send</button><p>One <b>two</b></p><img src="a.png"></main>');
  expect(after.filter((_, index) => index !== line - 1)).toEqual(source.split('\n').filter((_, index) => index !== line - 1));
  const image = result.selectionRemaps.find(item => item.oldSourceId.endsWith(`index.html:${line}:${column('<img')}`))!;
  expect(after[line - 1].indexOf('<img') + 1).toBe(image.newCoordinates.column);
});

test('undo restores the HTML page', async () => {
  const f = fixture();
  await f.service.execute('html-2', [f.operation('a', '<main', { type: 'class', property: 'padding', value: 16 })]);
  expect((await f.service.restoreHistory('undo-1', f.store, 'undo')).success).toBe(true);
  expect(f.read()).toBe(source);
});

test('unsupported HTML edits are refused and write nothing', async () => {
  const f = fixture();
  const refused = async (id: string, tag: string, change: MutationOperation['change'], reason: string) => {
    const result = await f.service.execute(id, [f.operation('a', tag, change)]);
    expect(result.success).toBe(false);
    expect(result.error).toContain(reason);
  };
  await refused('html-3', '<button', { type: 'delete' }, 'UNSUPPORTED_OPERATION');
  await refused('html-4', '<p>', { type: 'text', value: 'x' }, 'only literal text');
  await refused('html-5', '<img', { type: 'text', value: 'x' }, 'only literal text');
  expect(f.read()).toBe(source);
});

test('in a project with no framework, the dev server stamps the page at its source positions', () => {
  const f = fixture();
  const page = devPlugin(f.root).transformIndexHtml.handler(source, { filename: path.join(f.root, 'index.html') });
  for (const tag of ['<main', '<button', '<img']) {
    expect(page).toContain(`${tag} data-gl-source="index.html:${line}:${column(tag)}"`);
  }
  expect(page).toContain('__glide_initialized__');
  expect(page).not.toContain('class="fake" data-gl-source');
});

test('with a framework, index.html is a mount point and gets no stamps', () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.root, 'package.json'), JSON.stringify({ dependencies: { react: '19.0.0' } }));
  const page = devPlugin(f.root).transformIndexHtml.handler(source, { filename: path.join(f.root, 'index.html') });
  expect(page).not.toContain('index.html:');
  expect(page).toContain('__glide_initialized__');
});
