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

export function parseTargetId(targetId: string): { file?: string; line?: number; col?: number } {
  if (!targetId || typeof targetId !== 'string') return {};
  const match = targetId.match(/^(.*):(\d+):(\d+)$/);
  if (match) {
    return {
      file: match[1],
      line: parseInt(match[2], 10),
      col: parseInt(match[3], 10)
    };
  }
  return {};
}

export function findTagAtLineCol(code: string, line: number, col: number): TagLocation | null {
  if (!code || line < 1) return null;
  const lines = code.split('\n');
  if (line > lines.length) return null;

  // Compute 0-based character index of (line, col)
  let charIndex = 0;
  for (let i = 0; i < line - 1; i++) {
    charIndex += lines[i].length + 1; // +1 for \n
  }
  charIndex += Math.max(0, col - 1);

  // Search window around charIndex (margin of error ±15 chars for whitespace/indentation shifts)
  const windowStart = Math.max(0, charIndex - 15);
  const windowEnd = Math.min(code.length, charIndex + 60);
  const searchSubstring = code.substring(windowStart, windowEnd);

  const tagStartMatch = searchSubstring.match(/<([a-zA-Z][a-zA-Z0-9.-]*)/);
  if (!tagStartMatch) return null;

  const actualTagOffset = windowStart + tagStartMatch.index!;
  const restOfCode = code.substring(actualTagOffset);
  const tagEndIndex = restOfCode.indexOf('>');
  if (tagEndIndex === -1) return null;

  const fullTag = restOfCode.substring(0, tagEndIndex + 1);
  const tagName = tagStartMatch[1];
  const attributes = fullTag.substring(1 + tagName.length, fullTag.length - 1).trim();

  return {
    fullTag,
    tagName,
    attributes,
    startIndex: actualTagOffset,
    endIndex: actualTagOffset + tagEndIndex + 1
  };
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
