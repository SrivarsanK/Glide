/**
 * Shared inline-style utilities for non-JSX frameworks.
 *
 * HTML-standard inline styles use kebab-case (`background-color`),
 * while the Glide Design Panel sends camelCase (`backgroundColor`).
 * These utilities handle conversion and merge.
 */

/**
 * Convert camelCase CSS property to kebab-case.
 * CSS custom properties (`--brandColor`) preserve their exact casing.
 * e.g. "backgroundColor" → "background-color"
 */
export function camelToKebab(prop: string): string {
  if (prop.startsWith('--')) return prop;
  return prop.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
}

/**
 * Convert kebab-case CSS property to camelCase.
 * e.g. "background-color" → "backgroundColor"
 */
export function kebabToCamel(prop: string): string {
  return prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Parse an inline style string into a Record.
 * Splits declarations on `;` outside quoted strings and parentheses so values
 * like `url(data:image/png;base64,...)` and `content: "a; b"` stay intact.
 * Input:  "color: red; font-size: 16px"
 * Output: { "color": "red", "font-size": "16px" }
 */
export function parseInlineStyle(styleStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!styleStr || !styleStr.trim()) return result;

  const parts: string[] = [];
  let start = 0;
  let quote: '"' | "'" | null = null;
  let parenDepth = 0;

  for (let i = 0; i < styleStr.length; i++) {
    const ch = styleStr[i];
    if (quote) {
      if (ch === '\\') {
        i++;
      } else if (ch === quote) {
        quote = null;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '(') {
      parenDepth++;
    } else if (ch === ')') {
      if (parenDepth > 0) parenDepth--;
    } else if (ch === ';' && parenDepth === 0) {
      parts.push(styleStr.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(styleStr.slice(start));

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.substring(0, colonIdx).trim();
    const val = trimmed.substring(colonIdx + 1).trim();
    if (key) result[key] = val;
  }
  return result;
}

/**
 * Merge new style properties into an existing inline style string.
 * Incoming keys are camelCase (from Design Panel); output is kebab-case.
 * Empty values remove the corresponding declaration.
 *
 * @param existing - Current style="" value (kebab-case)
 * @param changes  - New properties (camelCase keys from overlay)
 * @returns        - Merged style string (kebab-case)
 */
export function mergeInlineStyle(
  existing: string,
  changes: Record<string, string>
): string {
  const parsed = parseInlineStyle(existing);

  for (const [camelKey, value] of Object.entries(changes)) {
    const kebabKey = camelToKebab(camelKey);
    const normalized = value === undefined || value === null ? '' : String(value).trim();
    if (!normalized) {
      delete parsed[kebabKey];
    } else {
      parsed[kebabKey] = normalized;
    }
  }

  return Object.entries(parsed)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
}
