import { expect, test } from 'vitest';
import { transformJSXBatch } from '../../packages/ast-writer/src/writer.js';
import { defaultTailwindTheme } from '../../packages/core/src/tailwind-tokens.js';

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

test('in Tailwind v4, hiding an inline-block element uses `hidden!`, because v4 sorts `inline-block` after `hidden`', () => {
  const v4 = { ...defaultTailwindTheme(), version: 4 as const };
  const at = (source: string) => { const before = source.slice(0, source.indexOf('<section')).split('\n'); return { line: before.length, column: before.at(-1)!.length + 1 }; };
  const run = (source: string, value: string) => transformJSXBatch(source, [{ ...at(source), change: display(value) } as any], { theme: v4 }).code;
  const hidden = run(app('className="inline-block p-2"'), 'none');
  expect(hidden).toContain('className="inline-block p-2 hidden!"');
  expect(run(hidden, '')).toContain('className="inline-block p-2"');
  expect(run(app('className="flex p-2"'), 'none')).toContain('className="flex p-2 hidden"');
});

test('important display classes are matched, and hiding them uses an important hidden', () => {
  const v4 = { ...defaultTailwindTheme(), version: 4 as const };
  const v3 = { ...defaultTailwindTheme(), version: 3 as const };
  const at = (source: string) => { const before = source.slice(0, source.indexOf('<section')).split('\n'); return { line: before.length, column: before.at(-1)!.length + 1 }; };
  const run = (source: string, value: string, theme: any) => transformJSXBatch(source, [{ ...at(source), change: display(value) } as any], { theme }).code;
  expect(run(app('className="flex! p-2"'), 'block', v4)).toContain('className="p-2 block"');
  expect(run(app('className="flex! p-2"'), 'none', v4)).toContain('className="flex! p-2 hidden!"');
  expect(run(app('className="!flex p-2"'), 'none', v3)).toContain('className="!flex p-2 !hidden"');
  // A later display edit keeps a hidden element hidden.
  expect(run(app('className="flex p-2 hidden"'), 'inline-block', v4)).toContain('className="p-2 inline-block hidden!"');
  expect(run(app('className="flex p-2 hidden"'), 'grid', v4)).toContain('className="p-2 hidden grid"');
});

test('hiding beats a responsive display class, and showing keeps an authored `hidden`', () => {
  const v4 = { ...defaultTailwindTheme(), version: 4 as const };
  const v3 = { ...defaultTailwindTheme(), version: 3 as const };
  const at = (source: string) => { const before = source.slice(0, source.indexOf('<section')).split('\n'); return { line: before.length, column: before.at(-1)!.length + 1 }; };
  const run = (source: string, value: string, theme: any) => transformJSXBatch(source, [{ ...at(source), change: display(value) } as any], { theme }).code;
  // `md:flex` wins over a plain `hidden` from md up.
  const hidden = run(app('className="md:flex p-2"'), 'none', v4);
  expect(hidden).toContain('className="md:flex p-2 hidden!"');
  expect(run(hidden, '', v4)).toContain('className="md:flex p-2"');
  expect(run(app('className="md:flex p-2"'), 'none', v3)).toContain('className="md:flex p-2 !hidden"');
  // The authored `hidden` hides below md; hiding at md and showing again must leave it.
  const both = run(app('className="hidden md:flex"'), 'none', v4);
  expect(both).toContain('className="hidden md:flex hidden!"');
  expect(run(both, '', v4)).toContain('className="hidden md:flex"');
  // A display edit still leaves the authored responsive pair alone.
  expect(run(app('className="hidden md:flex"'), 'grid', v4)).toContain('className="hidden md:flex grid"');
});

test('showing is refused when a condition adds `hidden`, because the edit could not undo it', () => {
  const source = 'import { clsx } from "clsx";\nconst App = ({ concealed }) => <main><section className={clsx("p-2", concealed && "hidden")}>A</section></main>;';
  expect(() => edit(source, '<section', display(''))).toThrow(/UNSUPPORTED_OPERATION/);
});
