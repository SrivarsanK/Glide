import { parse } from '@vue/compiler-sfc';
import { mergeInlineStyle } from '@srivarsank/core';

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
function attribute(code: string, id: string, name: string, value: string | Record<string, string>) {
  const node = target(code, id);
  if (node === null) return code;
  if (node.props.some((p: any) => p.type === 7 && p.name === 'bind'
    && (!p.arg || !p.arg.isStatic || p.arg.content === name))) throw new Error('UNSUPPORTED_OPERATION: Preserve the dynamic Vue binding in source.');
  const attrs = node.props.filter((p: any) => p.type === 6 && p.name === name);
  if (attrs.length > 1) throw new Error('UNSUPPORTED_OPERATION: Duplicate attributes are ambiguous.');
  const attr = attrs[0];
  const next = typeof value === 'string' ? value : mergeInlineStyle(attr?.value?.content || '', value);
  if (attr) return replace(code, attr.loc.start.offset, attr.loc.end.offset, `${name}="${escape(next)}"`);
  const offset = node.props.length ? node.props[node.props.length - 1].loc.end.offset : node.loc.start.offset + node.tag.length + 1;
  return replace(code, offset, offset, ` ${name}="${escape(next)}"`);
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
  return replace(code, child.loc.start.offset, child.loc.end.offset,
    (raw.match(/^\s*/)?.[0] || '') + escape(text) + (raw.match(/\s*$/)?.[0] || ''));
}
