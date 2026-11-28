/**
 * Compiler-based Svelte template edits. Elements are found by the exact position
 * of their opening tag in the parsed template, never by a text search.
 */
import { parse } from 'svelte/compiler';
import { formattingWhitespace, mergeInlineStyle } from '@srivarsank/core';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

/** Blank non-CSS `<style lang="...">` bodies (preserving newlines and offsets) so Svelte's parser accepts preprocessed styles. */
function maskPreprocessedStyles(code: string): string {
  return code.replace(
    /(<style\b[^>]*\blang\s*=\s*(?:"(?!css")[^"]*"|'(?!css')[^']*'|(?!=css\b)[^\s>]+)[^>]*>)([\s\S]*?)(?=<\/style\s*>)/gi,
    (_m, open: string, body: string) => open + body.replace(/[^\n]/g, ' ')
  );
}

function parseSvelte(code: string): any {
  try {
    return parse(code, { modern: true });
  } catch (err) {
    const masked = maskPreprocessedStyles(code);
    if (masked === code) throw err;
    return parse(masked, { modern: true });
  }
}

function collectNodes(code: string, includeComponents: boolean): any[] {
  let root: any;
  try { root = parseSvelte(code); }
  catch { throw new Error('UNSUPPORTED_OPERATION: A valid Svelte component is required.'); }
  const found: any[] = [];
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.type === 'RegularElement' || (includeComponents && node.type === 'Component')) found.push(node);
    for (const [key, child] of Object.entries(node)) {
      // Attributes and expressions hold no template elements.
      if (!['attributes', 'expression', 'test', 'metadata'].includes(key)) walk(child);
    }
  };
  walk(root.fragment);
  return found.sort((a, b) => a.start - b.start);
}

function elements(code: string): any[] {
  return collectNodes(code, false);
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
  try { parseSvelte(result); }
  catch { throw new Error('INVALID_OUTPUT: The edit produced an invalid Svelte component.'); }
  return result;
}

/** The literal value of a static attribute; throws when the attribute is dynamic or ambiguous. */
function staticAttribute(node: any, name: string): { attribute: any; value: string } | null {
  if (node.attributes.some((item: any) => item.type === 'SpreadAttribute')) {
    throw new Error(`UNSUPPORTED_OPERATION: ${name} may come from a spread attribute.`);
  }
  const lower = name.toLowerCase();
  if (lower === 'style' && node.attributes.some((item: any) => item.type === 'StyleDirective')) {
    throw new Error('UNSUPPORTED_OPERATION: Preserve the dynamic Svelte style directive in source.');
  }
  if (lower === 'class' && node.attributes.some((item: any) => item.type === 'ClassDirective')) {
    throw new Error('UNSUPPORTED_OPERATION: Preserve the dynamic Svelte class directive in source.');
  }
  if (node.attributes.some((item: any) => item.type === 'BindDirective' && item.name?.toLowerCase() === lower)) {
    throw new Error(`UNSUPPORTED_OPERATION: Preserve the dynamic Svelte bind:${name} directive in source.`);
  }
  // HTML attribute names ignore case, and the parser keeps them as written.
  const matches = node.attributes.filter((item: any) => item.type === 'Attribute' && item.name.toLowerCase() === lower);
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

/** The element at line:column with what a retag checks: its ancestors (nearest first), children and descendants. */
export function readSvelteTagAt(code: string, line: number, column: number) {
  const node = target(code, line, column);
  if (!node) throw new Error(`NODE_NOT_FOUND: No template element exists at ${line}:${column}.`);
  const all = collectNodes(code, true);
  const inside = all.filter(item => item.start > node.start && item.end <= node.end);
  return { name: node.name as string,
    ancestors: all.filter(item => item.start < node.start && item.end >= node.end).reverse().map(item => item.name as string),
    childTags: inside.filter(item => !inside.some(other => other.start < item.start && other.end >= item.end)).map(item => item.name as string),
    descendants: inside.map(item => ({ tag: item.name as string,
      focusable: (item.attributes || []).some((attribute: any) => attribute.type === 'Attribute' && attribute.name.toLowerCase() === 'tabindex') })) };
}

/** Rename the element at line:column, opening and closing tag together. */
export function renameSvelteTagAt(code: string, line: number, column: number, to: string): string {
  const node = target(code, line, column);
  if (!node) throw new Error(`NODE_NOT_FOUND: No template element exists at ${line}:${column}.`);
  if (VOID.has(node.name.toLowerCase())) throw new Error(`UNSUPPORTED_OPERATION: <${node.name}> has no content to keep; replace it in source.`);
  const selfClosing = code.slice(node.end - 2, node.end) === '/>', closing = `</${node.name}>`;
  if (!selfClosing && !code.slice(node.start, node.end).endsWith(closing)) throw new Error(`UNSUPPORTED_OPERATION: <${node.name}> has no closing tag Glide can find; change it in source.`);
  let next = code;
  if (!selfClosing) next = next.slice(0, node.end - closing.length + 2) + to + next.slice(node.end - 1);
  return replace(code, 0, code.length, next.slice(0, node.start + 1) + to + next.slice(node.start + 1 + node.name.length));
}

/** A static attribute's value (true when it has none) or null when it is absent; throws when it is dynamic. */
export function readSvelteAttributeAt(code: string, line: number, column: number, name: string): string | true | null {
  const node = target(code, line, column);
  if (!node) throw new Error(`NODE_NOT_FOUND: No template element exists at ${line}:${column}.`);
  const current = staticAttribute(node, name);
  return current ? (current.attribute.value === true ? true : current.value) : null;
}

/** Add, change (text, or true for a bare attribute) or remove (null) a static attribute. */
export function setSvelteAttributeAt(code: string, line: number, column: number, name: string, value: string | true | null): string {
  if (typeof value === 'string') return setAttribute(code, line, column, name, () => value);
  const node = target(code, line, column);
  if (!node) throw new Error(`NODE_NOT_FOUND: No template element exists at ${line}:${column}.`);
  const current = staticAttribute(node, name);
  if (value === true) {
    if (current) return replace(code, current.attribute.start, current.attribute.end, name);
    const offset = node.start + 1 + node.name.length;
    return replace(code, offset, offset, ' ' + name);
  }
  if (!current) return code;
  let start = current.attribute.start;
  while (start > 0 && /\s/.test(code[start - 1])) start--;
  const end = current.attribute.end;
  const sep = start < current.attribute.start && code[end] && !/[\s/>]/.test(code[end]) ? ' ' : '';
  return replace(code, start, end, sep);
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
  const nodes = node.fragment.nodes, index = nodes.indexOf(literals[0]);
  const [lead, trail] = formattingWhitespace(raw, { before: index > 0, after: index < nodes.length - 1 });
  return replace(code, literals[0].start, literals[0].end, lead + escape(text) + trail);
}
