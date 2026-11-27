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
    let selectedElement, selectedRect, selectedComputedStyles, selectedComputedSource = null, selectedSources = [], selectedRects = [], pendingStampRemaps = [];
    const selectionSnapshots = new Map();
    const document = { querySelectorAll() { return []; } };
    let draws = 0;
    function drawOverlay() { draws++; } function populatePropsFromComputed() {}
    ${fn('parseSource')} ${fn('normalizePathSlash')} ${fn('isSourceMatch')} ${fn('isSourceSelected')} ${fn('acceptSelection')}
    const data = { type: 'glide:overlay', source: 'App.tsx:1:1', rect: { x: 40, y: 25, width: 200, height: 50 } };
    (function() { ${branch('glide:overlay')} })();
  `, context);
  expect(vm.runInContext('selectedRect.y', context)).toBe(25);
  expect(vm.runInContext('draws', context)).toBe(1);
});

test('deselecting one of two selected elements restores the other one\'s tag, styles, text, and owners', () => {
  const context = vm.createContext({ createSourceMapping });
  vm.runInContext(`
    const sourceMapping = createSourceMapping();
    let currentFile = 'App.tsx', isResizing = false, isDragging = false, isPendingPositionUpdate = false;
    let selectedElement, selectedRect, selectedComputedStyles, selectedComputedSource = null, selectedSources = [], selectedRects = [], pendingStampRemaps = [];
    const selectionSnapshots = new Map(), populated = [];
    const document = { querySelectorAll() { return []; } };
    function drawOverlay() {} function resetEditScope() {} function showNoSelection() {}
    function populatePropsFromComputed(styles, rect, text) { populated.push({ styles, rect, text }); }
    ${fn('parseSource')} ${fn('normalizePathSlash')} ${fn('isSourceMatch')} ${fn('isSourceSelected')} ${fn('acceptSelection')}
    const rectA = { x: 0, y: 0, width: 100, height: 40 };
    const rectB = { x: 0, y: 50, width: 80, height: 20 };
    acceptSelection({ source: 'App.tsx:1:1', rect: rectA, owners: ['Hero'], computedStyles: { tagName: 'h1', color: 'rgb(10, 20, 30)' }, textContent: 'Title' });
    acceptSelection({ source: 'App.tsx:2:1', rect: rectB, isShift: true, owners: ['Card'], computedStyles: { tagName: 'p', color: 'rgb(99, 0, 0)' }, textContent: 'Body' });
    populated.length = 0;
    let data = { type: 'glide:element-deselected', source: 'App.tsx:2:1' };
    (function() { ${branch('glide:element-deselected')} })();
  `, context);
  expect(vm.runInContext('selectedElement', context)).toMatchObject({ source: 'App.tsx:1:1', tagName: 'h1', owners: ['Hero'] });
  expect(vm.runInContext('selectedComputedStyles', context)).toEqual({ tagName: 'h1', color: 'rgb(10, 20, 30)' });
  expect(vm.runInContext('selectedComputedSource', context)).toBe('App.tsx:1:1');
  expect(vm.runInContext('populated', context)).toEqual([
    { styles: { tagName: 'h1', color: 'rgb(10, 20, 30)' }, rect: { x: 0, y: 0, width: 100, height: 40 }, text: 'Title' },
  ]);
  vm.runInContext(`
    data = { type: 'glide:element-deselected', source: 'App.tsx:1:1' };
    (function() { ${branch('glide:element-deselected')} })();
  `, context);
  expect(vm.runInContext('selectedElement', context)).toBeNull();
  expect(vm.runInContext('selectedComputedStyles', context)).toBeNull();
  expect(vm.runInContext('selectedComputedSource', context)).toBeNull();
});

test('deselecting after a source remap keeps the remaining element\'s snapshot and drops deleted snapshots', () => {
  const context = vm.createContext({ createSourceMapping });
  vm.runInContext(`
    const sourceMapping = createSourceMapping();
    let currentFile = 'App.tsx', isResizing = false, isDragging = false, isPendingPositionUpdate = false;
    let selectedElement, selectedRect, selectedComputedStyles, selectedComputedSource = null, selectedSources = [], selectedRects = [], pendingStampRemaps = [];
    let glideClipboard = null;
    const selectionSnapshots = new Map(), fileDigests = new Map(), _styleTimers = new Map(), _pendingEdits = [];
    const document = { querySelectorAll() { return []; } };
    function drawOverlay() {} function populatePropsFromComputed() {} function resetEditScope() {}
    function showNoSelection() {} function clearOverlay() {} function setFileDigest() {} function trackStaleStamps() {}
    ${fn('parseSource')} ${fn('normalizePathSlash')} ${fn('isSourceMatch')} ${fn('isSourceSelected')} ${fn('applyTransactionMappings')} ${fn('acceptSelection')}
    const rect = { x: 0, y: 0, width: 10, height: 10 };
    acceptSelection({ source: 'App.tsx:1:1', rect, computedStyles: { tagName: 'h1', color: 'red' }, textContent: 'Hello' });
    acceptSelection({ source: 'App.tsx:2:1', rect, isShift: true, computedStyles: { tagName: 'p', color: 'blue' }, textContent: 'World' });
    applyTransactionMappings({
      success: true,
      selectionRemaps: [
        { oldSourceId: 'App.tsx:1:1', oldHash: '', newHash: 'aa11', newCoordinates: { line: 2, column: 1 } },
        { oldSourceId: 'App.tsx:2:1', oldHash: '', newHash: 'bb22', newCoordinates: { line: 3, column: 1 } },
      ],
    });
    const data = { type: 'glide:element-deselected', source: 'App.tsx:3:1:bb22' };
    (function() { ${branch('glide:element-deselected')} })();
  `, context);
  expect(vm.runInContext('selectedElement', context)).toMatchObject({ source: 'App.tsx:2:1:aa11', tagName: 'h1' });
  expect(vm.runInContext('selectedComputedStyles', context)).toEqual({ tagName: 'h1', color: 'red' });
  expect(vm.runInContext('selectedComputedSource', context)).toBe('App.tsx:2:1:aa11');
  expect(vm.runInContext('selectionSnapshots.size', context)).toBe(1);
  vm.runInContext(`applyTransactionMappings({ success: true, deletedSourceIds: ['App.tsx:2:1'] });`, context);
  expect(vm.runInContext('selectionSnapshots.size', context)).toBe(0);
  expect(vm.runInContext('selectedComputedStyles', context)).toBeNull();
  expect(vm.runInContext('selectedComputedSource', context)).toBeNull();
});

test('clearing selection empties selectionSnapshots and computed styles', () => {
  const context = vm.createContext({ createSourceMapping });
  vm.runInContext(`
    const sourceMapping = createSourceMapping();
    let currentFile = 'App.tsx', isPendingPositionUpdate = false;
    let selectedElement, selectedRect, selectedComputedStyles, selectedComputedSource = null, selectedSources = [], selectedRects = [], pendingStampRemaps = [];
    const selectionSnapshots = new Map();
    const document = { querySelectorAll() { return []; } };
    function populatePropsFromComputed() {} function clearOverlay() {} function showNoSelection() {}
    ${fn('parseSource')} ${fn('normalizePathSlash')} ${fn('isSourceMatch')} ${fn('isSourceSelected')} ${fn('acceptSelection')}
    const rect = { x: 0, y: 0, width: 10, height: 10 };
    acceptSelection({ source: 'App.tsx:1:1', rect, computedStyles: { tagName: 'h1' }, textContent: 'Title' });
    const data = { type: 'glide:clear-selection' };
    (function() { ${branch('glide:clear-selection')} })();
  `, context);
  expect(vm.runInContext('selectionSnapshots.size', context)).toBe(0);
  expect(vm.runInContext('selectedComputedStyles', context)).toBeNull();
  expect(vm.runInContext('selectedComputedSource', context)).toBeNull();
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
