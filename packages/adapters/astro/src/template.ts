/**
 * Position-based Astro template edits. An element is the opening tag that starts
 * exactly at line:column; its attributes are scanned with quotes and `{}`
 * expressions respected. Anything dynamic or ambiguous is refused, not guessed.
 */
import { formattingWhitespace, mergeInlineStyle } from '@srivarsank/core';

interface Attribute { name: string; start: number; end: number; value: string | null; dynamic: boolean }
interface Tag { name: string; start: number; end: number; selfClosing: boolean; attributes: Attribute[]; spread: boolean }

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const REGEX_KEYWORDS = new Set(['return', 'case', 'typeof', 'in', 'of', 'new', 'void', 'delete', 'throw', 'else', 'yield', 'await', 'do']);
const invalid = (): never => { throw new Error('UNSUPPORTED_OPERATION: This tag has a form Glide cannot read safely. Edit it in source.'); };

/** Treat lowercase and ALL-CAPS HTML void tags (`<br>`, `<BR>`, `<IMG>`) as void, keeping PascalCase Astro components (`<Link>`). */
function isVoidTag(name: string): boolean {
  return (name === name.toLowerCase() || name === name.toUpperCase()) && VOID.has(name.toLowerCase());
}

/** The offset after the closing backtick of a template literal starting at `open`, handling nested `${...}` expressions. */
function findCloseTemplate(code: string, open: number): number {
  for (let i = open + 1; i < code.length; i++) {
    const ch = code[i];
    if (ch === '\\') { i++; continue; }
    if (ch === '`') return i + 1;
    if (ch === '$' && code[i + 1] === '{') {
      const end = findCloseBrace(code, i + 1);
      if (end < 0) return -1;
      i = end - 1;
    }
  }
  return -1;
}

/** The offset after the `}` that closes `{` at `open`, skipping strings, nested templates, comments, and regex literals. */
function findCloseBrace(code: string, open: number): number {
  let depth = 0;
  let regexAllowed = true;
  for (let i = open; i < code.length; i++) {
    const ch = code[i];
    if (/\s/.test(ch)) continue;
    if (ch === '"' || ch === "'") {
      for (i++; i < code.length && code[i] !== ch; i++) if (code[i] === '\\') i++;
      if (i >= code.length) return -1;
      regexAllowed = false;
      continue;
    }
    if (ch === '`') {
      const end = findCloseTemplate(code, i);
      if (end < 0) return -1;
      i = end - 1;
      regexAllowed = false;
      continue;
    }
    if (ch === '/' && code[i + 1] === '/') {
      const nl = code.indexOf('\n', i + 2);
      if (nl < 0) return -1;
      i = nl;
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      if (end < 0) return -1;
      i = end + 1;
      continue;
    }
    if (ch === '/' && regexAllowed) {
      let inClass = false;
      for (i++; i < code.length; i++) {
        const rc = code[i];
        if (rc === '\\') { i++; continue; }
        if (rc === '[') inClass = true;
        else if (rc === ']') inClass = false;
        else if (rc === '/' && !inClass) break;
        else if (rc === '\n' || rc === '\r') return -1;
      }
      if (i >= code.length) return -1;
      regexAllowed = false;
      continue;
    }
    if (ch === '{') { depth++; regexAllowed = true; continue; }
    if (ch === '}') {
      if (--depth === 0) return i + 1;
      regexAllowed = false;
      continue;
    }
    if (/[a-zA-Z0-9_$]/.test(ch)) {
      let end = i + 1;
      while (end < code.length && /[a-zA-Z0-9_$]/.test(code[end])) end++;
      regexAllowed = REGEX_KEYWORDS.has(code.slice(i, end));
      i = end - 1;
      continue;
    }
    if ((ch === '+' && code[i + 1] === '+') || (ch === '-' && code[i + 1] === '-')) {
      i++;
      regexAllowed = false;
      continue;
    }
    regexAllowed = /[([,;?:=!&|^~+\-*%<>]/.test(ch);
  }
  return -1;
}

/** Frontmatter, comments, scripts, styles, and textarea/title bodies blanked out in one pass, with every offset kept. */
function mask(code: string): string {
  const blank = (segment: string) => segment.replace(/[^\n]/g, ' ');
  const out: string[] = [];
  let cursor = 0;
  let i = 0;
  const fm = /^\s*---(?:\r?\n[\s\S]*?)?\r?\n---(?=\r?\n|$)/.exec(code);
  if (fm) {
    out.push(blank(fm[0]));
    i = cursor = fm[0].length;
  }
  const flush = (from: number, to: number, replaceWithBlank: boolean) => {
    if (from > cursor) out.push(code.slice(cursor, from));
    out.push(replaceWithBlank ? blank(code.slice(from, to)) : code.slice(from, to));
    cursor = to;
  };
  while (i < code.length) {
    if (code.startsWith('<!--', i)) {
      const close = code.indexOf('-->', i + 4);
      const end = close < 0 ? code.length : close + 3;
      flush(i, end, true);
      i = end;
      continue;
    }
    if (code[i] === '<') {
      const rawMatch = /^<(script|style|textarea|title)(?=[\s/>])/i.exec(code.slice(i, i + 20));
      if (rawMatch) {
        const tag = tryReadTag(code, i, true);
        if (tag) {
          const lower = rawMatch[1].toLowerCase();
          if (lower === 'script' || lower === 'style') {
            if (tag.selfClosing) {
              flush(i, tag.end, true);
              i = tag.end;
              continue;
            }
            const closeRe = new RegExp(`</${lower}\\s*>`, 'gi');
            closeRe.lastIndex = tag.end;
            const closeMatch = closeRe.exec(code);
            const end = closeMatch ? closeMatch.index + closeMatch[0].length : code.length;
            flush(i, end, true);
            i = end;
            continue;
          }
          // Textarea and title hold text, so a `</section>` written inside one is not a tag.
          if (!tag.selfClosing) {
            const closeRe = new RegExp(`</${lower}\\s*>`, 'gi');
            closeRe.lastIndex = tag.end;
            const closeMatch = closeRe.exec(code);
            if (closeMatch) {
              flush(tag.end, closeMatch.index, true);
              i = closeMatch.index + closeMatch[0].length;
              continue;
            }
          }
          i = tag.end;
          continue;
        }
      } else if (/[a-zA-Z]/.test(code[i + 1] ?? '')) {
        const tag = tryReadTag(code, i, true);
        if (tag) { i = tag.end; continue; }
      }
    }
    i++;
  }
  if (cursor < code.length) out.push(code.slice(cursor));
  return out.join('');
}

function tagStarts(code: string): number[] {
  return tree(code).map(node => node.start);
}

function position(code: string, offset: number): { line: number; column: number } {
  const before = code.slice(0, offset);
  return { line: before.split('\n').length, column: offset - before.lastIndexOf('\n') };
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

function tryReadTag(code: string, start: number, anyName = false): Tag | null {
  const match = /^<([a-zA-Z][a-zA-Z0-9.-]*)(?=[\s/>])/.exec(code.slice(start, start + 128));
  if (!match) return null;
  const name = match[1];
  if (!anyName && !/^[a-z][a-z0-9-]*$/.test(name)) return null;
  const attributes: Attribute[] = [];
  let spread = false, i = start + 1 + name.length;
  for (;;) {
    while (/\s/.test(code[i] ?? '')) i++;
    if (i >= code.length) return null;
    if (code[i] === '>') return { name, start, end: i + 1, selfClosing: false, attributes, spread };
    if (code.startsWith('/>', i)) return { name, start, end: i + 2, selfClosing: true, attributes, spread };
    if (code[i] === '{') {
      const close = findCloseBrace(code, i);
      if (close < 0) return null;
      const inner = code.slice(i + 1, close - 1).trim();
      // Astro shorthand `{id}` is equivalent to `id={id}`, not a spread attribute.
      if (!inner.startsWith('...') && /^[a-zA-Z_$][a-zA-Z0-9_$-]*$/.test(inner)) {
        attributes.push({ name: inner, start: i, end: close, value: null, dynamic: true });
      } else {
        spread = true;
      }
      i = close;
      continue;
    }
    if (!/[a-zA-Z_:@#$]/.test(code[i])) return null;
    const attributeStart = i;
    while (i < code.length && !/[\s=/>"'<{}]/.test(code[i])) i++;
    const attributeName = code.slice(attributeStart, i);
    if (!attributeName) return null;
    const nameEnd = i;
    let eq = i;
    while (eq < code.length && /\s/.test(code[eq])) eq++;
    let value: string | null = null, dynamic = false;
    if (code[eq] === '=') {
      i = eq + 1;
      while (i < code.length && /\s/.test(code[i])) i++;
      const quote = code[i];
      if (quote === '"' || quote === "'") {
        const close = code.indexOf(quote, i + 1);
        if (close < 0) return null;
        value = decodeHtmlEntities(code.slice(i + 1, close));
        i = close + 1;
      } else if (quote === '{') {
        dynamic = true;
        const close = findCloseBrace(code, i);
        if (close < 0) return null;
        i = close;
      } else if (quote === '`') {
        dynamic = true;
        const close = findCloseTemplate(code, i);
        if (close < 0) return null;
        i = close;
      } else {
        const valueStart = i;
        while (i < code.length && !/[\s>"'`=]/.test(code[i]) && !code.startsWith('/>', i)) i++;
        if (i === valueStart) return null;
        value = decodeHtmlEntities(code.slice(valueStart, i));
      }
    } else {
      i = nameEnd;
    }
    attributes.push({ name: attributeName, start: attributeStart, end: i, value, dynamic });
  }
}

function readTag(code: string, start: number, anyName = false): Tag {
  const name = /^<([a-zA-Z][a-zA-Z0-9.-]*)(?=[\s/>])/.exec(code.slice(start, start + 128))?.[1] ?? invalid();
  if (!anyName && !/^[a-z][a-z0-9-]*$/.test(name)) throw new Error('UNSUPPORTED_OPERATION: Components are edited where they are defined. Select an HTML element.');
  return tryReadTag(code, start, anyName) ?? invalid();
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
  for (let i = 0; i < clean.length;) {
    if (clean[i] !== '<') { i++; continue; }
    if (clean[i + 1] === '/') {
      const closeMatch = /^<\/([a-zA-Z][a-zA-Z0-9.-]*)\s*>/.exec(clean.slice(i, i + 128));
      if (!closeMatch) { i++; continue; }
      const name = closeMatch[1];
      if (!['template', 'script', 'style'].includes(name.toLowerCase())) {
        let depth = open.length - 1;
        while (depth >= 0) {
          const openName = nodes[open[depth]].name;
          const matches = /^[a-z]/.test(openName) || openName === openName.toUpperCase()
            ? openName.toLowerCase() === name.toLowerCase()
            : openName === name;
          if (matches) break;
          depth--;
        }
        // A stray closing tag closes nothing; unclosed elements in between keep close = null.
        if (depth >= 0) { nodes[open[depth]].close = i; open.length = depth; }
      }
      i += closeMatch[0].length;
      continue;
    }
    const openMatch = /^<([a-zA-Z][a-zA-Z0-9.-]*)(?=[\s/>])/.exec(clean.slice(i, i + 128));
    if (!openMatch) { i++; continue; }
    const name = openMatch[1];
    const tag = tryReadTag(code, i, true);
    if (!tag) { i++; continue; }
    if (!['template', 'script', 'style'].includes(name.toLowerCase())) {
      nodes.push({ name, start: i, parent: open.length ? open[open.length - 1] : -1, close: null,
        focusable: tag.attributes.some(item => item.name.toLowerCase() === 'tabindex') });
      if (!tag.selfClosing && !isVoidTag(name)) open.push(nodes.length - 1);
    }
    i = tag.end;
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
  if (isVoidTag(tag.name)) throw new Error(`UNSUPPORTED_OPERATION: <${tag.name}> has no content to keep; replace it in source.`);
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
  const closeBoundary = close >= 0 && new RegExp(`^</${tag.name}\\s*>`, 'i').test(code.slice(close, close + tag.name.length + 16));
  if (tag.selfClosing || isVoidTag(tag.name) || !closeBoundary || !raw.trim() || (!literalBraces && /[{}]/.test(raw))) {
    throw new Error('UNSUPPORTED_OPERATION: Select an element that holds only literal text.');
  }
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/{/g, '&#123;').replace(/}/g, '&#125;');
  const [lead, trail] = formattingWhitespace(raw);
  return checked(code, code.slice(0, tag.end) + lead + escaped + trail + code.slice(close));
}
