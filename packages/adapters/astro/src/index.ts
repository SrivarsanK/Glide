import { mergeInlineStyle } from '@srivarsank/core';

export function updateAstroClass(
  astroCode: string,
  targetId: string,
  updatedClasses: string
): string {
  let frontmatter = '';
  let template = astroCode;

  const parts = astroCode.split('---');
  if (parts.length >= 3) {
    frontmatter = parts.slice(0, 2).join('---') + '---';
    template = parts.slice(2).join('---');
  }

  const escapedId = targetId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const tagRegex = new RegExp(`<([\\w-]+)\\s+([^>]*data-gl-source="${escapedId}"[^>]*)>`, 'i');
  const match = template.match(tagRegex);
  if (!match) return astroCode;

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

  const updatedTemplate = template.replace(fullTag, newFullTag);
  return frontmatter + updatedTemplate;
}

export function updateAstroStyle(
  astroCode: string,
  targetId: string,
  styles: Record<string, string>
): string {
  let frontmatter = '';
  let template = astroCode;

  const parts = astroCode.split('---');
  if (parts.length >= 3) {
    frontmatter = parts.slice(0, 2).join('---') + '---';
    template = parts.slice(2).join('---');
  }

  const escapedId = targetId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const tagRegex = new RegExp(`<([\\w-]+)\\s+([^>]*data-gl-source="${escapedId}"[^>]*)>`, 'i');
  const match = template.match(tagRegex);
  if (!match) return astroCode;

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

  const updatedTemplate = template.replace(fullTag, newFullTag);
  return frontmatter + updatedTemplate;
}

export function updateAstroText(
  astroCode: string,
  targetId: string,
  newText: string
): string {
  let frontmatter = '';
  let template = astroCode;

  const parts = astroCode.split('---');
  if (parts.length >= 3) {
    frontmatter = parts.slice(0, 2).join('---') + '---';
    template = parts.slice(2).join('---');
  }

  const escapedId = targetId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const elementRegex = new RegExp(
    `(<([\\w-]+)\\s+[^>]*data-gl-source="${escapedId}"[^>]*>)([\\s\\S]*?)(<\\/\\2>)`,
    'i'
  );

  const match = template.match(elementRegex);
  if (!match) return astroCode;

  const openTag = match[1];
  const closeTag = match[4];
  const updatedElement = `${openTag}${newText}${closeTag}`;

  const updatedTemplate = template.replace(elementRegex, updatedElement);
  return frontmatter + updatedTemplate;
}

