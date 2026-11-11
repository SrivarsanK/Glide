/**
 * Position-based Astro template edits. An element is the opening tag that starts
 * exactly at line:column; its attributes are scanned with quotes and `{}`
 * expressions respected. Anything dynamic or ambiguous is refused, not guessed.
 */
import { mergeInlineStyle } from '@srivarsank/core';

interface Attribute { name: string; start: number; end: number; value: string | null; dynamic: boolean }
interface Tag { name: string; start: number; end: number; selfClosing: boolean; attributes: Attribute[]; spread: boolean }

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const invalid = (): never => { throw new Error('UNSUPPORTED_OPERATION: This tag has a form Glide cannot read safely. Edit it in source.'); };

/** Frontmatter, comments, scripts and styles blanked out, with every offset kept. */
function mask(code: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, ' ');
  return code.replace(/^\s*---[\s\S]*?\n---/, blank).replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/<script[\s\S]*?<\/script>/gi, blank).replace(/<style[\s\S]*?<\/style>/gi, blank);
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

function readTag(code: string, start: number): Tag {
  const name = /^<([a-zA-Z][a-zA-Z0-9.-]*)/.exec(code.slice(start, start + 80))?.[1] ?? invalid();
  if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error('UNSUPPORTED_OPERATION: Components are edited where they are defined. Select an HTML element.');
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
        value = code.slice(i + 1, close);
        i = close + 1;
      } else if (quote === '{') { dynamic = true; i = closeBrace(code, i); }
      else if (quote === '`') { dynamic = true; i = code.indexOf('`', i + 1) + 1 || invalid(); }
      else {
        const valueStart = i;
        while (i < code.length && !/[\s>]/.test(code[i])) i++;
        value = code.slice(valueStart, i);
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
  if (tag.attributes.some(item => item.name.startsWith(name + ':'))) {
    throw new Error(`UNSUPPORTED_OPERATION: Preserve the dynamic Astro ${name} directive in source.`);
  }
  const matches = tag.attributes.filter(item => item.name === name);
  if (matches.length > 1) throw new Error('UNSUPPORTED_OPERATION: Duplicate attributes are ambiguous.');
  if (matches[0]?.dynamic) throw new Error(`UNSUPPORTED_OPERATION: Preserve the dynamic Astro ${name} in source.`);
  return matches[0] ?? null;
}

function checked(before: string, after: string): string {
  if (tagStarts(after).length !== tagStarts(before).length) throw new Error('INVALID_OUTPUT: The edit changed the template structure.');
  return after;
}

function setAttribute(code: string, line: number, column: number, name: string, next: (current: string) => string): string {
  const tag = target(code, line, column);
  if (!tag) throw new Error(`NODE_NOT_FOUND: No template element exists at ${line}:${column}.`);
  const current = staticAttribute(tag, name);
  const text = `${name}="${next(current?.value ?? '').replace(/"/g, '&quot;')}"`;
  if (current) return checked(code, code.slice(0, current.start) + text + code.slice(current.end));
  const offset = tag.start + 1 + tag.name.length;
  return checked(code, code.slice(0, offset) + ' ' + text + code.slice(offset));
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
  return setAttribute(code, line, column, 'style', current => mergeInlineStyle(current, styles));
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
  return checked(code, code.slice(0, tag.end) + (raw.match(/^\s*/)?.[0] || '') + escaped + (raw.match(/\s*$/)?.[0] || '') + code.slice(close));
}
