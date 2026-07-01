export function updateSvelteClass(
  svelteCode: string,
  targetId: string,
  updatedClasses: string
): string {
  const escapedId = targetId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const tagRegex = new RegExp(`<([\\w-]+)\\s+([^>]*data-cf-source="${escapedId}"[^>]*)>`, 'i');
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
