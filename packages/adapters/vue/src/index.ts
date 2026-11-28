import { parse } from '@vue/compiler-sfc';
import { formattingWhitespace, mergeInlineStyle } from '@srivarsank/core';

// compiler-sfc 3.5 template AST locations refer to the complete authored SFC.
function target(code: string, id: string): any {
  const parsed = parse(code);
  if (parsed.errors.length || !parsed.descriptor.template?.ast) throw new Error('UNSUPPORTED_OPERATION: A valid HTML Vue template is required.');
  if (parsed.descriptor.template.lang && parsed.descriptor.template.lang !== 'html') throw new Error('UNSUPPORTED_OPERATION: Template preprocessors are not supported.');
  const coordinates = id.match(/^.*?:(\d+):(\d+)(?::[a-fA-F0-9]+)?$/);
  const matches: any[] = [];
  function walk(node: any) {
    if (node.type === 1) {
      const stamped = node.props.some((p: any) => p.type === 6 && p.name === 'data-gl-source' && p.value?.content === id);
      const located = coordinates && node.loc.start.line === Number(coordinates[1]) && node.loc.start.column === Number(coordinates[2]);
      if (stamped || located) matches.push(node);
    }
    for (const child of node.children || []) walk(child);
  }
  walk(parsed.descriptor.template.ast);
  if (matches.length > 1) throw new Error('INVALID_TARGET: Select exactly one authored Vue template node.');
  if (matches.length === 0) return null;
  return matches[0];
}
function escape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/{/g, '&#123;').replace(/}/g, '&#125;');
}
function replace(code: string, start: number, end: number, text: string) {
  const result = code.slice(0, start) + text + code.slice(end);
  if (parse(result).errors.length) throw new Error('INVALID_OUTPUT: The edit produced an invalid SFC.');
  return result;
}
/** The static attribute `name`, or null; throws when a binding may set it or it is duplicated. */
function staticAttribute(node: any, name: string): any {
  if (node.props.some((p: any) => p.type === 7 && p.name === 'bind'
    && (!p.arg || !p.arg.isStatic || p.arg.content.toLowerCase() === name.toLowerCase()))) throw new Error('UNSUPPORTED_OPERATION: Preserve the dynamic Vue binding in source.');
  // HTML attribute names ignore case, and the parser keeps them as written.
  const attrs = node.props.filter((p: any) => p.type === 6 && p.name.toLowerCase() === name.toLowerCase());
  if (attrs.length > 1) throw new Error('UNSUPPORTED_OPERATION: Duplicate attributes are ambiguous.');
  return attrs[0] ?? null;
}
function attribute(code: string, id: string, name: string, value: string | true | null | Record<string, string>) {
  const node = target(code, id);
  if (node === null) return code;
  const attr = staticAttribute(node, name);
  if (value === null) {
    if (!attr) return code;
    let start = attr.loc.start.offset;
    while (start > 0 && /\s/.test(code[start - 1])) start--;
    const end = attr.loc.end.offset;
    const sep = start < attr.loc.start.offset && code[end] && !/[\s/>]/.test(code[end]) ? ' ' : '';
    return replace(code, start, end, sep);
  }
  const text = value === true ? name : `${name}="${escape(typeof value === 'string' ? value : mergeInlineStyle(attr?.value?.content || '', value))}"`;
  if (attr) return replace(code, attr.loc.start.offset, attr.loc.end.offset, text);
  const offset = node.props.length ? node.props[node.props.length - 1].loc.end.offset : node.loc.start.offset + node.tag.length + 1;
  return replace(code, offset, offset, ` ${text}`);
}
/** A static attribute's value (true when it has none) or null when it is absent; throws when it is bound. */
export function readVueAttribute(code: string, id: string, name: string): string | true | null {
  const node = target(code, id);
  if (node === null) throw new Error('NODE_NOT_FOUND: No template element exists here.');
  const attr = staticAttribute(node, name);
  return attr ? attr.value?.content ?? true : null;
}
/** Add, change (text, or true for a bare attribute) or remove (null) a static attribute on an HTML element. */
export function updateVueSFCAttribute(code: string, id: string, name: string, value: string | true | null): string {
  // tagType 0 is a plain element; components, slots and <template> decide what they render.
  const node = target(code, id);
  if (node && node.tagType !== 0) throw new Error('UNSUPPORTED_OPERATION: Components take props they declare; set this on an HTML element, or add the prop in source.');
  return attribute(code, id, name, value);
}
function htmlElement(code: string, id: string): any {
  const node = target(code, id);
  if (node === null) throw new Error('NODE_NOT_FOUND: No template element exists here.');
  if (node.tagType !== 0) throw new Error('UNSUPPORTED_OPERATION: Only HTML elements can change their tag; a component decides what it renders.');
  return node;
}
/** The element at `id` with what a retag checks: its ancestors (nearest first), children and descendants. */
export function readVueTag(code: string, id: string) {
  const node = htmlElement(code, id);
  const all: any[] = [];
  const walk = (item: any) => { if (item.type === 1) all.push(item); for (const child of item.children || []) walk(child); };
  for (const child of parse(code).descriptor.template?.ast?.children || []) walk(child);
  const start = (item: any) => item.loc.start.offset, end = (item: any) => item.loc.end.offset;
  // A <template> wrapper (v-for, v-if, slots; tagType 3) renders only its children, so it is see-through here.
  const rendered = (item: any) => item.tagType !== 3;
  const inside = all.filter(item => start(item) > start(node) && end(item) <= end(node) && rendered(item));
  const focusable = (item: any) => item.props.some((p: any) => (p.type === 6 && p.name === 'tabindex') || (p.type === 7 && p.arg?.content === 'tabindex'));
  const children = (item: any): string[] => item.children.filter((child: any) => child.type === 1)
    .flatMap((child: any) => rendered(child) ? [child.tag as string] : children(child));
  return { name: node.tag as string,
    ancestors: all.filter(item => start(item) < start(node) && end(item) >= end(node) && rendered(item)).reverse().map(item => item.tag as string),
    childTags: children(node),
    descendants: inside.map(item => ({ tag: item.tag as string, focusable: focusable(item) })) };
}
/** Rename the element at `id`, opening and closing tag together. */
export function renameVueTag(code: string, id: string, to: string): string {
  const node = htmlElement(code, id);
  const start = node.loc.start.offset, end = node.loc.end.offset, closing = `</${node.tag}>`;
  if (!node.isSelfClosing && !node.loc.source.endsWith(closing)) throw new Error(`UNSUPPORTED_OPERATION: <${node.tag}> has no closing tag Glide can find; change it in source.`);
  let next = code;
  if (!node.isSelfClosing) next = next.slice(0, end - closing.length + 2) + to + next.slice(end - 1);
  return replace(code, 0, code.length, next.slice(0, start + 1) + to + next.slice(start + 1 + node.tag.length));
}
export function updateVueSFCClass(code: string, id: string, classes: string): string { return attribute(code, id, 'class', classes); }
export function updateVueSFCStyle(code: string, id: string, styles: Record<string, string>): string { return attribute(code, id, 'style', styles); }
export function updateVueSFCText(code: string, id: string, text: string): string {
  const node = target(code, id);
  if (node === null) return code;
  if (node.props.some((p: any) => p.type === 7 && ['text', 'html', 'pre'].includes(p.name))) throw new Error('UNSUPPORTED_OPERATION: Text is controlled by a directive.');
  const literals = node.children.filter((child: any) => child.type === 2 && child.content.trim());
  if (literals.length !== 1) throw new Error('UNSUPPORTED_OPERATION: Select one literal text segment.');
  const child = literals[0], raw = child.loc.source;
  const index = node.children.indexOf(child);
  const [lead, trail] = formattingWhitespace(raw, { before: index > 0, after: index < node.children.length - 1 });
  return replace(code, child.loc.start.offset, child.loc.end.offset, lead + escape(text) + trail);
}

/** The static class of the node at `id`, or null when no such node exists. */
export function readVueClass(code: string, id: string): string | null {
  const node = target(code, id);
  if (node === null) return null;
  return node.props.find((p: any) => p.type === 6 && p.name === 'class')?.value?.content ?? '';
}

/** Every template element in document order, with the one-based position of its opening tag. */
export function listVueElements(code: string): { line: number; column: number }[] {
  const ast = parse(code).descriptor.template?.ast;
  const result: { line: number; column: number }[] = [];
  const walk = (node: any) => {
    if (node.type === 1) result.push({ line: node.loc.start.line, column: node.loc.start.column });
    for (const child of node.children || []) walk(child);
  };
  if (ast) walk(ast);
  return result;
}
