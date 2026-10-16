import { expect, test } from 'vitest';
import { inspectJSXProps } from '../../packages/ast-writer/src/props.js';
import { transformJSXBatch } from '../../packages/ast-writer/src/writer.js';

const source = `type Props = { variant: 'primary' | 'quiet'; disabled: boolean; count: number; title: string; missing?: string };
const Button = (props: Props) => <button>{props.title}</button>;
const App = () => <main><Button variant="primary" disabled count={2} title="First" /><Button variant="quiet" disabled={false} count={3} title="Second" /></main>;`;
const column = source.split('\n')[2].indexOf('<Button') + 1;
const change = (property: string, value: unknown, scope = 'call-site') => transformJSXBatch(source, [{ line: 3, column, change: { type: 'prop', property, value, scope } }]);

test('inspects boolean, number, string and declared enum props at the exact call site', () => {
  const info = inspectJSXProps(source, 3, column);
  expect(info.scope).toBe('call-site');
  expect(info.props).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: 'variant', kind: 'enum', choices: ['primary', 'quiet'], value: 'primary' }),
    expect.objectContaining({ name: 'disabled', kind: 'boolean', value: true }),
    expect.objectContaining({ name: 'count', kind: 'number', value: 2 }),
    expect.objectContaining({ name: 'title', kind: 'string', value: 'First' }),
    expect.objectContaining({ name: 'missing', reason: expect.stringContaining('unknown') }),
  ]));
});

test.each([['variant', 'quiet'], ['disabled', false], ['count', -2.5], ['title', 'Quoted " <&>{text}']])('edits %s without changing another call site', (property, value) => {
  const result = change(property as string, value);
  expect(result.code).toContain('<Button variant="quiet" disabled={false} count={3} title="Second" />');
  expect(inspectJSXProps(result.code, 3, column).props.find(p => p.name === property)?.value).toBe(value);
});

test('rejects values outside declared types and incorrect scope', () => {
  expect(() => change('variant', 'invalid')).toThrow('INVALID_PROP');
  expect(() => change('count', 'five')).toThrow('INVALID_PROP');
  expect(() => change('title', 'new', 'source-element')).toThrow('INVALID_SCOPE');
  expect(() => change('missing', 'new')).toThrow('UNSUPPORTED_OPERATION');
});

test.each(['<Button title={computed} />', '<Button title="Static" {...props} />', '<Button {...props} title="Static" />', '<Button title="One" title="Two" />'])('preserves unsupported call site %s', element => {
  const code = `const App = () => ${element};`;
  expect(inspectJSXProps(code, 1, 19).props.find(p => p.name === 'title')?.reason).toBeTruthy();
  expect(() => transformJSXBatch(code, [{ line: 1, column: 19, change: { type: 'prop', property: 'title', value: 'New', scope: 'call-site' } }])).toThrow('UNSUPPORTED_OPERATION');
});
