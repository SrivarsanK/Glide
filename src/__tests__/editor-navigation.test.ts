import vm from 'node:vm';
import { parse } from '@babel/parser';
import { expect, test, vi } from 'vitest';
import { getEditorHTML } from '../../packages/overlay/src/editor-html.js';

const script = getEditorHTML().match(/<script>\s*([\s\S]*?)<\/script>/)![1];
const ast = parse(script);

function keyHandler(containing: string): string {
  let handler: any;
  function walk(node: any) {
    if (!node || typeof node !== 'object' || handler) return;
    if (node.type === 'CallExpression' && node.callee?.property?.name === 'addEventListener'
      && node.arguments[0]?.value === 'keydown') {
      const callback = node.arguments[1];
      if (script.slice(callback.start, callback.end).includes(containing)) handler = callback;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  }
  walk(ast);
  if (!handler) throw new Error('Missing served key handler: ' + containing);
  return script.slice(handler.start, handler.end);
}

const mainHandler = keyHandler('triggerGroup');
const spaceHandler = keyHandler('spaceHeld = true');

function harness() {
  const calls = {
    group: vi.fn(), ungroup: vi.fn(), fit: vi.fn(), selection: vi.fn(),
    help: vi.fn(), click: vi.fn(), send: vi.fn(), tool: vi.fn(), toast: vi.fn(),
  };
  const context = vm.createContext({
    triggerGroup: calls.group, triggerUngroup: calls.ungroup,
    fitToScreen: calls.fit, fitSelection: calls.selection,
    editorNavigation: { showHelp: calls.help },
    document: { getElementById: (id: string) => ({ click: () => calls.click(id), style: { display: 'none' } }) },
    socket: { readyState: 1, send: (value: string) => calls.send(JSON.parse(value)) },
    WebSocket: { OPEN: 1 }, showToast: calls.toast, setTool: calls.tool,
    selectedElement: null, selectedSources: [],
    spaceHeld: false, canvasContainer: { style: { cursor: 'default' } },
  });
  return { calls, context, handle: vm.runInContext('(' + mainHandler + ')', context) };
}

function event(key: string, extra: Record<string, unknown> = {}) {
  return {
    key, code: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false,
    target: { closest: () => null }, preventDefault: vi.fn(), ...extra,
  };
}

test('Ctrl+G groups and Ctrl+Shift+G ungroups without changing the grid', () => {
  const { calls, handle } = harness();
  handle(event('g', { ctrlKey: true }));
  handle(event('G', { ctrlKey: true, shiftKey: true }));
  expect(calls.group).toHaveBeenCalledTimes(1);
  expect(calls.ungroup).toHaveBeenCalledTimes(1);
  expect(calls.click).not.toHaveBeenCalled();
});

test.each(['ctrlKey', 'metaKey'])('%s + Shift+Z sends redo only', modifier => {
  const { calls, handle } = harness();
  handle(event('Z', { [modifier]: true, shiftKey: true }));
  expect(calls.send.mock.calls).toEqual([[{ type: 'redo' }]]);
});

test('Shift+G uses the visible grid control', () => {
  const { calls, handle } = harness();
  handle(event('G', { shiftKey: true }));
  expect(calls.click).toHaveBeenCalledWith('btn-toggle-grid-nav');
  expect(calls.group).not.toHaveBeenCalled();
});

test('Shift+1 fits the frame, Shift+2 fits the selection, and ? opens help', () => {
  const { calls, handle } = harness();
  handle(event('!', { shiftKey: true, code: 'Digit1' }));
  handle(event('@', { shiftKey: true, code: 'Digit2' }));
  handle(event('?', { shiftKey: true }));
  expect(calls.fit).toHaveBeenCalledTimes(1);
  expect(calls.selection).toHaveBeenCalledTimes(1);
  expect(calls.help).toHaveBeenCalledTimes(1);
});

test.each(['input', 'textarea', 'select', '[contenteditable]:not([contenteditable="false"])'])
  ('typing in %s does not run editor shortcuts', selector => {
    const { calls, handle } = harness();
    const e = event('g', { ctrlKey: true, target: { closest: (query: string) => query.includes(selector) ? {} : null } });
    handle(e);
    expect(calls.group).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

test('Space in a textarea preserves text entry; canvas Space enables panning', () => {
  const { context } = harness();
  const handle = vm.runInContext('(' + spaceHandler + ')', context);
  const typing = event(' ', {
    code: 'Space', target: { closest: (query: string) => query.includes('textarea') ? {} : null },
  });
  handle(typing);
  expect(typing.preventDefault).not.toHaveBeenCalled();
  expect(vm.runInContext('spaceHeld', context)).toBe(false);
  const canvas = event(' ', { code: 'Space' });
  handle(canvas);
  expect(canvas.preventDefault).toHaveBeenCalledTimes(1);
  expect(vm.runInContext('canvasContainer.style.cursor', context)).toBe('grab');
});
