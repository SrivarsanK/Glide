import { describe, expect, test, vi, beforeEach } from 'vitest';
import vm from 'vm';
import { buildBridgeScript } from '../../packages/vite-plugin/src/index.js';
import { buildGlideBridgeInlineScript } from '../../packages/server/src/ws-server.js';
import { DEFAULT_CONFIG } from '../../packages/core/src/index.js';


describe('Bridge Script Syntax & Integrity', () => {
  test('buildBridgeScript should compile without syntax error in V8', () => {
    const scriptCode = buildBridgeScript('data-gl-source', 'data-glide-hover', 'data-glide-selected', 5);
    expect(() => new vm.Script(scriptCode)).not.toThrow();
  });

  test('buildGlideBridgeInlineScript should compile without syntax error in V8', () => {
    const raw = buildGlideBridgeInlineScript(DEFAULT_CONFIG);
    const cleaned = raw.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    expect(() => new vm.Script(cleaned)).not.toThrow();
  });

  test('buildGlideBridgeInlineScript should execute serializeDOMNode and sendDOMTree without runtime ReferenceError', () => {
    const raw = buildGlideBridgeInlineScript(DEFAULT_CONFIG);
    const cleaned = raw.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    const messages: any[] = [];
    const sandbox = {
      window: {
        __glide_initialized__: false,
        get top() { return {}; },
        parent: {
          postMessage: (data: any) => messages.push(data)
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        getComputedStyle: () => ({})
      },
      document: {
        head: { appendChild: () => {} },
        createElement: () => ({ id: '', textContent: '', appendChild: () => {} }),
        addEventListener: () => {},
        readyState: 'complete',
        body: {
          children: [
            {
              nodeType: 1,
              tagName: 'DIV',
              className: 'hero-card p-4',
              childNodes: [{ nodeType: 3, textContent: 'Hero Title' }],
              children: [],
              getAttribute: (attr: string) => (attr === 'data-gl-source' ? 'src/App.tsx:10:5' : null),
              hasAttribute: (attr: string) => attr === 'data-gl-source',
              getBoundingClientRect: () => ({ left: 10, top: 10, right: 110, bottom: 50, width: 100, height: 40 })
            }
          ]
        },
        querySelectorAll: () => [],
        querySelector: () => null
      },
      setTimeout: (fn: any) => fn(),
      clearTimeout: () => {},
      Math,
      String,
      console
    };
    (sandbox.window as any).window = sandbox.window;
    (sandbox.window as any).document = sandbox.document;

    const script = new vm.Script(cleaned);
    const context = vm.createContext(sandbox);
    expect(() => script.runInContext(context)).not.toThrow();
    expect(messages.some(m => m.type === 'glide:dom-tree')).toBe(true);
    expect(messages.some(m => m.type === 'glide:scene-nodes')).toBe(true);
    const domTreeMsg = messages.find(m => m.type === 'glide:dom-tree');
    expect(domTreeMsg.tree[0].className).toBe('hero-card p-4');
  });

  test('buildBridgeScript should execute serializeDOMNode and sendDOMTree without runtime ReferenceError', () => {
    const scriptCode = buildBridgeScript('data-gl-source', 'data-glide-hover', 'data-glide-selected', 5);
    const messages: any[] = [];
    const sandbox = {
      window: {
        __glide_initialized__: false,
        get top() { return {}; },
        parent: {
          postMessage: (data: any) => messages.push(data)
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        getComputedStyle: () => ({})
      },
      document: {
        head: { appendChild: () => {} },
        createElement: () => ({ id: '', textContent: '', appendChild: () => {} }),
        addEventListener: () => {},
        readyState: 'complete',
        body: {
          firstElementChild: {
            getAttribute: () => 'src/App.tsx:1:1'
          },
          children: [
            {
              nodeType: 1,
              tagName: 'SPAN',
              className: 'badge text-sm',
              childNodes: [{ nodeType: 3, textContent: 'New' }],
              children: [],
              getAttribute: (attr: string) => (attr === 'data-gl-source' ? 'src/App.tsx:1:1' : null),
              hasAttribute: (attr: string) => attr === 'data-gl-source',
              getBoundingClientRect: () => ({ left: 20, top: 20, right: 80, bottom: 40, width: 60, height: 20 })
            }
          ]
        },
        querySelectorAll: () => [],
        querySelector: () => null
      },
      setTimeout: (fn: any) => fn(),
      clearTimeout: () => {},
      setInterval: (fn: any) => { fn(); return 123; },
      clearInterval: () => {},
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => {},
      Math,
      String,
      console
    };
    (sandbox.window as any).window = sandbox.window;
    (sandbox.window as any).document = sandbox.document;
    (sandbox.window as any).requestAnimationFrame = sandbox.requestAnimationFrame;
    (sandbox.window as any).cancelAnimationFrame = sandbox.cancelAnimationFrame;

    const script = new vm.Script(scriptCode);
    const context = vm.createContext(sandbox);
    expect(() => script.runInContext(context)).not.toThrow();
    expect(messages.some(m => m.type === 'glide:dom-tree')).toBe(true);
    const domTreeMsg = messages.find(m => m.type === 'glide:dom-tree');
    expect(domTreeMsg.tree[0].className).toBe('badge text-sm');
  });

  test('Shift-deselecting on the canvas or from Layers omits glide:overlay so the editor does not re-select', () => {
    const scriptCode = buildBridgeScript('data-gl-source', 'data-glide-hover', 'data-glide-selected', 5);
    const messages: any[] = [];
    const windowListeners: Record<string, Function[]> = {};
    const documentListeners: Record<string, Function[]> = {};
    const attrs = new Map<string, string>([
      ['data-gl-source', 'src/App.tsx:1:1'],
      ['data-glide-selected', ''],
    ]);
    const el: any = {
      nodeType: 1,
      tagName: 'BUTTON',
      className: 'cta',
      isConnected: true,
      childNodes: [{ nodeType: 3, textContent: 'Click' }],
      children: [],
      parentNode: null,
      contentEditable: 'inherit',
      getAttribute: (attr: string) => (attrs.has(attr) ? attrs.get(attr)! : null),
      hasAttribute: (attr: string) => attrs.has(attr),
      setAttribute: (attr: string, val: string) => attrs.set(attr, val),
      removeAttribute: (attr: string) => attrs.delete(attr),
      closest: (sel: string) => (sel === '[data-gl-source]' ? el : null),
      getBoundingClientRect: () => ({ left: 20, top: 20, right: 120, bottom: 60, width: 100, height: 40 }),
    };
    const parentWindow = {
      postMessage: (data: any) => messages.push(data),
    };
    const sandbox: any = {
      window: {
        __glide_initialized__: false,
        get top() { return {}; },
        parent: parentWindow,
        location: { href: 'http://localhost:5173/', ancestorOrigins: ['http://localhost:5173'] },
        addEventListener: (ev: string, fn: Function) => { (windowListeners[ev] ||= []).push(fn); },
        removeEventListener: () => {},
        getComputedStyle: () => ({ position: 'static', marginLeft: '0px', marginTop: '0px', left: 'auto', top: 'auto' }),
      },
      document: {
        head: { appendChild: () => {} },
        referrer: 'http://localhost:5173/',
        createElement: () => ({ id: '', textContent: '', appendChild: () => {} }),
        addEventListener: (ev: string, fn: Function) => { (documentListeners[ev] ||= []).push(fn); },
        readyState: 'complete',
        body: { tagName: 'BODY', children: [el], querySelectorAll: () => [el] },
        documentElement: { tagName: 'HTML', setAttribute: () => {}, removeAttribute: () => {} },
        querySelectorAll: (sel: string) => (sel === '[data-gl-source]' || (sel === '[data-glide-selected]' && attrs.has('data-glide-selected')) ? [el] : []),
        querySelector: (sel: string) => (sel.includes('src/App.tsx:1:1') ? el : null),
      },
      URL,
      Set,
      Map,
      setTimeout: (fn: any) => fn(),
      clearTimeout: () => {},
      setInterval: () => 123,
      clearInterval: () => {},
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => {},
      Math,
      String,
      Number,
      Boolean,
      Array,
      Object,
      parseInt,
      isFinite,
      console,
    };
    el.parentNode = sandbox.document.body;
    sandbox.window.window = sandbox.window;
    sandbox.window.document = sandbox.document;
    sandbox.window.requestAnimationFrame = sandbox.requestAnimationFrame;
    sandbox.window.cancelAnimationFrame = sandbox.cancelAnimationFrame;

    new vm.Script(scriptCode).runInContext(vm.createContext(sandbox));
    messages.length = 0;

    // 1. Canvas Shift-click deselect (sendMsgForAny)
    documentListeners.pointerdown.forEach(fn => fn({
      target: el,
      shiftKey: true,
      metaKey: false,
      ctrlKey: false,
      pointerId: 1,
      clientX: 30,
      clientY: 30,
      preventDefault: () => {},
      stopPropagation: () => {},
    }));
    expect(messages.map(m => m.type)).toEqual(['glide:element-deselected']);

    // 2. Layers-panel Shift-click deselect (sendMsg)
    attrs.set('data-glide-selected', '');
    messages.length = 0;
    windowListeners.message.forEach(fn => fn({
      source: parentWindow,
      origin: 'http://localhost:5173',
      data: { type: 'glide:select-element-by-id', id: 'src/App.tsx:1:1', isShift: true },
    }));
    expect(messages.map(m => m.type)).toEqual(['glide:element-deselected']);
  });

  test('Shift-deselecting one of two selected elements sends a refresh update for the remaining element', () => {
    const scriptCode = buildBridgeScript('data-gl-source', 'data-glide-hover', 'data-glide-selected', 5);
    const messages: any[] = [];
    const windowListeners: Record<string, Function[]> = {};
    const documentListeners: Record<string, Function[]> = {};
    const makeEl = (source: string, tagName: string, text: string) => {
      const attrs = new Map<string, string>([
        ['data-gl-source', source],
        ['data-glide-selected', ''],
      ]);
      const node: any = {
        nodeType: 1,
        tagName,
        className: 'item',
        isConnected: true,
        childNodes: [{ nodeType: 3, textContent: text }],
        children: [],
        parentNode: null,
        contentEditable: 'inherit',
        getAttribute: (attr: string) => (attrs.has(attr) ? attrs.get(attr)! : null),
        hasAttribute: (attr: string) => attrs.has(attr),
        setAttribute: (attr: string, val: string) => attrs.set(attr, val),
        removeAttribute: (attr: string) => attrs.delete(attr),
        closest: (sel: string) => (sel === '[data-gl-source]' ? node : null),
        getBoundingClientRect: () => ({ left: 20, top: 20, right: 120, bottom: 60, width: 100, height: 40 }),
      };
      return node;
    };
    const elA = makeEl('src/App.tsx:1:1', 'H1', 'Title');
    const elB = makeEl('src/App.tsx:2:1', 'P', 'Body');
    const all = [elA, elB];
    const parentWindow = { postMessage: (data: any) => messages.push(data) };
    const sandbox: any = {
      window: {
        __glide_initialized__: false,
        get top() { return {}; },
        parent: parentWindow,
        location: { href: 'http://localhost:5173/', ancestorOrigins: ['http://localhost:5173'] },
        addEventListener: (ev: string, fn: Function) => { (windowListeners[ev] ||= []).push(fn); },
        removeEventListener: () => {},
        getComputedStyle: () => ({ position: 'static', marginLeft: '0px', marginTop: '0px', left: 'auto', top: 'auto' }),
      },
      document: {
        head: { appendChild: () => {} },
        referrer: 'http://localhost:5173/',
        createElement: () => ({ id: '', textContent: '', appendChild: () => {} }),
        addEventListener: (ev: string, fn: Function) => { (documentListeners[ev] ||= []).push(fn); },
        readyState: 'complete',
        body: { tagName: 'BODY', children: all, querySelectorAll: () => all },
        documentElement: { tagName: 'HTML', setAttribute: () => {}, removeAttribute: () => {} },
        querySelectorAll: (sel: string) => {
          if (sel === '[data-gl-source]') return all;
          if (sel === '[data-glide-selected]') return all.filter(n => n.hasAttribute('data-glide-selected'));
          return [];
        },
        querySelector: (sel: string) => {
          if (sel === '[data-glide-selected]') return all.find(n => n.hasAttribute('data-glide-selected')) || null;
          return all.find(n => sel.includes(n.getAttribute('data-gl-source'))) || null;
        },
      },
      URL, Set, Map,
      setTimeout: (fn: any) => fn(),
      clearTimeout: () => {},
      setInterval: () => 123,
      clearInterval: () => {},
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => {},
      Math, String, Number, Boolean, Array, Object, parseInt, isFinite, console,
    };
    all.forEach(n => { n.parentNode = sandbox.document.body; });
    sandbox.window.window = sandbox.window;
    sandbox.window.document = sandbox.document;
    sandbox.window.requestAnimationFrame = sandbox.requestAnimationFrame;
    sandbox.window.cancelAnimationFrame = sandbox.cancelAnimationFrame;

    new vm.Script(scriptCode).runInContext(vm.createContext(sandbox));
    messages.length = 0;

    // 1. Canvas Shift-deselect of elB leaves elA selected and refreshes elA
    documentListeners.pointerdown.forEach(fn => fn({
      target: elB,
      shiftKey: true,
      metaKey: false,
      ctrlKey: false,
      pointerId: 1,
      clientX: 30,
      clientY: 30,
      preventDefault: () => {},
      stopPropagation: () => {},
    }));
    expect(messages.map(m => ({ type: m.type, source: m.source, refresh: !!m.refresh }))).toEqual([
      { type: 'glide:element-deselected', source: 'src/App.tsx:2:1', refresh: false },
      { type: 'glide:element-selected', source: 'src/App.tsx:1:1', refresh: true },
      { type: 'glide:overlay', source: 'src/App.tsx:1:1', refresh: true },
    ]);

    // 2. Layers-panel Shift-deselect of elB leaves elA selected and refreshes elA
    elB.setAttribute('data-glide-selected', '');
    messages.length = 0;
    windowListeners.message.forEach(fn => fn({
      source: parentWindow,
      origin: 'http://localhost:5173',
      data: { type: 'glide:select-element-by-id', id: 'src/App.tsx:2:1', isShift: true },
    }));
    expect(messages.map(m => ({ type: m.type, source: m.source, refresh: !!m.refresh }))).toEqual([
      { type: 'glide:element-deselected', source: 'src/App.tsx:2:1', refresh: false },
      { type: 'glide:element-selected', source: 'src/App.tsx:1:1', refresh: true },
      { type: 'glide:overlay', source: 'src/App.tsx:1:1', refresh: true },
    ]);
  });
});
