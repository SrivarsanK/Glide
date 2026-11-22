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
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  // Astro projects often install React too, which the framework detector reports first.
  const astro = !!deps.astro || metaFramework === 'astro', next = !astro && metaFramework === 'next', kit = !!deps['@sveltejs/kit'];
  const routes: RouteEntry[] = [];
  const add = (file: string, segments: string[], router: 'app' | 'pages' | 'astro' | 'kit') => {
    // Route groups `(name)` (App Router, SvelteKit) and parallel slots `@name` (App Router) add nothing to the URL.
    const kept = segments.filter(segment => segment && !((router === 'app' || router === 'kit') && /^\(.*\)$/.test(segment))
      && !(router === 'app' && segment.startsWith('@')));
    routes.push({ path: '/' + kept.join('/'), file: path.relative(projectRoot, file).split(path.sep).join('/'), dynamic: kept.some(segment => segment.includes('[')) });
  };
  const under = (base: string, file: string) => path.relative(base, file).split(path.sep);
  // Next.js reads `app/` and `pages/` at the root and ignores the `src/` copies when the root ones exist.
  const first = (...dirs: string[]) => dirs.map(dir => path.join(projectRoot, dir)).find(dir => fs.existsSync(dir));
  const appBase = next ? first('app', 'src/app') : undefined;
  for (const file of appBase ? walk(appBase) : []) {
    const parts = under(appBase!, file);
    // Folders starting with `_` are private in the App Router.
    if (/^page\.(tsx|jsx|ts|js|mdx)$/.test(parts[parts.length - 1]) && !parts.some(part => part.startsWith('_'))) add(file, parts.slice(0, -1), 'app');
  }
  const pagesBase = next ? first('pages', 'src/pages') : astro ? first('src/pages') : undefined;
  const pattern = next ? /\.(tsx|jsx|ts|js)$/ : /\.(astro|md|mdx)$/;
  for (const file of pagesBase ? walk(pagesBase) : []) {
    const parts = under(pagesBase!, file);
    const name = parts[parts.length - 1];
    if (!pattern.test(name)) continue;
    if (next && (parts[0] === 'api' || /^_(app|document|error)\./.test(name))) continue;
    // Astro does not route files or folders starting with `_`.
    if (astro && parts.some(part => part.startsWith('_'))) continue;
    const stem = name.replace(pattern, '');
    add(file, [...parts.slice(0, -1), stem === 'index' ? '' : stem], next ? 'pages' : 'astro');
  }
  if (kit) {
    const base = path.join(projectRoot, 'src/routes');
    for (const file of walk(base)) {
      const parts = under(base, file);
      if (parts[parts.length - 1] === '+page.svelte') add(file, parts.slice(0, -1), 'kit');
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}
