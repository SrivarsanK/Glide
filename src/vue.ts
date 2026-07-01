import { parse } from '@vue/compiler-sfc';

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
  const tagRegex = new RegExp(`<([\\w-]+)\\s+([^>]*data-cf-source="${escapedId}"[^>]*)>`, 'i');
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
