import vm from 'node:vm';
import { parse } from '@babel/parser';
import { describe, expect, test } from 'vitest';
import { getEditorHTML } from '../../packages/overlay/src/editor-html.js';

const script = getEditorHTML().match(/<script>\s*([\s\S]*?)<\/script>/)?.[1] ?? '';
const ast = parse(script);
const functionNames = new Set([
  'framePointFromClient', 'zoomCanvasTo', 'applyTransform',
  'setIframeWidth', 'setIframeHeight', 'fitToScreen',
]);
const functions = ast.program.body
  .filter(node => node.type === 'FunctionDeclaration' && functionNames.has(node.id?.name ?? ''))
  .map(node => script.slice(node.start!, node.end!)).join('\n');

function messageBranch(type: string): string {
  const start = script.indexOf(`if (data.type === '${type}')`);
  function find(node: unknown): { start: number; end: number } | undefined {
    if (!node || typeof node !== 'object') return;
    const candidate = node as Record<string, unknown>;
    if (candidate.type === 'IfStatement' && candidate.start === start) {
      return candidate as unknown as { start: number; end: number };
    }
    for (const value of Object.values(candidate)) {
      if (Array.isArray(value)) {
        for (const child of value) {
          const found = find(child);
          if (found) return found;
        }
      } else if (value && typeof value === 'object') {
        const found = find(value);
        if (found) return found;
      }
    }
  }
  const node = find(ast);
  if (!node) throw new Error(`Missing message branch: ${type}`);
  return script.slice(node.start, node.end);
}

function canvasHarness() {
  const context = vm.createContext({});
  vm.runInContext(`
    let zoomLevel = 0.5, panX = 73, panY = -42;
    const iframeWidth = { current: 800 };
    let rulerUpdates = 0;
    function drawRulers() { rulerUpdates++; }
    function style() {
      return { removeProperty(key) { delete this[key]; } };
    }
    const frame = {
      style: style(), dataset: {},
      get clientWidth() { return parseFloat(this.style.width) || 800; },
      get clientHeight() { return parseFloat(this.style.height) || 600; },
      getBoundingClientRect() {
        return {
          left: 890 + panX - this.clientWidth * zoomLevel / 2,
          top: 520 + panY - this.clientHeight * zoomLevel / 2,
          width: this.clientWidth * zoomLevel, height: this.clientHeight * zoomLevel,
        };
      },
      contentWindow: { postMessage() {} },
    };
    const wrapper = { style: style() };
    const container = {
      clientWidth: 1200, clientHeight: 800,
      getBoundingClientRect() { return { left: 290, top: 120, width: 1200, height: 800 }; },
    };
    const elements = {
      'app-iframe': frame, 'frame-wrapper': wrapper, 'canvas-container': container,
      'canvas-viewport': { style: style() }, 'zoom-label': {},
      'draw-zoom-select': {}, 'canvas-loading': { style: style() },
    };
    const document = { getElementById(id) { return elements[id] || null; } };
    let layerTree = [{ id: 'existing' }];
    let expandedNodeIds = new Set();
    const snapObjectEnabled = true, snapPixelEnabled = true;
    function renderLayersTree() {}
    ${functions}
    function receive(data) {
      ${messageBranch('glide:document-height')}
      ${messageBranch('glide:dom-tree')}
    }
  `, context);
  return (code: string) => vm.runInContext(code, context);
}

describe('served canvas viewport behavior', () => {
  test('converts client coordinates from the actual panned and scaled iframe bounds', () => {
    const run = canvasHarness();
    expect(run('framePointFromClient(813, 428)')).toEqual({ x: 100, y: 200 });
    expect(run('framePointFromClient(713, 303)')).toEqual({ x: -100, y: -50 });
  });

  test('keeps the same source point underneath the pointer across zoom changes', () => {
    const run = canvasHarness();
    const before = run('framePointFromClient(813, 428)');
    run('zoomCanvasTo(1.75, 813, 428)');
    expect(run('framePointFromClient(813, 428)')).toEqual(before);
    run('zoomCanvasTo(0.2, 813, 428)');
    const after = run('framePointFromClient(813, 428)');
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  test('keeps selected viewport resolution when document content changes repeatedly', () => {
    const run = canvasHarness();
    run(`
      wrapper.style.height = '2040px';
      setIframeWidth(375);
      setIframeHeight(812);
      for (const height of [2000, 4000, 6000, 1000]) {
        receive({ type: 'glide:document-height', height });
        receive({ type: 'glide:dom-tree', tree: [] });
      }
    `);
    expect(run('frame.clientWidth')).toBe(375);
    expect(run('frame.clientHeight')).toBe(812);
    expect(run('wrapper.style.height')).toBeUndefined();
    expect(run('frame.dataset.documentHeight')).toBe('1000');
  });

  test('fits small host windows without negative scale or altering source viewport size', () => {
    const run = canvasHarness();
    run('container.clientWidth = 60; container.clientHeight = 50; fitToScreen()');
    expect(run('zoomLevel')).toBeGreaterThan(0);
    expect(run('({ x: panX, y: panY })')).toEqual({ x: 0, y: 0 });
    expect(run('frame.clientWidth')).toBe(800);
    expect(run('frame.clientHeight')).toBe(600);
  });
});
