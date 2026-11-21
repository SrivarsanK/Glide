import { expect, test } from 'vitest';
import { transformJSXBatch } from '../../packages/ast-writer/src/writer.js';

/** Apply one change to the element starting at `marker`. */
function edit(source: string, marker: string, change: Record<string, unknown>) {
  const index = source.indexOf(marker);
  const before = source.slice(0, index).split('\n');
  return transformJSXBatch(source, [{ line: before.length, column: before[before.length - 1].length + 1, change } as any]).code;
}
const app = (attributes: string) => `const App = () => <main><section ${attributes}>A</section></main>;`;
const display = (value: string, extra: Record<string, unknown> = {}) => ({ type: 'class', property: 'display', value, ...extra });

test('hiding adds `hidden` beside the display class, and showing restores the element as it was', () => {
  const hidden = edit(app('className="flex p-2"'), '<section', display('none'));
  expect(hidden).toContain('className="flex p-2 hidden"');
  expect(edit(hidden, '<section', display(''))).toContain('className="flex p-2"');
});

test('auto layout replaces the display class but leaves a hidden element hidden', () => {
  expect(edit(app('className="block p-2"'), '<section', display('flex'))).toContain('className="p-2 flex"');
  expect(edit(app('className="hidden p-2"'), '<section', display('flex'))).toContain('className="hidden p-2 flex"');
  expect(edit(app('className="flex p-2"'), '<section', display('block'))).toContain('className="p-2 block"');
});

test('inline hiding never loses an authored display value', () => {
  const inline = { authoringRepresentation: 'inline' };
  expect(() => edit(app(`style={{ display: 'flex' }}`), '<section', display('none', inline))).toThrow(/UNSUPPORTED_OPERATION/);
  const hidden = edit(app(`style={{ color: 'red' }}`), '<section', display('none', inline));
  expect(hidden).toMatch(/display: ['"]none['"]/);
  const shown = edit(hidden, '<section', display('', inline));
  expect(shown).not.toContain('display');
  expect(shown).toContain('color');
});

test('a radius edit replaces every radius class, and a corner edit keeps the overall radius', () => {
  const all = edit(app('className="rounded-[50%] rounded-tl-md p-1"'), '<section', { type: 'class', property: 'borderRadius', value: '8px' });
  expect(all).toContain('className="p-1 rounded-[8px]"');
  const corner = edit(app('className="rounded-[50%] p-1"'), '<section', { type: 'class', property: 'borderTopLeftRadius', value: '4px' });
  expect(corner).toContain('className="rounded-[50%] p-1 rounded-tl-[4px]"');
});
