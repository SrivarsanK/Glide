/**
 * Load the project's Tailwind theme: v3 through its own resolveConfig, v4 by
 * reading `@theme` blocks. Falls back to Tailwind's default token names.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import postcss, { type Root } from 'postcss';
import { defaultTailwindTheme, type TailwindTheme } from './tailwind-tokens.js';

const CONFIG_NAMES = ['tailwind.config.js', 'tailwind.config.cjs', 'tailwind.config.mjs', 'tailwind.config.ts',
  'tailwind.config.cts', 'tailwind.config.mts'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next', '.nuxt', '.svelte-kit',
  '.astro', '.turbo', '.vercel', '.cache', '.output']);
const RESCAN_MS = 2000;

interface CacheEntry { theme: TailwindTheme; stamp: string; files: string[]; scannedAt: number }
const cache = new Map<string, CacheEntry>();

function findCssFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 6 || found.length >= 300) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) walk(full, depth + 1);
      else if (entry.isFile() && entry.name.endsWith('.css')) found.push(full);
    }
  };
  walk(root, 0);
  return found.sort();
}

function stampOf(files: string[]): string {
  return files.map(file => {
    try { return `${file}@${fs.statSync(file).mtimeMs}`; } catch { return `${file}@-`; }
  }).join('|');
}

function tailwindPackage(root: string): { dir: string; major: number } | null {
  try {
    const pkgPath = createRequire(path.join(root, 'package.json')).resolve('tailwindcss/package.json');
    const major = parseInt(JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version, 10);
    return { dir: path.dirname(pkgPath), major };
  } catch {
    return null;
  }
}

/** Light-mode custom properties (`:root`, `html`) used to resolve `var()` in theme values. */
function collectVars(root: Root, vars: Map<string, string>): void {
  root.walkRules(rule => {
    const light = rule.selectors.some(selector => /^(:root|html|:host)$/.test(selector.trim()));
    if (!light) return;
    rule.walkDecls(/^--/, decl => { if (decl.parent === rule) vars.set(decl.prop, decl.value); });
  });
}

function resolveVars(value: string, vars: Map<string, string>, depth = 0): string {
  if (depth > 5 || !value.includes('var(')) return value;
  const next = value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g,
    (whole, name: string, fallback?: string) => vars.get(name) ?? fallback?.trim() ?? whole);
  return next === value ? value : resolveVars(next, vars, depth + 1);
}

/** shadcn v3 stores bare `H S% L%` channels; `hsl(var(--x) / <alpha-value>)` resolves to a color. */
function finishColor(value: string, vars: Map<string, string>): string {
  return resolveVars(value.replace(/\s*\/\s*<alpha-value>/g, '').replace(/<alpha-value>/g, '1'), vars);
}

function applyThemeBlocks(css: Root, theme: TailwindTheme, vars: Map<string, string>, isProject: boolean): void {
  css.walkAtRules('theme', rule => {
    rule.each(node => {
      if (node.type !== 'decl' || !node.prop.startsWith('--')) return;
      const { prop, value } = node;
      vars.set(prop, value);
      if (value.trim() === 'initial') {
        if (prop === '--*') { theme.colors.clear(); theme.fontSizes.clear(); theme.breakpoints.clear(); theme.spacing.clear(); delete theme.spacingStep; }
        if (prop === '--color-*') theme.colors.clear();
        if (prop === '--text-*') theme.fontSizes.clear();
        if (prop === '--breakpoint-*') theme.breakpoints.clear();
        if (prop === '--spacing-*' || prop === '--spacing') { theme.spacing.clear(); delete theme.spacingStep; }
        return;
      }
      const token = (prefix: string) => prop.startsWith(prefix) && !prop.slice(prefix.length).includes('--') ? prop.slice(prefix.length) : null;
      const color = token('--color-'), text = token('--text-'), breakpoint = token('--breakpoint-');
      if (color) { theme.colors.set(color, value); if (isProject) theme.projectColors.add(color); }
      else if (text && !text.startsWith('shadow-')) theme.fontSizes.set(text, value);
      else if (breakpoint) theme.breakpoints.set(breakpoint, value);
      else if (prop === '--spacing') theme.spacingStep = value;
    });
  });
}

function loadV4(pkgDir: string | null, cssFiles: string[]): TailwindTheme {
  const theme = defaultTailwindTheme();
  theme.version = 4;
  const vars = new Map<string, string>();
  const defaults = pkgDir ? path.join(pkgDir, 'theme.css') : null;
  if (defaults && fs.existsSync(defaults)) {
    // Replace the bundled name list with the real default palette and scale.
    theme.colors.clear(); theme.fontSizes.clear(); theme.breakpoints.clear(); theme.spacing.clear();
    theme.colors.set('inherit', ''); theme.colors.set('current', ''); theme.colors.set('transparent', 'transparent');
    applyThemeBlocks(postcss.parse(fs.readFileSync(defaults, 'utf8')), theme, vars, false);
  }
  const parsed = cssFiles.flatMap(file => {
    try { return [postcss.parse(fs.readFileSync(file, 'utf8'), { from: file })]; } catch { return []; }
  });
  for (const css of parsed) collectVars(css, vars);
  for (const css of parsed) applyThemeBlocks(css, theme, vars, true);
  for (const [name, value] of theme.colors) theme.colors.set(name, finishColor(value, vars));
  for (const [name, value] of theme.fontSizes) theme.fontSizes.set(name, resolveVars(value, vars));
  for (const [name, value] of theme.breakpoints) theme.breakpoints.set(name, resolveVars(value, vars));
  if (theme.spacingStep) theme.spacingStep = resolveVars(theme.spacingStep, vars);
  return theme;
}

function flattenColors(colors: any, into: Map<string, string>, prefix = ''): void {
  if (!colors || typeof colors !== 'object') return;
  for (const [key, value] of Object.entries(colors)) {
    const name = key === 'DEFAULT' ? prefix : prefix ? `${prefix}-${key}` : key;
    if (!name) continue;
    if (typeof value === 'string') into.set(name, value);
    else if (typeof value === 'function') into.set(name, '');
    else flattenColors(value, into, name);
  }
}

function loadV3(pkgDir: string, configPath: string | undefined, cssFiles: string[]): TailwindTheme {
  const requireFromTailwind = createRequire(path.join(pkgDir, 'package.json'));
  let config: any = {};
  if (configPath) {
    // Re-read an edited config instead of Node's cached module.
    delete requireFromTailwind.cache[configPath];
    let loadConfig: ((file: string) => any) | null = null;
    try { loadConfig = requireFromTailwind('./loadConfig.js'); } catch { /* Tailwind < 3.3 */ }
    const loaded = loadConfig ? loadConfig(configPath) : requireFromTailwind(configPath);
    config = loaded?.default ?? loaded;
  }
  const resolved = requireFromTailwind('./resolveConfig.js')(config || {}).theme || {};
  const vars = new Map<string, string>();
  for (const file of cssFiles) {
    try { collectVars(postcss.parse(fs.readFileSync(file, 'utf8'), { from: file }), vars); } catch { /* skip */ }
  }
  const theme: TailwindTheme = {
    version: 3,
    colors: new Map(),
    projectColors: new Set(),
    fontSizes: new Map(),
    spacing: new Map(),
    breakpoints: new Map(),
  };
  flattenColors(resolved.colors, theme.colors);
  for (const [name, value] of theme.colors) theme.colors.set(name, finishColor(value, vars));
  const own = new Map<string, string>();
  flattenColors(config?.theme?.colors, own);
  flattenColors(config?.theme?.extend?.colors, own);
  for (const name of own.keys()) theme.projectColors.add(name);
  for (const [name, value] of Object.entries(resolved.fontSize || {})) {
    const size = Array.isArray(value) ? value[0] : value;
    if (typeof size === 'string') theme.fontSizes.set(name, size);
  }
  for (const [name, value] of Object.entries(resolved.spacing || {})) {
    if (typeof value === 'string') theme.spacing.set(name, value);
  }
  for (const [name, value] of Object.entries(resolved.screens || {})) {
    const min = typeof value === 'string' ? value : (value as any)?.min;
    if (typeof min === 'string') theme.breakpoints.set(name, min);
  }
  return theme;
}

function build(pkg: ReturnType<typeof tailwindPackage>, configPath: string | undefined, cssFiles: string[]): TailwindTheme {
  if (pkg?.major === 3) return loadV3(pkg.dir, configPath, cssFiles);
  const usesV4Css = cssFiles.some(file => {
    try { return /@theme\b|@import\s+['"]tailwindcss['"]/.test(fs.readFileSync(file, 'utf8')); } catch { return false; }
  });
  return pkg?.major === 4 || usesV4Css ? loadV4(pkg?.dir ?? null, cssFiles) : defaultTailwindTheme();
}

/**
 * The project's Tailwind theme. Cached; re-read when the config, the Tailwind
 * package, or a project stylesheet changes. Never throws.
 */
export function loadTailwindTheme(projectRoot: string): TailwindTheme {
  const root = path.resolve(projectRoot);
  const cached = cache.get(root);
  const now = Date.now();
  if (cached && now - cached.scannedAt < RESCAN_MS && stampOf(cached.files) === cached.stamp) return cached.theme;
  const pkg = tailwindPackage(root);
  const configPath = CONFIG_NAMES.map(name => path.join(root, name)).find(file => fs.existsSync(file));
  const cssFiles = findCssFiles(root);
  const files = [...(configPath ? [configPath] : []), ...(pkg ? [path.join(pkg.dir, 'package.json')] : []), ...cssFiles];
  const stamp = stampOf(files);
  if (cached && cached.stamp === stamp) {
    cached.scannedAt = now;
    return cached.theme;
  }
  let theme: TailwindTheme;
  try {
    theme = build(pkg, configPath, cssFiles);
  } catch (error) {
    console.warn('[Glide] Could not read the Tailwind theme; using default token names.', error);
    theme = defaultTailwindTheme();
  }
  cache.set(root, { theme, stamp, files, scannedAt: now });
  return theme;
}
