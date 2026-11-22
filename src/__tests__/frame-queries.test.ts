import { expect, test } from 'vitest';
import vm from 'node:vm';
import { createFrameQueries } from '../../packages/core/src/frame-queries.js';
import { buildBridgeScript } from '../../packages/vite-plugin/src/index.js';
import { getEditorHTML } from '../../packages/overlay/src/editor-html.js';

const attributes = { source: 'data-gl-source', selected: 'data-glide-selected', hover: 'data-glide-hover' };

function element(localName: string, source: string | null, parentElement: any = null, position = 'static') {
  const attrs: Record<string, string> = source ? { 'data-gl-source': source } : {};
  return { localName, tagName: localName.toUpperCase(), parentElement, position, clientLeft: 0, clientTop: 0, scrollLeft: 0, scrollTop: 0,
    hasAttribute: (name: string) => name in attrs, getAttribute: (name: string) => attrs[name] ?? null,
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 50 }) };
}

function page() {
  const main = element('main', 'App.tsx:3:5', null, 'relative');
  const span = element('span', 'App.tsx:4:7', main);
  const win = { scrollX: 0, scrollY: 0,
    getComputedStyle: (el: any) => ({ position: el.position, transform: 'none', backgroundColor: 'rgb(1, 2, 3)' }),
    document: { elementFromPoint: () => span, querySelectorAll: () => [main, span, element('main', 'App.tsx:3:5')] } };
  return win;
}

test('a point resolves to the nearest authored container and an offset in its containing block', () => {
  const run = createFrameQueries(page(), attributes);
  expect(run('container-at', { x: 40, y: 60 })).toEqual({ parentId: 'App.tsx:3:5', x: 30, y: 40 });
  expect(run('first-container', {})).toEqual({ parentId: 'App.tsx:3:5' });
  expect(run('sources', {})).toEqual(['App.tsx:3:5', 'App.tsx:4:7', 'App.tsx:3:5']);
  expect(run('unknown', {})).toBeNull();
});

test('the function is self-contained, so it runs in the editor page and in the bridge', () => {
  const source = createFrameQueries.toString();
  const run = vm.runInNewContext(`(${source})`)(page(), attributes);
  expect(run('first-container', {})).toEqual({ parentId: 'App.tsx:3:5' });
  expect(getEditorHTML()).toMatch(/case ["']container-at["']/);
  expect(buildBridgeScript('data-gl-source', 'data-glide-hover', 'data-glide-selected', 4)).toMatch(/case ["']container-at["']/);
});

test('the bridge answers a query from the editor with the same id', () => {
  const sent: any[] = [];
  const listeners: Record<string, ((event: any) => void)[]> = {};
  const parent = { postMessage: (message: any) => sent.push(message) };
  const main = element('main', 'App.tsx:3:5');
  const node = () => ({ style: {}, setAttribute() {}, appendChild() {}, addEventListener() {}, classList: { add() {}, remove() {} } });
  const document: any = { referrer: 'http://127.0.0.1:5173/__glide/', readyState: 'complete', documentElement: node(), head: node(), body: node(),
    createElement: node, addEventListener() {}, querySelectorAll: () => [main], querySelector: () => null, elementFromPoint: () => main };
  const window: any = { parent, top: {}, document, location: { ancestorOrigins: ['http://127.0.0.1:5173'], href: 'http://localhost:5173/' },
    addEventListener: (type: string, listener: (event: any) => void) => { (listeners[type] ||= []).push(listener); },
    getComputedStyle: () => ({ position: 'static', transform: 'none' }), requestAnimationFrame: () => 0, setTimeout: () => 0, setInterval: () => 0,
    MutationObserver: class { observe() {} }, ResizeObserver: class { observe() {} } };
  window.window = window;
  vm.runInNewContext(buildBridgeScript('data-gl-source', 'data-glide-hover', 'data-glide-selected', 4),
    { ...window, window, document, URL, console, MutationObserver: window.MutationObserver, ResizeObserver: window.ResizeObserver });
  const message = (origin: string) => ({ source: parent, origin, data: { type: 'glide:query', id: 7, query: 'first-container', payload: {} } });
  for (const listener of listeners.message || []) listener(message('http://evil.test'));
  expect(sent.filter(item => item.type === 'glide:query-result')).toEqual([]);
  for (const listener of listeners.message || []) listener(message('http://127.0.0.1:5173'));
  expect(sent.filter(item => item.type === 'glide:query-result')).toEqual([{ type: 'glide:query-result', id: 7, result: { parentId: 'App.tsx:3:5' } }]);
});

function row(display: string, flexDirection = 'row') {
  const box = (source: string | null, left: number, top: number, position = 'static') => ({ ...element('div', source, null, position),
    getBoundingClientRect: () => ({ left, top, width: 100, height: 50 }) });
  const children = [box('App.tsx:4:7', 0, 0), box('Card.tsx:1:1', 120, 0), box('App.tsx:6:7', 240, 0), box('App.tsx:7:7', 360, 0, 'absolute')];
  const container = { ...element('section', 'App.tsx:3:5', null, 'relative'), children };
  const win = { scrollX: 0, scrollY: 0, getComputedStyle: (el: any) => el === container
    ? { position: 'relative', transform: 'none', display, flexDirection, flexWrap: 'nowrap' } : { position: el.position, transform: 'none' },
  document: { elementFromPoint: () => container, querySelectorAll: () => [] } };
  return createFrameQueries(win, attributes);
}

test('a drop point names the in-flow sibling from the same file that a new element goes next to', () => {
  // Between the first and third children; the second is another file's component, the last is out of flow.
  expect(row('flex')('container-at', { x: 150, y: 25 })).toMatchObject({ siblingId: 'App.tsx:6:7', position: 'before' });
  expect(row('flex')('container-at', { x: 60, y: 25 })).toMatchObject({ siblingId: 'App.tsx:6:7', position: 'before' });
  expect(row('flex')('container-at', { x: 20, y: 25 })).toMatchObject({ siblingId: 'App.tsx:4:7', position: 'before' });
  expect(row('flex')('container-at', { x: 500, y: 25 })).toMatchObject({ siblingId: 'App.tsx:6:7', position: 'after' });
  expect(row('flex', 'row-reverse')('container-at', { x: 500, y: 25 })).toMatchObject({ siblingId: 'App.tsx:4:7', position: 'before' });
  // In a block container, order follows the vertical axis.
  expect(row('block')('container-at', { x: 500, y: 10 })).toMatchObject({ siblingId: 'App.tsx:4:7', position: 'before' });
});

test('a reversed wrapping row orders each line right to left', () => {
  const box = (source: string, left: number, top: number) => ({ ...element('div', source), getBoundingClientRect: () => ({ left, top, width: 100, height: 50 }) });
  const container = { ...element('section', 'App.tsx:3:5', null, 'relative'), children: [box('App.tsx:4:7', 120, 0), box('App.tsx:5:7', 0, 0), box('App.tsx:6:7', 120, 60)] };
  const win = { scrollX: 0, scrollY: 0, getComputedStyle: (el: any) => el === container
    ? { position: 'relative', transform: 'none', display: 'flex', flexDirection: 'row-reverse', flexWrap: 'wrap' } : { position: 'static', transform: 'none' },
  document: { elementFromPoint: () => container, querySelectorAll: () => [] } };
  expect(createFrameQueries(win, attributes)('container-at', { x: 250, y: 25 })).toMatchObject({ siblingId: 'App.tsx:4:7', position: 'before' });
});

test('wrap-reverse orders the lines bottom to top', () => {
  const box = (source: string, left: number, top: number) => ({ ...element('div', source), getBoundingClientRect: () => ({ left, top, width: 100, height: 50 }) });
  // Source order A, B on the bottom line, then C on the line above.
  const container = { ...element('section', 'App.tsx:3:5', null, 'relative'), children: [box('App.tsx:4:7', 120, 60), box('App.tsx:5:7', 0, 60), box('App.tsx:6:7', 120, 0)] };
  const win = { scrollX: 0, scrollY: 0, getComputedStyle: (el: any) => el === container
    ? { position: 'relative', transform: 'none', display: 'flex', flexDirection: 'row-reverse', flexWrap: 'wrap-reverse' } : { position: 'static', transform: 'none' },
  document: { elementFromPoint: () => container, querySelectorAll: () => [] } };
  expect(createFrameQueries(win, attributes)('container-at', { x: 250, y: 25 })).toMatchObject({ siblingId: 'App.tsx:6:7', position: 'before' });
  expect(createFrameQueries(win, attributes)('container-at', { x: 250, y: 85 })).toMatchObject({ siblingId: 'App.tsx:4:7', position: 'before' });
});

test('a wrapped line spans all its items, also when their heights differ', () => {
  const box = (source: string, left: number, top: number, height: number) => ({ ...element('div', source), getBoundingClientRect: () => ({ left, top, width: 100, height }) });
  // One bottom-aligned line: the short A sits lower than the tall B.
  const container = { ...element('section', 'App.tsx:3:5', null, 'relative'), children: [box('App.tsx:4:7', 120, 90, 20), box('App.tsx:5:7', 0, 60, 50)] };
  const win = { scrollX: 0, scrollY: 0, getComputedStyle: (el: any) => el === container
    ? { position: 'relative', transform: 'none', display: 'flex', flexDirection: 'row-reverse', flexWrap: 'wrap-reverse' } : { position: 'static', transform: 'none' },
  document: { elementFromPoint: () => container, querySelectorAll: () => [] } };
  expect(createFrameQueries(win, attributes)('container-at', { x: 210, y: 75 })).toMatchObject({ siblingId: 'App.tsx:4:7', position: 'before' });
});

test('a grid item spanning two rows does not merge them', () => {
  const box = (source: string, left: number, top: number, height: number) => ({ ...element('div', source), getBoundingClientRect: () => ({ left, top, width: 100, height }) });
  // A spans both rows; B is in the first row and C in the second.
  const container = { ...element('section', 'App.tsx:3:5', null, 'relative'), children: [box('App.tsx:4:7', 0, 0, 110), box('App.tsx:5:7', 120, 0, 50), box('App.tsx:6:7', 120, 60, 50)] };
  const win = { scrollX: 0, scrollY: 0, getComputedStyle: (el: any) => el === container
    ? { position: 'relative', transform: 'none', display: 'grid', flexDirection: 'row', flexWrap: 'nowrap' } : { position: 'static', transform: 'none' },
  document: { elementFromPoint: () => container, querySelectorAll: () => [] } };
  expect(createFrameQueries(win, attributes)('container-at', { x: 115, y: 85 })).toMatchObject({ siblingId: 'App.tsx:6:7', position: 'before' });
});
