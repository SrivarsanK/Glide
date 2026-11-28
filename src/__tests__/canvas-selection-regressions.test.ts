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

test('hand tool uses iframe blocker and Space+drag pans even in select tool', () => {
  expect(script).toMatch(/hand:\s*\{[^}]*needsBlocker:\s*true/);
  expect(script).toMatch(/currentTool === 'hand'\s*\|\|\s*spaceHeld/);
});

test('drawSelectionBox has no duplicate window resize listeners and resize emits only the dragged axis with smooth min-size clamp', () => {
  const drawBox = fn('drawSelectionBox');
  expect(drawBox).not.toContain('onHandleMove');
  expect(drawBox).not.toContain('onHandleUp');

  // Verify pointermove + pointerup resize math directly from the served editor script
  const moveBranch = extract(node => node.type === 'IfStatement' && script.slice(node.start, node.consequent.start).includes('isResizing && startRect && selectedElement'));
  const upBranch = extract(node => node.type === 'IfStatement' && script.slice(node.start, node.consequent.start).includes('isResizing && startRect && selectedElement') && script.slice(node.start, node.end).includes('sendPositionChange'));
  const context = vm.createContext({});
  vm.runInContext(`
    const optimistic = [], committed = [];
    const blocker = { style: { display: 'block' }, hasPointerCapture: () => false, releasePointerCapture() {} };
    const document = {
      getElementById: (id) => (id === 'iframe-blocker' ? blocker : null),
      createElementNS: () => ({ setAttribute() {}, appendChild() {} }),
    };
    const window = {};
    function clearTimeout() {} function setTimeout() { return 1; }
    function drawOverlay() {}
    function applyOptimisticStyle(src, styles) { optimistic.push({ src, styles }); }
    function sendPositionChange(src, styles) { committed.push({ src, styles }); }
    let zoomLevel = 1, isResizing = true, isPendingPositionUpdate = false;
    let selectedElement = { source: 'App.tsx:2:1' };
    let selectedRect = { x: 100, y: 50, width: 120, height: 21 };
    let selectedRects = [selectedRect];
    let startRect = { x: 100, y: 50, width: 120, height: 21 };
    let startPointerX = 220, startPointerY = 60, resizeInitialLeft = 0, resizeInitialTop = 0;
    let resizeFinalW = 120, resizeFinalH = 21, resizeDir = 'mr';
    let resizePointerId = null;
    // 1. Horizontal-only drag on mr handle (+50px) must emit ONLY width, never height
    let e = { clientX: 270, clientY: 65, pointerId: 1 };
    (function() { ${moveBranch} })();
    (function() { ${upBranch} })();
    // 2. Left handle dragged past min width (dx = +150 on width 120 -> width clamped to 10, left shifted +110)
    isResizing = true; startRect = { x: 100, y: 50, width: 120, height: 21 };
    startPointerX = 100; startPointerY = 60; resizeInitialLeft = 0; resizeInitialTop = 0;
    resizeFinalW = 120; resizeFinalH = 21; resizeDir = 'ml';
    e = { clientX: 250, clientY: 60, pointerId: 2 };
    (function() { ${moveBranch} })();
    (function() { ${upBranch} })();
  `, context);
  const committed = vm.runInContext('committed', context);
  expect(committed[0].styles).toEqual({ width: '170px' });
  expect(committed[1].styles).toEqual({ width: '10px', left: '110px' });
});

test('preview mode ignores glide:overlay and blocks Escape/Delete leaks', () => {
  const context = vm.createContext({ createSourceMapping });
  vm.runInContext(`
    const sourceMapping = createSourceMapping();
    let currentFile = 'App.tsx', isResizing = false, isDragging = false, interactionPreview = true;
    let selectedElement = null, selectedRect = null, selectedComputedStyles = null, selectedComputedSource = null;
    let selectedSources = [], selectedRects = [], pendingStampRemaps = [];
    const selectionSnapshots = new Map();
    const document = { querySelectorAll() { return []; } };
    let draws = 0;
    function drawOverlay() { draws++; } function populatePropsFromComputed() {}
    ${fn('parseSource')} ${fn('normalizePathSlash')} ${fn('isSourceMatch')} ${fn('isSourceSelected')} ${fn('acceptSelection')}
    const data = { type: 'glide:overlay', source: 'App.tsx:1:1', rect: { x: 40, y: 25, width: 200, height: 50 } };
    (function() { ${branch('glide:overlay')} })();
  `, context);
  expect(vm.runInContext('selectedElement', context)).toBeNull();
  expect(vm.runInContext('draws', context)).toBe(0);

  // Escape handler must post glide:clear-selection to iframe and clear layer highlights
  const escapeBranch = extract(node => node.type === 'IfStatement' && script.slice(node.start, node.consequent.start).includes("key === 'Escape'"));
  expect(escapeBranch).toContain('glide:clear-selection');
  expect(escapeBranch).toContain('workspaceCanvas.clearSelection');
});

test('inline text edit preserves selectedElement owners/tagName and remaps stale coordinates', () => {
  const inlineBranch = branch('glide:inline-text-edit');
  const context = vm.createContext({ createSourceMapping });
  vm.runInContext(`
    const sourceMapping = createSourceMapping();
    let currentFile = 'App.tsx';
    let pendingStampRemaps = [{ oldSourceId: 'App.tsx:2:1', oldHash: '', newHash: 'abcd', newCoordinates: { line: 4, column: 3 } }];
    let selectedElement = { source: 'App.tsx:4:3:abcd', owners: [{ name: 'Card' }], tagName: 'p' };
    const sent = [];
    function sendEdit(change) { sent.push({ selected: selectedElement, change }); }
    const data = { type: 'glide:inline-text-edit', source: 'App.tsx:2:1', value: 'Updated' };
    (function() { ${inlineBranch} })();
  `, context);
  const sent = vm.runInContext('sent', context);
  expect(sent).toEqual([{
    selected: { source: 'App.tsx:4:3:abcd', owners: [{ name: 'Card' }], tagName: 'p' },
    change: { type: 'text', value: 'Updated' },
  }]);
});

test('fill mode select stays outside fill-solid-controls, gradType is declared, and fill +/- buttons are wired', () => {
  const html = getEditorHTML();
  const solidStart = html.indexOf('id="fill-solid-controls"');
  const gradStart = html.indexOf('id="fill-gradient-controls"');
  expect(solidStart).toBeGreaterThan(-1);
  expect(gradStart).toBeGreaterThan(solidStart);
  const solidBlock = html.slice(solidStart, gradStart);
  expect(solidBlock).not.toContain('id="fill-mode-select"');
  expect(html).toContain('id="fill-mode-select"');
  expect(script).toMatch(/let\s+gradType\s*=\s*'linear'/);
  expect(script).toContain("getElementById('btn-add-fill')");
  expect(script).toContain("getElementById('btn-remove-fill')");
});

test('formatCssLength preserves CSS units and unitless line-height without producing 150%px', () => {
  const context = vm.createContext({});
  vm.runInContext(`${fn('formatCssLength')}`, context);
  const fmt = (raw: string, unitless = false) => vm.runInContext('formatCssLength', context)(raw, unitless);
  expect(fmt('150%', true)).toBe('150%');
  expect(fmt('1.5', true)).toBe('1.5');
  expect(fmt('24px', true)).toBe('24px');
  expect(fmt('normal', true)).toBe('normal');
  expect(fmt('16', false)).toBe('16px');
  expect(fmt('-4.5', false)).toBe('-4.5px');
  expect(fmt('1.5rem', false)).toBe('1.5rem');
  expect(fmt('auto', false)).toBe('auto');
  expect(fmt('', false)).toBe('');
});

test('W/H mode reads authored inlineStyle and Tailwind classes instead of snapping back to fixed', () => {
  const context = vm.createContext({});
  vm.runInContext(`
    const elems = new Map();
    const el = (id) => {
      if (!elems.has(id)) elems.set(id, { id, value: '', disabled: false, style: {}, classList: { toggle() {} }, setAttribute() {} });
      return elems.get(id);
    };
    const document = { activeElement: null, getElementById: el };
    let gradType = 'linear';
    function showPropsPanel() {}
    function setActiveBtn() {}
    function setFillMode() {}
    function rgbToHex(v) { return v || '#000000'; }
    function rotationFromTransform() { return 0; }
    ${fn('parsePixels')}
    ${fn('populatePropsFromComputed')}
    populatePropsFromComputed({ width: '240px', height: '40px', inlineStyle: 'width: fit-content; height: 100%;' }, { x: 0, y: 0, width: 240, height: 40 });
    const inlineModes = { w: el('prop-w-mode').value, h: el('prop-h-mode').value };
    populatePropsFromComputed({ width: '240px', height: '40px', className: 'w-full h-fit p-2' }, { x: 0, y: 0, width: 240, height: 40 });
    const classModes = { w: el('prop-w-mode').value, h: el('prop-h-mode').value };
  `, context);
  expect(vm.runInContext('inlineModes', context)).toEqual({ w: 'hug', h: 'fill' });
  expect(vm.runInContext('classModes', context)).toEqual({ w: 'fill', h: 'hug' });
});

test('border swatch binds prop-border-color, section action icons do not collapse, shadows commit boxShadow, and color popup clamps to viewport', () => {
  expect(script).toMatch(/color-swatch-border[\s\S]{0,220}hexInputId:\s*'prop-border-color'/);
  expect(script).toContain('applyShadowsToElement');
  expect(script).not.toContain('shadow-color-input');

  const context = vm.createContext({});
  vm.runInContext(`
    let _cpTarget = null;
    const popup = { style: { display: 'none', left: '0px', top: '0px' }, offsetHeight: 210 };
    const hexInp = { value: '', select() {}, focus() {} };
    const prev = { style: {} };
    const swatch = { style: { background: '#ff0000' } };
    const document = {
      getElementById: (id) => ({ 'glide-color-popup': popup, 'color-popup-hex': hexInp, 'color-popup-preview': prev, 'color-swatch-border': swatch }[id] || null),
    };
    const window = { innerWidth: 1200, innerHeight: 600 };
    function setTimeout() { return 1; }
    ${fn('cssColorToHex')}
    ${fn('openColorPopup')}
    openColorPopup({ getBoundingClientRect: () => ({ left: 1050, top: 560, bottom: 580, width: 20, height: 20 }) },
      { swatchId: 'color-swatch-border', styleProp: 'borderColor', hexInputId: 'prop-border-color', isGradient: false, isGradEnd: false });
  `, context);
  const top = parseFloat(vm.runInContext('popup.style.top', context));
  const left = parseFloat(vm.runInContext('popup.style.left', context));
  expect(top).toBeGreaterThanOrEqual(4);
  expect(top + 210).toBeLessThanOrEqual(600);
  expect(left + 220).toBeLessThanOrEqual(1200);
});

test('applyTransactionMappings remaps stagedEdits keys, coordinates, and expectedDigest and drops deleted entries', () => {
  const context = vm.createContext({ createSourceMapping });
  vm.runInContext(`
    const sourceMapping = createSourceMapping();
    const sourceFileAliases = new Map(), selectionSnapshots = new Map(), fileDigests = new Map();
    const _styleTimers = new Map(), _pendingEdits = [];
    const stagedEdits = new Map();
    let currentFile = 'App.tsx', selectedElement = null, selectedRects = [], selectedComputedStyles = null;
    let selectedComputedSource = null, selectedSources = [], glideClipboard = null, pendingStampRemaps = [];
    function clearOverlay() {} function showNoSelection() {} function trackStaleStamps() {} function updateStagingBarUI() {}
    ${fn('normalizePathSlash')} ${fn('sameSourceFile')} ${fn('setFileDigest')} ${fn('parseSource')} ${fn('applyTransactionMappings')}
    stagedEdits.set('App.tsx:2:1', new Map([
      ['k1', { change: { type: 'class', property: 'color', value: 'red' }, parsed: { file: 'App.tsx', line: 2, column: 1, hash: null, expectedDigest: 'd1' }, previewTarget: 'App.tsx:2:1', timestamp: 1 }],
    ]));
    stagedEdits.set('App.tsx:5:1', new Map([
      ['k2', { change: { type: 'class', property: 'padding', value: '8px' }, parsed: { file: 'App.tsx', line: 5, column: 1, hash: null, expectedDigest: 'd1' }, previewTarget: 'App.tsx:5:1', timestamp: 2 }],
    ]));
    applyTransactionMappings({
      success: true,
      changedFiles: [{ path: 'App.tsx', newDigest: 'd2' }],
      selectionRemaps: [{ oldSourceId: 'App.tsx:2:1', oldHash: '', newHash: 'aa11', newCoordinates: { line: 3, column: 1 } }],
      deletedSourceIds: ['App.tsx:5:1'],
    });
  `, context);
  expect(vm.runInContext('stagedEdits.has("App.tsx:5:1")', context)).toBe(false);
  expect(vm.runInContext('stagedEdits.has("App.tsx:3:1:aa11")', context)).toBe(true);
  const remappedItem = vm.runInContext('stagedEdits.get("App.tsx:3:1:aa11").get("k1")', context);
  expect(remappedItem.parsed).toMatchObject({ file: 'App.tsx', line: 3, column: 1, hash: 'aa11', expectedDigest: 'd2' });
});

test('staged Before/After previews style, layout, text, and call-site scope targets on the live DOM element', () => {
  const context = vm.createContext({ createSourceMapping });
  vm.runInContext(`
    const sourceMapping = createSourceMapping();
    const sourceFileAliases = new Map(), fileDigests = new Map();
    const stagedEdits = new Map();
    const posted = [];
    let currentFile = 'App.tsx', pendingBatch = null, previewState = 'after';
    const iframe = { contentWindow: { postMessage(msg) { posted.push(msg); } } };
    const document = { getElementById: (id) => (id === 'app-iframe' ? iframe : null) };
    const mutationScope = {
      capture: (c) => c,
      entries: (c) => [{ key: c.type + ':' + (c.property || 'val'), change: c }],
    };
    function showToast() {} function updateStagingBarUI() {}
    ${fn('normalizePathSlash')} ${fn('sameSourceFile')} ${fn('setFileDigest')} ${fn('getFileDigest')} ${fn('parseSource')}
    ${fn('previewStyleInIframe')} ${fn('clearPreviewInIframe')} ${fn('stageEdit')} ${fn('togglePreviewMode')}
    setFileDigest('Parent.tsx', 'dig-p');
    setFileDigest('App.tsx', 'dig-a');
    stageEdit('Parent.tsx:10:5', { type: 'style', value: { color: 'red' } }, 'Button.tsx:4:3');
    stageEdit('App.tsx:2:1', { type: 'text', value: 'Updated' }, 'App.tsx:2:1');
    const initialPosted = posted.slice();
    posted.length = 0;
    togglePreviewMode(); // -> before
    const beforePosted = posted.slice();
    posted.length = 0;
    togglePreviewMode(); // -> after
    const afterPosted = posted.slice();
  `, context);
  expect(vm.runInContext('initialPosted', context)).toEqual([
    { type: 'glide:preview-style', sourceId: 'Button.tsx:4:3', styles: { color: 'red' } },
    { type: 'glide:preview-text', source: 'App.tsx:2:1', value: 'Updated' },
  ]);
  expect(vm.runInContext('beforePosted', context)).toEqual([{ type: 'glide:clear-preview', sourceId: undefined }]);
  expect(vm.runInContext('afterPosted', context)).toEqual([
    { type: 'glide:preview-style', sourceId: 'Button.tsx:4:3', styles: { color: 'red' } },
    { type: 'glide:preview-text', source: 'App.tsx:2:1', value: 'Updated' },
  ]);
});

test('Windows drive-letter case normalization, selectedRect x/y coordinates, iframe.onload reset, and component row clear', () => {
  const context = vm.createContext({});
  vm.runInContext(`
    const sourceFileAliases = new Map(), fileDigests = new Map();
    ${fn('normalizePathSlash')} ${fn('sameSourceFile')} ${fn('setFileDigest')} ${fn('getFileDigest')}
    setFileDigest('C:\\\\project\\\\src\\\\App.tsx', 'win-digest');
    const fetchedLower = getFileDigest('c:/project/src/App.tsx');
    const fetchedUpper = getFileDigest('C:/project/src/App.tsx');
  `, context);
  expect(vm.runInContext('fetchedLower', context)).toBe('win-digest');
  expect(vm.runInContext('fetchedUpper', context)).toBe('win-digest');

  // triggerFlyingReaction and #menu-comment must read selectedRect.x/y (not undefined .left/.top)
  const reactionCtx = vm.createContext({});
  vm.runInContext(`
    const spawned = [];
    const document = {
      body: { appendChild(el) { spawned.push(el); } },
      createElement() { return { className: '', textContent: '', style: { setProperty() {} }, addEventListener() {} }; },
    };
    const window = { innerWidth: 1000, innerHeight: 800 };
    const selectedRect = { x: 120, y: 240, width: 80, height: 40 };
    function setTimeout(fn) { fn(); }
    ${fn('triggerFlyingReaction')}
    triggerFlyingReaction('🔥');
  `, reactionCtx);
  const spawned = vm.runInContext('spawned', reactionCtx);
  expect(spawned.length).toBe(4);
  expect(spawned[0].style.left).not.toContain('NaN');
  expect(spawned[0].style.top).not.toContain('NaN');
  expect(script).not.toContain('selectedRect.left + selectedRect.width / 2');

  // Route navigation resets selection and layerTree (while same-URL HMR reload preserves active inspector)
  const resetNavFn = fn('resetNavigationState');
  expect(resetNavFn).toContain('selectedElement = null');
  expect(resetNavFn).toContain('layerTree = null');
  expect(resetNavFn).toContain('resetEditScope()');
  expect(fn('_doLoadApp')).toContain('resetNavigationState()');
  expect(branch('glide:ready')).toContain('resetNavigationState()');
  const renderLayersFn = fn('renderLayersTree');
  expect(renderLayersFn).toMatch(/if\s*\(isComponent\)\s*\{[\s\S]{0,600}clearOverlay\(\)/);
});
