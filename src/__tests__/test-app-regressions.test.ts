// Regressions found by driving the editor in the five glide-test-apps.
import vm from 'node:vm';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { parse } from '@babel/parser';
import { describe, expect, test } from 'vitest';
import { getEditorHTML } from '../../packages/overlay/src/editor-html.js';
import { createSourceMapping } from '../../packages/overlay/src/source-mapping.js';
import { createMutationScope } from '../../packages/overlay/src/mutation-scope.js';
import { buildBridgeScript } from '../../packages/vite-plugin/src/index.js';
import { buildGlideBridgeInlineScript } from '../../packages/server/src/ws-server.js';
import { transformTemplateBatch } from '../../packages/server/src/template-mutations.js';
import { transformJSXBatch } from '../../packages/ast-writer/src/index.js';
import { DEFAULT_CONFIG, loadTailwindTheme } from '../../packages/core/src/index.js';

/** Function and variable declarations from a served script, by name. */
function pick(script: string, names: string[]): string {
  const found = new Map<string, string>();
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration' && names.includes(node.id?.name)) found.set(node.id.name, script.slice(node.start, node.end));
    if (node.type === 'VariableDeclaration' && node.declarations.some((d: any) => names.includes(d.id?.name))) {
      found.set(node.declarations[0].id.name, script.slice(node.start, node.end));
    }
    for (const value of Object.values(node)) Array.isArray(value) ? value.forEach(walk) : walk(value);
  };
  walk(parse(script));
  expect([...found.keys()].sort()).toEqual([...names].sort());
  return [...found.values()].join('\n');
}

const editorScript = () => getEditorHTML().match(/<script>\s*([\s\S]*?)<\/script>/)![1];

function editor(names: string[]) {
  const context = vm.createContext({ createSourceMapping, createMutationScope, setTimeout, clearTimeout });
  vm.runInContext(`
    const sourceMapping = createSourceMapping(), sourceFileAliases = new Map(), fileDigests = new Map(), selectionTags = new Map();
    let currentFile = 'src/App.tsx', currentGeneration = 0, editScope = null, representation = '', stagingModeActive = false;
    let selectedElement = null, selectedSources = [], selectedRects = [], selectedRect = null, selectedComputedStyles = null;
    const iframeWidth = { current: 800 };
    const mutationScope = createMutationScope(() => ({ authoringRepresentation: representation || undefined }));
    const sent = [], toasts = [], WebSocket = { OPEN: 1 };
    const socket = { readyState: 1, send(value) { sent.push(JSON.parse(value)); } };
    const document = { getElementById: () => null, querySelectorAll: () => [] };
    function showToast(kind, message) { toasts.push(message); }
    let glideClipboard = null;
    function applyOptimisticStyle() {}
    function populatePropsFromComputed() {}
    function clearOverlay() {}
    function showNoSelection() {}
    ${pick(editorScript(), names)}
  `, context);
  return context;
}
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('editor', () => {
  const styleNames = ['normalizePathSlash', 'sameSourceFile', 'parseSource', 'scopedEdit', 'sendStylePropsChange', '_styleTimers'];

  test('quick color edits on three elements each save to their own element', async () => {
    const context = editor(styleNames);
    vm.runInContext(`
      for (const [column, color] of [[5, '#111111'], [40, '#222222'], [75, '#333333']]) {
        selectedElement = { source: 'src/App.tsx:3:' + column };
        sendStylePropsChange(selectedElement.source, { backgroundColor: color });
      }`, context);
    await wait(300);
    expect(vm.runInContext('sent', context).map((m: any) => [m.column, m.change.value.backgroundColor]))
      .toEqual([[5, '#111111'], [40, '#222222'], [75, '#333333']]);
  });

  test('quick edits of two properties on one element save both', async () => {
    const context = editor(styleNames);
    vm.runInContext(`
      selectedElement = { source: 'src/App.tsx:3:5' };
      sendStylePropsChange(selectedElement.source, { color: '#ff0000' });
      sendStylePropsChange(selectedElement.source, { backgroundColor: '#00ff00' });`, context);
    await wait(300);
    const sent = vm.runInContext('sent', context);
    expect(sent).toHaveLength(1);
    expect(sent[0].change.value).toEqual({ color: '#ff0000', backgroundColor: '#00ff00' });
  });

  test('with Auto format, a color edit is written as a Tailwind class unless the element sets it inline', async () => {
    const context = editor(styleNames);
    vm.runInContext(`
      selectedElement = { source: 'src/App.tsx:3:5' };
      selectedComputedStyles = { inlineStyle: '' };
      sendStylePropsChange(selectedElement.source, { color: '#ff0000' });`, context);
    await wait(300);
    vm.runInContext(`
      selectedElement = { source: 'src/App.tsx:9:5' };
      selectedComputedStyles = { inlineStyle: 'width: 200px; background: rgb(253, 230, 138);' };
      sendStylePropsChange(selectedElement.source, { backgroundColor: '#111111' });
      selectedElement = { source: 'src/App.tsx:12:5' };
      selectedComputedStyles = { inlineStyle: '' };
      sendStylePropsChange(selectedElement.source, { width: '250px' });`, context);
    await wait(300);
    expect(vm.runInContext('sent', context).map((m: any) => m.change.type)).toEqual(['multi-class', 'style', 'style']);
  });

  test('a selection refresh from the page keeps a shift-click multi-selection', () => {
    const context = editor(['normalizePathSlash', 'parseSource', 'isSourceMatch', 'isSourceSelected', 'acceptSelection', 'pendingStampRemaps']);
    const rect = { x: 1, y: 1, width: 10, height: 10 };
    const select = (data: object) => vm.runInContext('acceptSelection', context)({ rect, computedStyles: {}, ...data });
    select({ source: 'src/App.tsx:3:5', isShift: false });
    select({ source: 'src/App.tsx:3:40', isShift: true });
    select({ source: 'src/App.tsx:3:40', isShift: false, refresh: true, owners: [{ name: 'Box' }] });
    expect(vm.runInContext('selectedSources', context)).toEqual(['src/App.tsx:3:5', 'src/App.tsx:3:40']);
    expect(vm.runInContext('selectedElement.owners', context)).toEqual([{ name: 'Box' }]);
    // A plain click on one of them still selects only that element.
    select({ source: 'src/App.tsx:3:5', isShift: false });
    expect(vm.runInContext('selectedSources', context)).toEqual(['src/App.tsx:3:5']);
  });

  const saved = ['setFileDigest', 'applyTransactionMappings', 'trackStaleStamps', 'pendingStampRemaps', '_styleTimers', '_pendingEdits'];
  const moved = (pairs: [number, number][]) => `{ success: true, changedFiles: [{ path: 'src/App.tsx', newDigest: 'd' }], selectionRemaps: [${
    pairs.map(([from, to]) => `{ oldSourceId: 'src/App.tsx:3:${from}', oldHash: '00000000', newHash: '00000000', newCoordinates: { line: 3, column: ${to} } }`).join(', ')}] }`;

  test('a click on the page before it re-renders a save lands on the saved coordinates', () => {
    const context = editor(['normalizePathSlash', 'sameSourceFile', 'parseSource', 'isSourceMatch', 'isSourceSelected', 'acceptSelection',
      'pageRendered', ...saved]);
    const select = (source: string) => {
      vm.runInContext('acceptSelection', context)({ source, isShift: false, rect: {}, computedStyles: {} });
      return vm.runInContext('parseSource(selectedElement.source).column', context);
    };
    select('src/App.tsx:3:5');
    vm.runInContext(`applyTransactionMappings(${moved([[5, 5], [40, 42], [75, 77]])})`, context);
    expect(select('src/App.tsx:3:40')).toBe(42);
    // A second save before the page re-renders: the page still shows the first coordinates.
    vm.runInContext(`applyTransactionMappings(${moved([[5, 5], [42, 44], [77, 79]])})`, context);
    expect(select('src/App.tsx:3:75')).toBe(79);
    // Once the page has re-rendered, its stamps are current and are not translated again.
    vm.runInContext('pageRendered()', context);
    expect(select('src/App.tsx:3:44')).toBe(44);
  });

  test('a save that moves no stamp leaves the page stamps alone', () => {
    const context = editor(['normalizePathSlash', 'sameSourceFile', 'parseSource', 'isSourceMatch', 'isSourceSelected', 'acceptSelection',
      'pageRendered', ...saved]);
    // A class edit on its own line: nothing moves, so the page never re-renders its stamps, and none may be rewritten.
    vm.runInContext(`applyTransactionMappings(${moved([[5, 5], [40, 40]])})`, context);
    vm.runInContext('acceptSelection', context)({ source: 'src/App.tsx:3:40', isShift: false, rect: {}, computedStyles: {} });
    expect(vm.runInContext('selectedElement.source', context)).toBe('src/App.tsx:3:40');
    // A later save that moves an element the first one left in place still translates its stamp.
    vm.runInContext(`applyTransactionMappings(${moved([[5, 5], [40, 42]])})`, context);
    vm.runInContext('acceptSelection', context)({ source: 'src/App.tsx:3:40', isShift: false, rect: {}, computedStyles: {} });
    expect(vm.runInContext('parseSource(selectedElement.source).column', context)).toBe(42);
  });

  test('page messages after a re-render that beats its save confirmation are replayed after the confirmation', () => {
    const context = editor(['holdPageMessage', 'releasePageMessages', 'heldPageMessages', 'holdingPage']);
    vm.runInContext(`
      const replayed = [];
      function onPageMessage(event) { replayed.push(event.data.type + (event.data.source ? ' ' + event.data.source : '')); }
      let inFlight = 0;
      const sourceTransport = { pending: () => inFlight };`, context);
    const hold = (data: object) => vm.runInContext('holdPageMessage', context)({ data });
    // With no save in flight, a re-render is handled at once.
    expect(hold({ type: 'glide:dom-tree', rendered: true })).toBe(false);
    vm.runInContext('inFlight = 1', context);
    // A click before the page re-renders carries the old stamps, which the confirmation remaps: handled at once.
    expect(hold({ type: 'glide:overlay', source: 'App.tsx:3:40' })).toBe(false);
    // The page re-rendered before the confirmation: it and what follows wait for it.
    expect(hold({ type: 'glide:dom-tree', rendered: true })).toBe(true);
    expect(hold({ type: 'glide:overlay', source: 'App.tsx:3:42' })).toBe(true);
    expect(hold({ type: 'glide:element-hovered' })).toBe(false);
    vm.runInContext('inFlight = 0; releasePageMessages()', context);
    expect(vm.runInContext('replayed', context)).toEqual(['glide:dom-tree', 'glide:overlay App.tsx:3:42']);
    expect(hold({ type: 'glide:overlay', source: 'App.tsx:3:42' })).toBe(false);
  });

  test('a style edit still waiting to be sent follows a save that moved its element', async () => {
    const context = editor([...styleNames.filter(name => name !== '_styleTimers'), ...saved]);
    vm.runInContext(`
      selectedElement = { source: 'src/App.tsx:3:40' };
      sendStylePropsChange(selectedElement.source, { backgroundColor: '#222222' });
      applyTransactionMappings(${moved([[5, 5], [40, 42]])});`, context);
    await wait(300);
    expect(vm.runInContext('sent', context).map((m: any) => m.column)).toEqual([42]);
  });

  test('undo and redo refresh the digest under every spelling of the file, so the next edit can save', () => {
    const context = editor(['normalizePathSlash', 'sameSourceFile', 'parseSource', ...saved]);
    vm.runInContext(`
      sourceFileAliases.set('src/App.svelte', 'C:/project/src/App.svelte');
      sourceFileAliases.set('C:/project/src/App.svelte', 'C:/project/src/App.svelte');
      fileDigests.set('src/App.svelte', 'before'); fileDigests.set('C:/project/src/App.svelte', 'before');
      applyTransactionMappings({ success: true, action: 'undo', changedFiles: [{ path: 'C:\\\\project\\\\src\\\\App.svelte', newDigest: 'after' }] });`, context);
    expect(vm.runInContext(`fileDigests.get('src/App.svelte')`, context)).toBe('after');
    expect(vm.runInContext(`fileDigests.get('C:/project/src/App.svelte')`, context)).toBe('after');
  });

  test('the color popup reads a swatch color the browser reports as rgb()', () => {
    const context = editor(['cssColorToHex']);
    expect(vm.runInContext(`cssColorToHex('rgb(255, 0, 0)')`, context)).toBe('#ff0000');
  });

  test('the rotation field reads the matrix that getComputedStyle reports', () => {
    const context = editor(['rotationFromTransform']);
    const degrees = (transform: string) => vm.runInContext('rotationFromTransform', context)(transform);
    expect(degrees('none')).toBe(0);
    expect(degrees('rotate(45deg)')).toBe(45);
    expect(degrees('matrix(0.707107, 0.707107, -0.707107, 0.707107, 0, 0)')).toBe(45);
    expect(degrees('matrix(6.12323e-17, -1, 1, 6.12323e-17, 0, 0)')).toBe(-90);
  });
});

describe('served scripts', () => {
  // A template literal drops the backslash of an escape it does not know: `/\d+/` reaches the browser as `/d+/`.
  test.each([
    ['packages/overlay/src/editor-html.ts', 'return `', '  `;'],
    ['packages/server/src/ws-server.ts', 'return `<script data-glide-bridge="1">', '<\\/script>`'],
  ])('no backslash escape in the %s template is silently dropped', (file, start, end) => {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const from = lines.findIndex(line => line.trim() === start.trim());
    const to = lines.findIndex((line, index) => index > from && line === end);
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    const dropped = lines.slice(from, to).flatMap((line, index) =>
      [...line.matchAll(/(\\+)([sdwSDWbB.()+*?^|/[\]{}-])/g)].filter(m => m[1].length % 2 === 1).map(() => `${from + index + 1}: ${line.trim()}`));
    expect(dropped).toEqual([]);
  });

  const bridges: [string, () => string][] = [
    ['vite bridge', () => buildBridgeScript('data-gl-source', 'data-glide-hover', 'data-glide-selected', 5)],
    ['server bridge', () => buildGlideBridgeInlineScript(DEFAULT_CONFIG).replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')],
  ];

  /** Runs a bridge against one stamped element; returns the posted messages and registered listeners. */
  function runBridge(code: string, text: string) {
    const messages: any[] = [], listeners: Record<string, Function[]> = {}, observers: Function[] = [], frames: Function[] = [];
    const on = (type: string, fn: Function) => { (listeners[type] ||= []).push(fn); };
    const attributes = new Map([['data-gl-source', 'src/App.tsx:10:5']]);
    const el: any = {
      nodeType: 1, tagName: 'DIV', className: 'box', childNodes: [{ nodeType: 3, textContent: text }], children: [], parentNode: null,
      getAttribute: (name: string) => attributes.get(name) ?? null, hasAttribute: (name: string) => attributes.has(name),
      setAttribute: (name: string, value: string) => attributes.set(name, value), removeAttribute: (name: string) => attributes.delete(name),
      closest: (selector: string) => (/contenteditable|data-glide-bridge/.test(selector) ? null : el),
      getBoundingClientRect: () => ({ left: 10, top: 10, right: 110, bottom: 50, width: 100, height: 40 }),
    };
    const window: any = {
      __glide_initialized__: false, get top() { return {}; }, parent: { postMessage: (data: any) => messages.push(data) },
      addEventListener: on, removeEventListener: () => {}, getComputedStyle: () => ({}), getSelection: () => null,
    };
    const stamped = [el];
    const document: any = {
      head: { appendChild: () => {} }, createElement: () => ({ id: '', textContent: '', appendChild: () => {} }),
      addEventListener: on, removeEventListener: () => {}, readyState: 'complete',
      documentElement: { setAttribute: () => {}, removeAttribute: () => {}, hasAttribute: () => false },
      body: { children: [el], firstElementChild: el }, querySelector: () => null,
      querySelectorAll: (selector: string) => (selector === '[data-gl-source]' ? stamped : []),
      elementFromPoint: () => el, createRange: () => ({ selectNodeContents() {} }),
    };
    const requestAnimationFrame = (fn: Function) => frames.push(fn);
    const MutationObserver = class { constructor(fn: Function) { observers.push(fn); } observe() {} disconnect() {} };
    // Runs at once and returns null, so a throttle that clears its timer inside the callback sees it cleared.
    const context = vm.createContext({ window, document, setTimeout: (fn: any) => { fn(); return null; }, clearTimeout: () => {},
      setInterval: () => 1, clearInterval: () => {}, requestAnimationFrame, cancelAnimationFrame: () => {}, MutationObserver, Math, String, console });
    Object.assign(window, { window, document, requestAnimationFrame, cancelAnimationFrame: () => {}, MutationObserver });
    vm.runInContext(code, context);
    const flush = () => frames.splice(0).forEach(fn => fn(0));
    const click = () => (listeners.pointerdown || listeners.mousedown || []).forEach(listener => listener({ target: el, shiftKey: false,
      ctrlKey: false, metaKey: false, button: 0, clientX: 20, clientY: 20, pointerId: 1, preventDefault() {}, stopPropagation() {} }));
    return { messages, listeners, el, observers, flush, click, stamped };
  }

  test.each(bridges)('the %s keeps the selection when a remount after a save moves its stamp', (_name, script) => {
    const { messages, observers, el, flush, click, stamped } = runBridge(script(), 'Box');
    click();
    flush();
    messages.length = 0;
    // Svelte remounts the component: the node is replaced, and the save moved its stamp two columns on.
    const attributes = new Map([['data-gl-source', 'src/App.tsx:10:7']]);
    const remounted = { ...el, isConnected: true, getAttribute: (name: string) => attributes.get(name) ?? null,
      hasAttribute: (name: string) => attributes.has(name), setAttribute: (name: string, value: string) => attributes.set(name, value),
      removeAttribute: (name: string) => attributes.delete(name) };
    el.isConnected = false;
    stamped.splice(0, 1, remounted);
    observers.forEach(fn => fn([{ type: 'childList', target: remounted }]));
    flush();
    expect(messages.some(m => m.type === 'glide:clear-selection')).toBe(false);
    expect(messages.filter(m => m.type === 'glide:overlay' && !m.isHover).map(m => m.source)).toContain('src/App.tsx:10:7');
  });

  test.each(bridges)('the %s reports a re-render before it re-reports the selection', (_name, script) => {
    const { messages, observers, el, flush, click } = runBridge(script(), 'Box');
    click();
    flush();
    messages.length = 0;
    observers.forEach(fn => fn([{ type: 'attributes', attributeName: 'data-gl-source', target: el }]));
    flush();
    const kinds = messages.map(m => (m.type === 'glide:overlay' && !m.isHover ? 'selection' : m.type));
    expect(kinds).toContain('glide:dom-tree');
    expect(kinds).toContain('selection');
    expect(kinds.indexOf('glide:dom-tree')).toBeLessThan(kinds.indexOf('selection'));
    expect(messages.find(m => m.type === 'glide:dom-tree').rendered).toBe(true);
  });

  test.each(bridges)('the %s does not report a class-only change as a re-render of the source', (_name, script) => {
    const { messages, observers, el, flush, click } = runBridge(script(), 'Box');
    click();
    flush();
    messages.length = 0;
    // The editor's optimistic preview changes classes, and Tailwind's CSS update swaps a <style>, before the save reaches the page.
    const style = { nodeType: 1, hasAttribute: () => false, querySelector: () => null };
    observers.forEach(fn => fn([{ type: 'attributes', attributeName: 'class', target: el },
      { type: 'childList', target: el, addedNodes: [style], removedNodes: [] }]));
    flush();
    expect(messages.filter(m => m.type === 'glide:dom-tree').every(m => !m.rendered)).toBe(true);
    messages.length = 0;
    // A remount adds stamped elements: that is a re-render.
    const section = { nodeType: 1, hasAttribute: () => false, querySelector: (selector: string) => (selector === '[data-gl-source]' ? el : null) };
    observers.forEach(fn => fn([{ type: 'childList', target: el, addedNodes: [section], removedNodes: [] }]));
    flush();
    expect(messages.filter(m => m.type === 'glide:dom-tree').some(m => m.rendered)).toBe(true);
    messages.length = 0;
    // React deletes the first of several boxes by reusing the nodes in place and removing the last one:
    // no stamp changes and nothing is added, but a stamped element is removed.
    observers.forEach(fn => fn([{ type: 'childList', target: el, addedNodes: [], removedNodes: [section] }]));
    flush();
    expect(messages.filter(m => m.type === 'glide:dom-tree').some(m => m.rendered)).toBe(true);
  });

  test.each(bridges)('the %s keeps the space between edited text and the page text next to it', (_name, script) => {
    const edit = (text: string, typed: string, next: string) => {
      const { messages, listeners, el } = runBridge(script(), text);
      const handlers: Record<string, Function> = {};
      Object.assign(el, { textContent: text, style: {}, focus() {}, blur() { handlers.blur?.(); },
        addEventListener: (type: string, fn: Function) => { handlers[type] = fn; }, removeEventListener() {},
        nextSibling: { nodeType: 3, nodeValue: next } });
      for (const listener of listeners.dblclick || []) listener({ target: el, clientX: 20, clientY: 20, preventDefault() {}, stopPropagation() {} });
      el.textContent = typed;
      handlers.blur?.();
      return messages.find(m => m.type === 'glide:inline-text-edit')?.value;
    };
    expect(edit('Hello ', 'Welcome', 'world')).toBe('Welcome ');
    expect(edit('Hello ', 'Welcome', ' world')).toBe('Welcome');
    expect(edit('Hello', 'Welcome', 'world')).toBe('Welcome');
  });

  test.each(bridges)('the %s keeps the letter s in layer text', (_name, script) => {
    const { messages } = runBridge(script(), 'Responsive  box');
    expect(messages.find(m => m.type === 'glide:dom-tree').tree[0].text).toBe('Responsive box');
  });

  test.each(bridges)('the %s marks its repeated selection reports as refreshes', (_name, script) => {
    const { messages, listeners, el } = runBridge(script(), 'Box');
    const pointerdown = { target: el, shiftKey: false, ctrlKey: false, metaKey: false, button: 0, clientX: 20, clientY: 20, pointerId: 1,
      preventDefault() {}, stopPropagation() {} };
    for (const listener of listeners.pointerdown || listeners.mousedown || []) listener(pointerdown);
    const clicked = messages.filter(m => m.type === 'glide:overlay' && !m.isHover);
    expect(clicked.length).toBeGreaterThan(0);
    expect(clicked.every(m => !m.refresh)).toBe(true);
    messages.length = 0;
    for (const listener of listeners.scroll || []) listener({});
    const refreshed = messages.filter(m => m.type === 'glide:overlay' && !m.isHover);
    expect(refreshed.length).toBeGreaterThan(0);
    expect(refreshed.every(m => m.refresh === true)).toBe(true);
  });
});

describe('text edits', () => {
  const theme = loadTailwindTheme(os.tmpdir());
  const jsx = (code: string, value: string) =>
    transformJSXBatch(code, [{ line: 1, column: code.indexOf('<p') + 1, change: { type: 'text', value } }], { theme }).code;
  const template = (file: string, code: string, line: number, column: number, value: string) =>
    transformTemplateBatch(file, code, [{ line, column, change: { type: 'text', value } }], theme).code;

  test('a space typed at the end of the text does not stick to the next value', () => {
    expect(jsx('const A = () => <p>Typed </p>;', 'Typed h')).toBe('const A = () => <p>Typed h</p>;');
    expect(template('A.vue', '<template>\n  <p>Typed </p>\n</template>\n', 2, 3, 'Typed h')).toBe('<template>\n  <p>Typed h</p>\n</template>\n');
    expect(template('A.svelte', '<p>Typed </p>\n', 1, 1, 'Typed h')).toBe('<p>Typed h</p>\n');
    expect(template('A.astro', '<p>Typed </p>\n', 1, 1, 'Typed h')).toBe('<p>Typed h</p>\n');
    expect(template('index.html', '<p> Typed</p>\n', 1, 1, 'Typed')).toBe('<p>Typed</p>\n');
  });

  test('a space between the text and a sibling element is kept', () => {
    expect(jsx('const A = () => <p>Hello <b>x</b></p>;', 'Welcome')).toBe('const A = () => <p>Welcome <b>x</b></p>;');
    expect(template('A.vue', '<template>\n  <p>Hello <b>x</b></p>\n</template>\n', 2, 3, 'Welcome'))
      .toBe('<template>\n  <p>Welcome <b>x</b></p>\n</template>\n');
    expect(template('A.svelte', '<p><b>x</b> Hello</p>\n', 1, 1, 'Welcome')).toBe('<p><b>x</b> Welcome</p>\n');
  });

  test('line breaks around the text are kept as formatting', () => {
    expect(jsx('const A = () => <p>\n  Hello\n</p>;', 'Bye')).toBe('const A = () => <p>\n  Bye\n</p>;');
    expect(template('A.vue', '<template>\n  <p>\n    Hello\n  </p>\n</template>\n', 2, 3, 'Bye'))
      .toBe('<template>\n  <p>\n    Bye\n  </p>\n</template>\n');
    expect(template('A.svelte', '<p>\n  Hello\n</p>\n', 1, 1, 'Bye')).toBe('<p>\n  Bye\n</p>\n');
    expect(template('index.html', '<p>\n  Hello\n</p>\n', 1, 1, 'Bye')).toBe('<p>\n  Bye\n</p>\n');
  });
});
