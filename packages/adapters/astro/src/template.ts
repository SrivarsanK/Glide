/**
 * Position-based Astro template edits. An element is the opening tag that starts
 * exactly at line:column; its attributes are scanned with quotes and `{}`
 * expressions respected. Anything dynamic or ambiguous is refused, not guessed.
 */
import { formattingWhitespace, mergeInlineStyle } from '@srivarsank/core';

interface Attribute { name: string; start: number; end: number; value: string | null; dynamic: boolean }
interface Tag { name: string; start: number; end: number; selfClosing: boolean; attributes: Attribute[]; spread: boolean }

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const invalid = (): never => { throw new Error('UNSUPPORTED_OPERATION: This tag has a form Glide cannot read safely. Edit it in source.'); };

/** Frontmatter, comments, scripts and styles blanked out, with every offset kept. */
function mask(code: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, ' ');
  return code.replace(/^\s*---[\s\S]*?\n---/, blank).replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/<script[\s\S]*?<\/script>/gi, blank).replace(/<style[\s\S]*?<\/style>/gi, blank)
    // Textarea and title hold text, so a `</section>` written inside one is not a tag.
    .replace(/(<(textarea|title)\b[^>]*>)([\s\S]*?)(?=<\/\2\s*>)/gi, (_match, open: string, _name: string, body: string) => open + blank(body));
}

function tagStarts(code: string): number[] {
  const clean = mask(code), starts: number[] = [];
  const pattern = /<([a-zA-Z][a-zA-Z0-9.-]*)/g;
  for (let match; (match = pattern.exec(clean));) {
    if (['template', 'script', 'style'].includes(match[1].toLowerCase())) continue;
    if (clean[match.index + 1 + match[1].length] === ':') continue;
    starts.push(match.index);
  }
  return starts;
}

function position(code: string, offset: number): { line: number; column: number } {
  const before = code.slice(0, offset);
  return { line: before.split('\n').length, column: offset - before.lastIndexOf('\n') };
}

/** The offset after the `}` that closes the `{` at `open`, with strings and nested braces skipped. */
function closeBrace(code: string, open: number): number {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    const char = code[i];
    if (char === '"' || char === "'" || char === '`') {
      for (i++; i < code.length && code[i] !== char; i++) if (code[i] === '\\') i++;
    } else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return i + 1;
  }
  return invalid();
}

/** Decode HTML character references in a single pass so `&amp;quot;` becomes `&quot;`, not `"`. */
function decodeHtmlEntities(raw: string): string {
  if (!raw.includes('&')) return raw;
  return raw.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|([a-zA-Z]+));/g, (match, dec, hex, named) => {
    if (dec !== undefined) {
      const cp = Number.parseInt(dec, 10);
      return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : match;
    }
    if (hex !== undefined) {
      const cp = Number.parseInt(hex, 16);
      return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : match;
    }
    switch (named) {
      case 'quot': return '"';
      case 'apos': return "'";
      case 'lt': return '<';
      case 'gt': return '>';
      case 'amp': return '&';
      default: return match;
    }
  });
}

function readTag(code: string, start: number, anyName = false): Tag {
  const name = /^<([a-zA-Z][a-zA-Z0-9.-]*)/.exec(code.slice(start, start + 80))?.[1] ?? invalid();
  if (!anyName && !/^[a-z][a-z0-9-]*$/.test(name)) throw new Error('UNSUPPORTED_OPERATION: Components are edited where they are defined. Select an HTML element.');
  const attributes: Attribute[] = [];
  let spread = false, i = start + 1 + name.length;
  for (;;) {
    while (/\s/.test(code[i] ?? '')) i++;
    if (i >= code.length) invalid();
    if (code[i] === '>') return { name, start, end: i + 1, selfClosing: false, attributes, spread };
    if (code.startsWith('/>', i)) return { name, start, end: i + 2, selfClosing: true, attributes, spread };
    if (code[i] === '{') { spread = true; i = closeBrace(code, i); continue; }
    const attributeStart = i;
    while (i < code.length && !/[\s=>]/.test(code[i]) && !code.startsWith('/>', i)) i++;
    const attributeName = code.slice(attributeStart, i);
    if (!attributeName) invalid();
    let value: string | null = null, dynamic = false;
    if (code[i] === '=') {
      i++;
      const quote = code[i];
      if (quote === '"' || quote === "'") {
        const close = code.indexOf(quote, i + 1);
        if (close < 0) invalid();
        value = decodeHtmlEntities(code.slice(i + 1, close));
        i = close + 1;
      } else if (quote === '{') { dynamic = true; i = closeBrace(code, i); }
      else if (quote === '`') { dynamic = true; i = code.indexOf('`', i + 1) + 1 || invalid(); }
      else {
        const valueStart = i;
        while (i < code.length && !/[\s>]/.test(code[i])) i++;
        value = decodeHtmlEntities(code.slice(valueStart, i));
      }
    }
    attributes.push({ name: attributeName, start: attributeStart, end: i, value, dynamic });
  }
}

function target(code: string, line: number, column: number): Tag | null {
  const start = tagStarts(code).find(offset => {
    const at = position(code, offset);
    return at.line === line && at.column === column;
  });
  return start === undefined ? null : readTag(code, start);
}

function staticAttribute(tag: Tag, name: string): Attribute | null {
  if (tag.spread) throw new Error(`UNSUPPORTED_OPERATION: ${name} may come from a spread attribute.`);
  // HTML attribute names ignore case: `HREF` and `popoverTarget` are `href` and `popovertarget`.
  const lower = name.toLowerCase();
  if (tag.attributes.some(item => item.name.toLowerCase().startsWith(lower + ':'))) {
    throw new Error(`UNSUPPORTED_OPERATION: Preserve the dynamic Astro ${name} directive in source.`);
  }
  const matches = tag.attributes.filter(item => item.name.toLowerCase() === lower);
  if (matches.length > 1) throw new Error('UNSUPPORTED_OPERATION: Duplicate attributes are ambiguous.');
  if (matches[0]?.dynamic) throw new Error(`UNSUPPORTED_OPERATION: Preserve the dynamic Astro ${name} in source.`);
  return matches[0] ?? null;
}

function checked(before: string, after: string): string {
  if (tagStarts(after).length !== tagStarts(before).length) throw new Error('INVALID_OUTPUT: The edit changed the template structure.');
  return after;
}

function setAttribute(code: string, line: number, column: number, name: string, next: (current: string) => string,
  escape = (value: string) => value.replace(/"/g, '&quot;')): string {
  const tag = target(code, line, column);
  if (!tag) throw new Error(`NODE_NOT_FOUND: No template element exists at ${line}:${column}.`);
  const current = staticAttribute(tag, name);
  const text = `${name}="${escape(next(current?.value ?? ''))}"`;
  if (current) return checked(code, code.slice(0, current.start) + text + code.slice(current.end));
  const offset = tag.start + 1 + tag.name.length;
  return checked(code, code.slice(0, offset) + ' ' + text + code.slice(offset));
}

interface TreeNode { name: string; start: number; parent: number; close: number | null; focusable: boolean }

/** Elements matched to their closing tags. `close` is the offset of `</name`, null for self-closing and void tags. */
function tree(code: string): TreeNode[] {
  const clean = mask(code), nodes: TreeNode[] = [], open: number[] = [];
  const pattern = /<(\/?)([a-zA-Z][a-zA-Z0-9.-]*)/g;
  for (let match; (match = pattern.exec(clean));) {
    const name = match[2];
    if (['template', 'script', 'style'].includes(name.toLowerCase()) || clean[match.index + match[0].length] === ':') continue;
    if (match[1]) {
      let depth = open.length - 1;
      while (depth >= 0 && nodes[open[depth]].name !== name) depth--;
      // A stray closing tag closes nothing; unclosed elements in between keep close = null.
      if (depth >= 0) { nodes[open[depth]].close = match.index; open.length = depth; }
      continue;
    }
    const tag = readTag(code, match.index, true);
    nodes.push({ name, start: match.index, parent: open.length ? open[open.length - 1] : -1, close: null,
      focusable: tag.attributes.some(item => item.name.toLowerCase() === 'tabindex') });
    if (!tag.selfClosing && !VOID.has(name)) open.push(nodes.length - 1);
    pattern.lastIndex = tag.end;
  }
  return nodes;
}

/** The element at line:column with what a retag checks: its ancestors (nearest first), children and descendants. */
export function readAstroTagAt(code: string, line: number, column: number) {
  const tag = target(code, line, column);
  if (!tag) throw new Error(`NODE_NOT_FOUND: No template element exists at ${line}:${column}.`);
  const nodes = tree(code), index = nodes.findIndex(node => node.start === tag.start);
  if (index < 0) invalid();
  const ancestors: string[] = [];
  for (let parent = nodes[index].parent; parent >= 0; parent = nodes[parent].parent) ancestors.push(nodes[parent].name);
  const within = (node: TreeNode) => { for (let p = node.parent; p >= 0; p = nodes[p].parent) if (p === index) return true; return false; };
  return { name: tag.name, ancestors, childTags: nodes.filter(node => node.parent === index).map(node => node.name),
    descendants: nodes.filter(within).map(node => ({ tag: node.name, focusable: node.focusable })) };
}

/** Rename the element at line:column, opening and closing tag together. */
export function renameAstroTagAt(code: string, line: number, column: number, to: string): string {
  const tag = target(code, line, column);
  if (!tag) throw new Error(`NODE_NOT_FOUND: No template element exists at ${line}:${column}.`);
  if (VOID.has(tag.name)) throw new Error(`UNSUPPORTED_OPERATION: <${tag.name}> has no content to keep; replace it in source.`);
  const close = tree(code).find(node => node.start === tag.start)?.close ?? null;
  if (!tag.selfClosing && close === null) throw new Error(`UNSUPPORTED_OPERATION: <${tag.name}> has no closing tag Glide can find; add one in source.`);
  let next = code;
  if (close !== null) next = next.slice(0, close + 2) + to + next.slice(close + 2 + tag.name.length);
  return checked(code, next.slice(0, tag.start + 1) + to + next.slice(tag.start + 1 + tag.name.length));
}

/** A static attribute's value (true when it has none) or null when it is absent; throws when it is dynamic. */
export function readAstroAttributeAt(code: string, line: number, column: number, name: string): string | true | null {
  const tag = target(code, line, column);
  if (!tag) throw new Error(`NODE_NOT_FOUND: No template element exists at ${line}:${column}.`);
  const current = staticAttribute(tag, name);
  return current ? current.value ?? true : null;
}

/** Add, change (text, or true for a bare attribute) or remove (null) a static attribute. */
export function setAstroAttributeAt(code: string, line: number, column: number, name: string, value: string | true | null): string {
  // The value is the text the attribute should hold, so markup characters are written as references.
  if (typeof value === 'string') return setAttribute(code, line, column, name, () => value,
    text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  const tag = target(code, line, column);
  if (!tag) throw new Error(`NODE_NOT_FOUND: No template element exists at ${line}:${column}.`);
  const current = staticAttribute(tag, name);
  if (value === true) {
    if (current) return checked(code, code.slice(0, current.start) + name + code.slice(current.end));
    const offset = tag.start + 1 + tag.name.length;
    return checked(code, code.slice(0, offset) + ' ' + name + code.slice(offset));
  }
  if (!current) return code;
  let start = current.start;
  while (start > 0 && /\s/.test(code[start - 1])) start--;
  const sep = start < current.start && code[current.end] && !/[\s/>]/.test(code[current.end]) ? ' ' : '';
  return checked(code, code.slice(0, start) + sep + code.slice(current.end));
}

/** Every stamped template element in document order, with the one-based position of its opening tag. */
export function listAstroElements(code: string): { line: number; column: number }[] {
  return tagStarts(code).map(offset => position(code, offset));
}

/** The static class of the element at line:column, or null when no such element exists. */
export function readAstroClassAt(code: string, line: number, column: number): string | null {
  const tag = target(code, line, column);
  return tag ? staticAttribute(tag, 'class')?.value ?? '' : null;
}

export function setAstroClassAt(code: string, line: number, column: number, classes: string): string {
  return setAttribute(code, line, column, 'class', () => classes);
}

export function setAstroStyleAt(code: string, line: number, column: number, styles: Record<string, string>): string {
  return setAttribute(code, line, column, 'style', current => mergeInlineStyle(current, styles),
    text => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;'));
}

/** Replace the text of an element whose only content is literal text. In plain HTML, braces are literal text. */
export function setAstroTextAt(code: string, line: number, column: number, text: string, literalBraces = false): string {
  const tag = target(code, line, column);
  if (!tag) throw new Error(`NODE_NOT_FOUND: No template element exists at ${line}:${column}.`);
  if (tag.attributes.some(item => item.name.startsWith('set:'))) throw new Error('UNSUPPORTED_OPERATION: Text is controlled by a directive.');
  const close = code.indexOf('<', tag.end);
  const raw = close < 0 ? '' : code.slice(tag.end, close);
  if (tag.selfClosing || VOID.has(tag.name) || !code.startsWith(`</${tag.name}`, close) || !raw.trim() || (!literalBraces && /[{}]/.test(raw))) {
    throw new Error('UNSUPPORTED_OPERATION: Select an element that holds only literal text.');
  }
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/{/g, '&#123;').replace(/}/g, '&#125;');
  const [lead, trail] = formattingWhitespace(raw);
  return checked(code, code.slice(0, tag.end) + lead + escaped + trail + code.slice(close));
}
