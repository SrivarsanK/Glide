/**
 * Print an edited recast AST by splicing only the changed text into the
 * original source. Recast reprints any return statement with a change inside
 * it, which adds semicolons and re-indents JSX text in nearly every component,
 * and it re-indents multi-line JSX text it reprints. The edits Glide makes to
 * strings, JSX text, attributes and class lists are written here instead.
 *
 * Any other change, or output that does not parse back to the edited tree,
 * returns null so the caller can print with recast.
 */

import * as t from '@babel/types';

interface Range { start: number; end: number }
interface Splice extends Range { text: string }
type Parse = (code: string) => any;

class Unsupported extends Error {}
const fail = (): never => { throw new Unsupported(); };

const SKIPPED = new Set(['loc', 'start', 'end', 'range', 'extra', 'tokens']);
const COMMA_LISTS = new Set(['ObjectExpression.properties', 'CallExpression.arguments', 'NewExpression.arguments',
  'OptionalCallExpression.arguments', 'ArrayExpression.elements']);
const BRACKETS: Record<string, [string, string]> = { ObjectExpression: ['{', '}'], ArrayExpression: ['[', ']'] };

const isNode = (value: any): boolean => !!value && typeof value === 'object' && typeof value.type === 'string';
/** The whitespace that ends just before `at`. */
function spaceBefore(text: string, at: number): string {
  let start = at;
  while (start > 0 && /\s/.test(text[start - 1])) start--;
  return text.slice(start, at);
}

export function spliceChanges(source: string, ast: any, parse: Parse): string | null {
  try {
    const printer = new SplicePrinter(source, ast.original, parse(source));
    printer.diff(ast, ast.original, null);
    const code = printer.apply();
    return sameTree(parse(code), ast) ? code : null;
  } catch {
    // Unsupported shapes, unparseable output and unexpected trees all fall back to recast.
    return null;
  }
}

class SplicePrinter {
  private ranges = new Map<object, Range>();
  private splices: Splice[] = [];
  private quotes = { js: { '"': 0, "'": 0 }, jsx: { '"': 0, "'": 0 } };

  constructor(private source: string, original: any, parsed: any) {
    this.pair(original, parsed, null);
  }

  /** Recast parses tab-expanded text, so take offsets from a parse of the untouched source. */
  private pair(node: any, parsed: any, parent: any): void {
    if (!isNode(node) || node.type !== parsed?.type) fail();
    this.ranges.set(node, { start: parsed.start, end: parsed.end });
    if (node.type === 'StringLiteral') {
      const quote = this.source[parsed.start] as '"' | "'";
      const counts = parent?.type === 'JSXAttribute' ? this.quotes.jsx : this.quotes.js;
      if (quote in counts) counts[quote]++;
    }
    for (const key of t.VISITOR_KEYS[node.type] ?? []) {
      const value = node[key], other = parsed[key];
      if (Array.isArray(value)) {
        if (!Array.isArray(other) || value.length !== other.length) fail();
        value.forEach((item, index) => item ? this.pair(item, other[index], node) : other[index] && fail());
      } else if (value) this.pair(value, other, node);
      else if (other) fail();
    }
  }

  private range(node: any): Range {
    return this.ranges.get(node) ?? fail();
  }

  private text(node: any): string {
    const { start, end } = this.range(node);
    return this.source.slice(start, end);
  }

  private splice(start: number, end: number, text: string): void {
    this.splices.push({ start, end, text });
  }

  apply(): string {
    const splices = this.splices.sort((a, b) => a.start - b.start || a.end - b.end);
    let code = '', at = 0;
    for (const { start, end, text } of splices) {
      if (start < at) fail();
      code += this.source.slice(at, start) + text;
      at = end;
    }
    return code + this.source.slice(at);
  }

  /** Compare an edited node with its original. `parent` is the original parent. */
  diff(node: any, old: any, parent: any): void {
    if (node.type !== old.type) fail();
    for (const key of new Set([...Object.keys(node), ...Object.keys(old)])) {
      if (SKIPPED.has(key) || key.startsWith('_')) continue;
      const next = node[key], prev = old[key];
      if (next === prev) continue;
      if (Array.isArray(next) && Array.isArray(prev)) this.diffList(old, key, next, prev);
      else if (isNode(next) && isNode(prev)) {
        if (next.original === prev) this.diff(next, prev, old);
        else this.splice(this.range(prev).start, this.range(prev).end, this.print(next, old, prev));
      } else if (isNode(next) && prev == null && old.type === 'JSXAttribute' && key === 'value') {
        // A boolean shorthand attribute that gained a value.
        this.splice(this.range(old.name).end, this.range(old.name).end, '=' + this.print(next, old));
      } else if (old.type === 'StringLiteral' && key === 'value' && typeof next === 'string') {
        const { start, end } = this.range(old);
        this.splice(start, end, quoteString(next, this.source[start], parent?.type === 'JSXAttribute'));
      } else if (old.type === 'JSXText' && key === 'value' && typeof next === 'string') {
        const { start, end } = this.range(old);
        this.splice(start, end, remap(this.text(old), prev, next));
      } else if (old.type === 'TemplateElement' && key === 'value') {
        if (next?.raw === prev?.raw && next?.cooked === prev?.cooked) continue;
        const { start, end } = this.range(old);
        this.splice(start, end, remap(this.text(old), prev.raw, next.raw));
      } else if (!sameValue(next, prev)) fail();
    }
  }

  /** Align a list by original identity. Only the list edits Glide makes are supported. */
  private diffList(old: any, key: string, next: any[], prev: any[]): void {
    if (next.some(item => item === null) || prev.some(item => item === null)) {
      if (next.length !== prev.length || next.some((item, index) => (item === null) !== (prev[index] === null))) fail();
    }
    const origins = next.map(item => item ? prev.indexOf(item.original) : -1);
    const kept = origins.filter(index => index >= 0);
    if (kept.some((index, i) => i > 0 && index <= kept[i - 1])) fail();
    next.forEach((item, index) => { if (origins[index] >= 0) this.diff(item, prev[origins[index]], old); });
    const removed = prev.map((_, index) => index).filter(index => !kept.includes(index));
    const added = next.flatMap((item, index) => item && origins[index] < 0 ? [index] : []);
    if (!removed.length && !added.length) return;

    const list = `${old.type}.${key}`;
    if (list === 'JSXOpeningElement.attributes' && !removed.length && added[0] === kept.length) {
      this.insertAttributes(old, prev, added.map(index => next[index]));
    } else if (COMMA_LISTS.has(list) && !added.length) {
      this.removeItems(prev, removed);
    } else if (COMMA_LISTS.has(list) && !removed.length && added.every((index, i) => index === i)) {
      this.insertItems(old, prev, added.map(index => next[index]), 'start');
    } else if (COMMA_LISTS.has(list) && !removed.length && added[0] === kept.length) {
      this.insertItems(old, prev, added.map(index => next[index]), 'end');
    } else if ((list === 'JSXElement.children' || list === 'JSXFragment.children') && removed.length === 1
      && t.isJSXText(prev[removed[0]]) && added.every((index, i) => index === added[0] + i)
      && origins.slice(0, added[0]).every(index => index < removed[0])
      && origins.slice(added[added.length - 1] + 1).every(index => index > removed[0])) {
      // A text child replaced by text and string expressions, as text edits with markup do.
      const text = prev[removed[0]], { start, end } = this.range(text);
      const printed = added.map(index => this.print(next[index], old)).join('');
      this.splice(start, end, remap(this.text(text), text.value, printed));
    } else fail();
  }

  private insertAttributes(opening: any, prev: any[], items: any[]): void {
    const texts = items.map(item => this.print(item, opening));
    if (prev.length) {
      const last = this.range(prev[prev.length - 1]);
      const gap = spaceBefore(this.source, last.start) || ' ';
      this.splice(last.end, last.end, texts.map(text => gap + text).join(''));
    } else {
      const anchor = this.range(opening.typeArguments ?? opening.typeParameters ?? opening.name).end;
      this.splice(anchor, anchor, texts.map(text => ' ' + text).join(''));
    }
  }

  private removeItems(prev: any[], removed: number[]): void {
    const gapIsComma = (index: number) => /^\s*,\s*$/.test(this.source.slice(this.range(prev[index]).end, this.range(prev[index + 1]).start));
    for (let first = 0; first < removed.length;) {
      let last = first;
      while (removed[last + 1] === removed[last] + 1) last++;
      const i = removed[first], j = removed[last];
      for (let index = Math.max(i - 1, 0); index < Math.min(j + 1, prev.length - 1); index++) if (!gapIsComma(index)) fail();
      if (j + 1 < prev.length) this.splice(this.range(prev[i]).start, this.range(prev[j + 1]).start, '');
      else if (i > 0) this.splice(this.range(prev[i - 1]).end, this.range(prev[j]).end, '');
      else {
        const end = this.range(prev[j]).end;
        this.splice(this.range(prev[i]).start, end + (/^\s*,/.exec(this.source.slice(end))?.[0].length ?? 0), '');
      }
      first = last + 1;
    }
  }

  private insertItems(container: any, prev: any[], items: any[], at: 'start' | 'end'): void {
    const texts = items.map(item => this.print(item, container));
    if (!prev.length) {
      const { start, end } = this.range(container);
      const [opener, closer] = BRACKETS[container.type] ?? ['(', ')'];
      const match = new RegExp(`\\${opener}\\s*\\${closer}$`).exec(this.source.slice(start, end)) ?? fail();
      const inner = container.type === 'ObjectExpression' ? ` ${texts.join(', ')} ` : texts.join(', ');
      this.splice(start + match.index + 1, end - 1, inner);
    } else if (at === 'start') {
      const first = this.range(prev[0]);
      const gap = spaceBefore(this.source, first.start);
      const separator = gap.includes('\n') ? gap : ' ';
      this.splice(first.start, first.start, texts.map(text => text + ',' + separator).join(''));
    } else {
      const last = this.range(prev[prev.length - 1]);
      const gap = spaceBefore(this.source, last.start);
      const separator = gap.includes('\n') ? gap : ' ';
      const comma = /^\s*,/.exec(this.source.slice(last.end));
      if (comma) this.splice(last.end + comma[0].length, last.end + comma[0].length, texts.map(text => separator + text + ',').join(''));
      else this.splice(last.end, last.end, texts.map(text => ',' + separator + text).join(''));
    }
  }

  /**
   * Source for a node the edit created. `parent` is the original node it goes
   * into; `replaced` is the node it takes the place of, whose quotes it keeps.
   */
  private print(node: any, parent: any, replaced?: any): string {
    if (node.original) fail();
    const inJSX = t.isJSXAttribute(parent);
    switch (node.type) {
      case 'StringLiteral': {
        const counts = inJSX ? this.quotes.jsx : this.quotes.js;
        const quote = t.isStringLiteral(replaced) ? this.source[this.range(replaced).start]
          : counts["'"] > counts['"'] ? "'" : '"';
        return quoteString(node.value, quote, inJSX);
      }
      case 'NumericLiteral':
        return Number.isFinite(node.value) && node.value >= 0 ? String(node.value) : fail();
      case 'BooleanLiteral': return String(node.value);
      case 'UnaryExpression':
        return node.operator === '-' && t.isNumericLiteral(node.argument) ? '-' + this.print(node.argument, node) : fail();
      case 'Identifier':
      case 'JSXIdentifier': return node.name;
      case 'JSXText': return /[{}<>]/.test(node.value) ? fail() : node.value;
      case 'JSXAttribute': return this.print(node.name, node) + (node.value ? '=' + this.print(node.value, node) : '');
      case 'JSXExpressionContainer': return '{' + this.print(node.expression, node) + '}';
      case 'ObjectExpression':
        return node.properties.length ? `{ ${node.properties.map((p: any) => this.print(p, node)).join(', ')} }` : '{}';
      case 'ObjectProperty':
        return node.computed || node.shorthand ? fail() : `${this.print(node.key, node)}: ${this.print(node.value, node)}`;
      default: return fail();
    }
  }
}

/** A string literal in the given quotes. JSX attribute strings have no escapes. */
function quoteString(value: string, quote: string, inJSX: boolean): string {
  if (inJSX) {
    if (!value.includes(quote)) return quote + value + quote;
    const other = quote === '"' ? "'" : '"';
    return value.includes(other) ? fail() : other + value + other;
  }
  const escapes: Record<string, string> = { '\\': '\\\\', '\n': '\\n', '\r': '\\r', '\u2028': '\\u2028', '\u2029': '\\u2029', [quote]: '\\' + quote };
  return quote + value.replace(/[\\\n\r\u2028\u2029'"]/g, char => escapes[char] ?? char) + quote;
}

/**
 * Apply the change from `before` to `after` to `raw`, the source of the same
 * text. Recast's values may differ from the source in line endings and leading
 * whitespace, so the changed span is mapped line by line.
 */
function remap(raw: string, before: string, after: string): string {
  if (raw === before) return after;
  let prefix = 0, suffix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  while (suffix < before.length - prefix && suffix < after.length - prefix
    && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
  const middle = after.slice(prefix, after.length - suffix);
  if (/[\r\n]/.test(middle)) fail();
  return raw.slice(0, mapOffset(raw, before, prefix)) + middle + raw.slice(mapOffset(raw, before, before.length - suffix));
}

function mapOffset(raw: string, value: string, offset: number): number {
  const valueParts = value.split(/(\r\n|\r|\n)/), rawParts = raw.split(/(\r\n|\r|\n)/);
  if (valueParts.length !== rawParts.length) fail();
  let inValue = 0, inRaw = 0;
  for (let i = 0; i < valueParts.length; i++) {
    const part = valueParts[i], rawPart = rawParts[i];
    if (i % 2 === 1) {
      if (offset > inValue && offset < inValue + part.length) fail();
    } else {
      // The first line starts mid-line in the source, so only later lines have leading whitespace.
      const indent = i === 0 ? 0 : /^[ \t]*/.exec(part)![0].length;
      const rawIndent = i === 0 ? 0 : /^[ \t]*/.exec(rawPart)![0].length;
      if (part.slice(indent) !== rawPart.slice(rawIndent)) fail();
      const column = offset - inValue;
      if (column >= 0 && column <= part.length) {
        if (column === 0) return inRaw;
        return column < indent ? fail() : inRaw + rawIndent + column - indent;
      }
    }
    inValue += part.length;
    inRaw += rawPart.length;
  }
  return fail();
}

function sameValue(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every(key => sameValue(a[key], b[key]));
}

/** Line endings and the whitespace around them can differ between recast's text values and the source. */
const lines = (text: unknown) => typeof text === 'string' ? text.replace(/[ \t]*(\r\n|\r|\n)[ \t]*/g, '\n') : text;

/** Whether two trees hold the same code, ignoring locations, comments and raw text. */
function sameTree(a: any, b: any): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => sameTree(item, b[index]));
  }
  if (!isNode(a) || !isNode(b)) return (a ?? null) === (b ?? null);
  if (a.type !== b.type) return false;
  const fields = t.NODE_FIELDS[a.type];
  if (!fields) return false;
  return Object.entries(fields).every(([key, field]: [string, any]) => {
    if (key === 'comments' || key === 'tokens') return true;
    const x = a[key] ?? field.default ?? null, y = b[key] ?? field.default ?? null;
    if (a.type === 'JSXText' && key === 'value') return lines(x) === lines(y);
    if (a.type === 'TemplateElement' && key === 'value') return lines(x?.raw) === lines(y?.raw) && lines(x?.cooked) === lines(y?.cooked);
    return sameTree(x, y);
  });
}
