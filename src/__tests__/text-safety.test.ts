import { parse } from '@babel/parser';
import { describe, expect, test } from 'vitest';
import { updateJSXText } from '../../packages/ast-writer/src/writer.js';

describe('Literal text isolation', () => {
  test('rejects multiple literal segments without an explicit target', () => {
    const code = 'const A = () => <p>Hello <strong>{name}</strong>!</p>;';
    expect(() => updateJSXText(code, 1, code.indexOf('<p>') + 1, 'Welcome'))
      .toThrow(/UNSUPPORTED_OPERATION:.*text/);
  });

  test('keeps nested markup and expressions around one literal segment', () => {
    const code = 'const A = () => <p><Icon />Hello <strong>{name}</strong></p>;';
    const result = updateJSXText(code, 1, code.indexOf('<p>') + 1, 'Welcome');
    expect(result).toBe(code.replace('Hello ', 'Welcome '));
  });

  test.each(['{name}', '<Icon />', '{...children}', '{/* Keep this comment. */}'])
  ('rejects children without a literal segment: %s', (children) => {
    const code = `const A = () => <p>${children}</p>;`;
    expect(() => updateJSXText(code, 1, code.indexOf('<p>') + 1, 'Welcome'))
      .toThrow(/UNSUPPORTED_OPERATION:.*text/);
  });

  test.each(['A & B < C > D {name}', 'line one\nline two', '"quoted" \\ text', ''])
  ('preserves the requested text through a syntax round trip: %s', (value) => {
    const code = 'const A = () => <p>{"Before"}<Icon />{name}</p>;';
    const result = updateJSXText(code, 1, code.indexOf('<p>') + 1, value);
    const ast = parse(result, { sourceType: 'module', plugins: ['jsx'] });
    const init = (ast.program.body[0] as any).declarations[0].init;
    expect(init.body.children[0].expression.value).toBe(value);
    expect(result).toContain('<Icon />{name}');
  });
});
