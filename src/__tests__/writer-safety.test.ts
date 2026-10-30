import { describe, expect, test } from 'vitest';
import { updateClassName, updateJSXStyleProp } from '../../packages/ast-writer/src/writer.js';

describe('Dynamic source protection', () => {
  test.each([
    'className={active ? "p-2" : "p-4"}',
    'className={classes}',
    'className={styles.button}',
    'className={cx("p-2", active)}',
    'className={`p-2 ${extra}`}',
    'className="p-2" {...props}',
    'className="p-2" className="p-4"',
  ])('rejects dynamic or ambiguous classes: %s', (attributes) => {
    const code = `const A = () => <button ${attributes}>A</button>;`;
    expect(() => updateClassName(code, 1, code.indexOf('<button') + 1, 'padding', 16))
      .toThrow(/UNSUPPORTED_OPERATION:.*className/);
  });

  test('a spread before className cannot override it, so the edit is allowed', () => {
    const code = 'const A = () => <button {...props} className="p-2">A</button>;';
    expect(updateClassName(code, 1, code.indexOf('<button') + 1, 'padding', 16)).toContain('{...props} className="p-4"');
  });

  test.each([
    'style={theme.button}',
    'style={styles}',
    'style={active ? first : second}',
    'style={{ ...base, color: "blue" }}',
    'style={{ [key]: "blue" }}',
    'style={{ color: theme.color }}',
    'style={{ color }}',
    'style={{ get color() { return "blue"; } }}',
    '{...props}',
  ])('rejects dynamic styles: %s', (attributes) => {
    const code = `const A = () => <button ${attributes}>A</button>;`;
    expect(() => updateJSXStyleProp(code, 1, code.indexOf('<button') + 1, { color: 'red' }))
      .toThrow(/UNSUPPORTED_OPERATION:.*style/);
  });

  test('preserves literal class expressions', () => {
    const code = 'const A = () => <button className={"p-2 flex"}>A</button>;';
    expect(updateClassName(code, 1, code.indexOf('<button') + 1, 'padding', 16))
      .toContain('className={"flex p-4"}');
  });

  test('updates quoted style keys without duplicate properties', () => {
    const code = 'const A = () => <button style={{ "color": "blue", opacity: 0.5 }}>A</button>;';
    const result = updateJSXStyleProp(code, 1, code.indexOf('<button') + 1, { color: 'red' });
    expect(result).not.toContain('blue');
    expect(result).toContain('opacity: 0.5');
  });
});
