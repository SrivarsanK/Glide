/**
 * scanner.ts — Cross-reference layer for Glide.
 *
 * Scans a project's JSX/TSX source files and CSS stylesheets, then builds
 * a flat HashMap keyed by `data-gl-source` (or a line:col fallback) where
 * every entry carries:
 *   - parsed className tokens
 *   - inline style object (static only)
 *   - `resolvedStyles` — winning CSS value per property with full provenance
 *
 * Supports:
 *   - Plain CSS / CSS Modules
 *   - CSS custom properties (`var(--x)`) resolved through `:root`
 *   - Tailwind utility classes (arbitrary `w-[327px]` and scale-based)
 *   - Specificity-based cascade resolution
 *   - Pseudo-class / media-query states reported separately
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse as parseBabel } from '@babel/parser';
import _traverse from '@babel/traverse';

// postcss is a CJS package — import via require so we stay ESM-compatible.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const postcss = require('postcss');

const traverse = (_traverse as any).default ?? _traverse;

// ── Public types ──────────────────────────────────────────────────────────────

export type StyleSource =
  | 'inline-style'
  | `css-rule`
  | `tailwind`
  | 'inherited'
  | 'initial';

export interface ResolvedValue {
  value: string;
  source: StyleSource;
  /** For css-rule entries */
  rule?: string;
  file?: string;
  line?: number;
  specificity?: [number, number, number, number]; // [inline, id, class, element]
  important?: boolean;
  /** For tailwind entries */
  resolvedFrom?: string;
}

export interface StateStyles {
  [pseudoOrMedia: string]: Record<string, ResolvedValue>;
}

export interface ScannedElement {
  /** Unique key — data-gl-source value or line:col fallback */
  id: string;
  tagName: string;
  line: number;
  column: number;
  file: string;
  classNames: string[];                      // individual class tokens
  inlineStyle: Record<string, string>;       // static JSX style={{}} values only
  resolvedStyles: Record<string, ResolvedValue>;
  /** Styles that only apply under a pseudo-class or media query */
  states: StateStyles;
  /** Properties that couldn't be resolved statically */
  unresolvable: string[];
}

/** The main HashMap: id → ScannedElement */
export type ScanResult = Map<string, ScannedElement>;

// ── Internal CSS Rule representation ─────────────────────────────────────────

interface CssRule {
  selector: string;
  declarations: Record<string, string>;
  specificity: [number, number, number, number];
  important: Set<string>;            // properties marked !important
  file: string;
  line: number;
  /** Non-null when this rule is inside a pseudo-class or @media */
  condition: string | null;
}

// ── Specificity calculation ───────────────────────────────────────────────────

function computeSpecificity(selector: string): [number, number, number, number] {
  let id = 0, cls = 0, el = 0;
  // strip pseudo-elements / pseudo-classes for counting
  const clean = selector
    .replace(/::[a-z-]+/gi, '')
    .replace(/:[a-z-]+(\([^)]*\))?/gi, () => { cls++; return ''; });

  const idMatches = clean.match(/#[a-z_-][a-z0-9_-]*/gi) ?? [];
  id += idMatches.length;

  const clsAttrMatches = clean.match(/(\.[a-z_-][a-z0-9_-]*|\[[^\]]+\])/gi) ?? [];
  cls += clsAttrMatches.length;

  const tagMatches = clean.replace(/#[a-z_-][a-z0-9_-]*/gi, '')
    .replace(/\.[a-z_-][a-z0-9_-]*/gi, '')
    .replace(/\[[^\]]+\]/gi, '')
    .match(/[a-z][a-z0-9]*/gi) ?? [];
  el += tagMatches.length;

  return [0, id, cls, el];
}

function specificityGT(
  a: [number, number, number, number],
  b: [number, number, number, number],
): boolean {
  for (let i = 0; i < 4; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

// ── CSS variable resolver ─────────────────────────────────────────────────────

/**
 * Build a flat map of `--var-name → resolved-value` from `:root` blocks.
 * Only resolves one level of indirection; deep chains resolved iteratively.
 */
function extractCssVars(rules: CssRule[]): Map<string, string> {
  const vars = new Map<string, string>();
  for (const rule of rules) {
    if (!/:root/.test(rule.selector)) continue;
    for (const [prop, val] of Object.entries(rule.declarations)) {
      if (prop.startsWith('--')) vars.set(prop, val.trim());
    }
  }
  // Resolve chains (e.g. --foo: var(--bar))
  let changed = true;
  let iterations = 0;
  while (changed && iterations++ < 10) {
    changed = false;
    for (const [name, val] of vars) {
      const resolved = val.replace(/var\((--[^,)]+)(,[^)]*)?\)/g, (_, ref) => {
        return vars.get(ref.trim()) ?? _;
      });
      if (resolved !== val) { vars.set(name, resolved); changed = true; }
    }
  }
  return vars;
}

function resolveVarReferences(value: string, cssVars: Map<string, string>): string {
  return value.replace(/var\((--[^,)]+)(,[^)]*)?\)/g, (_, ref, fallback) => {
    return cssVars.get(ref.trim()) ?? (fallback ? fallback.slice(1).trim() : _);
  });
}

// ── CSS file parser ───────────────────────────────────────────────────────────

function parseCssFile(filePath: string): CssRule[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const root = postcss.parse(raw, { from: filePath });
  const rules: CssRule[] = [];

  function walkRules(nodes: any[], condition: string | null) {
    for (const node of nodes) {
      if (node.type === 'atrule') {
        // media queries, supports, etc.
        const cond = `@${node.name} ${node.params}`.trim();
        if (node.nodes) walkRules(node.nodes, cond);
      } else if (node.type === 'rule') {
        const declarations: Record<string, string> = {};
        const important = new Set<string>();

        node.walkDecls?.((decl: any) => {
          declarations[decl.prop] = decl.value;
          if (decl.important) important.add(decl.prop);
        });

        // A selector block can have comma-separated selectors
        const selectors: string[] = (node.selector as string)
          .split(',')
          .map((s: string) => s.trim());

        for (const sel of selectors) {
          rules.push({
            selector: sel,
            declarations,
            specificity: computeSpecificity(sel),
            important,
            file: filePath,
            line: node.source?.start?.line ?? 0,
            condition,
          });
        }
      }
    }
  }

  walkRules(root.nodes, null);
  return rules;
}

// ── Tailwind resolver ─────────────────────────────────────────────────────────

/** Lazy-loaded Tailwind scale table. */
let twTable: Map<string, { value: string; resolvedFrom: string }> | null = null;

function buildTailwindTable(projectRoot: string): Map<string, { value: string; resolvedFrom: string }> {
  if (twTable) return twTable;
  twTable = new Map();

  // Try to load tailwind config
  let twConfig: any = {};
  const configPaths = [
    path.join(projectRoot, 'tailwind.config.js'),
    path.join(projectRoot, 'tailwind.config.ts'),
    path.join(projectRoot, 'tailwind.config.cjs'),
  ];
  for (const cp of configPaths) {
    if (fs.existsSync(cp)) {
      try { twConfig = require(cp); } catch { /* ignore */ }
      break;
    }
  }

  const theme = twConfig?.theme ?? {};
  const extend = theme?.extend ?? {};

  // Merge base + extend for colors, spacing, etc.
  function mergeScale(base: Record<string, any> = {}, ext: Record<string, any> = {}): Record<string, any> {
    return { ...base, ...ext };
  }

  // Default Tailwind spacing scale (subset — full list at tailwindcss.com/docs/customizing-spacing)
  const defaultSpacing: Record<string, string> = {
    '0': '0px', '1': '0.25rem', '2': '0.5rem', '3': '0.75rem',
    '4': '1rem', '5': '1.25rem', '6': '1.5rem', '8': '2rem',
    '10': '2.5rem', '12': '3rem', '16': '4rem', '20': '5rem',
    '24': '6rem', '32': '8rem', '40': '10rem', '48': '12rem',
    '56': '14rem', '64': '16rem', '72': '18rem', '80': '20rem',
    '96': '24rem', 'px': '1px', '0.5': '0.125rem', '1.5': '0.375rem',
    '2.5': '0.625rem', '3.5': '0.875rem',
  };
  const spacing = mergeScale(theme.spacing ?? defaultSpacing, extend.spacing);

  // Default colors (abbreviated — key hues)
  const defaultColors: Record<string, any> = {
    blue: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
            400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
            800: '#1e40af', 900: '#1e3a8a' },
    red:  { 500: '#ef4444', 600: '#dc2626' },
    green:{ 500: '#22c55e', 600: '#16a34a' },
    gray: { 50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db',
            400: '#9ca3af', 500: '#6b7280', 700: '#374151', 800: '#1f2937',
            900: '#111827' },
    white: '#ffffff', black: '#000000', transparent: 'transparent',
  };
  const colors = mergeScale(theme.colors ?? defaultColors, extend.colors);

  function lookupColor(colorPath: string): string | undefined {
    const parts = colorPath.split('-');
    let cur: any = colors;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = typeof cur === 'object' ? cur[p] : undefined;
    }
    return typeof cur === 'string' ? cur : undefined;
  }

  // Register spacing-based utilities
  const spacingUtilPrefixes: [string, string][] = [
    ['p', 'padding'], ['px', 'padding-left,padding-right'],
    ['py', 'padding-top,padding-bottom'], ['pt', 'padding-top'],
    ['pb', 'padding-bottom'], ['pl', 'padding-left'], ['pr', 'padding-right'],
    ['m', 'margin'], ['mx', 'margin-left,margin-right'],
    ['my', 'margin-top,margin-bottom'], ['mt', 'margin-top'],
    ['mb', 'margin-bottom'], ['ml', 'margin-left'], ['mr', 'margin-right'],
    ['w', 'width'], ['h', 'height'], ['min-w', 'min-width'], ['max-w', 'max-width'],
    ['min-h', 'min-height'], ['max-h', 'max-height'],
    ['gap', 'gap'], ['gap-x', 'column-gap'], ['gap-y', 'row-gap'],
    ['top', 'top'], ['right', 'right'], ['bottom', 'bottom'], ['left', 'left'],
    ['text', 'font-size'], ['rounded', 'border-radius'],
  ];

  for (const [prefix, cssProp] of spacingUtilPrefixes) {
    for (const [key, val] of Object.entries(spacing)) {
      const cls = `${prefix}-${key}`;
      twTable!.set(cls, { value: val as string, resolvedFrom: `theme.spacing[${key}]` });
    }
    // Also handle w-full, h-full, etc.
  }

  // Special width/height keywords
  for (const [cls, val] of [
    ['w-full', '100%'], ['h-full', '100%'], ['w-screen', '100vw'],
    ['h-screen', '100vh'], ['w-auto', 'auto'], ['h-auto', 'auto'],
    ['w-fit', 'fit-content'], ['h-fit', 'fit-content'],
    ['w-min', 'min-content'], ['w-max', 'max-content'],
  ] as [string, string][]) {
    twTable!.set(cls, { value: val, resolvedFrom: 'keyword' });
  }

  // Color utilities
  const colorPrefixes: [string, string][] = [
    ['bg', 'background-color'], ['text', 'color'], ['border', 'border-color'],
    ['ring', '--tw-ring-color'], ['fill', 'fill'], ['stroke', 'stroke'],
  ];
  function flatColors(obj: any, prefix: string): [string, string][] {
    const out: [string, string][] = [];
    if (typeof obj === 'string') { out.push([prefix, obj]); return out; }
    for (const [k, v] of Object.entries(obj ?? {})) {
      out.push(...flatColors(v, prefix ? `${prefix}-${k}` : k));
    }
    return out;
  }
  for (const [utilPrefix, cssProp] of colorPrefixes) {
    for (const [colorKey, colorVal] of flatColors(colors, '')) {
      const cls = `${utilPrefix}-${colorKey}`;
      twTable!.set(cls, { value: colorVal as string, resolvedFrom: `theme.colors.${colorKey}` });
    }
  }

  // flex / display / position utilities
  for (const [cls, val] of [
    ['flex', 'flex'], ['inline-flex', 'inline-flex'], ['block', 'block'],
    ['inline', 'inline'], ['hidden', 'none'], ['grid', 'grid'],
    ['absolute', 'absolute'], ['relative', 'relative'], ['fixed', 'fixed'],
    ['sticky', 'sticky'], ['static', 'static'],
    ['flex-row', 'row'], ['flex-col', 'column'],
    ['flex-wrap', 'wrap'], ['flex-nowrap', 'nowrap'],
    ['items-center', 'center'], ['items-start', 'flex-start'],
    ['items-end', 'flex-end'], ['items-stretch', 'stretch'],
    ['justify-center', 'center'], ['justify-start', 'flex-start'],
    ['justify-end', 'flex-end'], ['justify-between', 'space-between'],
    ['justify-around', 'space-around'], ['justify-evenly', 'space-evenly'],
  ] as [string, string][]) {
    twTable!.set(cls, { value: val, resolvedFrom: 'keyword' });
  }

  return twTable;
}

/** Resolve a single Tailwind class.  Returns null if unknown. */
function resolveTailwindClass(
  cls: string,
  projectRoot: string,
): { property: string; value: string; resolvedFrom: string } | null {
  // Arbitrary value: w-[327px], text-[#abc], p-[1.5rem], etc.
  const arbitrary = cls.match(/^([a-z-]+)-\[(.+)\]$/);
  if (arbitrary) {
    const [, prefix, rawVal] = arbitrary;
    const prefixMap: Record<string, string> = {
      w: 'width', h: 'height', p: 'padding', m: 'margin',
      bg: 'background-color', text: 'color', border: 'border-color',
      top: 'top', right: 'right', bottom: 'bottom', left: 'left',
      min_w: 'min-width', max_w: 'max-width', gap: 'gap',
      rounded: 'border-radius', opacity: 'opacity',
    };
    const cssProp = prefixMap[prefix.replace(/-/g, '_')] ?? prefix;
    return { property: cssProp, value: rawVal, resolvedFrom: 'arbitrary-value' };
  }

  const table = buildTailwindTable(projectRoot);
  const entry = table.get(cls);
  if (!entry) return null;

  // Map class prefix back to CSS property
  const prefixToProp: Record<string, string> = {
    bg: 'background-color', text: 'color', border: 'border-color',
    w: 'width', h: 'height', p: 'padding', m: 'margin',
    pt: 'padding-top', pb: 'padding-bottom', pl: 'padding-left', pr: 'padding-right',
    mt: 'margin-top', mb: 'margin-bottom', ml: 'margin-left', mr: 'margin-right',
    px: 'padding-inline', py: 'padding-block',
    mx: 'margin-inline', my: 'margin-block',
    gap: 'gap', 'gap-x': 'column-gap', 'gap-y': 'row-gap',
    top: 'top', right: 'right', bottom: 'bottom', left: 'left',
    flex: 'display', block: 'display', hidden: 'display',
    'flex-row': 'flex-direction', 'flex-col': 'flex-direction',
    'flex-wrap': 'flex-wrap', 'flex-nowrap': 'flex-wrap',
    'items-center': 'align-items', 'items-start': 'align-items',
    'items-end': 'align-items', 'items-stretch': 'align-items',
    'justify-center': 'justify-content', 'justify-start': 'justify-content',
    'justify-end': 'justify-content', 'justify-between': 'justify-content',
    'justify-around': 'justify-content', 'justify-evenly': 'justify-content',
    rounded: 'border-radius',
  };
  const property = prefixToProp[cls.split('-')[0]] ?? cls.split('-')[0];
  return { property, value: entry.value, resolvedFrom: entry.resolvedFrom };
}

// ── JSX element extractor ─────────────────────────────────────────────────────

interface RawElement {
  id: string;
  tagName: string;
  line: number;
  column: number;
  file: string;
  classNames: string[];
  inlineStyle: Record<string, string>;
}

function extractJsxElements(code: string, filePath: string): RawElement[] {
  const ast = parseBabel(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  const elements: RawElement[] = [];

  traverse(ast, {
    JSXElement(jsxPath: any) {
      const opening = jsxPath.node.openingElement;
      const loc = jsxPath.node.loc;
      if (!loc) return;

      const line = loc.start.line;
      const column = loc.start.column;

      // tagName
      const nameNode = opening.name;
      let tagName = '';
      if (nameNode.type === 'JSXIdentifier') tagName = nameNode.name;
      else if (nameNode.type === 'JSXMemberExpression') {
        const parts: string[] = [];
        let cur = nameNode;
        while (cur.type === 'JSXMemberExpression') {
          parts.unshift(cur.property.name);
          cur = cur.object;
        }
        parts.unshift(cur.name);
        tagName = parts.join('.');
      }

      // id (data-gl-source preferred, else line:col)
      let id = `${filePath}:${line}:${column}`;
      let classNames: string[] = [];
      const inlineStyle: Record<string, string> = {};

      for (const attr of opening.attributes) {
        if (attr.type !== 'JSXAttribute') continue;
        const attrName = attr.name.name as string;

        if (attrName === 'data-gl-source' && attr.value?.type === 'StringLiteral') {
          id = attr.value.value;
        }

        if (attrName === 'className') {
          if (attr.value?.type === 'StringLiteral') {
            classNames = attr.value.value.split(/\s+/).filter(Boolean);
          }
          // template literal / JSXExpressionContainer: unresolvable statically
        }

        if (attrName === 'style' && attr.value?.type === 'JSXExpressionContainer') {
          const expr = attr.value.expression;
          if (expr.type === 'ObjectExpression') {
            for (const prop of expr.properties) {
              if (prop.type !== 'ObjectProperty') continue;
              const key = prop.key.name ?? prop.key.value;
              if (!key) continue;
              const val = prop.value;
              if (val.type === 'StringLiteral') inlineStyle[key] = val.value;
              else if (val.type === 'NumericLiteral') inlineStyle[key] = String(val.value);
            }
          }
        }
      }

      elements.push({ id, tagName, line, column, file: filePath, classNames, inlineStyle });
    },
  });

  return elements;
}

// ── Cascade resolver ──────────────────────────────────────────────────────────

/**
 * For each JSX element, merge inline styles, Tailwind classes, and CSS rules
 * into `resolvedStyles`.  State-conditional rules go into `states`.
 */
function resolveElement(
  el: RawElement,
  allRules: CssRule[],
  cssVars: Map<string, string>,
  projectRoot: string,
): ScannedElement {
  const resolvedStyles: Record<string, ResolvedValue> = {};
  const states: StateStyles = {};
  const unresolvable: string[] = [];

  // 1. Inline styles win over everything (specificity [1,0,0,0])
  for (const [camelProp, rawVal] of Object.entries(el.inlineStyle)) {
    const val = resolveVarReferences(rawVal, cssVars);
    const cssProp = camelProp.replace(/([A-Z])/g, '-$1').toLowerCase();
    resolvedStyles[cssProp] = {
      value: val,
      source: 'inline-style',
      specificity: [1, 0, 0, 0],
    };
  }

  // 2. Tailwind classes
  for (const cls of el.classNames) {
    const tw = resolveTailwindClass(cls, projectRoot);
    if (!tw) continue;
    const { property, value, resolvedFrom } = tw;
    const existing = resolvedStyles[property];
    // Tailwind specificity treated as [0,0,1,0] — one class selector
    const twSpec: [number, number, number, number] = [0, 0, 1, 0];
    if (!existing || specificityGT(twSpec, existing.specificity!)) {
      resolvedStyles[property] = { value, source: 'tailwind', resolvedFrom, specificity: twSpec };
    }
  }

  // 3. CSS rules
  // Collect matching rules for this element's classes
  const matchingRules: CssRule[] = [];
  for (const rule of allRules) {
    // Simple class matching — check each class token present in selector
    const selectorClasses = rule.selector.match(/\.([a-z0-9_-]+)/gi)?.map(c => c.slice(1)) ?? [];
    if (selectorClasses.length === 0) continue;
    // Rule matches if ALL selector classes are present in element's classNames
    // (handles compound like .card.active)
    const allPresent = selectorClasses.every(sc => el.classNames.includes(sc));
    if (allPresent) matchingRules.push(rule);
  }

  // Sort by specificity ascending so later (higher spec) wins when we iterate
  matchingRules.sort((a, b) => {
    for (let i = 0; i < 4; i++) {
      if (a.specificity[i] !== b.specificity[i]) return a.specificity[i] - b.specificity[i];
    }
    return 0; // preserve file order (already collected in file order)
  });

  for (const rule of matchingRules) {
    const isConditional = rule.condition !== null;

    for (const [prop, rawVal] of Object.entries(rule.declarations)) {
      if (prop.startsWith('--')) continue; // CSS vars — skip, already in cssVars map
      const val = resolveVarReferences(rawVal, cssVars);
      const entry: ResolvedValue = {
        value: val,
        source: 'css-rule',
        rule: rule.selector,
        file: rule.file,
        line: rule.line,
        specificity: rule.specificity,
        important: rule.important.has(prop),
      };

      if (isConditional) {
        const bucket = states[rule.condition!] ??= {};
        const existing = bucket[prop];
        if (!existing || rule.important.has(prop) || specificityGT(rule.specificity, existing.specificity!)) {
          bucket[prop] = entry;
        }
      } else {
        const existing = resolvedStyles[prop];
        const wins =
          rule.important.has(prop)                              // !important always wins
          || !existing                                           // nothing yet
          || (!existing.important && specificityGT(rule.specificity, existing.specificity!))
          || (!existing.important && existing.source === 'tailwind'); // CSS overrides TW if higher spec
        if (wins) resolvedStyles[prop] = entry;
      }
    }
  }

  // 4. Mark truly unresolvable (dynamic className / styled-components)
  // — we detect these by checking for JSXExpressionContainer classNames:
  //   already filtered out at extraction time; any empty classNames with no resolved is a gap
  if (el.classNames.length === 0 && Object.keys(el.inlineStyle).length === 0) {
    // Element uses purely runtime styles — flag it
    unresolvable.push('all-styles: dynamic className or styled-components — use getComputedStyle');
  }

  // 5. Fill unresolved properties with initial/inherited markers
  const TRACKED_PROPS = [
    'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
    'background-color', 'color', 'font-size', 'font-weight', 'font-family',
    'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
    'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
    'border-color', 'border-width', 'border-radius', 'display',
    'flex-direction', 'align-items', 'justify-content', 'gap', 'opacity',
  ];
  for (const p of TRACKED_PROPS) {
    if (!resolvedStyles[p]) {
      resolvedStyles[p] = { value: 'initial', source: 'initial' };
    }
  }

  return {
    id: el.id,
    tagName: el.tagName,
    line: el.line,
    column: el.column,
    file: el.file,
    classNames: el.classNames,
    inlineStyle: el.inlineStyle,
    resolvedStyles,
    states,
    unresolvable,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ScanOptions {
  /** Root of the target project (not Glide itself). */
  projectRoot: string;
  /** Glob-free list of JSX/TSX source files to scan. */
  sourceFiles: string[];
  /** Glob-free list of CSS files to parse. */
  cssFiles: string[];
}

/**
 * scanProject — entry point.
 *
 * Returns a `Map<id, ScannedElement>` (the HashMap).
 *
 * Usage:
 * ```ts
 * const result = await scanProject({
 *   projectRoot: '/path/to/app',
 *   sourceFiles: glob.sync('src/**\/*.tsx', { cwd: '/path/to/app', absolute: true }),
 *   cssFiles:    glob.sync('src/**\/*.css', { cwd: '/path/to/app', absolute: true }),
 * });
 * const element = result.get('src/App.tsx:25:4');
 * console.log(element?.resolvedStyles['background-color']);
 * ```
 */
export async function scanProject(opts: ScanOptions): Promise<ScanResult> {
  const { projectRoot, sourceFiles, cssFiles } = opts;

  // 1. Parse all CSS files
  const allRules: CssRule[] = [];
  for (const cssFile of cssFiles) {
    try {
      allRules.push(...parseCssFile(cssFile));
    } catch (e) {
      // Non-fatal: log and continue
      console.warn(`[Glide scanner] Failed to parse CSS ${cssFile}: ${e}`);
    }
  }

  // 2. Build CSS variable table from :root blocks
  const cssVars = extractCssVars(allRules);

  // 3. Extract all JSX elements from source files
  const rawElements: RawElement[] = [];
  for (const srcFile of sourceFiles) {
    try {
      const code = fs.readFileSync(srcFile, 'utf-8');
      rawElements.push(...extractJsxElements(code, srcFile));
    } catch (e) {
      console.warn(`[Glide scanner] Failed to parse JSX ${srcFile}: ${e}`);
    }
  }

  // 4. Resolve each element and insert into HashMap
  const result: ScanResult = new Map();
  for (const el of rawElements) {
    const resolved = resolveElement(el, allRules, cssVars, projectRoot);
    result.set(resolved.id, resolved);
  }

  return result;
}

/**
 * Quick-scan a single file.  Useful for incremental re-scan on HMR.
 */
export async function scanFile(
  filePath: string,
  cssFiles: string[],
  projectRoot: string,
): Promise<ScanResult> {
  return scanProject({ projectRoot, sourceFiles: [filePath], cssFiles });
}
