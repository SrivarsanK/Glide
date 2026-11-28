/**
 * Shared utility functions used across packages.
 */

import * as crypto from 'crypto';

export function computeNodeHash(sourceCodeSlice: string): string {
  return crypto.createHash('sha1').update(sourceCodeSlice.trim()).digest('hex').substring(0, 8);
}

/**
 * The whitespace before and after a text node to keep when its text is replaced: a run that holds a
 * line break (formatting) or that separates the text from a sibling. A same-line space at the
 * element's own edge is part of the old text, so the new text replaces it.
 */
export function formattingWhitespace(raw: string, siblings: { before?: boolean; after?: boolean } = {}): [string, string] {
  const lead = raw.match(/^\s*/)![0], trail = raw.match(/\s*$/)![0];
  return [siblings.before || lead.includes('\n') ? lead : '', siblings.after || trail.includes('\n') ? trail : ''];
}

const SKIP_STAMP_TAGS = new Set([
  'template', 'script', 'style', 'html', 'head', 'body', 'title', 'meta', 'link', 'base',
]);
// Raw-text / metadata elements whose inner body must not be scanned for child tags.
const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title', 'svelte:head']);

function skipTemplateString(code: string, start: number): number {
  for (let i = start + 1; i < code.length; i++) {
    const ch = code[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === '`') return i + 1;
    if (ch === '$' && code[i + 1] === '{') {
      const end = skipBraceExpr(code, i + 1);
      if (end < 0) return -1;
      i = end - 1;
    }
  }
  return -1;
}

function skipBraceExpr(code: string, open: number): number {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    const ch = code[i];
    if (ch === '"' || ch === "'") {
      for (i++; i < code.length && code[i] !== ch; i++) {
        if (code[i] === '\\') i++;
      }
      if (i >= code.length) return -1;
    } else if (ch === '`') {
      const end = skipTemplateString(code, i);
      if (end < 0) return -1;
      i = end - 1;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      if (--depth === 0) return i + 1;
    }
  }
  return -1;
}

function skipVueMustache(code: string, open: number): number {
  for (let i = open + 2; i < code.length; i++) {
    const ch = code[i];
    if (ch === '"' || ch === "'") {
      for (i++; i < code.length && code[i] !== ch; i++) {
        if (code[i] === '\\') i++;
      }
      if (i >= code.length) return code.length;
    } else if (ch === '`') {
      const end = skipTemplateString(code, i);
      if (end < 0) return code.length;
      i = end - 1;
    } else if (ch === '}' && code[i + 1] === '}') {
      return i + 2;
    }
  }
  return code.length;
}

export function stampHTMLTemplate(code: string, filepath: string, sourceAttribute: string = 'data-gl-source'): string {
  const lowerPath = filepath.toLowerCase();
  const isAstro = lowerPath.endsWith('.astro');
  const isVue = lowerPath.endsWith('.vue');
  const isSvelte = lowerPath.endsWith('.svelte');

  let i = 0;
  // Strip Astro frontmatter only at the start of .astro files (never mid-file `---`).
  if (isAstro) {
    const fm = /^\s*---(?:\r?\n[\s\S]*?)?\r?\n---(?=\r?\n|$)/.exec(code);
    if (fm) i = fm[0].length;
  }

  const insertions: { pos: number; text: string }[] = [];
  let line = 1;
  let lineStart = 0;
  let scannedLinePos = 0;

  const positionAt = (index: number): { line: number; col: number } => {
    while (scannedLinePos < index) {
      if (code.charCodeAt(scannedLinePos) === 10) {
        line++;
        lineStart = scannedLinePos + 1;
      }
      scannedLinePos++;
    }
    return { line, col: index - lineStart + 1 };
  };

  while (i < code.length) {
    const ch = code[i];

    if (isVue && ch === '{' && code[i + 1] === '{') {
      i = skipVueMustache(code, i);
      continue;
    }

    if (isSvelte && ch === '{') {
      const end = skipBraceExpr(code, i);
      if (end > i) {
        i = end;
        continue;
      }
      i++;
      continue;
    }

    if (ch !== '<') {
      i++;
      continue;
    }

    // HTML comments
    if (code.startsWith('<!--', i)) {
      const close = code.indexOf('-->', i + 4);
      i = close === -1 ? code.length : close + 3;
      continue;
    }

    // CDATA sections
    if (code.startsWith('<![CDATA[', i)) {
      const close = code.indexOf(']]>', i + 9);
      i = close === -1 ? code.length : close + 3;
      continue;
    }

    // DOCTYPE, declarations, processing instructions, and closing tags
    const next = code[i + 1];
    if (next === '!' || next === '?' || next === '/') {
      const close = code.indexOf('>', i + 2);
      i = close === -1 ? code.length : close + 1;
      continue;
    }

    if (!next || !/[a-zA-Z]/.test(next)) {
      i++;
      continue;
    }

    let nameEnd = i + 2;
    while (nameEnd < code.length && /[a-zA-Z0-9.-]/.test(code[nameEnd])) {
      nameEnd++;
    }
    const baseName = code.slice(i + 1, nameEnd);

    // `<svelte:head>` and other namespaced tags: never insert an attribute after the prefix.
    let fullName = baseName;
    let isNamespaced = false;
    if (code[nameEnd] === ':') {
      isNamespaced = true;
      nameEnd++;
      while (nameEnd < code.length && /[a-zA-Z0-9._:-]/.test(code[nameEnd])) {
        nameEnd++;
      }
      fullName = code.slice(i + 1, nameEnd);
    }

    // Require a valid tag-name boundary (`[\s/>]`) so `a<foo_bar` or `a<b(c)` is never treated as a tag.
    const afterName = code[nameEnd];
    if (!afterName || !/[\s/>]/.test(afterName)) {
      i++;
      continue;
    }

    // Scan opening tag attributes respecting quotes and `{...}` expressions.
    let j = nameEnd;
    let closed = false;
    let selfClosing = false;
    let alreadyStamped = false;
    while (j < code.length) {
      while (j < code.length && /\s/.test(code[j])) j++;
      if (j >= code.length) break;

      if (code[j] === '>') {
        j++;
        closed = true;
        break;
      }
      if (code[j] === '/' && code[j + 1] === '>') {
        j += 2;
        selfClosing = true;
        closed = true;
        break;
      }
      if (code[j] === '{') {
        const end = skipBraceExpr(code, j);
        if (end < 0) break;
        j = end;
        continue;
      }
      if (!/[a-zA-Z_:@#$]/.test(code[j])) {
        break;
      }
      const attrStart = j;
      while (j < code.length && !/[\s=/>"'<{}]/.test(code[j])) j++;
      const attrName = code.slice(attrStart, j);
      if (attrName === sourceAttribute) alreadyStamped = true;

      while (j < code.length && /\s/.test(code[j])) j++;
      if (code[j] === '=') {
        j++;
        while (j < code.length && /\s/.test(code[j])) j++;
        const q = code[j];
        if (q === '"' || q === "'") {
          const closeQ = code.indexOf(q, j + 1);
          if (closeQ === -1) break;
          j = closeQ + 1;
        } else if (q === '{') {
          const end = skipBraceExpr(code, j);
          if (end < 0) break;
          j = end;
        } else if (q === '`') {
          const end = skipTemplateString(code, j);
          if (end < 0) break;
          j = end;
        } else {
          while (
            j < code.length &&
            !/[\s>"'`=]/.test(code[j]) &&
            !(code[j] === '/' && code[j + 1] === '>')
          ) {
            j++;
          }
        }
      }
    }

    if (!closed) {
      i++;
      continue;
    }

    const lowerFull = fullName.toLowerCase();
    // Not stamped: non-visual/scaffolding tags, namespaced tags, and component tags (`<PlanCard>`, `<Card.Header>`).
    const shouldStamp =
      !isNamespaced &&
      !alreadyStamped &&
      !SKIP_STAMP_TAGS.has(lowerFull) &&
      !/^[A-Z]/.test(baseName) &&
      !baseName.includes('.');

    if (shouldStamp) {
      const { line: tagLine, col } = positionAt(i);
      insertions.push({
        pos: nameEnd,
        text: ` ${sourceAttribute}="${filepath}:${tagLine}:${col}"`,
      });
    }

    i = j;

    // Document metadata / raw-text elements: skip inner content up to the matching closing tag.
    if (!selfClosing && RAW_TEXT_TAGS.has(lowerFull)) {
      const closePattern = new RegExp(`</${lowerFull.replace(':', '\\:')}\\s*>`, 'gi');
      closePattern.lastIndex = i;
      const closeMatch = closePattern.exec(code);
      i = closeMatch ? closeMatch.index + closeMatch[0].length : code.length;
    }
  }

  if (insertions.length === 0) return code;

  let out = '';
  let last = 0;
  for (const ins of insertions) {
    out += code.slice(last, ins.pos) + ins.text;
    last = ins.pos;
  }
  return out + code.slice(last);
}
