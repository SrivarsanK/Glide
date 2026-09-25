import { describe, expect, test, vi, beforeEach } from 'vitest';
import vm from 'vm';
import { GlideBridge } from '../../packages/overlay/src/bridge.js';
import { buildBridgeScript } from '../../packages/vite-plugin/src/index.js';
import { buildGlideBridgeInlineScript } from '../../packages/server/src/ws-server.js';
import { DEFAULT_CONFIG } from '../../packages/core/src/index.js';

describe('GlideBridge Client Bridge', () => {
  let mockWindow: any;
  let mockParent: any;
  let mockDocument: any;
  let eventListeners: Record<string, any[]> = {};

  beforeEach(() => {
    eventListeners = {};
    mockParent = {
      postMessage: vi.fn(),
    };
    mockDocument = {
      addEventListener: vi.fn((event, handler) => {
        if (!eventListeners[event]) eventListeners[event] = [];
        eventListeners[event].push(handler);
      }),
      removeEventListener: vi.fn((event, handler) => {
        if (eventListeners[event]) {
          eventListeners[event] = eventListeners[event].filter((h) => h !== handler);
        }
      }),
      getElementById: vi.fn(() => null),
      createElement: vi.fn(() => ({
        id: '',
        textContent: '',
        remove: vi.fn(),
        setAttribute: vi.fn(),
        removeAttribute: vi.fn(),
      })),
      head: { appendChild: vi.fn() },
      querySelector: vi.fn(() => null),
    };
    mockWindow = {
      document: mockDocument,
      parent: mockParent,
      scrollX: 10,
      scrollY: 20,
    };
  });

  test('should attach event listeners on init and remove them on dispose', () => {
    const bridge = new GlideBridge(mockWindow);
    bridge.init();
    expect(mockDocument.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(mockDocument.addEventListener).toHaveBeenCalledWith('click', expect.any(Function), true);

    bridge.dispose();
    expect(mockDocument.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(mockDocument.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function), true);
  });

  test('should dispatch message on mousemove over data-gl-source element', () => {
    const bridge = new GlideBridge(mockWindow);
    bridge.init();

    const mockElement: any = {
      getAttribute: vi.fn((attr) => (attr === 'data-gl-source' ? 'src/App.tsx:10:5' : null)),
      getBoundingClientRect: vi.fn(() => ({
        left: 50,
        top: 100,
        width: 200,
        height: 80,
      } as any)),
      closest: vi.fn((selector) => (selector === '[data-gl-source]' ? mockElement : null)),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      tagName: 'DIV',
      className: 'hero-section',
    };

    const mousemoveHandler = eventListeners['mousemove'][0];
    mousemoveHandler({ target: mockElement } as any);

    expect(mockParent.postMessage).toHaveBeenCalledWith(
      {
        type: 'glide:element-hovered',
        source: 'src/App.tsx:10:5',
        tagName: 'div',
        classNames: 'hero-section',
        rect: {
          left: 60,
          top: 120,
          width: 200,
          height: 80,
        },
      },
      '*'
    );
  });

  test('should dispatch hover-exit when moving off data-gl-source elements', () => {
    const bridge = new GlideBridge(mockWindow);
    bridge.init();

    const mockElement: any = {
      getAttribute: () => 'src/App.tsx:10:5',
      getBoundingClientRect: () => ({ left: 50, top: 100, width: 200, height: 80 }),
      closest: (sel: string) => (sel === '[data-gl-source]' ? mockElement : null),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      tagName: 'SECTION',
      className: '',
    };

    const mousemoveHandler = eventListeners['mousemove'][0];
    mousemoveHandler({ target: mockElement } as any);
    mousemoveHandler({ target: { closest: () => null } } as any);

    expect(mockParent.postMessage).toHaveBeenLastCalledWith(
      { type: 'glide:element-hover-exit' },
      '*'
    );
  });

  test('should dispatch selected event and prevent default action on click', () => {
    const bridge = new GlideBridge(mockWindow);
    bridge.init();

    const mockElement: any = {
      getAttribute: () => 'src/App.tsx:10:5',
      getBoundingClientRect: () => ({ left: 50, top: 100, width: 200, height: 80 }),
      closest: (sel: string) => (sel === '[data-gl-source]' ? mockElement : null),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      tagName: 'BUTTON',
      className: 'btn-primary',
    };

    const mockEvent = {
      target: mockElement,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    const clickHandler = eventListeners['click'][0];
    clickHandler(mockEvent as any);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
    expect(mockParent.postMessage).toHaveBeenCalledWith(
      {
        type: 'glide:element-selected',
        source: 'src/App.tsx:10:5',
        tagName: 'button',
        classNames: 'btn-primary',
        rect: {
          left: 60,
          top: 120,
          width: 200,
          height: 80,
        },
      },
      '*'
    );
  });

  test('should toggle multi-selection on shift-click', () => {
    const bridge = new GlideBridge(mockWindow);
    bridge.init();

    const mockEl1: any = {
      getAttribute: (attr: string) => (attr === 'data-gl-source' ? 'src/App.tsx:10:5' : null),
      getBoundingClientRect: () => ({ left: 50, top: 100, width: 200, height: 80 }),
      closest: (sel: string) => (sel === '[data-gl-source]' ? mockEl1 : null),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      tagName: 'BUTTON',
      className: 'btn-1',
    };

    const clickHandler = eventListeners['click'][0];
    // 1st shift-click: select
    clickHandler({
      target: mockEl1,
      shiftKey: true,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as any);

    expect(mockEl1.setAttribute).toHaveBeenCalledWith('data-glide-selected', '');
    expect(bridge.getSelectedElements()).toEqual([mockEl1]);

    // 2nd shift-click: toggle off
    clickHandler({
      target: mockEl1,
      shiftKey: true,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as any);

    expect(mockEl1.removeAttribute).toHaveBeenCalledWith('data-glide-selected');
    expect(bridge.getSelectedElements()).toEqual([]);
    expect(mockParent.postMessage).toHaveBeenCalledWith(
      { type: 'glide:element-deselected', source: 'src/App.tsx:10:5' },
      '*'
    );
  });

  test('should select deep leaf on meta/ctrl click', () => {
    const bridge = new GlideBridge(mockWindow);
    bridge.init();

    const parentEl: any = {
      getAttribute: (attr: string) => (attr === 'data-gl-source' ? 'src/App.tsx:5:1' : null),
      parentElement: null,
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      tagName: 'DIV',
      className: 'container',
    };

    const leafEl: any = {
      getAttribute: (attr: string) => (attr === 'data-gl-source' ? 'src/App.tsx:12:3' : null),
      parentElement: parentEl,
      closest: (sel: string) => (sel === '[data-gl-source]' ? leafEl : null),
      getBoundingClientRect: () => ({ left: 60, top: 110, width: 100, height: 40 }),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      tagName: 'SPAN',
      className: 'title',
    };

    const clickHandler = eventListeners['click'][0];

    // Meta+click: selects leaf directly
    clickHandler({
      target: leafEl,
      metaKey: true,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as any);

    expect(leafEl.setAttribute).toHaveBeenCalledWith('data-glide-selected', '');
    expect(bridge.getSelectedElements()).toEqual([leafEl]);
  });

  test('should dispatch depth-stacked layerStack on contextmenu', () => {
    const bridge = new GlideBridge(mockWindow);
    bridge.init();

    const parentEl: any = {
      getAttribute: (attr: string) => {
        if (attr === 'data-gl-source') return 'src/App.tsx:5:1';
        if (attr === 'data-gl-name') return 'Section';
        return null;
      },
      parentElement: null,
      tagName: 'SECTION',
    };

    const childEl: any = {
      getAttribute: (attr: string) => {
        if (attr === 'data-gl-source') return 'src/App.tsx:10:5';
        if (attr === 'data-gl-name') return 'Button';
        return null;
      },
      parentElement: parentEl,
      tagName: 'BUTTON',
    };

    const contextmenuHandler = eventListeners['contextmenu'][0];
    const mockEvent = {
      target: childEl,
      clientX: 150,
      clientY: 220,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    contextmenuHandler(mockEvent as any);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
    expect(mockParent.postMessage).toHaveBeenCalledWith(
      {
        type: 'glide:contextmenu',
        clientX: 150,
        clientY: 220,
        layerStack: [
          { source: 'src/App.tsx:10:5', tagName: 'button', name: 'Button' },
          { source: 'src/App.tsx:5:1', tagName: 'section', name: 'Section' },
        ],
      },
      '*'
    );
  });
});

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
});
