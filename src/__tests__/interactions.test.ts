import { expect, test } from 'vitest';
import vm from 'node:vm';
import { createInteractions } from '../../packages/overlay/src/interactions.js';
import { transformJSXBatch } from '../../packages/ast-writer/src/writer.js';
import { createFrameQueries } from '../../packages/core/src/frame-queries.js';

const interactions = createInteractions();
const info = (tag: string, href: string | null = null, target: string | null = null, rel: string | null = null) => ({ tag, href, target, rel });

test('reads the interaction back from the rendered link', () => {
  expect(interactions.read(info('div'))).toEqual({ action: 'none', value: '' });
  expect(interactions.read(info('a', '/pricing'))).toEqual({ action: 'page', value: '/pricing' });
  expect(interactions.read(info('a', '#features'))).toEqual({ action: 'scroll', value: 'features' });
  expect(interactions.read(info('a', 'https://x.test', '_blank'))).toEqual({ action: 'url', value: 'https://x.test', newTab: true });
});

test('checks a choice before writing it', () => {
  expect(interactions.problem({ action: 'page', value: 'pricing' }, [])).toMatch(/starts with \//);
  expect(interactions.problem({ action: 'url', value: 'javascript:alert(1)' }, [])).toMatch(/web address/);
  expect(interactions.problem({ action: 'scroll', value: 'gone' }, ['features'])).toMatch(/has an id/);
  expect(interactions.problem({ action: 'scroll', value: 'features' }, ['features'])).toBe('');
});

test('plans one retag that carries the link, and keeps a hand-written rel', () => {
  expect(interactions.plan({ action: 'url', value: 'https://x.test', newTab: true }, info('div')))
    .toEqual({ type: 'retag', tagName: 'a', attributes: { href: 'https://x.test', target: '_blank' } });
  expect(interactions.plan({ action: 'page', value: '/a' }, info('a', 'https://x.test', '_blank', 'noopener noreferrer')).attributes)
    .toEqual({ href: '/a', target: null, rel: null });
  expect(interactions.plan({ action: 'page', value: '/a' }, info('a', '/b', null, 'author')).attributes).toEqual({ href: '/a', target: null });
  expect(interactions.plan({ action: 'page', value: '/a' }, info('button')).attributes).toMatchObject({ type: null });
  expect(interactions.plan({ action: 'none', value: '' }, info('a', '/b'))).toEqual({ type: 'retag', tagName: 'div', attributes: { href: null, target: null } });
  // A hand-written rel stays, so the element stays an <a> (no href, so not a link).
  expect(interactions.plan({ action: 'none', value: '' }, info('a', '/b', null, 'author'))).toMatchObject({ tagName: 'a', attributes: { href: null, target: null } });
});

test('the module is self-contained, so the editor can embed it', () => {
  const embedded = vm.runInNewContext(`(${createInteractions.toString()})`)();
  expect(embedded.read(info('a', '#x'))).toEqual({ action: 'scroll', value: 'x' });
});

function run(source: string, marker: string, change: any) {
  const before = source.slice(0, source.indexOf(marker)).split('\n');
  return transformJSXBatch(source, [{ line: before.length, column: before.at(-1)!.length + 1, change }]).code;
}

test('a retag writes the link and its tag in one change, and can undo the link', () => {
  const app = 'const App = () => <main><div className="cta">Go</div><section id="features" /></main>;';
  const linked = run(app, '<div', interactions.plan({ action: 'scroll', value: 'features' }, info('div')));
  expect(linked).toContain('<a className="cta" href="#features">Go</a>');
  const external = run(app, '<div', interactions.plan({ action: 'url', value: 'https://x.test', newTab: true }, info('div')));
  for (const part of ['<a', 'href="https://x.test"', 'target="_blank"', 'rel="noopener noreferrer"', '>Go</a>']) expect(external).toContain(part);
  const unlinked = run(external, '<a', interactions.plan({ action: 'none', value: '' }, info('a', 'https://x.test', '_blank', 'noopener noreferrer')));
  expect(unlinked.replace(/\s+/g, ' ')).toContain('<div className="cta">Go</div>');
  expect(run('const App = () => <main><button type="button">Go</button></main>;', '<button', interactions.plan({ action: 'page', value: '/a' }, info('button'))))
    .toContain('<a href="/a">Go</a>');
});

test('the page reports a link and how often each id is used', () => {
  const el = (attrs: Record<string, string>) => ({ localName: attrs.tag, getAttribute: (name: string) => attrs[name] ?? null, hasAttribute: (name: string) => name in attrs, id: attrs.id });
  const link = el({ tag: 'a', 'data-gl-source': 'App.tsx:2:3', href: '#features' });
  const win = { document: { querySelectorAll: (selector: string) => selector === '[id]'
    ? [el({ tag: 'section', id: 'features' }), el({ tag: 'div', id: 'dup' }), el({ tag: 'div', id: 'dup' }), el({ tag: 'div', id: 'glide-overlay' }), el({ tag: 'div', id: 'constructor' })]
    : [link] } };
  const ask = createFrameQueries(win, { source: 'data-gl-source', selected: 'x', hover: 'y' });
  expect(ask('link-info', { source: 'App.tsx:2:3' })).toEqual({ tag: 'a', href: '#features', target: null, rel: null });
  expect(ask('ids', {})).toEqual([{ id: 'features', count: 1 }, { id: 'dup', count: 2 }, { id: 'constructor', count: 1 }]);
});
