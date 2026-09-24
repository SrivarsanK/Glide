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

// ── Tailwind Token Rewriting ──────────────────────────────────────────────────
import { parse as recastParse, print as recastPrint } from 'recast';
import * as babelParser from 'recast/parsers/babel.js';
import getBabelOptions from 'recast/parsers/_babel_options.js';
import traverseModule from '@babel/traverse';

const tsxParser = {
  parse(source: string, options?: any) {
    const getOpts = (getBabelOptions as any).default || getBabelOptions;
    const babelOptions = getOpts(options);
    babelOptions.plugins = babelOptions.plugins.filter((p: string) => p !== 'flow');
    babelOptions.plugins.push('jsx', 'typescript', 'decoratorAutoAccessors');
    return babelParser.parser.parse(source, babelOptions);
  }
};

const traverse = (traverseModule as any).default || traverseModule;

const TAILWIND_FONT_SIZES = new Set([
  'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'
]);

const TAILWIND_TEXT_ALIGNS = new Set([
  'left', 'center', 'right', 'justify', 'start', 'end'
]);

const TAILWIND_FONT_FAMILIES = new Set([
  'sans', 'serif', 'mono'
]);

const TAILWIND_FONT_WEIGHTS = new Set([
  'thin', 'extralight', 'light', 'normal', 'medium', 'semibold', 'bold', 'extrabold', 'black'
]);

const TAILWIND_BORDER_STYLES = new Set([
  'solid', 'dashed', 'dotted', 'double', 'hidden', 'none'
]);

function isMatchingToken(token: string, prefix: string, targetCategory?: string): boolean {
  let cleanToken = token;
  let cleanPrefix = prefix;

  if (prefix.includes(':')) {
    if (!token.startsWith(prefix)) return false;
    cleanToken = token.slice(prefix.indexOf(':') + 1);
    cleanPrefix = prefix.slice(prefix.indexOf(':') + 1);
  } else {
    if (token.includes(':')) return false;
  }

  if (cleanPrefix === 'border-' && cleanToken === 'border' && targetCategory === 'border-width') {
    return true;
  }

  if (!cleanToken.startsWith(cleanPrefix)) return false;

  const rest = cleanToken.slice(cleanPrefix.length);

  if (targetCategory === 'font-size') {
    return TAILWIND_FONT_SIZES.has(rest) || /^\[\d+(px|rem|em)\]$/.test(rest);
  }
  if (targetCategory === 'text-align') {
    return TAILWIND_TEXT_ALIGNS.has(rest);
  }
  if (targetCategory === 'text-color') {
    return (
      !TAILWIND_FONT_SIZES.has(rest) &&
      !TAILWIND_TEXT_ALIGNS.has(rest) &&
      !/^\[\d+(px|rem|em)\]$/.test(rest)
    );
  }
  if (targetCategory === 'border-style') {
    return TAILWIND_BORDER_STYLES.has(rest);
  }
  if (targetCategory === 'border-width') {
    return cleanToken === 'border' || /^\d+$/.test(rest) || /^\[\d+px\]$/.test(rest);
  }
  if (targetCategory === 'border-color') {
    return !TAILWIND_BORDER_STYLES.has(rest) && !/^\d+$/.test(rest) && !/^\[\d+px\]$/.test(rest);
  }
  if (targetCategory === 'font-family') {
    return TAILWIND_FONT_FAMILIES.has(rest);
  }
  if (targetCategory === 'font-weight') {
    return TAILWIND_FONT_WEIGHTS.has(rest);
  }

  return true;
}

function inferCategory(prefix: string, newValue: string): string | undefined {
  const normVal = newValue.startsWith(prefix) ? newValue.slice(prefix.length) : newValue;

  if (prefix === 'text-' || prefix.endsWith(':text-')) {
    if (TAILWIND_FONT_SIZES.has(normVal) || /^\[\d+(px|rem|em)\]$/.test(normVal)) {
      return 'font-size';
    }
    if (TAILWIND_TEXT_ALIGNS.has(normVal)) {
      return 'text-align';
    }
    if (normVal !== '') {
      return 'text-color';
    }
  }

  if (prefix === 'border-' || prefix.endsWith(':border-')) {
    if (TAILWIND_BORDER_STYLES.has(normVal)) {
      return 'border-style';
    }
    if (/^\d+$/.test(normVal) || /^\[\d+px\]$/.test(normVal)) {
      return 'border-width';
    }
    if (normVal !== '') {
      return 'border-color';
    }
  }

  if (prefix === 'font-' || prefix.endsWith(':font-')) {
    if (TAILWIND_FONT_FAMILIES.has(normVal)) {
      return 'font-family';
    }
    if (TAILWIND_FONT_WEIGHTS.has(normVal)) {
      return 'font-weight';
    }
  }

  return undefined;
}

/**
 * Surgically replace, add, or remove a Tailwind utility class token inside a className string.
 *
 * @param classStr  The existing className string (e.g. "flex bg-blue-500 p-4")
 * @param prefix    The utility prefix to target (e.g. "bg-", "w-", "h-", "text-", "p-")
 * @param newValue  The new token value (e.g. "red-500", "[240px]"). Pass empty string "" to remove.
 */
export function rewriteClassNameToken(
  classStr: string,
  prefix: string,
  newValue: string
): string {
  const category = inferCategory(prefix, newValue);
  const classes = (classStr || '').split(/\s+/).filter(Boolean);

  let fullToken = '';
  if (newValue !== null && newValue !== undefined && newValue.trim() !== '') {
    const trimmed = newValue.trim();
    fullToken = trimmed.startsWith(prefix) ? trimmed : `${prefix}${trimmed}`;
  }

  let replaced = false;
  const newClasses: string[] = [];

  for (const c of classes) {
    if (isMatchingToken(c, prefix, category)) {
      if (!replaced && fullToken) {
        newClasses.push(fullToken);
        replaced = true;
      }
    } else {
      newClasses.push(c);
    }
  }

  if (!replaced && fullToken) {
    newClasses.push(fullToken);
  }

  return newClasses.join(' ');
}

function matchesSourceId(path: any, targetId: string, sourceAttr = 'data-gl-source'): boolean {
  if (!targetId) return false;
  const openingEl = path.node.openingElement;
  let currentId = '';
  openingEl.attributes?.forEach((attr: any) => {
    if (attr.type === 'JSXAttribute' && (attr.name.name === sourceAttr || attr.name.name?.endsWith('-source'))) {
      if (attr.value && attr.value.type === 'StringLiteral') {
        currentId = attr.value.value;
      }
    }
  });

  if (currentId === targetId) return true;

  const parts = targetId.split(':');
  let lineNum = NaN;
  let colNum = NaN;
  if (parts.length >= 3) {
    const last = parts[parts.length - 1];
    const secondLast = parts[parts.length - 2];
    const thirdLast = parts[parts.length - 3];
    const lastAsNum = parseInt(last, 10);
    const secondLastAsNum = parseInt(secondLast, 10);
    const thirdLastAsNum = parseInt(thirdLast, 10);
    if (!isNaN(secondLastAsNum) && !isNaN(lastAsNum)) {
      lineNum = secondLastAsNum;
      colNum = lastAsNum;
    } else if (!isNaN(thirdLastAsNum) && !isNaN(secondLastAsNum)) {
      lineNum = thirdLastAsNum;
      colNum = secondLastAsNum;
    }
  } else if (parts.length === 2) {
    const lineCandidate = parseInt(parts[0], 10);
    const colCandidate = parseInt(parts[1], 10);
    if (!isNaN(lineCandidate) && !isNaN(colCandidate)) {
      lineNum = lineCandidate;
      colNum = colCandidate;
    }
  }

  if (!isNaN(lineNum) && !isNaN(colNum) && path.node.loc) {
    const loc = path.node.loc;
    return loc.start.line === lineNum && (loc.start.column + 1) === colNum;
  }

  return false;
}

/**
 * Surgically replace or add a Tailwind utility token on a JSX element identified by nodeId.
 * Preserves all other attributes, indentation, and formatting using Recast.
 *
 * @param source    Full JSX/TSX source code
 * @param nodeId    Element identifier in data-gl-source format (e.g. "/src/App.tsx:12:3")
 * @param prefix    Tailwind prefix to rewrite (e.g. "bg-", "w-", "h-", "text-", "p-")
 * @param newValue  New token value (e.g. "red-500", "[240px]"). Pass empty string "" to remove.
 */
export function rewriteTailwindToken(
  source: string,
  nodeId: string,
  prefix: string,
  newValue: string
): string {
  const ast = recastParse(source, { parser: tsxParser });
  let targetPath: any = null;

  traverse(ast, {
    JSXElement(path: any) {
      if (matchesSourceId(path, nodeId)) {
        targetPath = path;
        path.stop();
      }
    }
  });

  if (!targetPath) {
    throw new Error(`NODE_NOT_FOUND: JSX element not found at ${nodeId}`);
  }

  const openingEl = targetPath.node.openingElement;
  let classAttr = openingEl.attributes.find(
    (attr: any) => attr.type === 'JSXAttribute' && attr.name && attr.name.name === 'className'
  );

  if (!classAttr) {
    if (!newValue || newValue.trim() === '') {
      return source;
    }
    const fullToken = newValue.startsWith(prefix) ? newValue.trim() : `${prefix}${newValue.trim()}`;
    openingEl.attributes.push({
      type: 'JSXAttribute',
      name: { type: 'JSXIdentifier', name: 'className' },
      value: { type: 'StringLiteral', value: fullToken }
    });
  } else {
    if (classAttr.value && classAttr.value.type === 'StringLiteral') {
      const existing = classAttr.value.value;
      const updated = rewriteClassNameToken(existing, prefix, newValue);
      classAttr.value.value = updated;
    } else if (
      classAttr.value &&
      classAttr.value.type === 'JSXExpressionContainer' &&
      classAttr.value.expression &&
      classAttr.value.expression.type === 'StringLiteral'
    ) {
      const existing = classAttr.value.expression.value;
      const updated = rewriteClassNameToken(existing, prefix, newValue);
      classAttr.value.expression.value = updated;
    } else if (
      classAttr.value &&
      classAttr.value.type === 'JSXExpressionContainer' &&
      classAttr.value.expression &&
      classAttr.value.expression.type === 'TemplateLiteral' &&
      classAttr.value.expression.quasis.length === 1
    ) {
      const raw = classAttr.value.expression.quasis[0].value.raw;
      const updated = rewriteClassNameToken(raw, prefix, newValue);
      classAttr.value.expression.quasis[0].value.raw = updated;
      classAttr.value.expression.quasis[0].value.cooked = updated;
    }
  }

  return recastPrint(ast).code;
}

