import { mergeInlineStyle, parseTargetId, findTagAtLineCol } from '@srivarsank/core';

export function updateAstroClass(
  astroCode: string,
  targetId: string,
  updatedClasses: string
): string {
  const escapedId = targetId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const tagRegex = new RegExp(`<([\\w-]+)\\s+([^>]*data-gl-source="${escapedId}"[^>]*)>`, 'i');
  const match = astroCode.match(tagRegex);

  if (match) {
    const fullTag = match[0];
    const tagName = match[1];
    const attributes = match[2];

    const classRegex = /class=(['"])(.*?)\1/;
    const classMatch = attributes.match(classRegex);
    let newFullTag: string;

    if (classMatch) {
      const quote = classMatch[1];
      const newAttributes = attributes.replace(classRegex, `class=${quote}${updatedClasses}${quote}`);
      newFullTag = `<${tagName} ${newAttributes}>`;
    } else {
      const newAttributes = `${attributes} class="${updatedClasses}"`;
      newFullTag = `<${tagName} ${newAttributes}>`;
    }
    return astroCode.replace(fullTag, newFullTag);
  }

  // Fallback: match by line:col in targetId (e.g. "src/pages/index.astro:8:3")
  const { line, col } = parseTargetId(targetId);
  if (line && col) {
    const tagLoc = findTagAtLineCol(astroCode, line, col);
    if (tagLoc) {
      const { tagName, attributes, startIndex, endIndex } = tagLoc;
      const classRegex = /class=(['"])(.*?)\1/;
      const classMatch = attributes.match(classRegex);
      let newFullTag: string;
      if (classMatch) {
        const quote = classMatch[1];
        const newAttributes = attributes.replace(classRegex, `class=${quote}${updatedClasses}${quote}`);
        newFullTag = `<${tagName} ${newAttributes ? ' ' + newAttributes : ''}>`;
      } else {
        const newAttributes = attributes ? `${attributes} class="${updatedClasses}"` : `class="${updatedClasses}"`;
        newFullTag = `<${tagName} ${newAttributes}>`;
      }
      return astroCode.substring(0, startIndex) + newFullTag + astroCode.substring(endIndex);
    }
  }

  return astroCode;
}

export function updateAstroStyle(
  astroCode: string,
  targetId: string,
  styles: Record<string, string>
): string {
  const escapedId = targetId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const tagRegex = new RegExp(`<([\\w-]+)\\s+([^>]*data-gl-source="${escapedId}"[^>]*)>`, 'i');
  const match = astroCode.match(tagRegex);

  if (match) {
    const fullTag = match[0];
    const tagName = match[1];
    const attributes = match[2];

    const styleRegex = /style=(['"])(.*?)\1/;
    const styleMatch = attributes.match(styleRegex);
    let newFullTag: string;

    if (styleMatch) {
      const quote = styleMatch[1];
      const existing = styleMatch[2];
      const merged = mergeInlineStyle(existing, styles);
      const newAttributes = attributes.replace(styleRegex, `style=${quote}${merged}${quote}`);
      newFullTag = `<${tagName} ${newAttributes}>`;
    } else {
      const merged = mergeInlineStyle('', styles);
      const newAttributes = `${attributes} style="${merged}"`;
      newFullTag = `<${tagName} ${newAttributes}>`;
    }
    return astroCode.replace(fullTag, newFullTag);
  }

  // Fallback: match by line:col
  const { line, col } = parseTargetId(targetId);
  if (line && col) {
    const tagLoc = findTagAtLineCol(astroCode, line, col);
    if (tagLoc) {
      const { tagName, attributes, startIndex, endIndex } = tagLoc;
      const styleRegex = /style=(['"])(.*?)\1/;
      const styleMatch = attributes.match(styleRegex);
      let newFullTag: string;
      if (styleMatch) {
        const quote = styleMatch[1];
        const existing = styleMatch[2];
        const merged = mergeInlineStyle(existing, styles);
        const newAttributes = attributes.replace(styleRegex, `style=${quote}${merged}${quote}`);
        newFullTag = `<${tagName} ${newAttributes ? ' ' + newAttributes : ''}>`;
      } else {
        const merged = mergeInlineStyle('', styles);
        const newAttributes = attributes ? `${attributes} style="${merged}"` : `style="${merged}"`;
        newFullTag = `<${tagName} ${newAttributes}>`;
      }
      return astroCode.substring(0, startIndex) + newFullTag + astroCode.substring(endIndex);
    }
  }

  return astroCode;
}

export function updateAstroText(
  astroCode: string,
  targetId: string,
  newText: string
): string {
  const escapedId = targetId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const elementRegex = new RegExp(
    `(<([\\w-]+)\\s+[^>]*data-gl-source="${escapedId}"[^>]*>)([\\s\\S]*?)(<\\/\\2>)`,
    'i'
  );

  const match = astroCode.match(elementRegex);
  if (match) {
    const openTag = match[1];
    const closeTag = match[4];
    return astroCode.replace(elementRegex, `${openTag}${newText}${closeTag}`);
  }

  // Fallback: match by line:col
  const { line, col } = parseTargetId(targetId);
  if (line && col) {
    const tagLoc = findTagAtLineCol(astroCode, line, col);
    if (tagLoc) {
      const { tagName, endIndex } = tagLoc;
      const closeTagStr = `</${tagName}>`;
      const restOfCode = astroCode.substring(endIndex);
      const closeIndex = restOfCode.toLowerCase().indexOf(closeTagStr.toLowerCase());
      if (closeIndex !== -1) {
        const absoluteCloseIndex = endIndex + closeIndex;
        return astroCode.substring(0, endIndex) + newText + astroCode.substring(absoluteCloseIndex);
      }
    }
  }

  return astroCode;
}
