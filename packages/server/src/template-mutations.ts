import { checkAttributeValue, checkRetag, layoutStyles, RETAG_TARGETS, templateAttributeName, updateClassString, type JSXMutation, type RetagSurroundings } from '@srivarsank/ast-writer';
import { mutationVariants, type TailwindTheme } from '@srivarsank/core';
import { listVueElements, readVueAttribute, readVueClass, readVueTag, renameVueTag, updateVueSFCAttribute, updateVueSFCClass, updateVueSFCStyle, updateVueSFCText } from '@srivarsank/adapter-vue';
import { listAstroElements, readAstroAttributeAt, readAstroClassAt, readAstroTagAt, renameAstroTagAt, setAstroAttributeAt, setAstroClassAt, setAstroStyleAt, setAstroTextAt } from '@srivarsank/adapter-astro';
import { listSvelteElements, readSvelteAttributeAt, readSvelteClassAt, readSvelteTagAt, renameSvelteTagAt, setSvelteAttributeAt, setSvelteClassAt, setSvelteStyleAt, setSvelteTextAt } from '@srivarsank/adapter-svelte';

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
  readAttribute(code: string, line: number, column: number, name: string): string | true | null;
  setAttribute(code: string, line: number, column: number, name: string, value: string | true | null): string;
  readTag(code: string, line: number, column: number): Omit<RetagSurroundings, 'attribute'> & { name: string };
  renameTag(code: string, line: number, column: number, to: string): string;
}

const vueId = (line: number, column: number) => `vue:${line}:${column}`;
const writers: Record<string, TemplateWriter> = {
  '.vue': { label: 'Vue', list: listVueElements,
    readClass: (code, line, column) => readVueClass(code, vueId(line, column)),
    setClass: (code, line, column, classes) => updateVueSFCClass(code, vueId(line, column), classes),
    setStyle: (code, line, column, styles) => updateVueSFCStyle(code, vueId(line, column), styles),
    setText: (code, line, column, text) => updateVueSFCText(code, vueId(line, column), text),
    readAttribute: (code, line, column, name) => readVueAttribute(code, vueId(line, column), name),
    setAttribute: (code, line, column, name, value) => updateVueSFCAttribute(code, vueId(line, column), name, value),
    readTag: (code, line, column) => readVueTag(code, vueId(line, column)),
    renameTag: (code, line, column, to) => renameVueTag(code, vueId(line, column), to) },
  '.svelte': { label: 'Svelte', list: listSvelteElements, readClass: readSvelteClassAt,
    setClass: setSvelteClassAt, setStyle: setSvelteStyleAt, setText: setSvelteTextAt,
    readAttribute: readSvelteAttributeAt, setAttribute: setSvelteAttributeAt, readTag: readSvelteTagAt, renameTag: renameSvelteTagAt },
  '.astro': { label: 'Astro', list: listAstroElements, readClass: readAstroClassAt,
    setClass: setAstroClassAt, setStyle: setAstroStyleAt, setText: setAstroTextAt,
    readAttribute: readAstroAttributeAt, setAttribute: setAstroAttributeAt, readTag: readAstroTagAt, renameTag: renameAstroTagAt },
  // Plain HTML uses the same tag scanner; it has no expressions, so braces in text are literal.
  '.html': { label: 'HTML', list: listAstroElements, readClass: readAstroClassAt,
    setClass: setAstroClassAt, setStyle: setAstroStyleAt,
    setText: (code, line, column, text) => setAstroTextAt(code, line, column, text, true),
    readAttribute: readAstroAttributeAt, setAttribute: setAstroAttributeAt, readTag: readAstroTagAt, renameTag: renameAstroTagAt },
};

function writerFor(file: string): TemplateWriter | undefined {
  const extension = Object.keys(writers).find(item => file.toLowerCase().endsWith(item));
  return extension ? writers[extension] : undefined;
}

/** Whether edits to this file go through a template writer instead of the JSX writer. */
export function isTemplateFile(file: string): boolean {
  return !!writerFor(file);
}

/** Add, change or remove one attribute with the same rules as JSX (props.ts), with names as HTML spells them. */
function writeAttribute(writer: TemplateWriter, code: string, line: number, column: number, property: unknown, raw: unknown): string {
  const name = templateAttributeName(String(property ?? ''));
  if (!name) throw new Error(`UNSUPPORTED_OPERATION: ${property} is not an attribute the editor can set. Edit it in source.`);
  const value = checkAttributeValue(name, raw);
  if (name === 'id' && typeof value === 'string') {
    // shortcut: a text match, so an id inside a script string also counts; refusing errs on the safe side.
    // Quoted or unquoted (`id=hero`, which HTML allows).
    const uses = code.match(new RegExp(`(?<![\\w-])id\\s*=\\s*(["']?)${value}\\1(?![\\w-])`, 'gi'))?.length ?? 0;
    if (uses > (writer.readAttribute(code, line, column, 'id') === value ? 1 : 0)) throw new Error(`INVALID_PROP: The id "${value}" is already used in this file.`);
  }
  code = writer.setAttribute(code, line, column, name, value);
  // A new tab must not get a handle on this page.
  if (name === 'target' && value === '_blank') {
    const rel = writer.readAttribute(code, line, column, 'rel');
    const tokens = typeof rel === 'string' ? rel.split(/\s+/).filter(Boolean) : [];
    code = writer.setAttribute(code, line, column, 'rel', [...new Set([...tokens, 'noopener', 'noreferrer'])].join(' '));
  }
  return code;
}

/** Apply class, style, layout, text, attribute and retag edits to a Vue, Svelte, Astro or HTML template. Other structural edits stay JSX-only. */
export function transformTemplateBatch(file: string, source: string, edits: Edit[], theme: TailwindTheme): { code: string; removed: never[]; remaps: Remap[] } {
  const writer = writerFor(file);
  if (!writer) throw new Error('UNSUPPORTED_OPERATION: Glide cannot save edits to this file type yet. Edit it in source.');
  const before = writer.list(source);
  let code = source;
  // Later positions first: an edit never moves a target that is still to come.
  const ordered = [...edits].sort((a, b) => b.line - a.line || b.column - a.column);
  for (const { line, column, change } of ordered) {
    if (!writer.list(code).some(at => at.line === line && at.column === column)) throw new Error(`NODE_NOT_FOUND: No template element exists at ${line}:${column}.`);
    const scoped = mutationVariants(change, [...theme.breakpoints.keys()]).length > 0;
    const tailwind = (values: Record<string, unknown>) => {
      const current = writer.readClass(code, line, column) ?? '';
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
      case 'attribute':
        code = writeAttribute(writer, code, line, column, change.property, change.value);
        break;
      case 'retag': {
        // The JSX rules (structure.ts): check the tag, set the attributes, then check validity and rename.
        const from = writer.readTag(code, line, column).name, to = String((change as any).tagName ?? '');
        if (!/^[a-z]/.test(from)) throw new Error('UNSUPPORTED_OPERATION: Only HTML elements can change their tag; a component decides what it renders.');
        if (!RETAG_TARGETS.has(to)) throw new Error(`UNSUPPORTED_OPERATION: <${to}> is not a tag the editor can switch to.`);
        const attributes = (change as any).attributes && typeof (change as any).attributes === 'object' ? (change as any).attributes : {};
        for (const [name, value] of Object.entries(attributes)) code = writeAttribute(writer, code, line, column, name, value);
        if (from === to) break;
        checkRetag(from, to, { ...writer.readTag(code, line, column), attribute: name => writer.readAttribute(code, line, column, name) });
        // A button inside a form submits it unless it says otherwise.
        if (to === 'button' && writer.readAttribute(code, line, column, 'type') === null) code = writer.setAttribute(code, line, column, 'type', 'button');
        code = writer.renameTag(code, line, column, to);
        break;
      }
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
