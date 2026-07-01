export function updateCSSModuleRule(
  cssCode: string,
  className: string,
  properties: Record<string, string | null>
): string {
  const escapedClass = className.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const ruleRegex = new RegExp(`\\.(${escapedClass})\\s*\\{([^}]*)\\}`, 'i');
  const match = cssCode.match(ruleRegex);

  if (!match) {
    // Append a new CSS rule block if not present
    const propsStr = Object.entries(properties)
      .filter(([_, val]) => val !== null && val !== '')
      .map(([key, val]) => `  ${key}: ${val};`)
      .join('\n');
    
    if (!propsStr) return cssCode;
    const separator = cssCode.trim() ? '\n\n' : '';
    return cssCode.trim() + `${separator}.${className} {\n${propsStr}\n}\n`;
  }

  const fullRule = match[0];
  let ruleContent = match[2];

  Object.entries(properties).forEach(([key, val]) => {
    // Regex for property inside the braces: e.g. padding: 12px;
    const propRegex = new RegExp(`(${key})\\s*:\\s*([^;]+)\\s*;?`, 'i');
    
    if (propRegex.test(ruleContent)) {
      if (val === null || val === '') {
        // Remove property declaration
        ruleContent = ruleContent.replace(propRegex, '');
      } else {
        // Replace property value
        ruleContent = ruleContent.replace(propRegex, `$1: ${val};`);
      }
    } else if (val !== null && val !== '') {
      // Append new property declaration
      // Ensure we append after a newline/space
      const lineEnd = ruleContent.trim() && !ruleContent.trim().endsWith(';') ? ';' : '';
      ruleContent = ruleContent + `${lineEnd}\n  ${key}: ${val};`;
    }
  });

  // Clean empty newlines or duplicate semicolons
  ruleContent = ruleContent.replace(/;+/g, ';');

  const newRule = `.${className} {${ruleContent}}`;
  return cssCode.replace(fullRule, newRule);
}
