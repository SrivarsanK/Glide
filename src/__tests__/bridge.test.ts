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

  test('proxy bridge shares the unified bridge implementation with Vite bridge', () => {
    const raw = buildGlideBridgeInlineScript(DEFAULT_CONFIG);
    expect(raw).toContain('glide:optimistic-style');
    expect(raw).toContain('glide:preview-style');
    expect(raw).toContain('glide:clear-preview');
    expect(raw).toContain('glide:resize-start');
    expect(raw).toContain('glide:scroll-by');
    expect(raw).toContain('glide:marquee-start');
  });

  test('right-click never starts a phantom drag and zero-button pointermove cancels dragCandidate', () => {
    const scriptCode = buildBridgeScript('data-gl-source', 'data-glide-hover', 'data-glide-selected', 5);
    const messages: any[] = [];
    const docListeners: Record<string, Function[]> = {};
    const attrs = new Map<string, string>([['data-gl-source', 'src/App.tsx:1:1']]);
    const el: any = {
      nodeType: 1, tagName: 'DIV', className: 'box', isConnected: true,
      childNodes: [{ nodeType: 3, textContent: 'Box' }], children: [], parentNode: null,
      contentEditable: 'inherit', style: { setProperty() {}, removeProperty() {}, getPropertyValue: () => '', getPropertyPriority: () => '' },
      getAttribute: (a: string) => attrs.get(a) ?? null, hasAttribute: (a: string) => attrs.has(a),
      setAttribute: (a: string, v: string) => attrs.set(a, v), removeAttribute: (a: string) => attrs.delete(a),
      closest: (s: string) => (s === '[data-gl-source]' ? el : null),
      getBoundingClientRect: () => ({ left: 10, top: 10, right: 110, bottom: 50, width: 100, height: 40 }),
    };
    const sandbox: any = {
      window: {
        __glide_initialized__: false, get top() { return {}; },
        parent: { postMessage: (d: any) => messages.push(d) },
        location: { href: 'http://localhost:5173/', ancestorOrigins: ['http://localhost:5173'] },
        addEventListener: () => {}, removeEventListener: () => {},
        getComputedStyle: () => ({ position: 'static', marginLeft: '0px', marginTop: '0px', left: 'auto', top: 'auto', transform: 'none' }),
      },
      document: {
        head: { appendChild: () => {} }, referrer: 'http://localhost:5173/',
        createElement: () => ({ id: '', textContent: '', appendChild: () => {} }),
        addEventListener: (ev: string, fn: Function) => { (docListeners[ev] ||= []).push(fn); },
        readyState: 'complete',
        body: { tagName: 'BODY', children: [el], querySelectorAll: () => [el] },
        documentElement: { tagName: 'HTML', setAttribute: () => {}, removeAttribute: () => {} },
        querySelectorAll: () => [el], querySelector: () => el,
      },
      URL, Set, Map, setTimeout: () => 1, clearTimeout: () => {}, setInterval: () => 1, clearInterval: () => {},
      requestAnimationFrame: () => 1, cancelAnimationFrame: () => {}, Math, String, Number, Boolean, Array, Object, parseInt, isFinite, console,
    };
    el.parentNode = sandbox.document.body;
    sandbox.window.window = sandbox.window;
    sandbox.window.document = sandbox.document;
    sandbox.window.requestAnimationFrame = sandbox.requestAnimationFrame;
    sandbox.window.cancelAnimationFrame = sandbox.cancelAnimationFrame;

    new vm.Script(scriptCode).runInContext(vm.createContext(sandbox));
    messages.length = 0;

    // Right-click pointerdown (button: 2) followed by mouse move with no buttons held (buttons: 0)
    docListeners.pointerdown.forEach(fn => fn({ target: el, button: 2, buttons: 2, pointerId: 1, clientX: 20, clientY: 20, preventDefault() {}, stopPropagation() {} }));
    docListeners.pointermove.forEach(fn => fn({ target: el, buttons: 0, pointerId: 1, clientX: 80, clientY: 60, preventDefault() {}, stopPropagation() {} }));
    expect(messages.some(m => m.type === 'glide:element-drag-start')).toBe(false);
    expect(messages.some(m => m.type === 'glide:element-selected')).toBe(false);

    // Left-click down then move with buttons: 0 (e.g. released outside iframe) cancels dragCandidate
    docListeners.pointerdown.forEach(fn => fn({ target: el, button: 0, buttons: 1, pointerId: 2, clientX: 20, clientY: 20, preventDefault() {}, stopPropagation() {} }));
    messages.length = 0;
    docListeners.pointermove.forEach(fn => fn({ target: el, buttons: 0, pointerId: 2, clientX: 80, clientY: 60, preventDefault() {}, stopPropagation() {} }));
    expect(messages.some(m => m.type === 'glide:element-drag-start')).toBe(false);
  });

  test('double-click inline edit cleans up keydown on blur, emits only glide:inline-text-edit, and preview blocks scroll/resize', () => {
    const scriptCode = buildBridgeScript('data-gl-source', 'data-glide-hover', 'data-glide-selected', 5);
    const messages: any[] = [];
    const winListeners: Record<string, Function[]> = {};
    const docListeners: Record<string, Function[]> = {};
    const elListeners: Record<string, Function[]> = {};
    const attrs = new Map<string, string>([['data-gl-source', 'src/App.tsx:1:1']]);
    const el: any = {
      nodeType: 1, tagName: 'P', className: 'copy', isConnected: true,
      textContent: 'Alpha Text', childNodes: [{ nodeType: 3, textContent: 'Alpha Text' }], children: [], parentNode: null,
      contentEditable: 'inherit', isContentEditable: false,
      style: { outline: '', outlineOffset: '', setProperty() {}, removeProperty() {}, getPropertyValue: () => '', getPropertyPriority: () => '' },
      focus() {},
      blur() { (elListeners.blur || []).slice().forEach(fn => fn()); },
      addEventListener(ev: string, fn: Function) { (elListeners[ev] ||= []).push(fn); },
      removeEventListener(ev: string, fn: Function) { elListeners[ev] = (elListeners[ev] || []).filter(f => f !== fn); },
      getAttribute: (a: string) => attrs.get(a) ?? null, hasAttribute: (a: string) => attrs.has(a),
      setAttribute: (a: string, v: string) => attrs.set(a, v), removeAttribute: (a: string) => attrs.delete(a),
      closest: (s: string) => (s === '[data-gl-source]' ? el : null),
      getBoundingClientRect: () => ({ left: 10, top: 10, right: 110, bottom: 30, width: 100, height: 20 }),
    };
    const parentWindow = { postMessage: (d: any) => messages.push(d) };
    const sandbox: any = {
      window: {
        __glide_initialized__: false, get top() { return {}; }, parent: parentWindow,
        location: { href: 'http://localhost:5173/', ancestorOrigins: ['http://localhost:5173'] },
        addEventListener: (ev: string, fn: Function) => { (winListeners[ev] ||= []).push(fn); },
        removeEventListener: () => {},
        getComputedStyle: () => ({ position: 'static', transform: 'none' }),
        getSelection: () => null,
      },
      document: {
        head: { appendChild: () => {} }, referrer: 'http://localhost:5173/',
        createElement: () => ({ id: '', textContent: '', appendChild: () => {} }),
        createRange: () => ({ selectNodeContents() {} }),
        addEventListener: (ev: string, fn: Function) => { (docListeners[ev] ||= []).push(fn); },
        readyState: 'complete',
        body: { tagName: 'BODY', children: [el], querySelectorAll: () => [el] },
        documentElement: { tagName: 'HTML', setAttribute: () => {}, removeAttribute: () => {} },
        querySelectorAll: () => [el], querySelector: () => el,
      },
      URL, Set, Map, setTimeout: () => 1, clearTimeout: () => {}, setInterval: () => 1, clearInterval: () => {},
      requestAnimationFrame: () => 1, cancelAnimationFrame: () => {}, Math, String, Number, Boolean, Array, Object, parseInt, isFinite, console,
    };
    el.parentNode = sandbox.document.body;
    sandbox.window.window = sandbox.window;
    sandbox.window.document = sandbox.document;
    sandbox.window.requestAnimationFrame = sandbox.requestAnimationFrame;
    sandbox.window.cancelAnimationFrame = sandbox.cancelAnimationFrame;

    new vm.Script(scriptCode).runInContext(vm.createContext(sandbox));
    messages.length = 0;

    // Edit #1: change to "Second Edit" and commit via blur
    docListeners.dblclick.forEach(fn => fn({ target: el, clientX: 20, clientY: 20, preventDefault() {}, stopPropagation() {} }));
    el.textContent = 'Second Edit';
    el.blur();
    expect(messages.filter(m => m.type === 'glide:inline-text-edit')).toHaveLength(1);
    expect(messages.filter(m => m.type === 'glide:text-edited')).toHaveLength(0);
    expect(elListeners.keydown || []).toHaveLength(0);

    // Edit #2: type "Aborted Gamma" then press Escape -> must revert to "Second Edit", NOT "Alpha Text"
    docListeners.dblclick.forEach(fn => fn({ target: el, clientX: 20, clientY: 20, preventDefault() {}, stopPropagation() {} }));
    el.textContent = 'Aborted Gamma';
    (elListeners.keydown || []).slice().forEach(fn => fn({ key: 'Escape', preventDefault() {} }));
    expect(el.textContent).toBe('Second Edit');

    // Preview mode must ignore scroll and resize events (never resurrect selection overlay)
    windowMessage({ type: 'glide:set-interaction-mode', enabled: true });
    messages.length = 0;
    (winListeners.scroll || []).forEach(fn => fn());
    (winListeners.resize || []).forEach(fn => fn());
    expect(messages.some(m => m.type === 'glide:overlay' || m.type === 'glide:element-selected')).toBe(false);

    // Preview style and clear-preview must resolve remapped :hash source IDs
    windowMessage({ type: 'glide:set-interaction-mode', enabled: false });
    windowMessage({ type: 'glide:preview-style', sourceId: 'src/App.tsx:1:1:deadbeef', styles: { color: 'red' } });
    expect(el.style.color).toBe('red');
    windowMessage({ type: 'glide:clear-preview', sourceId: 'src/App.tsx:1:1:deadbeef' });
    expect(el.style.color).toBe('');

    function windowMessage(data: any) {
      (winListeners.message || []).forEach(fn => fn({ source: parentWindow, origin: 'http://localhost:5173', data }));
    }
  });

  test('Instant previews never touch the page-owned style attribute and end with their save', () => {
    const scriptCode = buildBridgeScript('data-gl-source', 'data-glide-hover', 'data-glide-selected', 5);
    const winListeners: Record<string, Function[]> = {};
    const attrs = new Map<string, string>([['data-gl-source', 'src/App.tsx:1:1']]);
    const pageNodes = [{ nodeType: 3, nodeValue: 'You clicked ' }, { nodeType: 3, nodeValue: '0' }, { nodeType: 3, nodeValue: ' times' }];
    let nodes: any[] = pageNodes.slice();
    const el: any = {
      nodeType: 1, tagName: 'P', className: 'copy', isConnected: true, children: [], parentNode: null,
      style: { color: '' },
      get childNodes() { return nodes; },
      get firstChild() { return nodes[0] || null; },
      get textContent() { return nodes.map(n => n.nodeValue).join(''); },
      set textContent(value: string) { nodes = value ? [{ nodeType: 3, nodeValue: value }] : []; },
      appendChild(node: any) { nodes.push(node); return node; },
      addEventListener() {}, removeEventListener() {},
      getAttribute: (a: string) => attrs.get(a) ?? null, hasAttribute: (a: string) => attrs.has(a),
      setAttribute: (a: string, v: string) => attrs.set(a, v), removeAttribute: (a: string) => attrs.delete(a),
      closest: () => el,
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }),
    };
    const rules: any[] = [];
    const sheet = {
      cssRules: rules,
      insertRule(text: string, index: number) { const decls: Record<string, string> = {}; rules.splice(index, 0, { text, decls, style: { setProperty: (n: string, v: string, p: string) => { decls[n] = v + ' !' + p; } } }); return index; },
      deleteRule(index: number) { rules.splice(index, 1); },
    };
    let styleNode: any = null;
    const timers: Function[] = [];
    const parentWindow = { postMessage: () => {} };
    const sandbox: any = {
      window: {
        __glide_initialized__: false, get top() { return {}; }, parent: parentWindow,
        location: { href: 'http://localhost:5173/', ancestorOrigins: ['http://localhost:5173'] },
        addEventListener: (ev: string, fn: Function) => { (winListeners[ev] ||= []).push(fn); },
        removeEventListener: () => {},
        getComputedStyle: () => ({ position: 'static', transform: 'none' }),
        getSelection: () => null,
      },
      document: {
        head: { appendChild: (node: any) => { styleNode = node; } }, referrer: 'http://localhost:5173/',
        createElement: () => ({ id: '', textContent: '', appendChild: () => {}, sheet }),
        getElementById: (id: string) => (styleNode && styleNode.id === id ? styleNode : null),
        addEventListener: () => {},
        readyState: 'complete',
        body: { tagName: 'BODY', children: [el], querySelectorAll: () => [el] },
        documentElement: { tagName: 'HTML', setAttribute: () => {}, removeAttribute: () => {} },
        querySelectorAll: () => [el], querySelector: () => el,
      },
      URL, Set, Map, setTimeout: (fn: Function) => timers.push(fn), clearTimeout: () => {}, setInterval: () => 1, clearInterval: () => {},
      requestAnimationFrame: () => 1, cancelAnimationFrame: () => {}, Math, String, Number, Boolean, Array, Object, parseInt, isFinite, console,
    };
    el.parentNode = sandbox.document.body;
    sandbox.window.window = sandbox.window;
    sandbox.window.document = sandbox.document;
    new vm.Script(scriptCode).runInContext(vm.createContext(sandbox));
    timers.length = 0;
    const send = (data: any) => (winListeners.message || []).forEach(fn => fn({ source: parentWindow, origin: 'http://localhost:5173', data }));

    // The preview is a stylesheet rule; the element's own style is left to the page.
    send({ type: 'glide:optimistic-style', id: 'src/App.tsx:1:1', styles: { paddingTop: '12px' } });
    expect(el.style).toEqual({ color: '' });
    const id = attrs.get('data-glide-optimistic');
    expect(rules).toHaveLength(1);
    expect(rules[0].text).toBe('[data-glide-optimistic="' + id + '"]{}');
    expect(rules[0].decls).toEqual({ 'padding-top': '12px !important' });

    // A refused save drops the preview at once.
    send({ type: 'glide:clear-optimistic', settle: false });
    expect(attrs.has('data-glide-optimistic')).toBe(false);
    expect(rules).toHaveLength(0);

    // A saved text preview ends after the page re-renders, and puts back the page's own text nodes.
    send({ type: 'glide:optimistic-text', source: 'src/App.tsx:1:1', value: 'Edited' });
    expect(el.textContent).toBe('Edited');
    send({ type: 'glide:clear-optimistic', settle: true });
    expect(el.textContent).toBe('Edited');
    timers.forEach(fn => fn());
    expect(nodes).toEqual(pageNodes);
    expect(nodes[1]).toBe(pageNodes[1]);

    // Text the page already re-rendered over the preview stays.
    send({ type: 'glide:optimistic-text', source: 'src/App.tsx:1:1', value: 'Draft' });
    el.textContent = 'Saved by the page';
    send({ type: 'glide:clear-optimistic', settle: false });
    expect(el.textContent).toBe('Saved by the page');

    // A lone text node: React writes the saved text into the preview's node in place, and it must stay.
    send({ type: 'glide:optimistic-text', source: 'src/App.tsx:1:1', value: 'New title' });
    nodes[0].nodeValue = 'New title';
    timers.length = 0;
    send({ type: 'glide:clear-optimistic', settle: true });
    timers.forEach(fn => fn());
    expect(el.textContent).toBe('New title');

    // A refused edit of a lone text node puts the page's node back.
    const pageNode = nodes[0];
    send({ type: 'glide:optimistic-text', source: 'src/App.tsx:1:1', value: 'Refused' });
    send({ type: 'glide:clear-optimistic', settle: false });
    expect(nodes[0]).toBe(pageNode);
    expect(el.textContent).toBe('New title');
  });
});
