/**
 * Shared utility functions used across packages.
 */

import * as crypto from 'crypto';

export function computeNodeHash(sourceCodeSlice: string): string {
  return crypto.createHash('sha1').update(sourceCodeSlice.trim()).digest('hex').substring(0, 8);
}

export interface TagLocation {
  fullTag: string;
  tagName: string;
  attributes: string;
  startIndex: number;
  endIndex: number;
}

export function parseTargetId(targetId: string): { file?: string; line?: number; col?: number; hash?: string } {
  if (!targetId || typeof targetId !== 'string') return {};
  const match = targetId.match(/^(.*?):(\d+):(\d+)(?::([a-fA-F0-9]+))?$/);
  if (match) {
    return {
      file: match[1],
      line: parseInt(match[2], 10),
      col: parseInt(match[3], 10),
      hash: match[4] || undefined
    };
  }
  const lineColMatch = targetId.match(/^line:(\d+):col:(\d+)(?::([a-fA-F0-9]+))?$/);
  if (lineColMatch) {
    return {
      line: parseInt(lineColMatch[1], 10),
      col: parseInt(lineColMatch[2], 10),
      hash: lineColMatch[3] || undefined
    };
  }
  return {};
}

export function findTagAtLineCol(code: string, line: number, col: number): TagLocation | null {
  if (!code || line < 1) return null;
  const normalizedCode = code.replace(/\r\n/g, '\n');
  const lines = normalizedCode.split('\n');
  if (line > lines.length) return null;

  let normIndex = 0;
  for (let i = 0; i < line - 1; i++) {
    normIndex += lines[i].length + 1;
  }
  normIndex += Math.max(0, col - 1);

  let charIndex = 0;
  let normCount = 0;
  for (let i = 0; i < code.length && normCount < normIndex; i++) {
    if (code[i] === '\r' && code[i + 1] === '\n') {
      // skip \r in counting towards normalized length
    } else {
      normCount++;
    }
    charIndex++;
  }

  const windowStart = Math.max(0, charIndex - 30);
  const windowEnd = Math.min(code.length, charIndex + 120);
  const searchSubstring = code.substring(windowStart, windowEnd);

  const tagStartRegex = /<([a-zA-Z][a-zA-Z0-9.-]*)/g;
  let bestMatch: RegExpExecArray | null = null;
  let bestDistance = Infinity;
  const targetOffset = charIndex - windowStart;

  let m: RegExpExecArray | null;
  while ((m = tagStartRegex.exec(searchSubstring)) !== null) {
    const dist = Math.abs(m.index - targetOffset);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestMatch = m;
    }
  }

  if (!bestMatch) return null;

  const actualTagOffset = windowStart + bestMatch.index;
  const restOfCode = code.substring(actualTagOffset);
  const tagEndIndex = restOfCode.indexOf('>');
  if (tagEndIndex === -1) return null;

  const fullTag = restOfCode.substring(0, tagEndIndex + 1);
  const tagName = bestMatch[1];
  const attributes = fullTag.substring(1 + tagName.length, fullTag.length - 1).trim();

  return {
    fullTag,
    tagName,
    attributes,
    startIndex: actualTagOffset,
    endIndex: actualTagOffset + tagEndIndex + 1
  };
}

export function getLineFromPos(code: string, pos: number): number {
  if (pos <= 0) return 1;
  const slice = code.substring(0, pos);
  return slice.split('\n').length;
}

export function getColFromPos(code: string, pos: number): number {
  if (pos <= 0) return 1;
  const slice = code.substring(0, pos);
  const lastNewline = slice.lastIndexOf('\n');
  return lastNewline === -1 ? pos + 1 : pos - lastNewline;
}

export function findTagBySelectorOrText(
  code: string,
  cstSelector?: string | null,
  textSnippet?: string | null
): TagLocation | null {
  if (!code) return null;

  // 1. If textSnippet is provided, search for tag containing textSnippet
  if (textSnippet && textSnippet.trim().length > 2) {
    const cleanSnippet = textSnippet.trim();
    const textPos = code.indexOf(cleanSnippet);
    if (textPos !== -1) {
      const prefix = code.substring(0, textPos);
      const lastTagStart = prefix.lastIndexOf('<');
      if (lastTagStart !== -1) {
        const line = getLineFromPos(code, lastTagStart + 1);
        const col = getColFromPos(code, lastTagStart + 1);
        const tagLoc = findTagAtLineCol(code, line, col);
        if (tagLoc) return tagLoc;
      }
    }
  }

  // 2. If cstSelector is provided, extract class names (e.g. ".hero-subtitle")
  if (cstSelector) {
    const classMatches = cstSelector.match(/\.([a-zA-Z0-9_-]+)/g);
    if (classMatches && classMatches.length > 0) {
      for (let i = classMatches.length - 1; i >= 0; i--) {
        const clsName = classMatches[i].slice(1);
        if (clsName.startsWith('__glide')) continue;
        const classAttrRegex = new RegExp(`<([a-zA-Z][a-zA-Z0-9.-]*)\\s+[^>]*class=(['"])[^'"]*\\b${clsName}\\b[^'"]*\\2[^>]*>`, 'i');
        const match = code.match(classAttrRegex);
        if (match && match.index !== undefined) {
          const line = getLineFromPos(code, match.index + 1);
          const col = getColFromPos(code, match.index + 1);
          const tagLoc = findTagAtLineCol(code, line, col);
          if (tagLoc) return tagLoc;
        }
      }
    }
  }

  return null;
}

export function stampHTMLTemplate(code: string, filepath: string, sourceAttribute: string = 'data-gl-source'): string {
  let cleanCode = code
    .replace(/^\s*---[\s\S]*?\n---/m, match => ' '.repeat(match.length))
    .replace(/<!--[\s\S]*?-->/g, match => ' '.repeat(match.length))
    .replace(/<script[\s\S]*?<\/script>/gi, match => ' '.repeat(match.length))
    .replace(/<style[\s\S]*?<\/style>/gi, match => ' '.repeat(match.length));

  const tagRegex = /<([a-zA-Z][a-zA-Z0-9.-]*)/g;
  let match: RegExpExecArray | null;
  let offset = 0;
  let result = code;

  while ((match = tagRegex.exec(cleanCode)) !== null) {
    const tagName = match[1];
    if (['template', 'script', 'style'].includes(tagName.toLowerCase())) {
      continue;
    }

    const index = match.index;
    const restOfTag = cleanCode.substring(index, index + 500);
    const tagEnd = restOfTag.indexOf('>');
    const tagContent = tagEnd !== -1 ? restOfTag.substring(0, tagEnd) : restOfTag;
    if (tagContent.includes(sourceAttribute)) {
      continue;
    }

    const prefix = code.substring(0, index);
    const lines = prefix.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;

    const sourceAttrVal = ` ${sourceAttribute}="${filepath}:${line}:${col}"`;
    const insertPos = index + 1 + tagName.length;
    const adjustedPos = insertPos + offset;

    result = result.substring(0, adjustedPos) + sourceAttrVal + result.substring(adjustedPos);
    offset += sourceAttrVal.length;
  }

  return result;
}
