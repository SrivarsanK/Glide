import { expect, test } from 'vitest';
import { transformJSXBatch } from '../../packages/ast-writer/src/writer.js';

/** Apply one change to the element starting at `marker` and return the printed file. */
function edit(source: string, marker: string, change: Record<string, unknown>): string {
  const index = source.indexOf(marker);
  const before = source.slice(0, index).split('\n');
  const op = { line: before.length, column: before[before.length - 1].length + 1, change } as any;
  return transformJSXBatch(source, [op]).code;
}

const padding = (value = '16px') => ({ type: 'class', property: 'padding', value });

/** One element inside a component that receives the usual props. */
function component(jsx: string): string {
  return `export function A({ className, active, error, extra, styles, size, ...props }: any) {\n  return ${jsx};\n}\n`;
}

// Modeled on shadcn/ui's button: a cva definition, cn, and a rest spread.
const BUTTON = `import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        outline: "border bg-background shadow-xs hover:bg-accent",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
`;

const CARD = `import * as React from "react"

import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
        className
      )}
      {...props}
    />
  )
}

export { Card }
`;

const INPUT = `import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn("flex h-9 w-full rounded-md border px-3 py-1", className)}
        ref={ref}
        {...props}
      />
    )
  }
)
`;

test('cn and clsx edits change only the classes that always apply', () => {
  expect(edit(component('<div className={cn("p-2 flex", className)}>x</div>'), '<div', padding()))
    .toContain('className={cn("p-4 flex", className)}');
  expect(edit(component(`<div className={clsx('flex p-2', active && 'bg-primary')}>x</div>`), '<div', padding()))
    .toContain(`className={clsx('flex p-4', active && 'bg-primary')}`);
  expect(edit(component('<div className={twMerge("flex", "p-2", "p-3")}>x</div>'), '<div', padding()))
    .toContain('className={twMerge("flex", "p-4")}');
  expect(edit(component('<div className={cn("p-2 md:p-4", className)}>x</div>'), '<div', { ...padding('24px'), breakpoint: 'md' }))
    .toContain('className={cn("p-2 md:p-6", className)}');
  expect(edit(component('<div className={clsx("p-2", { "bg-red-500": error })}>x</div>'), '<div', padding()))
    .toContain('className={clsx("p-4", { "bg-red-500": error })}');
});

test('a class goes in front of passed-in classes, so callers can still override it', () => {
  expect(edit(component('<div className={cn(className)}>x</div>'), '<div', padding()))
    .toContain('className={cn("p-4", className)}');
});

test('template literal edits keep interpolations and runtime-built classes', () => {
  expect(edit(component('<div className={`p-2 flex ${extra}`}>x</div>'), '<div', padding()))
    .toContain('className={`p-4 flex ${extra}`}');
  expect(edit(component('<div className={`flex ${extra}`}>x</div>'), '<div', padding()))
    .toContain('className={`p-4 flex ${extra}`}');
  expect(() => edit(component('<div className={`flex p-${size}`}>x</div>'), '<div', padding()))
    .toThrow('The padding depends on a class built at runtime (`p-…`)');
});

test('an edit a condition would override is refused with the condition named', () => {
  expect(() => edit(component('<div className={cn("p-2", active && "p-6")}>x</div>'), '<div', padding()))
    .toThrow('The padding is also set when `active`.');
  expect(() => edit(component('<div className={cn("p-2", active ? "px-6" : "px-2")}>x</div>'), '<div', padding()))
    .toThrow('The padding is also set when `active`.');
  expect(() => edit(component('<div className={clsx("p-2", { "p-8": error })}>x</div>'), '<div', padding()))
    .toThrow('The padding is also set when `error`.');
});

test('classes Glide cannot read are refused with the reason', () => {
  expect(() => edit(component('<div className={className}>x</div>'), '<div', padding()))
    .toThrow('passed in through `className`. Edit them where the component is used.');
  expect(() => edit(component('<div className={styles.card}>x</div>'), '<div', padding()))
    .toThrow('The classes come from `styles.card`, which Glide cannot edit.');
  expect(() => edit(component('<div className={cn("p-2")}>x</div>'), '<div', { type: 'class', property: 'className', value: 'flex' }))
    .toThrow('Replacing every class needs a static className string.');
});

test('a spread blocks an edit only when it may carry the attribute', () => {
  expect(edit(component('<div {...props} className="p-2">x</div>'), '<div', padding()))
    .toContain('<div {...props} className="p-4">x</div>');
  expect(() => edit('export const A = (props: any) => <div className="p-2" {...props}>x</div>;\n', '<div', padding()))
    .toThrow('className may come from a spread attribute.');
  expect(() => edit('export const A = ({ type, ...props }: any) => <div className="p-2" {...props}>x</div>;\n', '<div', padding()))
    .toThrow('className may come from a spread attribute.');
  // Inline edits add a style attribute after the spread, which `props.style` would have set.
  expect(() => edit(CARD, '<div', { type: 'class', property: 'width', value: '30px', authoringRepresentation: 'inline' }))
    .toThrow('style may come from a spread attribute.');
  const withStyle = CARD.replace('{ className, ...props }', '{ className, style, ...props }');
  expect(edit(withStyle, '<div', { type: 'class', property: 'width', value: '30px', authoringRepresentation: 'inline' }))
    .toContain('style={{\n        width: "30px"\n      }}');
});

test('shadcn-style card and input edits change the class in place', () => {
  expect(edit(CARD, '<div', { type: 'class', property: 'gap', value: '16px' }))
    .toContain('"bg-card text-card-foreground flex flex-col gap-4 rounded-xl border py-6 shadow-sm",\n        className');
  expect(edit(INPUT, '<input', { type: 'class', property: 'width', value: '320px' }))
    .toContain('className={cn("flex h-9 w-80 rounded-md border px-3 py-1", className)}');
});

test('shadcn-style button edits the cva base and refuses what a variant sets', () => {
  const justified = edit(BUTTON, '<Comp', { type: 'class', property: 'justifyContent', value: 'start' });
  expect(justified).toContain('"inline-flex items-center justify-start gap-2 whitespace-nowrap rounded-md text-sm font-medium disabled:opacity-50",');
  expect(justified).toContain('default: "h-9 px-4 py-2 has-[>svg]:px-3",');
  expect(edit(BUTTON, '<Comp', { type: 'class', property: 'width', value: '320px' }))
    .toContain('className={cn("w-80", buttonVariants({ variant, size, className }))}');
  expect(() => edit(BUTTON, '<Comp', padding()))
    .toThrow('The padding is also set by the `size` variant.');
  expect(() => edit(BUTTON, '<Comp', { type: 'class', property: 'backgroundColor', value: '#000' }))
    .toThrow('The background color is also set by the `variant` variant.');
  expect(() => edit(BUTTON, '<Comp', { type: 'class', property: 'gap', value: '4px' }))
    .toThrow('The gap is also set by the `size` variant.');
});

test('a condition blocks a color edit only when it may set a color', () => {
  const color = { type: 'class', property: 'color', value: '#ff0000' };
  expect(edit(component('<p className={cn("text-gray-700", active && "text-sm text-center")}>x</p>'), '<p', color))
    .toContain('className={cn("text-[#ff0000]", active && "text-sm text-center")}');
  expect(() => edit(component('<p className={cn("text-gray-700", active && "text-brand")}>x</p>'), '<p', color))
    .toThrow('The color is also set when `active`.');
});
