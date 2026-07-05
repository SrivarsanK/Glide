import { describe, expect, test } from 'vitest';
import { updateCSSModuleRule } from '../../packages/ast-writer/src/css.js';

describe('CSS Modules Rule Modifier', () => {
  test('should update existing CSS property values', () => {
    const css = `
      .card {
        padding: 12px;
        background: #fff;
      }
    `;

    const updated = updateCSSModuleRule(css, 'card', { padding: '16px' });

    expect(updated).toContain('padding: 16px;');
    expect(updated).toContain('background: #fff;');
  });

  test('should add new property declarations to existing rule', () => {
    const css = `
      .btn {
        color: red;
      }
    `;

    const updated = updateCSSModuleRule(css, 'btn', { margin: '8px' });

    expect(updated).toContain('color: red;');
    expect(updated).toContain('margin: 8px;');
  });

  test('should append new class rule block if missing from stylesheet', () => {
    const css = `.title { font-size: 24px; }`;
    const updated = updateCSSModuleRule(css, 'subtitle', { color: 'blue', 'font-weight': 'bold' });

    expect(updated).toContain('.subtitle {');
    expect(updated).toContain('color: blue;');
    expect(updated).toContain('font-weight: bold;');
  });

  test('should remove property declaration if value is null or empty', () => {
    const css = `
      .card {
        padding: 12px;
        margin: 8px;
      }
    `;

    const updated = updateCSSModuleRule(css, 'card', { padding: null });

    expect(updated).not.toContain('padding:');
    expect(updated).toContain('margin: 8px;');
  });
});
