import { parse as babelParse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import _generate from '@babel/generator';
import * as t from '@babel/types';
import * as crypto from 'crypto';
import ts from 'typescript';
import { parse as recastParse, print as recastPrint } from 'recast';
import * as babelParser from 'recast/parsers/babel.js';
import getBabelOptions from 'recast/parsers/_babel_options.js';
import { mutateStructure, structuralKinds, type StructuralChange } from './structure.js';
import { mutateProp } from './props.js';
import { layoutStyles } from './layout.js';
import { mutationVariants, splitClassVariants, defaultTailwindTheme, isColorValue, isFontSizeValue, colorToken,
  spacingToken, spacingTokenPx, fontSizeToken, lengthToPx, type MutationScope, type TailwindTheme } from '@srivarsank/core';

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
const generate = (_generate as any).default || _generate;


export function computeNodeHash(sourceCodeSlice: string): string {
  return crypto.createHash('sha1').update(sourceCodeSlice.trim()).digest('hex').substring(0, 8);
}

function validateTypeScript(code: string) {
  const result = ts.createSourceFile('temp.tsx', code, ts.ScriptTarget.Latest, true);
  const diagnostics = (result as any).parseDiagnostics;
  if (diagnostics && diagnostics.length > 0) {
    const msg = diagnostics[0].messageText;
    throw new Error(`TypeScript syntax validation failed: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
  }
}

export function findJSXElementAt(
  sourceCode: string,
  line: number,
  column: number
): any {
  const ast = babelParse(sourceCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let targetNode: any = null;

  traverse(ast, {
    JSXOpeningElement(path: any) {
      const loc = path.node.loc;
      if (loc && loc.start.line === line && loc.start.column === column - 1) {
        targetNode = path.node;
        path.stop();
      }
    },
  });

  return targetNode;
}

const DEFAULT_THEME = defaultTailwindTheme();
const SPACING_PREFIXES: Record<string, string> = {
  marginLeft: 'ml-', marginRight: 'mr-', marginTop: 'mt-', marginBottom: 'mb-', margin: 'm-',
  paddingLeft: 'pl-', paddingRight: 'pr-', paddingTop: 'pt-', paddingBottom: 'pb-', padding: 'p-',
  paddingInline: 'px-', paddingBlock: 'py-', width: 'w-', height: 'h-', gap: 'gap-', rowGap: 'gap-y-',
};
const COLOR_PREFIXES: Record<string, string> = { color: 'text-', backgroundColor: 'bg-', borderColor: 'border-' };
const OTHER_PREFIXES: Record<string, string> = {
  opacity: 'opacity-', borderTopLeftRadius: 'rounded-tl-', borderTopRightRadius: 'rounded-tr-',
  borderBottomRightRadius: 'rounded-br-', borderBottomLeftRadius: 'rounded-bl-', borderWidth: 'border-',
};

/** Only classes positively identified as setting `property` match, so unknown classes survive an edit. */
function matchesProperty(c: string, property: string, theme: TailwindTheme = DEFAULT_THEME): boolean {
  const parts = splitClassVariants(c);
  const name = parts[parts.length - 1];
  const unsigned = name.replace(/^-/, '');

  switch (property) {
    case 'marginLeft': return unsigned.startsWith('ml-');
    case 'marginRight': return unsigned.startsWith('mr-');
    case 'marginTop': return unsigned.startsWith('mt-');
    case 'marginBottom': return unsigned.startsWith('mb-');
    case 'margin': return unsigned.split('-')[0] === 'm';
    case 'paddingLeft': return name.startsWith('pl-');
    case 'paddingRight': return name.startsWith('pr-');
    case 'paddingTop': return name.startsWith('pt-');
    case 'paddingBottom': return name.startsWith('pb-');
    case 'padding': return name.split('-')[0] === 'p';
    case 'paddingInline': return name.startsWith('px-');
    case 'paddingBlock': return name.startsWith('py-');
    case 'width': return name.startsWith('w-');
    case 'height': return name.startsWith('h-');
    case 'gap': return name.startsWith('gap-') && !name.startsWith('gap-y') && !name.startsWith('gap-x');
    case 'rowGap': return name.startsWith('gap-y-');
    case 'opacity': return name.startsWith('opacity-');
    case 'borderTopLeftRadius': return name.startsWith('rounded-tl');
    case 'borderTopRightRadius': return name.startsWith('rounded-tr');
    case 'borderBottomRightRadius': return name.startsWith('rounded-br');
    case 'borderBottomLeftRadius': return name.startsWith('rounded-bl');
    case 'flexDirection': return name === 'flex-row' || name === 'flex-col';
    case 'justifyContent': return name.startsWith('justify-') && !name.startsWith('justify-items-') && !name.startsWith('justify-self-');
    case 'alignItems': return name.startsWith('items-');
    case 'borderStyle': return ['border-solid', 'border-dashed', 'border-dotted', 'border-none'].includes(name);
    // `text-*` is a color or a font size depending on the theme; a class that is both stays put.
    case 'fontSize':
      return name.startsWith('text-') && isFontSizeValue(name.slice(5), theme) && !isColorValue(name.slice(5), theme);
    case 'textAlign':
      return ['text-left', 'text-center', 'text-right', 'text-justify', 'text-start', 'text-end'].includes(name);
    case 'color':
      return name.startsWith('text-') && isColorValue(name.slice(5), theme) && !isFontSizeValue(name.slice(5), theme);
    case 'backgroundColor':
      return name.startsWith('bg-') && isColorValue(name.slice(3), theme);
    case 'borderColor':
      return name.startsWith('border-') && isColorValue(name.slice(7), theme);
    case 'borderWidth':
      return name.startsWith('border-') && (/^border-\[\d+px\]$/.test(name) || /^border-\d+$/.test(name) || name === 'border');
    case 'position': return ['static','relative','absolute','fixed','sticky'].includes(name);
    case 'left': return name.startsWith('left-');
    case 'top': return name.startsWith('top-');
    case 'right': return name.startsWith('right-');
    case 'bottom': return name.startsWith('bottom-');
    default:
      return false;
  }
}

/** The token part of a matching class (`bg-primary/50` → `primary`). */
function classToken(c: string, prefix: string): string | null {
  const parts = splitClassVariants(c);
  const name = parts[parts.length - 1].replace(/^-/, '');
  if (!name.startsWith(prefix)) return null;
  const token = name.slice(prefix.length);
  return token.startsWith('[') ? null : token.split('/')[0];
}

/**
 * The class for `property: value`. Uses the theme's token when the value
 * equals one exactly; otherwise an arbitrary value. `existing` holds the tokens
 * this property already uses in the edited scope.
 */
function getNewClass(property: string, value: any, theme: TailwindTheme = DEFAULT_THEME, existing: string[] = []): string {
  const clean = String(value).trim().replace(/^["']|["']$/g, '');
  // Tailwind splits classes on whitespace; arbitrary values use underscores.
  const arbitraryValue = clean.replace(/\s+/g, '_');
  const isNumber = /^-?\d*\.?\d+$/.test(clean);

  switch (property) {
    case 'flexDirection':
      return clean === 'column' ? 'flex-col' : 'flex-row';
    case 'justifyContent':
      return `justify-${clean}`;
    case 'alignItems':
      return `items-${clean}`;
    case 'textAlign':
      return `text-${clean}`;
    case 'borderStyle':
      return `border-${clean}`;
    case 'position':
      return ['static','relative','absolute','fixed','sticky'].includes(clean) ? clean : 'relative';
    case 'left':
    case 'top':
    case 'right':
    case 'bottom': {
      let v = clean;
      if (/^-?\d+px$/.test(v)) v = v.slice(0, -2);
      return `${property}-[${v}px]`;
    }
  }

  const colorPrefix = COLOR_PREFIXES[property];
  if (colorPrefix) {
    const token = colorToken(clean, theme, existing);
    return token ? `${colorPrefix}${token}` : `${colorPrefix}[${arbitraryValue}]`;
  }

  const spacingPrefix = SPACING_PREFIXES[property];
  if (spacingPrefix) {
    const px = lengthToPx(clean);
    const token = px === null ? null : spacingToken(Math.abs(px), theme);
    if (token && px !== null && (px >= 0 || property.startsWith('margin'))) return `${px < 0 ? '-' : ''}${spacingPrefix}${token}`;
    return isNumber ? `${spacingPrefix}[${clean}px]` : `${spacingPrefix}[${arbitraryValue}]`;
  }

  if (property === 'fontSize') {
    // Font-size tokens also set line-height, so only stay on tokens when the element already uses one.
    const usesTokens = existing.some(token => theme.fontSizes.has(token));
    const px = lengthToPx(clean);
    const token = usesTokens && px !== null ? fontSizeToken(px, theme) : null;
    if (token) return `text-${token}`;
    return isNumber ? `text-[${clean}px]` : `text-[${arbitraryValue}]`;
  }

  const prefix = OTHER_PREFIXES[property];
  if (!prefix) return '';
  const val = /^\d+px$/.test(clean) ? clean.slice(0, -2) : arbitraryValue;
  if (property !== 'opacity' && /^\d+$/.test(val)) return `${prefix}[${val}px]`;
  return `${prefix}[${val}]`;
}

function getExistingValue(existingClasses: string, property: string, theme: TailwindTheme = DEFAULT_THEME): number {
  const classes = existingClasses.split(/\s+/).filter(Boolean);
  for (const c of classes) {
    if (matchesProperty(c, property, theme)) {
      const parts = splitClassVariants(c);
      const name = parts[parts.length - 1];

      const jitMatch = name.match(/-\[([-\d]+)(?:px)?\]$/);
      if (jitMatch) {
        return Number(jitMatch[1]);
      }

      const prefix = SPACING_PREFIXES[property];
      const token = prefix ? classToken(c, prefix) : null;
      const px = token === null ? null : spacingTokenPx(token, theme);
      if (px !== null) return name.startsWith('-') ? -px : px;
    }
  }
  return 0;
}

export function updateClassString(
  existingClasses: string,
  property: string,
  value: any,
  breakpoint?: string,
  pseudoState?: string,
  theme: TailwindTheme = DEFAULT_THEME
): string {
  const variants = mutationVariants({ breakpoint, pseudoState }, [...theme.breakpoints.keys()]);
  if (property === 'className') {
    if (variants.length) throw new Error('UNSUPPORTED_SCOPE: Replace individual properties in a scoped edit.');
    return value;
  }

  const classes = existingClasses.split(/\s+/).filter(Boolean);
  const inScope = (token: string) => {
    const prefixes = splitClassVariants(token).slice(0, -1);
    return prefixes.length === variants.length && variants.every(variant => prefixes.includes(variant));
  };

  let finalValue = value;
  const valStr = String(value).trim();
  if (valStr.startsWith('+=') || valStr.startsWith('-=')) {
    const isNegative = valStr.startsWith('-=');
    const change = Number(valStr.slice(2).replace('px', ''));
    if (!isNaN(change)) {
      const current = getExistingValue(classes.filter(inScope).join(' '), property, theme);
      finalValue = isNegative ? (current - change) : (current + change);
    }
  }

  const replaced = classes.filter(c => inScope(c) && matchesProperty(c, property, theme));
  const prefix = COLOR_PREFIXES[property] || (property === 'fontSize' ? 'text-' : '');
  const existingTokens = prefix ? replaced.flatMap(c => classToken(c, prefix) ?? []) : [];
  const newClass = getNewClass(property, finalValue, theme, existingTokens);
  if (!newClass) return existingClasses;

  const filtered = classes.filter(c => !replaced.includes(c));
  filtered.push([...variants, newClass].join(':'));
  return filtered.join(' ');
}

function getStaticAttribute(opening: t.JSXOpeningElement, name: string): t.JSXAttribute | undefined {
  if (opening.attributes.some(attr => t.isJSXSpreadAttribute(attr))) {
    throw new Error(`UNSUPPORTED_OPERATION: ${name} may come from a spread attribute.`);
  }
  const attributes = opening.attributes.filter((attr): attr is t.JSXAttribute =>
    t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name }));
  if (attributes.length > 1) {
    throw new Error(`UNSUPPORTED_OPERATION: ${name} has duplicate attributes.`);
  }
  return attributes[0];
}

function classLiteral(attr?: t.JSXAttribute): t.StringLiteral | undefined {
  if (!attr) return undefined;
  if (t.isStringLiteral(attr.value)) return attr.value;
  if (t.isJSXExpressionContainer(attr.value) && t.isStringLiteral(attr.value.expression)) {
    return attr.value.expression;
  }
  throw new Error('UNSUPPORTED_OPERATION: className must be a static string literal.');
}

function mutateClass(node: t.JSXElement, property: string, value: any, breakpoint?: string, pseudoState?: string,
  theme: TailwindTheme = DEFAULT_THEME): string {
  if (property !== 'className' && !getNewClass(property, value, theme)) {
    throw new Error(`UNSUPPORTED_OPERATION: No Tailwind authoring rule for ${property}.`);
  }
  const openingEl = node.openingElement;
  const classAttr = getStaticAttribute(openingEl, 'className');
  const literal = classLiteral(classAttr);
  const existingVal = literal?.value ?? '';

  const newVal = updateClassString(existingVal, property, value, breakpoint, pseudoState, theme);

  // Change only the node selected by its source location.
  if (literal) {
    literal.value = newVal;
  } else {
    openingEl.attributes.push(
      t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral(newVal))
    );
  }
  return newVal;
}

export interface JSXMutation extends MutationScope {
  line: number;
  column: number;
  hash?: string;
  change: StructuralChange & MutationScope & { property?: string; value?: any; scope?: string; layoutPosition?: string };
}

function jsxNodes(ast: any): t.JSXElement[] {
  const nodes: t.JSXElement[] = [];
  traverse(ast, { JSXElement(p: { node: t.JSXElement }) { nodes.push(p.node); } });
  return nodes;
}

/** Resolve all locations from the original source. Public columns start at one. */
export function transformJSXBatch(source: string, operations: JSXMutation[], options: { theme?: TailwindTheme } = {}) {
  const theme = options.theme ?? DEFAULT_THEME;
  const ast = recastParse(source, { parser: tsxParser });
  const nodes = jsxNodes(ast);
  // Recast expands leading tabs and normalizes line endings before parsing.
  // Resolve public coordinates and hashes against Babel's untouched input,
  // then pair the structure-identical trees by traversal order.
  const originalNodes = jsxNodes(babelParse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] }));
  if (operations.some(op => structuralKinds.has(op.change?.type)) && operations.length !== 1) {
    throw new Error('UNSUPPORTED_OPERATION: A structural action must have its own transaction.');
  }
  const resolve = (id: string): t.JSXElement => {
    const local = typeof id === 'string' && id.match(/^line:(\d+):col:(\d+)(?::([a-fA-F0-9]+))?$/);
    const full = typeof id === 'string' && id.match(/^.*?:(\d+):(\d+)(?::([a-fA-F0-9]+))?$/);
    const match = local || full;
    if (!match) throw new Error('INVALID_TARGET: An exact source reference is required.');
    const line = Number(match[1]), column = Number(match[2]) + (local ? 1 : 0);
    const index = originalNodes.findIndex(node => node.loc?.start.line === line && node.loc.start.column + 1 === column);
    if (index < 0) throw new Error('INVALID_TARGET: The referenced node does not exist.');
    if (match[3] && computeNodeHash(source.slice(originalNodes[index].start!, originalNodes[index].end!)) !== match[3]) throw new Error('STALE_NODE: The referenced node changed.');
    return nodes[index];
  };
  const targets = operations.map(op => {
    const node = originalNodes.find(n => n.loc?.start.line === op.line && n.loc.start.column === op.column - 1);
    if (!node) throw new Error(`NODE_NOT_FOUND: No JSX element exists at ${op.line}:${op.column}.`);
    if (op.hash && op.hash !== 'nohash' && computeNodeHash(source.slice(node.start!, node.end!)) !== op.hash) {
      throw new Error('STALE_NODE: Reference is stale. Read the file again.');
    }
    return nodes[originalNodes.indexOf(node)];
  });
  operations.forEach((op, index) => {
    const change = { ...op.change, breakpoint: op.breakpoint ?? op.change.breakpoint,
      pseudoState: op.pseudoState ?? op.change.pseudoState,
      authoringRepresentation: op.authoringRepresentation ?? op.change.authoringRepresentation };
    const variants = mutationVariants(change, [...theme.breakpoints.keys()]);
    if (variants.length && !['class', 'multi-class', 'style', 'layout'].includes(change.type)) {
      throw new Error('UNSUPPORTED_OPERATION: This style scope needs an authored stylesheet.');
    }
    if (variants.length && change.type === 'style' && change.authoringRepresentation !== 'tailwind') {
      throw new Error('UNSUPPORTED_OPERATION: Scoped styles require Tailwind authoring.');
    }
    switch (change.type) {
      case 'prop': mutateProp(ast, targets[index], change.property, change.value, change.scope); break;
      case 'class':
        if (!change.property) throw new Error('INVALID_OPERATION: Class edits need a property.');
        if (change.authoringRepresentation === 'inline') mutateStyle(targets[index], { [change.property]: change.value });
        else mutateClass(targets[index], change.property, change.value, change.breakpoint, change.pseudoState, theme);
        break;
      case 'style':
        if (change.authoringRepresentation === 'tailwind') {
          for (const [property, value] of Object.entries(change.value || {})) mutateClass(targets[index], property, value, change.breakpoint, change.pseudoState, theme);
        } else mutateStyle(targets[index], change.value);
        break;
      case 'layout': {
        const styles = layoutStyles(change.value, change.layoutPosition);
        if (variants.length || change.authoringRepresentation === 'tailwind') {
          if (change.authoringRepresentation !== 'tailwind') throw new Error('UNSUPPORTED_SCOPE: Scoped layout needs Tailwind authoring.');
          for (const [property, value] of Object.entries(styles)) mutateClass(targets[index], property, value, change.breakpoint, change.pseudoState, theme);
        } else mutateStyle(targets[index], styles);
        break;
      }
      case 'position':
        if (!change.value || change.value.position !== 'relative' || Object.keys(change.value).some(key => !['position', 'left', 'top'].includes(key))) {
          throw new Error('UNSUPPORTED_OPERATION: Only relative flow-preserving offsets are supported.');
        }
        mutateStyle(targets[index], change.value);
        break;
      case 'multi-class':
        if (!change.value || typeof change.value !== 'object' || Array.isArray(change.value)) throw new Error('INVALID_OPERATION: Expected class properties.');
        if (change.authoringRepresentation === 'inline') mutateStyle(targets[index], change.value);
        else for (const [property, value] of Object.entries(change.value)) mutateClass(targets[index], property, value, change.breakpoint, change.pseudoState, theme);
        break;
      case 'text':
        if (typeof change.value !== 'string') throw new Error('INVALID_OPERATION: Text must be a string.');
        mutateText(targets[index], change.value);
        break;
      default:
        if (!structuralKinds.has(change.type)) throw new Error('UNSUPPORTED_OPERATION: This operation kind is not supported.');
        mutateStructure(ast, targets[index], change, resolve);
    }
  });
  const code = recastPrint(ast, { lineTerminator: source.includes('\r\n') ? '\r\n' : '\n' }).code;
  const survivingNodes = jsxNodes(ast);
  const checked = babelParse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  const locations: { line: number; column: number; hash: string }[] = [];
  traverse(checked, { JSXElement(p: { node: t.JSXElement }) {
    locations.push({ line: p.node.loc!.start.line, column: p.node.loc!.start.column + 1,
      hash: computeNodeHash(code.slice(p.node.start!, p.node.end!)) });
  } });
  if (locations.length !== survivingNodes.length) throw new Error('INVALID_OUTPUT: The printed JSX structure changed unexpectedly.');
  // Printing a changed node can move every following sibling and descendant.
  // Structure-preserving edits retain traversal order, so map every source node.
  return { code, removed: originalNodes.flatMap((node, index) => survivingNodes.includes(nodes[index]) ? [] : [{
    line: node.loc!.start.line, column: node.loc!.start.column + 1,
  }]), remaps: originalNodes.flatMap((node, index) => {
    const next = survivingNodes.indexOf(nodes[index]);
    if (next < 0) return [];
    return [{
    oldLine: node.loc!.start.line, oldColumn: node.loc!.start.column + 1,
    oldHash: computeNodeHash(source.slice(node.start!, node.end!)),
    newHash: locations[next].hash,
    newCoordinates: { line: locations[next].line, column: locations[next].column },
  }]; }) };
}

function mutateText(node: t.JSXElement, newText: string): void {
  const children: t.JSXElement['children'] = node.children;
  const candidates = children.filter(child =>
    (t.isJSXText(child) && child.value.trim() !== '') ||
    (t.isJSXExpressionContainer(child) && t.isStringLiteral(child.expression)));
  if (candidates.length !== 1) {
    throw new Error('UNSUPPORTED_OPERATION: Select one literal text segment. The element has no unique text target.');
  }
  const child = candidates[0];
  if (t.isJSXText(child)) {
    const existingRaw = child.value;
    const leadingWs = existingRaw.match(/^(\s*)/)?.[1] ?? '';
    const trailingWs = existingRaw.match(/(\s*)$/)?.[1] ?? '';
    if (/[&<>{}\r\n]/.test(newText) || newText === '') {
      // A string expression preserves special characters and line breaks.
      const replacement = [
        ...(leadingWs ? [t.jsxText(leadingWs)] : []),
        t.jsxExpressionContainer(t.stringLiteral(newText)),
        ...(trailingWs ? [t.jsxText(trailingWs)] : []),
      ];
      children.splice(children.indexOf(child), 1, ...replacement);
    } else {
      child.value = leadingWs + newText + trailingWs;
    }
  } else if (t.isJSXExpressionContainer(child) && t.isStringLiteral(child.expression)) {
    child.expression.value = newText;
  }
}

function mutateStyle(node: t.JSXElement, styles: Record<string, string>): void {
  const openingEl = node.openingElement;
  const styleAttr = getStaticAttribute(openingEl, 'style');
  if (styleAttr) {
    const value = styleAttr.value;
    if (!t.isJSXExpressionContainer(value) || !t.isObjectExpression(value.expression)) {
      throw new Error('UNSUPPORTED_OPERATION: style must be a static object literal.');
    }
    const keys = new Set<string>();
    for (const prop of value.expression.properties) {
      if (!t.isObjectProperty(prop) || prop.computed || prop.shorthand
        || (!t.isIdentifier(prop.key) && !t.isStringLiteral(prop.key))
        || (!t.isStringLiteral(prop.value) && !t.isNumericLiteral(prop.value))) {
        throw new Error('UNSUPPORTED_OPERATION: style has a dynamic property, spread, or computed key.');
      }
      const key = t.isIdentifier(prop.key) ? prop.key.name : prop.key.value;
      if (keys.has(key)) throw new Error('UNSUPPORTED_OPERATION: style has duplicate properties.');
      keys.add(key);
    }
  }

  const newProperties = Object.entries(styles).map(([key, val]) => {
    return t.objectProperty(t.isValidIdentifier(key) ? t.identifier(key) : t.stringLiteral(key), t.stringLiteral(val));
  });

  if (styleAttr) {
    if (styleAttr.value && styleAttr.value.type === 'JSXExpressionContainer' && styleAttr.value.expression.type === 'ObjectExpression') {
      const existingProperties = styleAttr.value.expression.properties as any[];
      const mergedProperties = [...existingProperties];
      newProperties.forEach(newProp => {
        const keyName = t.isIdentifier(newProp.key) ? newProp.key.name : (newProp.key as t.StringLiteral).value;
        const idx = mergedProperties.findIndex(p => p.type === 'ObjectProperty' &&
          (t.isIdentifier(p.key) ? p.key.name : p.key.value) === keyName);
        if (idx !== -1) {
          mergedProperties[idx].value = newProp.value;
        } else {
          mergedProperties.push(newProp);
        }
      });
      styleAttr.value.expression.properties = mergedProperties;
    } else {
      styleAttr.value = t.jsxExpressionContainer(t.objectExpression(newProperties));
    }
  } else {
    openingEl.attributes.push(
      t.jsxAttribute(
        t.jsxIdentifier('style'),
        t.jsxExpressionContainer(t.objectExpression(newProperties))
      )
    );
  }
}

export function updateClassName(
  sourceCode: string,
  line: number,
  column: number,
  property: string,
  value: any,
  breakpoint?: string,
  expectedHash?: string
): string {
  // Parse with babel for precise location/hash check
  const babelAst = babelParse(sourceCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let babelTarget: any = null;
  traverse(babelAst, {
    JSXElement(path: any) {
      const loc = path.node.openingElement.loc;
      if (loc && loc.start.line === line && loc.start.column === column - 1) {
        babelTarget = path;
        path.stop();
      }
    },
  });

  if (!babelTarget) {
    throw new Error(`NODE_NOT_FOUND: JSX element not found at line ${line}, column ${column}`);
  }

  if (expectedHash && expectedHash !== 'nohash') {
    const currentSlice = sourceCode.slice(babelTarget.node.start, babelTarget.node.end);
    const currentHash = computeNodeHash(currentSlice);
    if (currentHash !== expectedHash) {
      throw new Error(`STALE_NODE: Reference is stale. Expected hash ${expectedHash}, got ${currentHash}`);
    }
  }

  // Now parse with recast for CST mutation and print
  const ast = recastParse(sourceCode, { parser: tsxParser });

  const target = jsxNodes(ast)[jsxNodes(babelAst).indexOf(babelTarget.node)];
  const newVal = mutateClass(target, property, value, breakpoint);

  const updatedSourceCode = recastPrint(ast).code;

  validateTypeScript(updatedSourceCode);

  const newJSXCode = recastPrint(target).code;
  const confirmAst = recastParse(newJSXCode, { parser: tsxParser });
  let hasExpectedValue = false;
  traverse(confirmAst, {
    JSXOpeningElement(path: any) {
      const attr = path.node.attributes.find(
        (a: any) => a.type === 'JSXAttribute' && a.name.name === 'className'
      );
      if (attr && classLiteral(attr)?.value === newVal) {
        hasExpectedValue = true;
        path.stop();
      }
    }
  });
  if (!hasExpectedValue) {
    throw new Error('Round-trip validation failed: Target node attribute was not updated as expected.');
  }

  return updatedSourceCode;
}

export function updateJSXText(
  sourceCode: string,
  line: number,
  column: number,
  newText: string,
  expectedHash?: string
): string {
  // Parse with babel for precise location/hash check
  const babelAst = babelParse(sourceCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let babelTarget: any = null;
  traverse(babelAst, {
    JSXElement(path: any) {
      const loc = path.node.openingElement.loc;
      if (loc && loc.start.line === line && loc.start.column === column - 1) {
        babelTarget = path;
        path.stop();
      }
    },
  });

  if (!babelTarget) {
    throw new Error(`NODE_NOT_FOUND: JSX element not found at line ${line}, column ${column}`);
  }

  if (expectedHash && expectedHash !== 'nohash') {
    const currentSlice = sourceCode.slice(babelTarget.node.start, babelTarget.node.end);
    const currentHash = computeNodeHash(currentSlice);
    if (currentHash !== expectedHash) {
      throw new Error(`STALE_NODE: Reference is stale. Expected hash ${expectedHash}, got ${currentHash}`);
    }
  }

  // Now parse with recast for CST mutation and print
  const ast = recastParse(sourceCode, { parser: tsxParser });

  const target = jsxNodes(ast)[jsxNodes(babelAst).indexOf(babelTarget.node)];
  mutateText(target, newText);

  const updatedSourceCode = recastPrint(ast).code;

  validateTypeScript(updatedSourceCode);

  const newJSXCode = recastPrint(target).code;
  const confirmAst = recastParse(newJSXCode, { parser: tsxParser });
  let hasExpectedValue = false;
  traverse(confirmAst, {
    JSXText(path: any) {
      if (path.node.value.trim() === newText.trim()) {
        hasExpectedValue = true;
      }
    },
    StringLiteral(path: any) {
      if (path.node.value.trim() === newText.trim()) {
        hasExpectedValue = true;
      }
    }
  });
  if (!hasExpectedValue) {
    throw new Error('Round-trip validation failed: Target text content was not updated as expected.');
  }

  return updatedSourceCode;
}

export function updateJSXStyleProp(
  sourceCode: string,
  line: number,
  column: number,
  styles: Record<string, string>,
  expectedHash?: string
): string {
  // Parse with babel for precise location/hash check
  const babelAst = babelParse(sourceCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let babelTarget: any = null;
  traverse(babelAst, {
    JSXElement(path: any) {
      const loc = path.node.openingElement.loc;
      if (loc && loc.start.line === line && loc.start.column === column - 1) {
        babelTarget = path;
        path.stop();
      }
    },
  });

  if (!babelTarget) {
    throw new Error(`NODE_NOT_FOUND: JSX element not found at line ${line}, column ${column}`);
  }

  if (expectedHash && expectedHash !== 'nohash') {
    const currentSlice = sourceCode.slice(babelTarget.node.start, babelTarget.node.end);
    const currentHash = computeNodeHash(currentSlice);
    if (currentHash !== expectedHash) {
      throw new Error(`STALE_NODE: Reference is stale. Expected hash ${expectedHash}, got ${currentHash}`);
    }
  }

  // Now parse with recast for CST mutation and print
  const ast = recastParse(sourceCode, { parser: tsxParser });

  const target = jsxNodes(ast)[jsxNodes(babelAst).indexOf(babelTarget.node)];
  mutateStyle(target, styles);

  const updatedSourceCode = recastPrint(ast).code;

  validateTypeScript(updatedSourceCode);

  const newJSXCode = recastPrint(target).code;
  const confirmAst = recastParse(newJSXCode, { parser: tsxParser });
  let hasExpectedValue = false;
  traverse(confirmAst, {
    JSXAttribute(path: any) {
      if (path.node.name.name === 'style' && path.node.value.type === 'JSXExpressionContainer' && path.node.value.expression.type === 'ObjectExpression') {
        hasExpectedValue = true;
      }
    }
  });
  if (!hasExpectedValue) {
    throw new Error('Round-trip validation failed: Target style prop was not updated as expected.');
  }

  return updatedSourceCode;
}
