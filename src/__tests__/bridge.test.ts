import { describe, expect, test, vi, beforeEach } from 'vitest';
import { GlideBridge } from '../bridge.js';

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
});
