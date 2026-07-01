import { describe, expect, test, vi, beforeEach } from 'vitest';
import { GlideOverlay } from './overlay.js';

describe('GlideOverlay Canvas Layer', () => {
  let mockWindow: any;
  let mockContainer: any;
  let eventListeners: Record<string, any[]> = {};

  beforeEach(() => {
    eventListeners = {};
    mockContainer = {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    };

    const mockDocument = {
      createElementNS: vi.fn((ns, tagName) => {
        const el: any = {
          setAttribute: vi.fn(),
          style: {},
          appendChild: vi.fn(),
          addEventListener: vi.fn((event, handler) => {
            if (!el.listeners) el.listeners = {};
            el.listeners[event] = handler;
          }),
        };
        return el;
      }),
      createElement: vi.fn(() => ({})),
    };

    mockWindow = {
      document: mockDocument,
      addEventListener: vi.fn((event, handler) => {
        if (!eventListeners[event]) eventListeners[event] = [];
        eventListeners[event].push(handler);
      }),
      removeEventListener: vi.fn((event, handler) => {
        if (eventListeners[event]) {
          eventListeners[event] = eventListeners[event].filter((h) => h !== handler);
        }
      }),
    };
  });

  test('should attach event listeners on init and remove them on dispose', () => {
    const overlay = new GlideOverlay(mockWindow, mockContainer);
    overlay.init();
    expect(mockWindow.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    expect(mockWindow.addEventListener).toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(mockWindow.addEventListener).toHaveBeenCalledWith('pointerup', expect.any(Function));

    overlay.dispose();
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith('pointerup', expect.any(Function));
  });

  test('should draw selection outline and 8 handles when element is selected', () => {
    const overlay = new GlideOverlay(mockWindow, mockContainer);
    overlay.init();

    const messageHandler = eventListeners['message'][0];
    messageHandler({
      data: {
        type: 'glide:element-selected',
        source: 'src/App.tsx:10:5',
        rect: { left: 100, top: 200, width: 300, height: 150 },
      },
    } as any);

    expect(mockContainer.appendChild).toHaveBeenCalled();
  });

  test('should compute resize deltas on pointermove when dragging handle', () => {
    const overlay = new GlideOverlay(mockWindow, mockContainer);
    overlay.init();

    let resizeResult: any = null;
    overlay.onResize((source, rect, delta) => {
      resizeResult = { source, rect, delta };
    });

    const messageHandler = eventListeners['message'][0];
    messageHandler({
      data: {
        type: 'glide:element-selected',
        source: 'src/App.tsx:10:5',
        rect: { left: 100, top: 100, width: 100, height: 100 },
      },
    } as any);

    const moveHandler = eventListeners['pointermove'][0];
    const upHandler = eventListeners['pointerup'][0];

    // Trigger handle dragging state internally
    (overlay as any).dragHandle = 'br';
    (overlay as any).startPointerX = 150;
    (overlay as any).startPointerY = 150;
    (overlay as any).startRect = { left: 100, top: 100, width: 100, height: 100 };
    (overlay as any).activeSource = 'src/App.tsx:10:5';

    // Move pointer by +20px horizontally and +30px vertically
    moveHandler({ clientX: 170, clientY: 180 } as PointerEvent);

    expect(resizeResult).not.toBeNull();
    expect(resizeResult.delta.width).toBe(20);
    expect(resizeResult.delta.height).toBe(30);
    expect(resizeResult.rect.width).toBe(120);
    expect(resizeResult.rect.height).toBe(130);

    upHandler();
    expect((overlay as any).dragHandle).toBeNull();
  });
});
