import { mergeInlineStyle } from '@srivarsank/core';

export function updateSvelteClass(
  svelteCode: string,
  targetId: string,
  updatedClasses: string
): string {
  const escapedId = targetId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const tagRegex = new RegExp(`<([\\w-]+)\\s+([^>]*data-gl-source="${escapedId}"[^>]*)>`, 'i');
  const match = svelteCode.match(tagRegex);
  if (!match) return svelteCode;

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

  return svelteCode.replace(fullTag, newFullTag);
}

/**
 * Update inline style attribute on a Svelte template element.
 */
export function updateSvelteStyle(
  svelteCode: string,
  targetId: string,
  styles: Record<string, string>
): string {
  const escapedId = targetId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const tagRegex = new RegExp(`<([\\w-]+)\\s+([^>]*data-gl-source="${escapedId}"[^>]*)>`, 'i');
  const match = svelteCode.match(tagRegex);
  if (!match) return svelteCode;

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

  return svelteCode.replace(fullTag, newFullTag);
}

/**
 * Update text content of a Svelte template element.
 */
export function updateSvelteText(
  svelteCode: string,
  targetId: string,
  newText: string
): string {
  const escapedId = targetId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const elementRegex = new RegExp(
    `(<([\\w-]+)\\s+[^>]*data-gl-source="${escapedId}"[^>]*>)([\\s\\S]*?)(<\\/\\2>)`,
    'i'
  );

  const match = svelteCode.match(elementRegex);
  if (!match) return svelteCode;

  const openTag = match[1];
  const closeTag = match[4];
  const updatedElement = `${openTag}${newText}${closeTag}`;

  return svelteCode.replace(elementRegex, updatedElement);
}
