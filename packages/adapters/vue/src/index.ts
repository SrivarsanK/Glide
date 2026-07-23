import { parse } from '@vue/compiler-sfc';
import { mergeInlineStyle } from '@srivarsank/core';

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
  const tagRegex = new RegExp(`<([\\w-]+)\\s+([^>]*data-gl-source="${escapedId}"[^>]*)>`, 'i');
  const match = templateContent.match(tagRegex);
  if (!match) return sfcCode;

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

/**
 * Update inline style attribute on a Vue SFC template element.
 * Merges camelCase properties from the Design Panel into kebab-case HTML style="...".
 */
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
  const tagRegex = new RegExp(`<([\\w-]+)\\s+([^>]*data-gl-source="${escapedId}"[^>]*)>`, 'i');
  const match = templateContent.match(tagRegex);
  if (!match) return sfcCode;

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

/**
 * Update text content of a Vue SFC template element.
 */
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
  const elementRegex = new RegExp(
    `(<([\\w-]+)\\s+[^>]*data-gl-source="${escapedId}"[^>]*>)([\\s\\S]*?)(<\\/\\2>)`,
    'i'
  );

  const match = templateContent.match(elementRegex);
  if (!match) return sfcCode;

  const openTag = match[1];
  const closeTag = match[4];
  const updatedElement = `${openTag}${newText}${closeTag}`;

  const newTemplateContent = templateContent.replace(elementRegex, updatedElement);
  const start = template.loc.start.offset;
  const end = template.loc.end.offset;

  return sfcCode.substring(0, start) + newTemplateContent + sfcCode.substring(end);
}

