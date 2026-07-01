import { describe, expect, test } from 'vitest';
import { measureTextLayout } from './text.js';

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
});
