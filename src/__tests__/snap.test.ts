import { describe, expect, test } from 'vitest';
import { snapToGrid } from '../snap.js';

describe('Canvas Grid Snapping Helper', () => {
  test('should snap layout coordinate values to nearest grid step size', () => {
    // Standard 8px grid
    expect(snapToGrid(4, 5)).toEqual({ x: 8, y: 8 });
    expect(snapToGrid(3, 11)).toEqual({ x: 0, y: 8 });
    expect(snapToGrid(15, 23)).toEqual({ x: 16, y: 24 });

    // Custom 10px grid
    expect(snapToGrid(14, 26, 10)).toEqual({ x: 10, y: 30 });
  });
});
