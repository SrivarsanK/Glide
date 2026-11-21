import { expect, test } from 'vitest';
import { transformJSXBatch } from '../../packages/ast-writer/src/writer.js';
import { defaultTailwindTheme } from '../../packages/core/src/tailwind-tokens.js';
import { createInteractions } from '../../packages/overlay/src/interactions.js';

function edit(source: string, value: Record<string, string>, extra: Record<string, unknown> = {}, theme = defaultTailwindTheme()) {
  const before = source.slice(0, source.indexOf('<section')).split('\n');
  return transformJSXBatch(source, [{ line: before.length, column: before.at(-1)!.length + 1,
    change: { type: 'multi-class', value, ...extra } } as any], { theme }).code;
}
const app = (attributes: string) => `const App = () => <main><section ${attributes}>A</section></main>;`;
const animate = { transitionProperty: 'all', transitionDuration: '200ms', transitionTimingFunction: 'ease-out' };
const none = { transitionProperty: '', transitionDuration: '', transitionTimingFunction: '' };

test('writes a transition as classes, replacing the previous one', () => {
  const animated = edit(app('className="p-2"'), animate);
  expect(animated).toContain('className="p-2 transition-all duration-200 ease-out"');
  expect(edit(animated, { ...animate, transitionDuration: '500ms', transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)' }))
    .toContain('className="p-2 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"');
  // Off v3's scale: arbitrary in v3, a plain step in v4.
  expect(edit(app('className="p-2"'), { transitionDuration: '250ms' })).toContain('duration-[250ms]');
  expect(edit(app('className="p-2"'), { transitionDuration: '250ms' }, {}, { ...defaultTailwindTheme(), version: 4 })).toContain('duration-250');
});

test('an empty value removes the classes, also inside cn()', () => {
  expect(edit(app('className="p-2 transition-all duration-200 ease-out hover:bg-sky-500"'), none)).toContain('className="p-2 hover:bg-sky-500"');
  const source = 'import { cn } from "./cn";\nconst App = () => <main><section className={cn("p-2 duration-200", true && "m-1")}>A</section></main>;';
  expect(edit(source, { transitionDuration: '' })).toContain('cn("p-2", true && "m-1")');
});

test('inline format writes and removes the same transition as style properties', () => {
  const inline = { authoringRepresentation: 'inline' };
  const animated = edit(app("style={{ color: 'red' }}"), animate, inline);
  expect(animated).toMatch(/transitionDuration: ['"]200ms['"]/);
  const still = edit(animated, none, inline);
  expect(still).not.toContain('transition');
  expect(still).toContain('color');
});

test('reads the animation back from classes or inline style', () => {
  const { animation } = createInteractions();
  expect(animation('p-2 transition-all duration-200 ease-in-out hover:duration-700', '')).toEqual({ duration: '200ms', easing: 'ease-in-out' });
  expect(animation('duration-[250ms] ease-[cubic-bezier(0.2,0,0,1)]', '')).toEqual({ duration: '250ms', easing: 'cubic-bezier(0.2,0,0,1)' });
  expect(animation('', 'color: red; transition-duration: 300ms; transition-timing-function: linear;')).toEqual({ duration: '300ms', easing: 'linear' });
  expect(animation('p-2', '')).toEqual({ duration: '', easing: 'ease-out' });
});
