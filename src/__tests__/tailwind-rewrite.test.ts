import { describe, test, expect } from 'vitest';
import { rewriteClassNameToken, rewriteTailwindToken } from '../../packages/ast-writer/src/css.js';

describe('rewriteClassNameToken', () => {
  test('replaces background color token with standard prefix', () => {
    const res = rewriteClassNameToken('flex bg-blue-500 p-4', 'bg-', 'red-500');
    expect(res).toBe('flex bg-red-500 p-4');
  });

  test('normalizes newValue if prefix already included', () => {
    const res = rewriteClassNameToken('flex bg-blue-500 p-4', 'bg-', 'bg-emerald-600');
    expect(res).toBe('flex bg-emerald-600 p-4');
  });

  test('removes token when newValue is empty string', () => {
    const res = rewriteClassNameToken('flex bg-blue-500 p-4', 'bg-', '');
    expect(res).toBe('flex p-4');
  });

  test('appends token when no matching prefix exists', () => {
    const res = rewriteClassNameToken('flex items-center', 'p-', '4');
    expect(res).toBe('flex items-center p-4');
  });

  test('handles arbitrary width and height values', () => {
    const res1 = rewriteClassNameToken('w-32 h-16', 'w-', '[240px]');
    expect(res1).toBe('w-[240px] h-16');

    const res2 = rewriteClassNameToken('w-[240px] h-16', 'h-', '[120px]');
    expect(res2).toBe('w-[240px] h-[120px]');
  });

  test('handles arbitrary hex colors', () => {
    const res = rewriteClassNameToken('bg-blue-500 text-white', 'bg-', '[#123456]');
    expect(res).toBe('bg-[#123456] text-white');
  });

  test('disambiguates text- prefix for color, font size, and text align', () => {
    const initial = 'text-sm text-gray-500 text-center font-bold';

    // 1. Rewrite color only — preserves text-sm and text-center
    const withNewColor = rewriteClassNameToken(initial, 'text-', 'blue-600');
    expect(withNewColor).toBe('text-sm text-blue-600 text-center font-bold');

    // 2. Rewrite font size only — preserves text-gray-500 and text-center
    const withNewSize = rewriteClassNameToken(initial, 'text-', 'xl');
    expect(withNewSize).toBe('text-xl text-gray-500 text-center font-bold');

    // 3. Rewrite text align only — preserves text-sm and text-gray-500
    const withNewAlign = rewriteClassNameToken(initial, 'text-', 'right');
    expect(withNewAlign).toBe('text-sm text-gray-500 text-right font-bold');
  });

  test('disambiguates border- prefix for width, style, and color', () => {
    const initial = 'border border-solid border-gray-300';

    // 1. Rewrite border color — preserves border (width) and border-solid
    const withNewColor = rewriteClassNameToken(initial, 'border-', 'red-500');
    expect(withNewColor).toBe('border border-solid border-red-500');

    // 2. Rewrite border width — preserves border-solid and border-gray-300
    const withNewWidth = rewriteClassNameToken(initial, 'border-', '2');
    expect(withNewWidth).toBe('border-2 border-solid border-gray-300');

    // 3. Rewrite border style — preserves border and border-gray-300
    const withNewStyle = rewriteClassNameToken(initial, 'border-', 'dashed');
    expect(withNewStyle).toBe('border border-dashed border-gray-300');
  });

  test('handles variant prefixes independently without clobbering base classes', () => {
    const initial = 'bg-white hover:bg-gray-100 text-black';
    const res = rewriteClassNameToken(initial, 'hover:bg-', 'gray-200');
    expect(res).toBe('bg-white hover:bg-gray-200 text-black');
  });
});

describe('rewriteTailwindToken', () => {
  const sampleCode = `import React from 'react';

export function Card() {
  return (
    <div className="flex bg-blue-500 p-4">
      <span className="text-sm text-gray-600">Title</span>
    </div>
  );
}`;

  test('rewrites token on element located by line:col without data-gl-source', () => {
    // Opening element <div className="..."> is at line 5, col 5
    const updated = rewriteTailwindToken(sampleCode, 'src/Card.tsx:5:5', 'bg-', 'red-600');
    expect(updated).toContain('className="flex bg-red-600 p-4"');
    // Ensure span is untouched
    expect(updated).toContain('className="text-sm text-gray-600"');
  });

  test('rewrites token on element located by data-gl-source attribute', () => {
    const stampedCode = `export function Card() {
  return (
    <div data-gl-source="/src/Card.tsx:10:3" className="w-12 h-12 bg-white">
      Content
    </div>
  );
}`;
    const updated = rewriteTailwindToken(stampedCode, '/src/Card.tsx:10:3', 'w-', '[240px]');
    expect(updated).toContain('className="w-[240px] h-12 bg-white"');
  });

  test('adds className attribute if element does not have one', () => {
    const noClassCode = `export function Box() {
  return (
    <div>
      <span>No class</span>
    </div>
  );
}`;
    // <div ...> is at line 3, col 5
    const updated = rewriteTailwindToken(noClassCode, 'src/Box.tsx:3:5', 'p-', '6');
    expect(updated).toContain('<div className="p-6">');
  });

  test('removes token from JSX element when newValue is empty string', () => {
    const updated = rewriteTailwindToken(sampleCode, 'src/Card.tsx:5:5', 'bg-', '');
    expect(updated).toContain('className="flex p-4"');
  });

  test('preserves JSXExpressionContainer with StringLiteral', () => {
    const exprCode = `export function Banner() {
  return (
    <div className={'flex bg-indigo-500'}>
      Banner
    </div>
  );
}`;
    const updated = rewriteTailwindToken(exprCode, 'src/Banner.tsx:3:5', 'bg-', 'amber-400');
    expect(updated).toMatch(/className=\{['"]flex bg-amber-400['"]\}/);
  });

  test('throws NODE_NOT_FOUND if element is not in AST', () => {
    expect(() => {
      rewriteTailwindToken(sampleCode, 'src/Card.tsx:999:999', 'bg-', 'red-500');
    }).toThrow('NODE_NOT_FOUND');
  });
});
