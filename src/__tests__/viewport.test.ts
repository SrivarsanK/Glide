import { describe, expect, test } from 'vitest';
import { resolveActiveBreakpoint } from '../../packages/overlay/src/utils/viewport.js';

describe('Viewport Device Resolver', () => {
  test('should map viewport widths to Tailwind breakpoints', () => {
    expect(resolveActiveBreakpoint(1440)).toBe('xl');
    expect(resolveActiveBreakpoint(1050)).toBe('lg');
    expect(resolveActiveBreakpoint(800)).toBe('md');
    expect(resolveActiveBreakpoint(700)).toBe('sm');
    expect(resolveActiveBreakpoint(500)).toBeNull();
  });
});
