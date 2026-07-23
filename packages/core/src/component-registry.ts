/**
 * component-registry.ts — Component segregation engine for Glide.
 *
 * Scans a project's source files and groups every discovered JSX/HTML element
 * into isolated `ComponentBucket` entries keyed by component name + file.
 *
 * Each bucket carries:
 *   - component name, file, export type, line/col of the function declaration
 *   - elements array: every JSX/HTML node inside that component
 *   - isRoot flag on the outermost returned element
 *   - co-located CSS / module file paths
 *
 * Supports React (JSX/TSX), Vue SFC, Svelte, plain HTML.
 * buildRegistry() is a static one-shot scan.
 * watchRegistry() adds chokidar-based incremental updates.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import { parse as parseBabel, type ParseResult } from '@babel/parser';
import _traverse from '@babel/traverse';
import type { File } from '@babel/types';
import { parse as parseVueSFC } from '@vue/compiler-sfc';
import parseDOMModule from 'html-dom-parser';
import type { FrameworkId } from './types.js';
import { detectProjectMeta } from './detect.js';

// CJS interop
const require = createRequire(import.meta.url);
const traverse = (_traverse as any).default ?? _traverse;
const parseDOM = (parseDOMModule as any).default ?? parseDOMModule;

// ── Public types ──────────────────────────────────────────────────────────────

export interface RegistryElement {
  /** data-gl-source value or `file:line:col` fallback — stable ID */
  id: string;
  tagName: string;
  line: number;
  column: number;
  /** True when this element is the outermost node returned by the component */
  isRoot: boolean;
  /** Static className tokens (empty when dynamic / unresolvable) */
  classNames: string[];
  /** Trimmed direct text content ≤ 25 chars */
  text?: string;
}

export interface ComponentBucket {
  /** PascalCase/camelCase component name. 'Anonymous' for unnamed exports. */
  name: string;
  /** Absolute path to the source file */
  file: string;
  /** How the component is exported */
  exportType: 'default' | 'named' | 'anonymous' | 'sfc' | 'html';
  /** 1-indexed line of the function/export declaration */
  line: number;
  column: number;
  /** All JSX/HTML elements found inside this component */
  elements: RegistryElement[];
  /** Co-located CSS files in the same directory with the same stem */
  cssFiles: string[];
}

export interface ComponentRegistry {
  projectRoot: string;
  /** ISO timestamp of last build */
  generatedAt: string;
  framework: FrameworkId;
  buckets: ComponentBucket[];
}

export interface RegistryOptions {
  projectRoot: string;
  /** Explicit list of source files. Omit to auto-discover from srcDir. */
  sourceFiles?: string[];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const CSS_EXTS = ['.css', '.module.css', '.scss', '.module.scss', '.less'];

function findColocatedCss(filePath: string): string[] {
  const dir = path.dirname(filePath);
  const stem = path.basename(filePath, path.extname(filePath));
  return CSS_EXTS
    .map(ext => path.join(dir, stem + ext))
    .filter(p => fs.existsSync(p));
}

function trimText(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  return t.length > 25 ? t.slice(0, 22) + '...' : t;
}

// ── Source file discovery ─────────────────────────────────────────────────────

const SOURCE_EXTS = new Set(['.jsx', '.tsx', '.vue', '.svelte', '.astro', '.html', '.js', '.ts']);
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', '__tests__', 'test', 'tests']);

export function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(current: string) {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        walk(path.join(current, entry.name));
      } else if (entry.isFile() && SOURCE_EXTS.has(path.extname(entry.name).toLowerCase())) {
        results.push(path.join(current, entry.name));
      }
    }
  }
  walk(dir);
  return results;
}

// ── JSX/TSX: component extraction ────────────────────────────────────────────

interface RawComponent {
  name: string;
  exportType: 'default' | 'named' | 'anonymous';
  line: number;
  column: number;
  functionPath: any; // Babel NodePath to the function node
}

function extractJsxComponents(ast: ParseResult<File>): RawComponent[] {
  const components: RawComponent[] = [];

  traverse(ast, {
    // export default function MyComp() {} | export default () => {}
    ExportDefaultDeclaration(p: any) {
      const decl = p.node.declaration;
      const loc = (decl.loc ?? p.node.loc)?.start;
      if (!loc) return;
      if (['FunctionDeclaration', 'ArrowFunctionExpression', 'FunctionExpression'].includes(decl.type)) {
        components.push({
          name: decl.id?.name ?? 'Default',
          exportType: 'default',
          line: loc.line,
          column: loc.column,
          functionPath: p.get('declaration'),
        });
      }
    },

    // export function MyComp() {} | export const MyComp = () => {}
    ExportNamedDeclaration(p: any) {
      const decl = p.node.declaration;
      if (!decl) return;
      if (decl.type === 'FunctionDeclaration') {
        const name = decl.id?.name;
        if (!name || !/^[A-Z]/.test(name)) return;
        const loc = decl.loc?.start;
        if (!loc) return;
        components.push({ name, exportType: 'named', line: loc.line, column: loc.column, functionPath: p.get('declaration') });
      } else if (decl.type === 'VariableDeclaration') {
        decl.declarations.forEach((declarator: any, i: number) => {
          const name = declarator.id?.name;
          if (!name || !/^[A-Z]/.test(name)) return;
          const init = declarator.init;
          if (!init || !['ArrowFunctionExpression', 'FunctionExpression'].includes(init.type)) return;
          const loc = declarator.loc?.start;
          if (!loc) return;
          components.push({
            name,
            exportType: 'named',
            line: loc.line,
            column: loc.column,
            functionPath: p.get(`declaration.declarations.${i}.init`),
          });
        });
      }
    },

    // Non-exported PascalCase function declarations
    FunctionDeclaration(p: any) {
      if (p.parentPath.isExportDefaultDeclaration() || p.parentPath.isExportNamedDeclaration()) return;
      const name = p.node.id?.name;
      if (!name || !/^[A-Z]/.test(name)) return;
      const loc = p.node.loc?.start;
      if (!loc) return;
      components.push({ name, exportType: 'named', line: loc.line, column: loc.column, functionPath: p });
    },

    // Non-exported PascalCase arrow/fn expressions: const MyComp = () => {}
    VariableDeclarator(p: any) {
      if (p.parentPath?.parentPath?.isExportNamedDeclaration()) return;
      const name = (p.node.id as any)?.name;
      if (!name || !/^[A-Z]/.test(name)) return;
      const init = p.node.init;
      if (!init || !['ArrowFunctionExpression', 'FunctionExpression'].includes(init.type)) return;
      const loc = p.node.loc?.start;
      if (!loc) return;
      components.push({ name, exportType: 'named', line: loc.line, column: loc.column, functionPath: p.get('init') });
    },
  });

  return components;
}

/** Collect all JSX elements inside a function path; mark root element. */
function collectJsxFromFunction(
  functionPath: any,
  filePath: string,
): RegistryElement[] {
  const elements: RegistryElement[] = [];
  let rootNode: any = null;

  // Find the outermost JSX returned
  try {
    functionPath.traverse({
      ReturnStatement(retPath: any) {
        let p = retPath.parentPath;
        while (p && p !== functionPath) {
          if (p.isFunction()) return;
          p = p.parentPath;
        }
        const arg = retPath.node.argument;
        if (arg && (arg.type === 'JSXElement' || arg.type === 'JSXFragment')) {
          if (!rootNode) rootNode = arg;
        }
      },
    });
  } catch { /* traverse errors are non-fatal */ }

  // Arrow fn with JSX body (no block statement)
  if (!rootNode) {
    const body = functionPath.node?.body;
    if (body && (body.type === 'JSXElement' || body.type === 'JSXFragment')) {
      rootNode = body;
    }
  }

  try {
    functionPath.traverse({
      JSXElement(jsxPath: any) {
        const opening = jsxPath.node.openingElement;
        const loc = jsxPath.node.loc;
        if (!loc) return;
        const line = loc.start.line;
        const column = loc.start.column;

        const nameNode = opening.name;
        let tagName = 'unknown';
        if (nameNode.type === 'JSXIdentifier') {
          tagName = nameNode.name;
        } else if (nameNode.type === 'JSXMemberExpression') {
          const parts: string[] = [];
          let cur = nameNode;
          while (cur.type === 'JSXMemberExpression') { parts.unshift(cur.property.name); cur = cur.object; }
          parts.unshift(cur.name);
          tagName = parts.join('.');
        }

        let id = `${filePath}:${line}:${column}`;
        const glAttr = opening.attributes?.find(
          (a: any) => a.type === 'JSXAttribute' && a.name?.name === 'data-gl-source'
        );
        if (glAttr?.value?.type === 'StringLiteral') id = glAttr.value.value;

        let classNames: string[] = [];
        const clsAttr = opening.attributes?.find(
          (a: any) => a.type === 'JSXAttribute' && a.name?.name === 'className'
        );
        if (clsAttr?.value?.type === 'StringLiteral') {
          classNames = clsAttr.value.value.split(/\s+/).filter(Boolean);
        }

        let rawText = '';
        for (const child of jsxPath.node.children ?? []) {
          if (child.type === 'JSXText') { rawText = child.value; break; }
          if (child.type === 'JSXExpressionContainer' && child.expression.type === 'StringLiteral') {
            rawText = child.expression.value; break;
          }
        }

        elements.push({
          id, tagName, line, column,
          isRoot: jsxPath.node === rootNode,
          classNames,
          text: trimText(rawText),
        });
      },
    });
  } catch { /* non-fatal */ }

  return elements;
}

function scanJsxFile(filePath: string): ComponentBucket[] {
  let code: string;
  try { code = fs.readFileSync(filePath, 'utf-8'); } catch { return []; }

  let ast: ParseResult<File>;
  try {
    ast = parseBabel(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  } catch { return []; }

  const cssFiles = findColocatedCss(filePath);
  const rawComponents = extractJsxComponents(ast);

  if (rawComponents.length === 0) {
    // No recognizable component functions — collect all JSX as anonymous bucket
    const elements: RegistryElement[] = [];
    traverse(ast, {
      JSXElement(jsxPath: any) {
        const opening = jsxPath.node.openingElement;
        const loc = jsxPath.node.loc;
        if (!loc) return;
        const nameNode = opening.name;
        let tagName = 'unknown';
        if (nameNode.type === 'JSXIdentifier') tagName = nameNode.name;
        let id = `${filePath}:${loc.start.line}:${loc.start.column}`;
        const glAttr = opening.attributes?.find((a: any) => a.type === 'JSXAttribute' && a.name?.name === 'data-gl-source');
        if (glAttr?.value?.type === 'StringLiteral') id = glAttr.value.value;
        elements.push({ id, tagName, line: loc.start.line, column: loc.start.column, isRoot: false, classNames: [] });
      },
    });
    if (elements.length === 0) return [];
    elements[0].isRoot = true;
    return [{ name: path.basename(filePath, path.extname(filePath)), file: filePath, exportType: 'anonymous', line: 1, column: 0, elements, cssFiles }];
  }

  return rawComponents.flatMap(comp => {
    try {
      const elements = collectJsxFromFunction(comp.functionPath, filePath);
      if (elements.length === 0) return [];
      return [{ name: comp.name, file: filePath, exportType: comp.exportType, line: comp.line, column: comp.column, elements, cssFiles }];
    } catch { return []; }
  });
}

// ── Vue SFC scanner ───────────────────────────────────────────────────────────

function scanVueFile(filePath: string): ComponentBucket[] {
  let code: string;
  try { code = fs.readFileSync(filePath, 'utf-8'); } catch { return []; }
  let templateContent = '';
  try { templateContent = parseVueSFC(code).descriptor.template?.content ?? ''; } catch { return []; }
  if (!templateContent.trim()) return [];

  const dom = parseDOM(templateContent);
  const elements: RegistryElement[] = [];
  let rootFound = false;

  function walk(nodes: any[], depth = 0) {
    for (const node of nodes) {
      if (node.type !== 'tag') { if (node.children) walk(node.children, depth); continue; }
      if (['script', 'style'].includes(node.name?.toLowerCase() ?? '')) continue;
      const id = node.attribs?.['data-gl-source'] ?? `${filePath}:${node.startIndex ?? 0}:0`;
      const className = (node.attribs?.['class'] ?? '').split(/\s+/).filter(Boolean);
      let rawText = '';
      for (const c of node.children ?? []) { if (c.type === 'text') { rawText = c.data; break; } }
      const isRoot = !rootFound && depth === 0;
      if (isRoot) rootFound = true;
      elements.push({ id, tagName: node.name, line: 0, column: 0, isRoot, classNames: className, text: trimText(rawText) });
      if (node.children) walk(node.children, depth + 1);
    }
  }
  walk(dom);
  if (elements.length === 0) return [];
  return [{ name: path.basename(filePath, '.vue'), file: filePath, exportType: 'sfc', line: 1, column: 0, elements, cssFiles: findColocatedCss(filePath) }];
}

// ── Svelte file scanner ───────────────────────────────────────────────────────

function scanSvelteFile(filePath: string): ComponentBucket[] {
  let code: string;
  try { code = fs.readFileSync(filePath, 'utf-8'); } catch { return []; }
  const stripped = code
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  if (!stripped.trim()) return [];

  const dom = parseDOM(stripped);
  const elements: RegistryElement[] = [];
  let rootFound = false;

  function walk(nodes: any[], depth = 0) {
    for (const node of nodes) {
      if (node.type !== 'tag') { if (node.children) walk(node.children, depth); continue; }
      const id = node.attribs?.['data-gl-source'] ?? `${filePath}:${node.startIndex ?? 0}:0`;
      const className = (node.attribs?.['class'] ?? '').split(/\s+/).filter(Boolean);
      let rawText = '';
      for (const c of node.children ?? []) { if (c.type === 'text') { rawText = c.data; break; } }
      const isRoot = !rootFound && depth === 0;
      if (isRoot) rootFound = true;
      elements.push({ id, tagName: node.name, line: 0, column: 0, isRoot, classNames: className, text: trimText(rawText) });
      if (node.children) walk(node.children, depth + 1);
    }
  }
  walk(dom);
  if (elements.length === 0) return [];
  return [{ name: path.basename(filePath, '.svelte'), file: filePath, exportType: 'sfc', line: 1, column: 0, elements, cssFiles: findColocatedCss(filePath) }];
}

// ── Astro file scanner ─────────────────────────────────────────────────────────

function scanAstroFile(filePath: string): ComponentBucket[] {
  let code: string;
  try { code = fs.readFileSync(filePath, 'utf-8'); } catch { return []; }
  
  let templateCode = code;
  const parts = code.split('---');
  if (parts.length >= 3) {
    templateCode = parts.slice(2).join('---');
  }

  const dom = parseDOM(templateCode);
  const elements: RegistryElement[] = [];
  let rootFound = false;

  function walk(nodes: any[], depth = 0) {
    for (const node of nodes) {
      if (node.type !== 'tag') { if (node.children) walk(node.children, depth); continue; }
      if (['script', 'style', 'head'].includes(node.name?.toLowerCase() ?? '')) continue;
      const id = node.attribs?.['data-gl-source'] ?? `${filePath}:${node.startIndex ?? 0}:0`;
      const className = (node.attribs?.['class'] ?? '').split(/\s+/).filter(Boolean);
      let rawText = '';
      for (const c of node.children ?? []) { if (c.type === 'text') { rawText = c.data; break; } }
      const isRoot = !rootFound && depth === 0;
      if (isRoot) rootFound = true;
      elements.push({ id, tagName: node.name, line: 0, column: 0, isRoot, classNames: className, text: trimText(rawText) });
      if (node.children) walk(node.children, depth + 1);
    }
  }
  walk(dom);
  if (elements.length === 0) return [];
  return [{ name: path.basename(filePath, '.astro'), file: filePath, exportType: 'sfc', line: 1, column: 0, elements, cssFiles: findColocatedCss(filePath) }];
}

// ── HTML file scanner ─────────────────────────────────────────────────────────

function scanHtmlFile(filePath: string): ComponentBucket[] {
  let code: string;
  try { code = fs.readFileSync(filePath, 'utf-8'); } catch { return []; }
  const dom = parseDOM(code);
  const elements: RegistryElement[] = [];
  let rootFound = false;

  function walk(nodes: any[], depth = 0) {
    for (const node of nodes) {
      if (node.type !== 'tag') { if (node.children) walk(node.children, depth); continue; }
      if (['script', 'style', 'head'].includes(node.name?.toLowerCase() ?? '')) continue;
      const id = node.attribs?.['data-gl-source'] ?? `${filePath}:${node.startIndex ?? 0}:0`;
      const className = (node.attribs?.['class'] ?? '').split(/\s+/).filter(Boolean);
      let rawText = '';
      for (const c of node.children ?? []) { if (c.type === 'text') { rawText = c.data; break; } }
      const isRoot = !rootFound && depth === 0;
      if (isRoot) rootFound = true;
      elements.push({ id, tagName: node.name, line: 0, column: 0, isRoot, classNames: className, text: trimText(rawText) });
      if (node.children) walk(node.children, depth + 1);
    }
  }
  walk(dom);
  if (elements.length === 0) return [];
  return [{ name: path.basename(filePath, '.html'), file: filePath, exportType: 'html', line: 1, column: 0, elements, cssFiles: findColocatedCss(filePath) }];
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

function scanSourceFile(filePath: string): ComponentBucket[] {
  const ext = path.extname(filePath).toLowerCase();
  try {
    if (ext === '.vue') return scanVueFile(filePath);
    if (ext === '.svelte') return scanSvelteFile(filePath);
    if (ext === '.astro') return scanAstroFile(filePath);
    if (ext === '.html') return scanHtmlFile(filePath);
    if (['.jsx', '.tsx', '.js', '.ts'].includes(ext)) return scanJsxFile(filePath);
  } catch (e) {
    console.warn(`[Glide registry] Failed to scan ${filePath}: ${e}`);
  }
  return [];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * buildRegistry — static one-shot scan.
 *
 * Discovers all component buckets across source files and returns
 * a `ComponentRegistry` ready to be serialised as `glide-components.json`.
 */
export function buildRegistry(opts: RegistryOptions): ComponentRegistry {
  const { projectRoot } = opts;
  const meta = detectProjectMeta(projectRoot);
  const sourceFiles = opts.sourceFiles ?? collectSourceFiles(meta.srcDir);
  const buckets: ComponentBucket[] = [];
  for (const file of sourceFiles) {
    buckets.push(...scanSourceFile(file));
  }
  return { projectRoot, generatedAt: new Date().toISOString(), framework: meta.framework, buckets };
}

/**
 * watchRegistry — incremental live watcher using chokidar.
 *
 * Calls `onUpdate` with a fresh registry whenever source files change.
 * Returns the chokidar FSWatcher — call `.close()` to stop watching.
 */
export function watchRegistry(
  projectRoot: string,
  onUpdate: (registry: ComponentRegistry) => void,
): any /* FSWatcher */ {
  // chokidar is a CJS package — use same require pattern as scanner.ts
  const chokidar = require('chokidar');
  const meta = detectProjectMeta(projectRoot);
  const WATCH_EXTS = /\.(jsx|tsx|js|ts|vue|svelte|astro|html)$/i;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleRebuild() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      try { onUpdate(buildRegistry({ projectRoot })); } catch (e) {
        console.warn('[Glide registry] Rebuild failed:', e);
      }
    }, 300);
  }

  const watcher = chokidar.watch(meta.srcDir, {
    ignored: /(node_modules|\.git|dist|build)/,
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('add',    (p: string) => { if (WATCH_EXTS.test(p)) scheduleRebuild(); });
  watcher.on('change', (p: string) => { if (WATCH_EXTS.test(p)) scheduleRebuild(); });
  watcher.on('unlink', (p: string) => { if (WATCH_EXTS.test(p)) scheduleRebuild(); });

  return watcher;
}
