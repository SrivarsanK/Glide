import { afterEach, expect, test } from 'vitest';
import { updateClassString, transformJSXBatch } from '../../packages/ast-writer/src/writer.js';
import { createMutationScope } from '../../packages/overlay/src/mutation-scope.js';
import { createSelectionFeedback } from '../../packages/overlay/src/selection-feedback.js';
import { closeTestProjects, startTestProject, request } from './server-fixture.js';

afterEach(closeTestProjects);

test('scoped tokens preserve base, other breakpoints, states, and arbitrary-value colons', () => {
  const classes = 'px-4 md:px-4 lg:px-4 md:hover:px-4 bg-[url(https://example.test/a:b)]';
  expect(updateClassString(classes, 'paddingInline', 24, 'md')).toBe('px-4 lg:px-4 md:hover:px-4 bg-[url(https://example.test/a:b)] md:px-6');
  expect(updateClassString(classes, 'paddingInline', 24, 'md:', 'hover:')).toBe('px-4 md:px-4 lg:px-4 bg-[url(https://example.test/a:b)] md:hover:px-6');
  expect(updateClassString('ml-2 md:ml-8 md:hover:ml-12', 'marginLeft', '+=4px', 'md')).toBe('ml-2 md:hover:ml-12 md:ml-9');
  // A background image is not a background color, so a color edit keeps it.
  expect(updateClassString('bg-[url(https://example.test/a:b)] md:bg-red-500', 'backgroundColor', 'blue')).toBe('bg-[url(https://example.test/a:b)] md:bg-red-500 bg-[blue]');
});

test('staging captures scope and keeps property edits in different scopes separate', () => {
  let breakpoint = 'md';
  const scope = createMutationScope(() => ({ breakpoint, pseudoState: 'hover' }));
  const first = scope.capture({ type: 'class', property: 'width', value: '20px' });
  breakpoint = 'lg';
  const second = scope.capture({ type: 'class', property: 'width', value: '30px' });
  expect(scope.capture(first).breakpoint).toBe('md');
  expect(scope.key(first, 'width')).not.toBe(scope.key(second, 'width'));
  expect(scope.entries({ type: 'multi-class', value: { width: '40px', height: '50px' }, breakpoint: 'md' })
    .map(entry => entry.change)).toEqual([
      { type: 'class', property: 'width', value: '40px', breakpoint: 'md', pseudoState: 'hover' },
      { type: 'class', property: 'height', value: '50px', breakpoint: 'md', pseudoState: 'hover' },
    ]);
  const style = scope.entries({ type: 'style', value: { width: '40px', height: '50px' } });
  expect(style[0].change).toMatchObject({ type: 'style', value: { width: '40px' }, breakpoint: 'lg' });
  expect(style[0].key).not.toBe(style[1].key);
});

test('live and staged combined scopes produce identical source and observer metadata', async () => {
  const source = 'const App = () => <button className="p-2 md:p-4 lg:p-6 md:hover:p-8">A</button>;';
  const live = await startTestProject(source), staged = await startTestProject(source);
  let observed: any;
  live.server.onEdit((_file, _line, _col, change) => { observed = change; });
  const scope = { breakpoint: 'md', pseudoState: 'hover', authoringRepresentation: 'tailwind' };
  const first = { ...live.edit({ type: 'class', property: 'padding', value: 40 }), ...scope };
  const second = { ...staged.edit(first.change), ...scope };
  expect((await request(await live.connect(), first)).success).toBe(true);
  expect((await request(await staged.connect(), { type: 'batch-edit', batchId: second.transactionId, edits: [second] })).success).toBe(true);
  expect(live.read()).toBe(staged.read());
  expect(live.read()).toContain('p-2 md:p-4 lg:p-6 md:hover:p-10');
  expect(observed).toMatchObject(scope);
});

test('inline authoring updates inline styles and rejects scoped inline mutations atomically', () => {
  const code = 'const x = <div className="md:p-4" style={{ color: "red" }} />;';
  const op = { line: 1, column: code.indexOf('<div') + 1, change: { type: 'class', property: 'width', value: '30px', authoringRepresentation: 'inline' as const } };
  expect(transformJSXBatch(code, [op]).code).toContain('width: "30px"');
  expect(() => transformJSXBatch(code, [{ ...op, breakpoint: 'md' }])).toThrow('UNSUPPORTED_SCOPE');
});

test('unmapped selection shows an accessible banner and disables mutation controls until remapped', () => {
  const banner = { hidden: true, textContent: '' } as HTMLElement;
  const attributes: Record<string, string> = {};
  const panel = { inert: false, setAttribute: (name: string, value: string) => { attributes[name] = value; } } as HTMLElement;
  const update = createSelectionFeedback(banner, panel);
  update(true, false);
  expect(banner.hidden).toBe(false);
  expect(banner.textContent).toContain('no editable source mapping');
  expect(panel.inert).toBe(true);
  expect(attributes['aria-disabled']).toBe('true');
  update(true, true);
  expect(banner.hidden).toBe(true);
  expect(panel.inert).toBe(false);
});
