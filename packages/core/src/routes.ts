import * as fs from 'fs';
import * as path from 'path';
import { detectProjectMeta } from './detect.js';

export interface RouteEntry {
  /** The URL path, with dynamic segments as written (`/blog/[slug]`). */
  path: string;
  /** The page file, relative to the project root, with forward slashes. */
  file: string;
  /** A segment such as `[slug]` needs a value before the page can be opened. */
  dynamic: boolean;
}

function walk(dir: string, found: string[] = []): string[] {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found); else found.push(full);
  }
  return found;
}

/** The routes a file-based router serves; empty when the project has none (a plain Vite app). */
export function listRoutes(projectRoot: string): RouteEntry[] {
  const { metaFramework } = detectProjectMeta(projectRoot);
  const pkg = (() => { try { return JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')); } catch { return {}; } })();
  const kit = !!({ ...pkg.dependencies, ...pkg.devDependencies })['@sveltejs/kit'];
  const routes: RouteEntry[] = [];
  const add = (file: string, segments: string[]) => {
    // Route groups `(name)` and parallel slots `@name` organize files without adding to the URL.
    const kept = segments.filter(segment => segment && !/^\(.*\)$/.test(segment) && !segment.startsWith('@'));
    routes.push({ path: '/' + kept.join('/'), file: path.relative(projectRoot, file).split(path.sep).join('/'), dynamic: kept.some(segment => segment.startsWith('[')) });
  };
  const under = (base: string, file: string) => path.relative(base, file).split(path.sep);
  for (const base of ['app', 'src/app'].map(dir => path.join(projectRoot, dir))) {
    if (metaFramework !== 'next') break;
    for (const file of walk(base)) {
      const parts = under(base, file);
      // Folders starting with `_` are private in the App Router.
      if (/^page\.(tsx|jsx|ts|js|mdx)$/.test(parts[parts.length - 1]) && !parts.some(part => part.startsWith('_'))) add(file, parts.slice(0, -1));
    }
  }
  for (const base of ['pages', 'src/pages'].map(dir => path.join(projectRoot, dir))) {
    if (metaFramework !== 'next' && metaFramework !== 'astro') break;
    const pattern = metaFramework === 'next' ? /\.(tsx|jsx|ts|js)$/ : /\.(astro|md|mdx)$/;
    for (const file of walk(base)) {
      const parts = under(base, file);
      const name = parts[parts.length - 1];
      if (!pattern.test(name) || (metaFramework === 'next' && (parts[0] === 'api' || /^_(app|document|error)\./.test(name)))) continue;
      const stem = name.replace(pattern, '');
      add(file, [...parts.slice(0, -1), stem === 'index' ? '' : stem]);
    }
  }
  if (kit) {
    const base = path.join(projectRoot, 'src/routes');
    for (const file of walk(base)) {
      const parts = under(base, file);
      if (parts[parts.length - 1] === '+page.svelte') add(file, parts.slice(0, -1));
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}
