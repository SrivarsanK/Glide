import { afterEach, expect, test } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { listRoutes } from '../../packages/core/src/routes.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function project(deps: Record<string, string>, files: string[]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-routes-'));
  roots.push(root);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: deps }));
  for (const file of files) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), ''); }
  return root;
}
const paths = (root: string) => listRoutes(root).map(route => (route.dynamic ? '~' : '') + route.path);

test('Next.js App Router: groups, slots and private folders add nothing to the URL', () => {
  const root = project({ next: '15', react: '19' }, ['app/page.tsx', 'app/(marketing)/pricing/page.tsx', 'app/blog/[slug]/page.tsx',
    'app/@modal/login/page.tsx', 'app/_lib/page.tsx', 'app/layout.tsx', 'src/app/docs/page.mdx']);
  expect(paths(root)).toEqual(['/', '~/blog/[slug]', '/docs', '/login', '/pricing']);
  expect(listRoutes(root).find(route => route.path === '/pricing')!.file).toBe('app/(marketing)/pricing/page.tsx');
});

test('Next.js Pages Router: index pages, and no api or reserved files', () => {
  const root = project({ next: '15' }, ['pages/index.tsx', 'pages/about.tsx', 'pages/blog/index.tsx', 'pages/api/hello.ts',
    'pages/_app.tsx', 'pages/_document.tsx', 'pages/_error.tsx', 'src/pages/team.jsx']);
  expect(paths(root)).toEqual(['/', '/about', '/blog', '/team']);
});

test('SvelteKit and Astro routes', () => {
  expect(paths(project({ '@sveltejs/kit': '2', svelte: '5' }, ['src/routes/+page.svelte', 'src/routes/(app)/settings/+page.svelte',
    'src/routes/+layout.svelte', 'src/routes/posts/[id]/+page.svelte']))).toEqual(['/', '~/posts/[id]', '/settings']);
  expect(paths(project({ astro: '5' }, ['src/pages/index.astro', 'src/pages/blog/[slug].astro', 'src/pages/about.md', 'src/pages/styles.css'])))
    .toEqual(['/', '/about', '~/blog/[slug]']);
});

test('a plain Vite app has no file routes', () => {
  expect(listRoutes(project({ react: '19', vite: '6' }, ['src/App.tsx', 'src/pages/Home.tsx']))).toEqual([]);
});
