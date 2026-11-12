import { describe, expect, test, vi, beforeEach } from 'vitest';
import { getEditorHTML } from '../../packages/overlay/src/editor-html.js';
import postcss from 'postcss';

describe('Editor page', () => {
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




  test('should render writeback mode toggle pill with instant and staged options in getEditorHTML', () => {
    const html = getEditorHTML();
    expect(html).toContain('id="writeback-mode-pill"');
    expect(html).toContain('id="mode-btn-live"');
    expect(html).toContain('id="mode-btn-staged"');
    expect(html).toContain('⚡ Instant');
    expect(html).toContain('📦 Staged');
  });

  test('should include bidirectional scene_update handling in getEditorHTML', () => {
    const html = getEditorHTML();
    expect(html).toContain("message.type === 'scene_update'");
    expect(html).toContain("glide:request-scene-nodes");
  });

  test('should preserve source ownership during ordinary canvas drags', () => {
    const html = getEditorHTML();
    expect(html).toContain('sendPositionChange(data.source');
    expect(html.includes('let didReparent')).toBe(false);
  });

  test('should include component definition jump button and resolution handling in getEditorHTML', () => {
    const html = getEditorHTML();
    expect(html).toContain('id="btn-jump-definition"');
    expect(html).toContain("type: 'resolve_component'");
    expect(html).toContain("message.type === 'resolved_component'");
    expect(html).toContain('jump-btn');
  });
});

test('the editor stylesheet has no rule left open around later rules', () => {
  // An unclosed rule makes browsers nest every later rule inside it, so none of them apply.
  const css = getEditorHTML().match(/<style>([\s\S]*?)<\/style>/)![1];
  const nested: string[] = [];
  postcss.parse(css).walkRules(rule => {
    if (rule.parent?.type === 'rule') nested.push(`${(rule.parent as any).selector} > ${rule.selector}`);
  });
  expect(nested).toEqual([]);
});
