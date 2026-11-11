/**
 * Compiler-based Svelte template edits. Elements are found by the exact position
 * of their opening tag in the parsed template, never by a text search.
 */
import { parse } from 'svelte/compiler';
import { mergeInlineStyle } from '@srivarsank/core';

function elements(code: string): any[] {
  let root: any;
  try { root = parse(code, { modern: true }); }
  catch { throw new Error('UNSUPPORTED_OPERATION: A valid Svelte component is required.'); }
  const found: any[] = [];
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.type === 'RegularElement') found.push(node);
    for (const [key, child] of Object.entries(node)) {
      // Attributes and expressions hold no template elements.
      if (!['attributes', 'expression', 'test', 'metadata'].includes(key)) walk(child);
    }
  };
  walk(root.fragment);
  return found.sort((a, b) => a.start - b.start);
}

function position(code: string, offset: number): { line: number; column: number } {
  const before = code.slice(0, offset);
  return { line: before.split('\n').length, column: offset - before.lastIndexOf('\n') };
}

function target(code: string, line: number, column: number): any | null {
  return elements(code).find(node => {
    const at = position(code, node.start);
    return at.line === line && at.column === column;
  }) ?? null;
}

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/{/g, '&#123;').replace(/}/g, '&#125;');
}

function replace(code: string, start: number, end: number, text: string): string {
  const result = code.slice(0, start) + text + code.slice(end);
  try { parse(result, { modern: true }); }
  catch { throw new Error('INVALID_OUTPUT: The edit produced an invalid Svelte component.'); }
  return result;
}

/** The literal value of a static attribute; throws when the attribute is dynamic or ambiguous. */
function staticAttribute(node: any, name: string): { attribute: any; value: string } | null {
  if (node.attributes.some((item: any) => item.type === 'SpreadAttribute')) {
    throw new Error(`UNSUPPORTED_OPERATION: ${name} may come from a spread attribute.`);
  }
  const matches = node.attributes.filter((item: any) => item.type === 'Attribute' && item.name === name);
  if (matches.length > 1) throw new Error('UNSUPPORTED_OPERATION: Duplicate attributes are ambiguous.');
  const attribute = matches[0];
  if (!attribute) return null;
  const parts = attribute.value === true ? [] : Array.isArray(attribute.value) ? attribute.value : [attribute.value];
  if (parts.some((part: any) => part.type !== 'Text')) {
    throw new Error(`UNSUPPORTED_OPERATION: Preserve the dynamic Svelte ${name} in source.`);
  }
  return { attribute, value: parts.map((part: any) => part.data).join('') };
}

function setAttribute(code: string, line: number, column: number, name: string, next: (current: string) => string): string {
  const node = target(code, line, column);
  if (!node) throw new Error(`NODE_NOT_FOUND: No template element exists at ${line}:${column}.`);
  const current = staticAttribute(node, name);
  const text = `${name}="${escape(next(current?.value ?? ''))}"`;
  if (current) return replace(code, current.attribute.start, current.attribute.end, text);
  const offset = node.start + 1 + node.name.length;
  return replace(code, offset, offset, ' ' + text);
}

/** Every template element in document order, with the one-based position of its opening tag. */
export function listSvelteElements(code: string): { line: number; column: number }[] {
  return elements(code).map(node => position(code, node.start));
}

/** The static class of the element at line:column, or null when no such element exists. */
export function readSvelteClassAt(code: string, line: number, column: number): string | null {
  const node = target(code, line, column);
  return node ? staticAttribute(node, 'class')?.value ?? '' : null;
}

export function setSvelteClassAt(code: string, line: number, column: number, classes: string): string {
  return setAttribute(code, line, column, 'class', () => classes);
}

export function setSvelteStyleAt(code: string, line: number, column: number, styles: Record<string, string>): string {
  return setAttribute(code, line, column, 'style', current => mergeInlineStyle(current, styles));
}

export function setSvelteTextAt(code: string, line: number, column: number, text: string): string {
  const node = target(code, line, column);
  if (!node) throw new Error(`NODE_NOT_FOUND: No template element exists at ${line}:${column}.`);
  const literals = node.fragment.nodes.filter((child: any) => child.type === 'Text' && child.data.trim());
  if (literals.length !== 1) throw new Error('UNSUPPORTED_OPERATION: Select one literal text segment.');
  const raw = code.slice(literals[0].start, literals[0].end);
  return replace(code, literals[0].start, literals[0].end,
    (raw.match(/^\s*/)?.[0] || '') + escape(text) + (raw.match(/\s*$/)?.[0] || ''));
}
