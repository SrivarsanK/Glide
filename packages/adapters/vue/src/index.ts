import { parse } from '@vue/compiler-sfc';
import { mergeInlineStyle, parseTargetId, findTagAtLineCol } from '@srivarsank/core';

export function updateVueSFCClass(
  sfcCode: string,
  targetId: string,
  updatedClasses: string
): string {
  const parsed = parse(sfcCode);
  const template = parsed.descriptor.template;
  if (!template) return sfcCode;

  const templateContent = template.content;
  const escapedId = targetId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const { line, col } = parseTargetId(targetId);
  const lineColPattern = line && col ? `[^"]*?:${line}:${col}` : null;
  const attrPattern = lineColPattern ? `(?:${escapedId}|${lineColPattern})` : escapedId;

  const tagRegex = new RegExp(`<([\\w-]+)\\s+([^>]*data-gl-source="${attrPattern}"[^>]*)>`, 'i');
  const match = templateContent.match(tagRegex);
  if (match) {
    const fullTag = match[0];
    const tagName = match[1];
    const attributes = match[2];

    const classRegex = /class=(['"])(.*?)\1/;
    const classMatch = attributes.match(classRegex);
    let newFullTag = fullTag;

    if (classMatch) {
      const quote = classMatch[1];
      const newAttributes = attributes.replace(classRegex, `class=${quote}${updatedClasses}${quote}`);
      newFullTag = `<${tagName} ${newAttributes}>`;
    } else {
      const newAttributes = `${attributes} class="${updatedClasses}"`;
      newFullTag = `<${tagName} ${newAttributes}>`;
    }

    const newTemplateContent = templateContent.replace(fullTag, newFullTag);
    const start = template.loc.start.offset;
    const end = template.loc.end.offset;

    return sfcCode.substring(0, start) + newTemplateContent + sfcCode.substring(end);
  }

  // Fallback: line:col search
  if (line && col) {
    const tagLoc = findTagAtLineCol(templateContent, line, col);
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
      const newTemplateContent = templateContent.substring(0, startIndex) + newFullTag + templateContent.substring(endIndex);
      const start = template.loc.start.offset;
      const end = template.loc.end.offset;
      return sfcCode.substring(0, start) + newTemplateContent + sfcCode.substring(end);
    }
  }

  return sfcCode;
}

export function updateVueSFCStyle(
  sfcCode: string,
  targetId: string,
  styles: Record<string, string>
): string {
  const parsed = parse(sfcCode);
  const template = parsed.descriptor.template;
  if (!template) return sfcCode;

  const templateContent = template.content;
  const escapedId = targetId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const { line, col } = parseTargetId(targetId);
  const lineColPattern = line && col ? `[^"]*?:${line}:${col}` : null;
  const attrPattern = lineColPattern ? `(?:${escapedId}|${lineColPattern})` : escapedId;

  const tagRegex = new RegExp(`<([\\w-]+)\\s+([^>]*data-gl-source="${attrPattern}"[^>]*)>`, 'i');
  const match = templateContent.match(tagRegex);
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

    const newTemplateContent = templateContent.replace(fullTag, newFullTag);
    const start = template.loc.start.offset;
    const end = template.loc.end.offset;

    return sfcCode.substring(0, start) + newTemplateContent + sfcCode.substring(end);
  }

  // Fallback: line:col search
  if (line && col) {
    const tagLoc = findTagAtLineCol(templateContent, line, col);
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
      const newTemplateContent = templateContent.substring(0, startIndex) + newFullTag + templateContent.substring(endIndex);
      const start = template.loc.start.offset;
      const end = template.loc.end.offset;
      return sfcCode.substring(0, start) + newTemplateContent + sfcCode.substring(end);
    }
  }

  return sfcCode;
}

export function updateVueSFCText(
  sfcCode: string,
  targetId: string,
  newText: string
): string {
  const parsed = parse(sfcCode);
  const template = parsed.descriptor.template;
  if (!template) return sfcCode;

  const templateContent = template.content;
  const escapedId = targetId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const { line, col } = parseTargetId(targetId);
  const lineColPattern = line && col ? `[^"]*?:${line}:${col}` : null;
  const attrPattern = lineColPattern ? `(?:${escapedId}|${lineColPattern})` : escapedId;

  const elementRegex = new RegExp(
    `(<([\\w-]+)\\s+[^>]*data-gl-source="${attrPattern}"[^>]*>)([\\s\\S]*?)(<\\/\\2>)`,
    'i'
  );

  const match = templateContent.match(elementRegex);
  if (match) {
    const openTag = match[1];
    const closeTag = match[4];
    const updatedElement = `${openTag}${newText}${closeTag}`;

    const newTemplateContent = templateContent.replace(elementRegex, updatedElement);
    const start = template.loc.start.offset;
    const end = template.loc.end.offset;

    return sfcCode.substring(0, start) + newTemplateContent + sfcCode.substring(end);
  }

  // Fallback: line:col search
  if (line && col) {
    const tagLoc = findTagAtLineCol(templateContent, line, col);
    if (tagLoc) {
      const { tagName, endIndex } = tagLoc;
      const closeTagStr = `</${tagName}>`;
      const restOfCode = templateContent.substring(endIndex);
      const closeIndex = restOfCode.toLowerCase().indexOf(closeTagStr.toLowerCase());
      if (closeIndex !== -1) {
        const absoluteCloseIndex = endIndex + closeIndex;
        const newTemplateContent = templateContent.substring(0, endIndex) + newText + templateContent.substring(absoluteCloseIndex);
        const start = template.loc.start.offset;
        const end = template.loc.end.offset;
        return sfcCode.substring(0, start) + newTemplateContent + sfcCode.substring(end);
      }
    }
  }

  return sfcCode;
}

