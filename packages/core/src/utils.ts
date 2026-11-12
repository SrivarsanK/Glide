/**
 * Shared utility functions used across packages.
 */

import * as crypto from 'crypto';

export function computeNodeHash(sourceCodeSlice: string): string {
  return crypto.createHash('sha1').update(sourceCodeSlice.trim()).digest('hex').substring(0, 8);
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
    // `<svelte:head>` and other namespaced tags: an attribute placed after "svelte" would break the tag.
    if (cleanCode[index + 1 + tagName.length] === ':') continue;
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
