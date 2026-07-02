import { describe, expect, test } from 'vitest';
import { measureTextLayout } from '../text.js';

describe('Pretext Text Measurement', () => {
  test('should calculate natural text width', () => {
    const text = 'hello';
    const font = '16px Inter';
    // Using mock canvas width = char length * 8
    const layout = measureTextLayout(text, font, 200);

    expect(layout.width).toBe(40); // 5 * 8
    expect(layout.lineCount).toBe(1);
    expect(layout.lines).toEqual(['hello']);
  });

  test('should break long text lines when exceeding maximum width', () => {
    const text = 'hello world';
    const font = '16px Inter';
    // Width limit = 50px
    // 'hello ' is 48px, so it fits on line 1. 'world' is 40px, so it goes to line 2.
    const layout = measureTextLayout(text, font, 50);

    expect(layout.lineCount).toBe(2);
    expect(layout.lines).toEqual(['hello', 'world']);
  });

  test('should bypass DOM to predict heights of a virtual list of text items using Pretext math', () => {
    const listItems = [
      'Short msg',
      'This is a longer message that should wrap to multiple lines',
      'Another short message',
    ];
    const font = '16px Inter';
    const containerWidth = 100; // narrow width to force wrapping
    const lineHeight = 20; // 20px per line
    
    const results = listItems.map(text => {
      // 1. Prepare & measure off-screen (skip DOM reflows)
      const layout = measureTextLayout(text, font, containerWidth);
      // 2. Perform purely mathematical calculations on width/height
      const height = layout.lineCount * lineHeight;
      return { height, lineCount: layout.lineCount, lines: layout.lines };
    });

    // Verify first item fits in 1 line
    expect(results[0].lineCount).toBe(1);
    expect(results[0].height).toBe(20);

    // Verify second item wraps to multiple lines
    expect(results[1].lineCount).toBeGreaterThan(1);
    expect(results[1].height).toBe(results[1].lineCount * lineHeight);
  });
});

