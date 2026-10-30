import { afterEach, describe, expect, test } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { transformJSXBatch, updateClassString } from '../../packages/ast-writer/src/writer.js';
import { loadTailwindTheme } from '../../packages/core/src/tailwind-theme.js';
import { colorToken, defaultTailwindTheme, parseColor, type TailwindTheme } from '../../packages/core/src/tailwind-tokens.js';
import { MutationService, contentDigest } from '../../packages/server/src/mutation-service.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

function project(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-theme-'));
  roots.push(root);
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return root;
}

const V4_DEFAULTS = `@theme default {
  --color-gray-700: oklch(37.3% 0.034 259.733);
  --color-blue-500: #3b82f6;
  --text-sm: 0.875rem;
  --text-sm--line-height: calc(1.25 / 0.875);
  --text-lg: 1.125rem;
  --text-shadow-sm: 0px 1px 2px rgb(0 0 0 / 0.075);
  --breakpoint-sm: 40rem;
  --breakpoint-md: 48rem;
  --spacing: 0.25rem;
}`;

function v4Project(): string {
  return project({
    'node_modules/tailwindcss/package.json': JSON.stringify({ name: 'tailwindcss', version: '4.1.0' }),
    'node_modules/tailwindcss/theme.css': V4_DEFAULTS,
    'src/index.css': `@import "tailwindcss";
@theme inline {
  --color-primary: var(--primary);
  --text-body: 1rem;
  --breakpoint-3xl: 120rem;
}
:root { --primary: #6d28d9; }
.dark { --primary: #a78bfa; }`,
  });
}

/** Apply one class edit to `jsx` and return the edited JSX line. */
function edit(jsx: string, change: any, theme?: TailwindTheme): string {
  const source = `export default function A({ className }: any) {\n  return ${jsx};\n}\n`;
  const column = source.split('\n')[1].indexOf('<') + 1;
  return transformJSXBatch(source, [{ line: 2, column, change }], { theme }).code.split('\n')[1].trim();
}

describe('Tailwind class edits keep classes they cannot classify', () => {
  test('a color edit keeps a custom font-size token', () => {
    expect(edit('<p className="text-body text-gray-700">Hi</p>', { type: 'class', property: 'color', value: '#ff0000' }))
      .toBe('return <p className="text-body text-[#ff0000]">Hi</p>;');
  });

  test('a color edit keeps an arbitrary rem font size', () => {
    expect(edit('<h1 className="text-[1.125rem] font-bold">T</h1>', { type: 'class', property: 'color', value: '#ff0000' }))
      .toBe('return <h1 className="text-[1.125rem] font-bold text-[#ff0000]">T</h1>;');
  });

  test('a font-size edit keeps an unknown text token and replaces only sizes', () => {
    expect(updateClassString('text-body text-sm text-red-500', 'fontSize', 18)).toBe('text-body text-red-500 text-lg');
    expect(updateClassString('text-red-500 text-[13px]', 'fontSize', 18)).toBe('text-red-500 text-[18px]');
  });

  test('background and border color edits keep non-color utilities', () => {
    expect(updateClassString('bg-cover bg-center bg-red-500', 'backgroundColor', '#000')).toBe('bg-cover bg-center bg-black');
    expect(updateClassString('border-t border-2 border-red-500', 'borderColor', '#fff')).toBe('border-t border-2 border-white');
  });

  test('arbitrary values with spaces stay one class', () => {
    expect(updateClassString('p-2', 'backgroundColor', 'rgb(1 2 3)')).toBe('p-2 bg-[rgb(1_2_3)]');
  });
});

describe('Tailwind theme', () => {
  test('v4 reads @theme blocks, resolves var() against :root, and marks project tokens', () => {
    const theme = loadTailwindTheme(v4Project());
    expect(theme.version).toBe(4);
    expect(theme.colors.get('primary')).toBe('#6d28d9');
    expect(theme.projectColors.has('primary')).toBe(true);
    expect(theme.projectColors.has('blue-500')).toBe(false);
    expect(theme.fontSizes.get('body')).toBe('1rem');
    expect(theme.fontSizes.has('sm--line-height')).toBe(false);
    expect(theme.fontSizes.has('shadow-sm')).toBe(false);
    expect(updateClassString('text-shadow-sm text-sm', 'fontSize', 18, undefined, undefined, theme)).toBe('text-shadow-sm text-lg');
    expect([...theme.breakpoints.keys()]).toEqual(['sm', 'md', '3xl']);
    expect(theme.spacingStep).toBe('0.25rem');
  });

  test('v4 edits write theme tokens instead of raw values', () => {
    const theme = loadTailwindTheme(v4Project());
    expect(edit('<button className="px-4">Go</button>', { type: 'class', property: 'backgroundColor', value: '#6d28d9' }, theme))
      .toBe('return <button className="px-4 bg-primary">Go</button>;');
    expect(edit('<button className="bg-primary px-4">Go</button>', { type: 'class', property: 'backgroundColor', value: '#3b82f6' }, theme))
      .toBe('return <button className="px-4 bg-blue-500">Go</button>;');
    expect(edit('<p className="text-gray-700">Hi</p>', { type: 'class', property: 'color', value: 'rgb(109 40 217 / 0.5)' }, theme))
      .toBe('return <p className="text-primary/50">Hi</p>;');
    expect(edit('<div className="rounded-lg border p-6">card</div>', { type: 'class', property: 'width', value: '320px' }, theme))
      .toBe('return <div className="rounded-lg border p-6 w-80">card</div>;');
    expect(edit('<div className="p-2">x</div>', { type: 'class', property: 'padding', value: '10px' }, theme))
      .toBe('return <div className="p-2.5">x</div>;');
    expect(edit('<div className="p-2">x</div>', { type: 'class', property: 'padding', value: '13px' }, theme))
      .toBe('return <div className="p-[13px]">x</div>;');
  });

  test('a color no token matches stays arbitrary', () => {
    const theme = loadTailwindTheme(v4Project());
    expect(edit('<p className="text-primary">Hi</p>', { type: 'class', property: 'color', value: '#123456' }, theme))
      .toBe('return <p className="text-[#123456]">Hi</p>;');
  });

  test('breakpoints come from the theme', () => {
    const theme = loadTailwindTheme(v4Project());
    expect(edit('<div className="p-2">x</div>', { type: 'class', property: 'padding', value: '16px', breakpoint: '3xl', authoringRepresentation: 'tailwind' }, theme))
      .toBe('return <div className="p-2 3xl:p-4">x</div>;');
    expect(() => edit('<div className="p-2">x</div>', { type: 'class', property: 'padding', value: '16px', breakpoint: 'lg' }, theme))
      .toThrow('UNSUPPORTED_SCOPE');
  });

  test('v3 uses the project resolveConfig and resolves shadcn-style channels', () => {
    const root = project({
      'node_modules/tailwindcss/package.json': JSON.stringify({ name: 'tailwindcss', version: '3.4.17' }),
      'node_modules/tailwindcss/loadConfig.js': 'module.exports = file => require(file);',
      'node_modules/tailwindcss/resolveConfig.js': `module.exports = config => ({ theme: {
        colors: { red: { 500: '#ef4444' }, ...config.theme.extend.colors },
        fontSize: { sm: ['0.875rem', { lineHeight: '1.25rem' }], ...config.theme.extend.fontSize },
        spacing: { 0: '0px', 4: '1rem', 18: '4.5rem' },
        screens: { sm: '640px', tablet: { min: '900px' } },
      } });`,
      'tailwind.config.cjs': `module.exports = { theme: { extend: {
        colors: { brand: { DEFAULT: 'hsl(var(--brand) / <alpha-value>)', foreground: '#fff' } },
        fontSize: { body: ['1rem', { lineHeight: '1.5rem' }] },
      } } };`,
      'src/app.css': ':root { --brand: 262 83% 58%; }',
    });
    const theme = loadTailwindTheme(root);
    expect(theme.version).toBe(3);
    expect(theme.colors.get('brand')).toBe('hsl(262 83% 58%)');
    expect([...theme.projectColors]).toEqual(['brand', 'brand-foreground']);
    expect(theme.fontSizes.get('body')).toBe('1rem');
    expect([...theme.breakpoints.keys()]).toEqual(['sm', 'tablet']);
    expect(colorToken('hsl(262 83% 58%)', theme)).toBe('brand');
    expect(updateClassString('text-body text-red-500', 'color', '#fff', undefined, undefined, theme)).toBe('text-body text-brand-foreground');
    expect(updateClassString('m-4', 'margin', '72px', 'tablet', undefined, theme)).toBe('m-4 tablet:m-18');
  });

  test('without Tailwind installed, default token names are used', () => {
    const theme = loadTailwindTheme(project({ 'src/index.css': 'body { margin: 0; }' }));
    expect(theme.version).toBeNull();
    expect(theme.fontSizes.has('lg')).toBe(true);
  });

  test('the cache picks up stylesheet changes', async () => {
    const root = v4Project();
    expect(loadTailwindTheme(root).colors.get('primary')).toBe('#6d28d9');
    const css = path.join(root, 'src/index.css');
    fs.writeFileSync(css, fs.readFileSync(css, 'utf8').replace('#6d28d9', '#0f766e'));
    fs.utimesSync(css, new Date(), new Date(Date.now() + 5000));
    expect(loadTailwindTheme(root).colors.get('primary')).toBe('#0f766e');
  });
});

describe('Color parsing', () => {
  test('oklch converts to sRGB', () => {
    const red = parseColor('oklch(62.8% 0.2577 29.23)')!;
    expect(Math.abs(red.r - 255)).toBeLessThanOrEqual(1);
    expect(red.g).toBeLessThanOrEqual(1);
    expect(red.b).toBeLessThanOrEqual(1);
    expect(parseColor('#3b82f680')).toEqual({ r: 59, g: 130, b: 246, a: 0.5 });
    expect(parseColor('hsl(0 100% 50%)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseColor('var(--x)')).toBeNull();
  });

  test('default theme names classify but never match a value', () => {
    expect(colorToken('#ef4444', defaultTailwindTheme())).toBeNull();
    expect(colorToken('#ffffff', defaultTailwindTheme())).toBe('white');
  });
});

test('the mutation service writes the project theme token', async () => {
  const root = v4Project();
  const source = 'export const A = () => <button className="px-4 bg-gray-700">Go</button>;';
  fs.writeFileSync(path.join(root, 'A.tsx'), source);
  const result = await new MutationService(root).execute('theme', [{
    operationId: 'one', filePath: 'A.tsx', expectedDigest: contentDigest(source), line: 1,
    column: source.indexOf('<button') + 1, change: { type: 'class', property: 'backgroundColor', value: '#6d28d9' },
  }]);
  expect(result.success).toBe(true);
  expect(fs.readFileSync(path.join(root, 'A.tsx'), 'utf8')).toContain('className="px-4 bg-primary"');
});
