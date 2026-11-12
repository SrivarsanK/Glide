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
});
