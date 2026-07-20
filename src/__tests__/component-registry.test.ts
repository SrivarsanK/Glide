import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { buildRegistry, collectSourceFiles } from '../../packages/core/src/component-registry.js';
import type { ComponentRegistry, ComponentBucket, RegistryElement } from '../../packages/core/src/component-registry.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-registry-'));
  // Minimal package.json so detectProjectMeta works
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ dependencies: { react: '*' } }));
  const srcDir = path.join(tmpDir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function write(relPath: string, content: string): string {
  const abs = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
  return abs;
}

function bucket(registry: ComponentRegistry, name: string): ComponentBucket | undefined {
  return registry.buckets.find(b => b.name === name);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildRegistry — JSX/TSX', () => {
  test('groups elements per named export component', () => {
    write('src/Card.tsx', `
      export function Card() {
        return (
          <div className="card">
            <h2>Title</h2>
            <p>Body</p>
          </div>
        );
      }
    `);

    const registry = buildRegistry({ projectRoot: tmpDir });
    const b = bucket(registry, 'Card');
    expect(b).toBeDefined();
    expect(b!.exportType).toBe('named');
    expect(b!.elements.length).toBeGreaterThanOrEqual(3); // div, h2, p
    const root = b!.elements.find(e => e.isRoot);
    expect(root).toBeDefined();
    expect(root!.tagName).toBe('div');
    expect(root!.classNames).toContain('card');
  });

  test('groups elements for default export component', () => {
    write('src/App.tsx', `
      export default function App() {
        return <main><span>Hello</span></main>;
      }
    `);

    const registry = buildRegistry({ projectRoot: tmpDir });
    const b = bucket(registry, 'App');
    expect(b).toBeDefined();
    expect(b!.exportType).toBe('default');
    const root = b!.elements.find(e => e.isRoot);
    expect(root!.tagName).toBe('main');
  });

  test('separates multiple components in one file', () => {
    write('src/ui.tsx', `
      export function Header() {
        return <header><nav>Nav</nav></header>;
      }
      export function Footer() {
        return <footer><small>Footer</small></footer>;
      }
    `);

    const registry = buildRegistry({ projectRoot: tmpDir });
    const names = registry.buckets.map(b => b.name);
    expect(names).toContain('Header');
    expect(names).toContain('Footer');
    // Roots should be different tags
    const hRoot = bucket(registry, 'Header')!.elements.find(e => e.isRoot);
    const fRoot = bucket(registry, 'Footer')!.elements.find(e => e.isRoot);
    expect(hRoot?.tagName).toBe('header');
    expect(fRoot?.tagName).toBe('footer');
  });

  test('arrow function component (const MyComp = () => {})', () => {
    write('src/Button.tsx', `
      export const Button = () => <button className="btn">Click</button>;
    `);

    const registry = buildRegistry({ projectRoot: tmpDir });
    const b = bucket(registry, 'Button');
    expect(b).toBeDefined();
    const root = b!.elements.find(e => e.isRoot);
    expect(root?.tagName).toBe('button');
    expect(root?.classNames).toContain('btn');
  });

  test('data-gl-source attribute used as element id', () => {
    write('src/Stamped.tsx', `
      export function Stamped() {
        return (
          <div data-gl-source="src/Stamped.tsx:3:10">
            <span data-gl-source="src/Stamped.tsx:4:12">text</span>
          </div>
        );
      }
    `);

    const registry = buildRegistry({ projectRoot: tmpDir });
    const b = bucket(registry, 'Stamped');
    const ids = b!.elements.map(e => e.id);
    expect(ids).toContain('src/Stamped.tsx:3:10');
    expect(ids).toContain('src/Stamped.tsx:4:12');
  });

  test('text content trimmed to 25 chars', () => {
    write('src/Long.tsx', `
      export function Long() {
        return <p>This is a very long piece of text that should be truncated</p>;
      }
    `);

    const registry = buildRegistry({ projectRoot: tmpDir });
    const b = bucket(registry, 'Long');
    const el = b!.elements.find(e => e.tagName === 'p');
    expect(el?.text).toBeDefined();
    expect(el!.text!.length).toBeLessThanOrEqual(25);
    expect(el!.text).toMatch(/\.\.\.$/);
  });

  test('file with no component functions treated as anonymous bucket', () => {
    write('src/template.tsx', `
      const el = <div><span>raw JSX</span></div>;
    `);

    const registry = buildRegistry({ projectRoot: tmpDir });
    expect(registry.buckets.some(b => b.file.endsWith('template.tsx'))).toBe(true);
    const b = registry.buckets.find(b => b.file.endsWith('template.tsx'))!;
    expect(b.exportType).toBe('anonymous');
    expect(b.elements[0].isRoot).toBe(true);
  });
});

describe('buildRegistry — Vue SFC', () => {
  test('creates one bucket per SFC file', () => {
    write('src/MyComp.vue', `
      <template>
        <div class="wrapper" data-gl-source="src/MyComp.vue:2:8">
          <p data-gl-source="src/MyComp.vue:3:10">Hello</p>
        </div>
      </template>
      <script>export default { name: 'MyComp' };</script>
      <style>.wrapper { color: red; }</style>
    `);

    const registry = buildRegistry({ projectRoot: tmpDir });
    const b = bucket(registry, 'MyComp');
    expect(b).toBeDefined();
    expect(b!.exportType).toBe('sfc');
    const root = b!.elements.find(e => e.isRoot);
    expect(root?.tagName).toBe('div');
    expect(root?.id).toBe('src/MyComp.vue:2:8');
    expect(root?.classNames).toContain('wrapper');
  });

  test('root element is flagged isRoot = true', () => {
    write('src/Layout.vue', `
      <template>
        <section>
          <header>Header</header>
        </section>
      </template>
    `);

    const registry = buildRegistry({ projectRoot: tmpDir });
    const b = bucket(registry, 'Layout');
    const roots = b!.elements.filter(e => e.isRoot);
    expect(roots).toHaveLength(1);
    expect(roots[0].tagName).toBe('section');
  });
});

describe('buildRegistry — Svelte', () => {
  test('creates one bucket per Svelte file', () => {
    write('src/Counter.svelte', `
      <script>let count = 0;</script>
      <div class="counter" data-gl-source="src/Counter.svelte:2:6">
        <button>Count: {count}</button>
      </div>
      <style>.counter { color: red; }</style>
    `);

    const registry = buildRegistry({ projectRoot: tmpDir });
    const b = bucket(registry, 'Counter');
    expect(b).toBeDefined();
    expect(b!.exportType).toBe('sfc');
    const root = b!.elements.find(e => e.isRoot);
    expect(root?.tagName).toBe('div');
    expect(root?.classNames).toContain('counter');
  });
});

describe('buildRegistry — HTML', () => {
  test('creates one bucket per HTML file, skips head/script/style', () => {
    write('src/index.html', `
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <div id="app">
            <h1>Hello</h1>
          </div>
        </body>
      </html>
    `);

    const registry = buildRegistry({ projectRoot: tmpDir });
    const b = registry.buckets.find(b => b.file.endsWith('index.html'));
    expect(b).toBeDefined();
    const tags = b!.elements.map(e => e.tagName);
    expect(tags).not.toContain('head');
    expect(tags).not.toContain('script');
    expect(tags).not.toContain('style');
    // body, div, h1 present
    expect(tags).toContain('div');
    expect(tags).toContain('h1');
  });
});

describe('buildRegistry — co-located CSS', () => {
  test('finds co-located .css file with same stem', () => {
    write('src/Card.tsx', `
      export function Card() { return <div className="card">Card</div>; }
    `);
    write('src/Card.css', `.card { color: blue; }`);

    const registry = buildRegistry({ projectRoot: tmpDir });
    const b = bucket(registry, 'Card');
    expect(b!.cssFiles.some(f => f.endsWith('Card.css'))).toBe(true);
  });

  test('reports empty cssFiles when no co-located CSS', () => {
    write('src/NoStyle.tsx', `
      export function NoStyle() { return <span>plain</span>; }
    `);

    const registry = buildRegistry({ projectRoot: tmpDir });
    const b = bucket(registry, 'NoStyle');
    expect(b!.cssFiles).toHaveLength(0);
  });
});

describe('buildRegistry — registry metadata', () => {
  test('includes projectRoot, generatedAt, framework', () => {
    write('src/App.tsx', `export default function App() { return <div />; }`);

    const registry = buildRegistry({ projectRoot: tmpDir });
    expect(registry.projectRoot).toBe(tmpDir);
    expect(registry.framework).toBe('react');
    expect(() => new Date(registry.generatedAt)).not.toThrow();
    expect(isNaN(new Date(registry.generatedAt).getTime())).toBe(false);
  });
});

describe('collectSourceFiles', () => {
  test('ignores node_modules and dist', () => {
    write('src/App.tsx', `export default function App() { return <div />; }`);
    write('node_modules/react/index.js', `module.exports = {};`);
    write('dist/app.js', `console.log("built");`);

    const files = collectSourceFiles(tmpDir);
    expect(files.some(f => f.includes('node_modules'))).toBe(false);
    expect(files.some(f => f.includes('dist'))).toBe(false);
    expect(files.some(f => f.endsWith('App.tsx'))).toBe(true);
  });

  test('finds files in nested subdirectories', () => {
    write('src/components/ui/Button.tsx', `export function Button() { return <button />; }`);
    write('src/pages/Home.tsx', `export function Home() { return <div />; }`);

    const files = collectSourceFiles(path.join(tmpDir, 'src'));
    expect(files.some(f => f.endsWith('Button.tsx'))).toBe(true);
    expect(files.some(f => f.endsWith('Home.tsx'))).toBe(true);
  });
});
