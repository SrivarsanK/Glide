import vm from 'node:vm';
import { parse } from '@babel/parser';
import { expect, test } from 'vitest';
import { getEditorHTML } from '../../packages/overlay/src/editor-html.js';
import { createSourceMapping } from '../../packages/overlay/src/source-mapping.js';

const script = getEditorHTML().match(/<script>\s*([\s\S]*?)<\/script>/)![1];
const ast = parse(script);
function extract(predicate: (node: any) => boolean): string {
  let found: any;
  function walk(node: any) {
    if (!node || typeof node !== 'object' || found) return;
    if (predicate(node)) { found = node; return; }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  }
  walk(ast);
  if (!found) throw new Error('Missing served code');
  return script.slice(found.start, found.end);
}
const fn = (name: string) => extract(node => node.type === 'FunctionDeclaration' && node.id?.name === name);
const branch = (name: string) => extract(node => node.type === 'IfStatement' && script.slice(node.start, node.consequent.start).includes(`data.type === '${name}'`));

test('hovering another component never requests its tree or replaces the active file', () => {
  const context = vm.createContext({ createSourceMapping });
  vm.runInContext(`
    const sourceMapping = createSourceMapping(), sourceFileAliases = new Map();
    let currentFile = 'src/App.tsx', layerTree = [{}], lastRequestedTreeFile = null;
    const sent = [], WebSocket = { OPEN: 1 }, socket = { readyState: 1, send(value) { sent.push(value); } };
    ${fn('normalizePathSlash')} ${fn('sameSourceFile')} ${fn('parseSource')} ${fn('updateLayersPanel')}
    for (let i = 0; i < 20; i++) updateLayersPanel({ type: 'glide:element-hovered', source: 'src/Header.tsx:1:1' });
  `, context);
  expect(vm.runInContext('sent.length', context)).toBe(0);
  expect(vm.runInContext('currentFile', context)).toBe('src/App.tsx');
});

test('selection bounds remain live while a persisted position update is pending', () => {
  const context = vm.createContext({ createSourceMapping });
  vm.runInContext(`
    const sourceMapping = createSourceMapping();
    let currentFile = 'App.tsx', isResizing = false, isDragging = false, isPendingPositionUpdate = true;
    let selectedElement, selectedRect, selectedComputedStyles, selectedSources = [], selectedRects = [];
    const document = { querySelectorAll() { return []; } };
    let draws = 0;
    function drawOverlay() { draws++; } function populatePropsFromComputed() {}
    ${fn('parseSource')}
    const data = { type: 'glide:overlay', source: 'App.tsx:1:1', rect: { x: 40, y: 25, width: 200, height: 50 } };
    (function() { ${branch('glide:overlay')} })();
  `, context);
  expect(vm.runInContext('selectedRect.y', context)).toBe(25);
  expect(vm.runInContext('draws', context)).toBe(1);
});

test('resolved relative and absolute file aliases do not repeatedly reload the tree', () => {
  const context = vm.createContext({ createSourceMapping });
  vm.runInContext(`
    const sourceMapping = createSourceMapping();
    const sourceFileAliases = new Map([['src/App.tsx', 'C:/project/src/App.tsx']]);
    const document = { querySelectorAll() { return []; } };
    let currentFile = 'C:/project/src/App.tsx', layerTree = [{}], lastRequestedTreeFile = null;
    const sent = [], WebSocket = { OPEN: 1 }, socket = { readyState: 1, send(value) { sent.push(value); } };
    ${fn('normalizePathSlash')} ${fn('sameSourceFile')} ${fn('parseSource')} ${fn('updateLayersPanel')}
    for (let i = 0; i < 20; i++) updateLayersPanel({ type: 'glide:element-selected', source: 'src/App.tsx:1:1' });
  `, context);
  expect(vm.runInContext('sent.length', context)).toBe(0);
});

test.each(['Other.tsx', 'App.tsx'])('dragging over %s preserves file boundaries', destination => {
  const context = vm.createContext({ createSourceMapping, destination });
  vm.runInContext(`
    const sourceMapping = createSourceMapping(), sourceFileAliases = new Map();
    let currentFile = 'UnrelatedPanel.tsx', isDragging = true, isPendingPositionUpdate = false;
    let selectedRect, selectedRects = [{}];
    const sent = [], positions = [], window = {}, WebSocket = { OPEN: 1 };
    const socket = { readyState: 1, send(value) { sent.push(JSON.parse(value)); } };
    const document = { getElementById() { return null; } };
    function clearTimeout() {} function setTimeout() { return 1; }
    function renderSnapGuides() {} function drawOverlay() {}
    function sendPositionChange(...args) { positions.push(args); }
    ${fn('normalizePathSlash')} ${fn('sameSourceFile')} ${fn('parseSource')}
    const _sg = { isEmpty: false, getById() { return { parent: { id: 'App.tsx:1:1' } }; },
      hitTest() { return { id: destination + ':3:1', tag: 'div', isStamped: true, children: [] }; } };
    const data = { type: 'glide:element-drag-end', source: 'App.tsx:2:1', dx: 20, dy: 30,
      rect: { x: 20, y: 30, width: 100, height: 40 } };
    (function() { ${branch('glide:element-drag-end')} })();
  `, context);
  expect(vm.runInContext('sent.length', context)).toBe(0);
  expect(vm.runInContext('positions.length', context)).toBe(1);
});

test('workspace mutations carry the file digest the server checks', () => {
  const context = vm.createContext({ createSourceMapping });
  vm.runInContext(`
    const sourceMapping = createSourceMapping(), sourceFileAliases = new Map(), fileDigests = new Map();
    let currentFile = 'src/App.tsx';
    const sent = [], toasts = [], WebSocket = { OPEN: 1 };
    const socket = { readyState: 1, send(value) { sent.push(JSON.parse(value)); } };
    function showToast(kind, message) { toasts.push(message); }
    ${fn('normalizePathSlash')} ${fn('sameSourceFile')} ${fn('parseSource')} ${fn('mutateWorkspace')}
    mutateWorkspace('src/App.tsx:4:7', { type: 'detach', workspaceId: 'one', x: 0, y: 0 });
    fileDigests.set('src/App.tsx', 'abc123');
    mutateWorkspace('src/App.tsx:4:7', { type: 'workspace-position', x: 10, y: 20 });
  `, context);
  expect(vm.runInContext('toasts.length', context)).toBe(1);
  expect(vm.runInContext('sent', context)).toMatchObject([
    { type: 'edit', file: 'src/App.tsx', line: 4, column: 7, expectedDigest: 'abc123', change: { type: 'workspace-position' } },
  ]);
});
