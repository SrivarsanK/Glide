import { describe, expect, test } from 'vitest';
import { parseTailwindClasses, updateTailwindClasses } from './properties.js';

describe('Properties Parser and Updater', () => {
  test('should parse simple Tailwind styling classes', () => {
    const classes = 'p-4 m-2 w-32 h-64 absolute top-2 left-4 rotate-45 bg-blue-500';
    const parsed = parseTailwindClasses(classes);

    expect(parsed.padding).toEqual({ top: '4', right: '4', bottom: '4', left: '4' });
    expect(parsed.margin).toEqual({ top: '2', right: '2', bottom: '2', left: '2' });
    expect(parsed.width).toBe('32');
    expect(parsed.height).toBe('64');
    expect(parsed.position).toBe('absolute');
    expect(parsed.offsets).toEqual({ top: '2', right: null, bottom: null, left: '4' });
    expect(parsed.rotation).toBe('45');
  });

  test('should resolve padding and margin override cascades', () => {
    const classes = 'px-4 py-2 pt-6 ml-3';
    const parsed = parseTailwindClasses(classes);

    expect(parsed.padding).toEqual({ top: '6', right: '4', bottom: '2', left: '4' });
    expect(parsed.margin).toEqual({ top: null, right: null, bottom: null, left: '3' });
  });

  test('should preserve unrelated classes when updating spacing and size', () => {
    const original = 'bg-red-500 text-white font-bold p-4 w-32';
    const updated = updateTailwindClasses(original, {
      padding: { top: '6', right: '4', bottom: '6', left: '4' },
      width: '40',
    });

    expect(updated).toContain('bg-red-500');
    expect(updated).toContain('text-white');
    expect(updated).toContain('font-bold');
    expect(updated).toContain('py-6');
    expect(updated).toContain('px-4');
    expect(updated).toContain('w-40');
    expect(updated).not.toContain('p-4');
    expect(updated).not.toContain('w-32');
  });

  test('should handle adding new layout options to clean class list', () => {
    const original = 'flex items-center';
    const updated = updateTailwindClasses(original, {
      position: 'relative',
      margin: { top: '2', right: '2', bottom: '2', left: '2' },
    });

    expect(updated).toContain('flex');
    expect(updated).toContain('items-center');
    expect(updated).toContain('relative');
    expect(updated).toContain('m-2');
  });

  test('should parse Flexbox and Typography classes', () => {
    const classes = 'flex flex-col justify-between items-center gap-4 font-mono font-semibold text-lg text-red-500 text-center';
    const parsed = parseTailwindClasses(classes);

    expect(parsed.flexDirection).toBe('col');
    expect(parsed.justifyContent).toBe('between');
    expect(parsed.alignItems).toBe('center');
    expect(parsed.gap).toBe('4');
    expect(parsed.fontFamily).toBe('mono');
    expect(parsed.fontWeight).toBe('semibold');
    expect(parsed.fontSize).toBe('lg');
    expect(parsed.textColor).toBe('red-500');
  });

  test('should update Flexbox and Typography properties correctly', () => {
    const original = 'flex flex-row justify-start items-stretch gap-2 font-sans font-normal text-base text-black bg-white';
    const updated = updateTailwindClasses(original, {
      flexDirection: 'col',
      justifyContent: 'center',
      gap: '6',
      fontWeight: 'bold',
      fontSize: 'xl',
      textColor: 'blue-600',
    });

    expect(updated).toContain('bg-white');
    expect(updated).toContain('flex-col');
    expect(updated).toContain('justify-center');
    expect(updated).toContain('gap-6');
    expect(updated).toContain('font-bold');
    expect(updated).toContain('text-xl');
    expect(updated).toContain('text-blue-600');
    expect(updated).not.toContain('flex-row');
    expect(updated).not.toContain('justify-start');
    expect(updated).not.toContain('gap-2');
    expect(updated).not.toContain('font-normal');
    expect(updated).not.toContain('text-base');
    expect(updated).not.toContain('text-black');
  });
});
