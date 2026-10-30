import { expect, test } from 'vitest';
import { activeVariants, forwardsClassName } from '../../packages/ast-writer/src/edit-scope.js';
import { transformJSXBatch } from '../../packages/ast-writer/src/writer.js';

/** 1-based line and column of the element starting at `marker`. */
function at(source: string, marker: string): [number, number] {
  const before = source.slice(0, source.indexOf(marker)).split('\n');
  return [before.length, before[before.length - 1].length + 1];
}

function edit(source: string, marker: string, change: Record<string, unknown>): string {
  const [line, column] = at(source, marker);
  return transformJSXBatch(source, [{ line, column, change } as any]).code;
}

const BUTTON = `import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva("inline-flex items-center rounded-md", {
  variants: {
    variant: {
      default: "bg-primary text-white",
      ghost: "",
    },
    size: {
      default: "h-9 px-4",
      sm: "h-8 px-3",
      icon: "size-9",
    },
  },
  compoundVariants: [{ variant: "ghost", size: "sm", class: "underline" }],
  defaultVariants: { variant: "default", size: "default" },
})

export function Button({ className, variant, size, ...props }: any) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
`;

test('className forwarding follows cn, props.className and spreads of the props', () => {
  expect(forwardsClassName(BUTTON, ...at(BUTTON, '<button'))).toBe(true);
  const cases: [string, boolean][] = [
    ['({ className }: any) => <div className={`p-2 ${className}`} />', true],
    ['(props: any) => <div className={props.className} />', true],
    ['(props: any) => <Button size="lg" {...props} />', true],
    ['({ className, ...rest }: any) => <div {...rest} />', false],
    ['(props: any) => <section className="p-8" />', false],
    ['(props: any) => <div {...props} className="p-8" />', false],
    ['(props: any) => { const { className } = props; return <div className={className} />; }', true],
    ['({ title }: any) => <div className={title} />', false],
  ];
  for (const [component, expected] of cases) {
    const source = `export const C = ${component};\n`;
    const marker = source.match(/<(div|section|Button)/)![0];
    expect([component, forwardsClassName(source, ...at(source, marker))]).toEqual([component, expected]);
  }
});

test('active variants come from the props, falling back to defaultVariants', () => {
  const [line, column] = at(BUTTON, '<button');
  expect(activeVariants(BUTTON, line, column, { size: 'sm' })).toEqual([
    { group: 'variant', option: 'default', definition: 'buttonVariants', shared: false },
    { group: 'size', option: 'sm', definition: 'buttonVariants', shared: false },
  ]);
  // An empty option can still take a class; an unknown value names no option.
  expect(activeVariants(BUTTON, line, column, { variant: 'ghost', size: 'xl' })).toEqual([
    { group: 'variant', option: 'ghost', definition: 'buttonVariants', shared: false },
  ]);
  const exported = BUTTON.replace('const buttonVariants', 'export const buttonVariants');
  expect(activeVariants(exported, line, column, {})[0].shared).toBe(true);
});

test('a variant edit changes only that option', () => {
  const variant = (group: string, option: string) => ({ variant: { group, option } });
  expect(edit(BUTTON, '<button', { type: 'class', property: 'paddingInline', value: '8px', ...variant('size', 'sm') }))
    .toBe(BUTTON.replace('sm: "h-8 px-3"', 'sm: "h-8 px-2"'));
  expect(edit(BUTTON, '<button', { type: 'class', property: 'marginTop', value: '4px', ...variant('size', 'sm') }))
    .toBe(BUTTON.replace('sm: "h-8 px-3"', 'sm: "h-8 px-3 mt-1"'));
  // The base sets the radius; the variant follows the base, so it may override it.
  expect(edit(BUTTON, '<button', { type: 'class', property: 'borderTopLeftRadius', value: '2px', ...variant('size', 'sm') }))
    .toContain('sm: "h-8 px-3 rounded-tl-[2px]"');
  // An exported definition changes for every user of the option, which the scope says.
  const exported = BUTTON.replace('const buttonVariants', 'export const buttonVariants');
  expect(edit(exported, '<button', { type: 'class', property: 'height', value: '40px', ...variant('size', 'default') }))
    .toContain('default: "h-10 px-4"');
});

test('a variant edit is refused when a class outside the option may win', () => {
  const change = (property: string, group: string, option: string) => ({ type: 'class', property, value: '16px', variant: { group, option } });
  expect(() => edit(BUTTON, '<button', change('padding', 'size', 'xl')))
    .toThrow('The `size` variant has no "xl" class string.');
  const compound = BUTTON.replace('class: "underline"', 'class: "px-6"');
  expect(() => edit(compound, '<button', change('paddingInline', 'size', 'sm')))
    .toThrow('The padding inline is also set by a compound variant.');
  const local = BUTTON.replace('cn(buttonVariants({ variant, size, className }))', 'cn(buttonVariants({ variant, size }), "px-1", className)');
  expect(() => edit(local, '<button', change('paddingInline', 'size', 'sm')))
    .toThrow('The padding inline is also set by `px-1` on this element.');
  expect(() => edit('export const A = () => <div className="p-2" />;\n', '<div', change('padding', 'size', 'sm')))
    .toThrow('Variant edits need a cva className.');
});
