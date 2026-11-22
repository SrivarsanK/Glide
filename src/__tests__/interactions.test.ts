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
    .toMatchObject({ type: 'retag', tagName: 'a', attributes: { href: 'https://x.test', target: '_blank' } });
  expect(interactions.plan({ action: 'page', value: '/a' }, info('a', 'https://x.test', '_blank', 'noopener noreferrer')).attributes)
    .toMatchObject({ href: '/a', target: null, rel: null });
  expect(interactions.plan({ action: 'page', value: '/a' }, info('a', '/b', null, 'author')).attributes).not.toHaveProperty('rel');
  expect(interactions.plan({ action: 'page', value: '/a' }, info('button')).attributes).toMatchObject({ type: null });
  expect(interactions.plan({ action: 'none', value: '' }, info('a', '/b'))).toMatchObject({ type: 'retag', tagName: 'div', attributes: { href: null, target: null } });
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
  expect(ask('link-info', { source: 'App.tsx:2:3' })).toMatchObject({ tag: 'a', href: '#features', target: null, rel: null, inPopover: null });
  expect(ask('ids', {})).toEqual([{ id: 'features', count: 1, popover: false }, { id: 'dup', count: 2, popover: false }, { id: 'constructor', count: 1, popover: false }]);
});

test('reads, checks and plans opening and closing an overlay', () => {
  const button = (target: string | null, action: string | null = null, extra = {}) => ({ ...info('button'), popoverTarget: target, popoverAction: action, ...extra });
  expect(interactions.read(button('menu'))).toEqual({ action: 'open-overlay', value: 'menu' });
  expect(interactions.read(button('menu', 'hide'))).toEqual({ action: 'close-overlay', value: 'menu' });
  expect(interactions.problem({ action: 'open-overlay', value: 'menu' }, [], [])).toMatch(/popover attribute/);
  expect(interactions.problem({ action: 'open-overlay', value: 'menu' }, [], ['menu'], { ...info('button'), type: 'submit' })).toMatch(/submits a form/);
  expect(interactions.problem({ action: 'close-overlay', value: '' }, [], [], info('button'))).toMatch(/inside an overlay/);
  // Review fixes: one Close target must fit every instance, and point at a unique id.
  expect(interactions.problem({ action: 'close-overlay', value: '' }, [], ['menu'], { ...info('button'), overlayMixed: true })).toMatch(/more than one overlay/);
  expect(interactions.problem({ action: 'close-overlay', value: '' }, [], [], { ...info('button'), inPopover: 'menu' })).toMatch(/shares its id/);
  expect(interactions.problem({ action: 'close-overlay', value: '' }, [], ['menu'], { ...info('button'), inPopover: 'menu' })).toBe('');
  expect(interactions.plan({ action: 'open-overlay', value: 'menu' }, info('a', '/x')))
    .toEqual({ type: 'retag', tagName: 'button', attributes: { href: null, target: null, type: 'button', popoverTarget: 'menu', popoverTargetAction: null } });
  expect(interactions.plan({ action: 'close-overlay', value: '' }, { ...info('div'), inPopover: 'menu' }).attributes)
    .toMatchObject({ popoverTarget: 'menu', popoverTargetAction: 'hide', type: 'button' });
});

test('an overlay button is written as a non-submitting button in one change', () => {
  const app = 'const App = () => <main><a href="/x">Menu</a><div id="menu" popover>Items</div></main>;';
  const opened = run(app, '<a', interactions.plan({ action: 'open-overlay', value: 'menu' }, info('a', '/x')));
  expect(opened.replace(/\s+/g, ' ')).toContain('<button type="button" popoverTarget="menu">Menu</button>');
  const closing = run('const App = () => <main><div id="menu" popover><span>Close</span></div></main>;', '<span',
    interactions.plan({ action: 'close-overlay', value: '' }, { ...info('span'), inPopover: 'menu' }));
  expect(closing.replace(/\s+/g, ' ')).toContain('<button type="button" popoverTarget="menu" popoverTargetAction="hide">Close</button>');
  // Hand-written lowercase names are the same attributes, so clearing the interaction removes them.
  const cleared = run('const App = () => <main><button type="button" popovertarget="menu" popovertargetaction="hide">X</button></main>;', '<button',
    interactions.plan({ action: 'none', value: '' }, info('button')));
  expect(cleared).not.toMatch(/popovertarget/i);
  const lowercase = run('const App = () => <main><button type="button" popovertarget="old">X</button></main>;', '<button',
    interactions.plan({ action: 'open-overlay', value: 'menu' }, info('button')));
  expect(lowercase).toContain('popoverTarget="menu"');
  expect(lowercase).not.toContain('popovertarget');
});

test('link-info names a containing overlay only when every rendered instance shares it', () => {
  const inside = (id: string) => ({ localName: 'button', getAttribute: (name: string) => name === 'data-gl-source' ? 'Card.tsx:1:1' : null,
    parentElement: { closest: () => ({ id }) } });
  const ask = (els: any[]) => createFrameQueries({ document: { querySelectorAll: () => els } }, { source: 'data-gl-source', selected: 'x', hover: 'y' })
    ('link-info', { source: 'Card.tsx:1:1' });
  expect(ask([inside('a'), inside('a')])).toMatchObject({ inPopover: 'a', overlayMixed: false });
  expect(ask([inside('a'), inside('b')])).toMatchObject({ inPopover: null, overlayMixed: true });
});
