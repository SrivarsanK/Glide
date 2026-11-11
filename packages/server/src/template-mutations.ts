import { layoutStyles, updateClassString, type JSXMutation } from '@srivarsank/ast-writer';
import { mutationVariants, type TailwindTheme } from '@srivarsank/core';
import { listVueElements, readVueClass, updateVueSFCClass, updateVueSFCStyle, updateVueSFCText } from '@srivarsank/adapter-vue';
import { listAstroElements, readAstroClassAt, setAstroClassAt, setAstroStyleAt, setAstroTextAt } from '@srivarsank/adapter-astro';
import { listSvelteElements, readSvelteClassAt, setSvelteClassAt, setSvelteStyleAt, setSvelteTextAt } from '@srivarsank/adapter-svelte';

type Edit = Pick<JSXMutation, 'line' | 'column' | 'change'>;
type Remap = { oldLine: number; oldColumn: number; oldHash: string; newHash: string; newCoordinates: { line: number; column: number } };

/** How one template language finds an element by the position of its opening tag and rewrites it. */
interface TemplateWriter {
  label: string;
  list(code: string): { line: number; column: number }[];
  readClass(code: string, line: number, column: number): string | null;
  setClass(code: string, line: number, column: number, classes: string): string;
  setStyle(code: string, line: number, column: number, styles: Record<string, string>): string;
  setText(code: string, line: number, column: number, text: string): string;
}

const vueId = (line: number, column: number) => `vue:${line}:${column}`;
const writers: Record<string, TemplateWriter> = {
  '.vue': { label: 'Vue', list: listVueElements,
    readClass: (code, line, column) => readVueClass(code, vueId(line, column)),
    setClass: (code, line, column, classes) => updateVueSFCClass(code, vueId(line, column), classes),
    setStyle: (code, line, column, styles) => updateVueSFCStyle(code, vueId(line, column), styles),
    setText: (code, line, column, text) => updateVueSFCText(code, vueId(line, column), text) },
  '.svelte': { label: 'Svelte', list: listSvelteElements, readClass: readSvelteClassAt,
    setClass: setSvelteClassAt, setStyle: setSvelteStyleAt, setText: setSvelteTextAt },
  '.astro': { label: 'Astro', list: listAstroElements, readClass: readAstroClassAt,
    setClass: setAstroClassAt, setStyle: setAstroStyleAt, setText: setAstroTextAt },
  // Plain HTML uses the same tag scanner; it has no expressions, so braces in text are literal.
  '.html': { label: 'HTML', list: listAstroElements, readClass: readAstroClassAt,
    setClass: setAstroClassAt, setStyle: setAstroStyleAt,
    setText: (code, line, column, text) => setAstroTextAt(code, line, column, text, true) },
};

function writerFor(file: string): TemplateWriter | undefined {
  const extension = Object.keys(writers).find(item => file.toLowerCase().endsWith(item));
  return extension ? writers[extension] : undefined;
}

/** Whether edits to this file go through a template writer instead of the JSX writer. */
export function isTemplateFile(file: string): boolean {
  return !!writerFor(file);
}

/** Apply class, style, layout and text edits to a Vue, Svelte, Astro or HTML template. Structural edits stay JSX-only. */
export function transformTemplateBatch(file: string, source: string, edits: Edit[], theme: TailwindTheme): { code: string; removed: never[]; remaps: Remap[] } {
  const writer = writerFor(file);
  if (!writer) throw new Error('UNSUPPORTED_OPERATION: Glide cannot save edits to this file type yet. Edit it in source.');
  const before = writer.list(source);
  let code = source;
  // Later positions first: an edit never moves a target that is still to come.
  const ordered = [...edits].sort((a, b) => b.line - a.line || b.column - a.column);
  for (const { line, column, change } of ordered) {
    const current = writer.readClass(code, line, column);
    if (current === null) throw new Error(`NODE_NOT_FOUND: No template element exists at ${line}:${column}.`);
    const scoped = mutationVariants(change, [...theme.breakpoints.keys()]).length > 0;
    const tailwind = (values: Record<string, unknown>) => {
      let classes = current;
      for (const [property, value] of Object.entries(values)) {
        classes = updateClassString(classes, property, value, change.breakpoint, change.pseudoState, theme);
      }
      if (classes !== current) code = writer.setClass(code, line, column, classes);
    };
    const inline = (values: Record<string, unknown>) => {
      if (scoped) throw new Error('UNSUPPORTED_OPERATION: Scoped styles require Tailwind authoring.');
      code = writer.setStyle(code, line, column, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])));
    };
    const values = change.value && typeof change.value === 'object' && !Array.isArray(change.value) ? change.value : null;
    if ((change as any).variant) throw new Error('UNSUPPORTED_OPERATION: Variant edits need a JSX cva className.');
    switch (change.type) {
      case 'class':
        if (!change.property) throw new Error('INVALID_OPERATION: Class edits need a property.');
        (change.authoringRepresentation === 'inline' ? inline : tailwind)({ [change.property]: change.value });
        break;
      case 'multi-class':
        if (!values) throw new Error('INVALID_OPERATION: Expected class properties.');
        (change.authoringRepresentation === 'inline' ? inline : tailwind)(values);
        break;
      case 'style':
        if (!values) throw new Error('INVALID_OPERATION: Expected style properties.');
        (change.authoringRepresentation === 'tailwind' ? tailwind : inline)(values);
        break;
      case 'layout': {
        const styles = layoutStyles(change.value, change.layoutPosition);
        (change.authoringRepresentation === 'tailwind' ? tailwind : inline)(styles);
        break;
      }
      case 'text':
        if (typeof change.value !== 'string') throw new Error('INVALID_OPERATION: Text must be a string.');
        code = writer.setText(code, line, column, change.value);
        break;
      default:
        throw new Error(`UNSUPPORTED_OPERATION: ${writer.label} templates do not support "${change.type}" edits yet. Edit this in source.`);
    }
  }
  const after = writer.list(code);
  if (after.length !== before.length) throw new Error('INVALID_OUTPUT: The template structure changed unexpectedly.');
  // Template stamps carry no content hash; a constant keeps remapped references parseable and consistent.
  return { code, removed: [], remaps: before.map((node, index) => ({
    oldLine: node.line, oldColumn: node.column, oldHash: '00000000', newHash: '00000000', newCoordinates: after[index] })) };
}
