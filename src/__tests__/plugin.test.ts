import { describe, expect, test } from 'vitest';
import * as babel from '@babel/core';
import * as os from 'os';
import glideSourceStampingPlugin from '../../packages/babel-plugin/src/index.js';
import { glideSourceStamping } from '../../packages/vite-plugin/src/index.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('glideSourceStamping Vite Plugin', () => {
  test('injects data-gl-source attributes in dev mode', () => {
    const plugin = glideSourceStamping();

    // Simulate configResolved for serve (dev mode)
    if (plugin.configResolved && typeof plugin.configResolved === 'function') {
      plugin.configResolved({ command: 'serve', root: '/project' } as any);
    }

    const code = `
      export function App() {
        return (
          <div className="container">
            <h1>Hello World</h1>
            <p>Test</p>
          </div>
        );
      }
    `;

    const filePath = '/project/src/App.tsx';

    if (plugin.transform) {
      const result = (plugin.transform as any).handler.call({} as any, code, filePath);
      expect(result).not.toBeNull();

      const transformedCode = (result as any).code;
      expect(transformedCode).toContain('project/src/App.tsx:4:11"');
      expect(transformedCode).toContain('project/src/App.tsx:5:13"');
      expect(transformedCode).toContain('project/src/App.tsx:6:13"');
      // Bridge is injected via transformIndexHtml, NOT as a module import
      expect(transformedCode).not.toContain("import { GlideBridge");
    } else {
      throw new Error('transform method not found on plugin');
    }
  });

  test('injects inline bridge script into index.html in dev mode', () => {
    const plugin = glideSourceStamping();

    if (plugin.configResolved && typeof plugin.configResolved === 'function') {
      plugin.configResolved({ command: 'serve', root: '/project' } as any);
    }

    const html = '<html><head></head><body></body></html>';

    if (plugin.transformIndexHtml) {
      const result = (plugin.transformIndexHtml as any).handler(html);
      expect(result).toContain('__glide_initialized__');
      expect(result).toContain('data-gl-source');
      expect(result).toContain('<script>');
    } else {
      throw new Error('transformIndexHtml not found on plugin');
    }
  });

  test('does not inject data-gl-source in production build mode', () => {
    const plugin = glideSourceStamping();

    // Simulate configResolved for build (production mode)
    if (plugin.configResolved && typeof plugin.configResolved === 'function') {
      plugin.configResolved({ command: 'build', root: '/project' } as any);
    }

    const code = `
      export function App() {
        return (
          <div className="container">
            <h1>Hello World</h1>
          </div>
        );
      }
    `;

    const filePath = '/project/src/App.tsx';

    if (plugin.transform) {
      const result = (plugin.transform as any).handler.call({} as any, code, filePath);
      expect(result).toBeNull();
    }
  });

  test('skips node_modules files', () => {
    const plugin = glideSourceStamping();

    if (plugin.configResolved && typeof plugin.configResolved === 'function') {
      plugin.configResolved({ command: 'serve', root: '/project' } as any);
    }

    const code = `<div>Test</div>`;
    const filePath = '/project/node_modules/library/App.tsx';

    if (plugin.transform) {
      const result = (plugin.transform as any).handler.call({} as any, code, filePath);
      expect(result).toBeNull();
    }
  });

  test('skips non-JSX/TSX files', () => {
    const plugin = glideSourceStamping();

    if (plugin.configResolved && typeof plugin.configResolved === 'function') {
      plugin.configResolved({ command: 'serve', root: '/project' } as any);
    }

    const code = `const a = 1;`;
    const filePath = '/project/src/index.ts';

    if (plugin.transform) {
      const result = (plugin.transform as any).handler.call({} as any, code, filePath);
      expect(result).toBeNull();
    }
  });

  test('skips Vue/Svelte/Astro virtual script/style modules and Vite asset query imports', () => {
    const plugin = glideSourceStamping({ editor: false });

    if (plugin.configResolved && typeof plugin.configResolved === 'function') {
      plugin.configResolved({ command: 'serve', root: '/project' } as any);
    }

    const handler = (plugin.transform as any).handler;
    const tsCode = 'const list = ref<string[]>([]);\nconst ok = count<limit;\n';
    const cssCode = 'a > b { color: red; }\n';
    const rawHtml = '<div class="card">Hello</div>\n';

    expect(handler.call({}, tsCode, '/project/src/App.vue?vue&type=script&setup=true&lang.ts')).toBeNull();
    expect(handler.call({}, cssCode, '/project/src/App.vue?vue&type=style&index=0&scoped=1&lang.css')).toBeNull();
    expect(handler.call({}, cssCode, '/project/src/App.svelte?svelte&type=style&lang.css')).toBeNull();
    expect(handler.call({}, tsCode, '/project/src/Page.astro?astro&type=script&index=0&lang.ts')).toBeNull();
    expect(handler.call({}, cssCode, '/project/src/Page.astro?astro&type=style&index=0&lang.css')).toBeNull();
    expect(handler.call({}, rawHtml, '/project/src/App.vue?raw')).toBeNull();
    expect(handler.call({}, rawHtml, '/project/src/App.tsx?raw')).toBeNull();
    expect(handler.call({}, rawHtml, '/project/src/page.html?url')).toBeNull();
    expect(handler.call({}, rawHtml, '/project/src/page.html?inline')).toBeNull();
    expect(handler.call({}, tsCode, '/project/src/worker.tsx?worker')).toBeNull();
    expect(handler.call({}, tsCode, '/project/src/worker.tsx?sharedworker')).toBeNull();

    // Regular files and HMR cache-busted module queries still stamp.
    const stampedVue = handler.call({}, '<template><div v-if="a<b">Hi</div></template>', '/project/src/App.vue?t=1700000000');
    expect(stampedVue).not.toBeNull();
    expect(stampedVue.code).toContain('<div data-gl-source="src/App.vue:1:11" v-if="a<b">Hi</div>');
  });

  test('never injects legacy position sidecars into the development app', () => {
    const plugin = glideSourceStamping();

    const mockRoot = path.resolve(__dirname, '../../tmp-test-root');
    if (!fs.existsSync(mockRoot)) {
      fs.mkdirSync(mockRoot, { recursive: true });
    }
    const posFile = path.join(mockRoot, 'glide-positions.json');
    const mockPositions = {
      'src/App.tsx:10:5': { position: 'relative', left: '10px' },
      'src/App.tsx:20:5': null
    };
    fs.writeFileSync(posFile, JSON.stringify(mockPositions), 'utf-8');

    if (plugin.configResolved && typeof plugin.configResolved === 'function') {
      plugin.configResolved({ command: 'serve', root: mockRoot } as any);
    }

    try {
      if (plugin.transformIndexHtml) {
        const html = '<html><head></head><body></body></html>';
        const result = (plugin.transformIndexHtml as any).handler(html);

        expect(result).not.toContain('src/App.tsx:10:5');
        expect(result).not.toContain('__glide_positions__');
        expect(result).not.toContain('glide:positions-updated');
        expect(result).not.toContain('src/App.tsx:20:5');
      }
    } finally {
      if (fs.existsSync(posFile)) {
        fs.unlinkSync(posFile);
      }
      if (fs.existsSync(mockRoot)) {
        fs.rmdirSync(mockRoot);
      }
    }
  });

  test('babel-plugin skips Fragment / React.Fragment / aliased Fragment and guards NODE_ENV=production', () => {
    const code = `
      import React, { Fragment, Fragment as F } from 'react';
      export function App() {
        return (
          <React.Fragment>
            <Fragment>
              <F>
                <div>Hello</div>
              </F>
            </Fragment>
          </React.Fragment>
        );
      }
    `;
    const devOut = babel.transformSync(code, {
      filename: '/project/src/App.tsx',
      configFile: false,
      babelrc: false,
      parserOpts: { plugins: ['jsx', 'typescript'] },
      plugins: [glideSourceStampingPlugin],
    })!.code!;
    expect(devOut).toContain('<React.Fragment>');
    expect(devOut).toContain('<Fragment>');
    expect(devOut).toContain('<F>');
    expect(devOut).toContain('project/src/App.tsx:8:17">Hello</div>');

    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const prodOut = babel.transformSync(code, {
        filename: '/project/src/App.tsx',
        configFile: false,
        babelrc: false,
        parserOpts: { plugins: ['jsx', 'typescript'] },
        plugins: [glideSourceStampingPlugin],
      })!.code!;
      expect(prodOut).not.toContain('data-gl-source');
    } finally {
      if (prevEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevEnv;
    }
  });

  test('vite-plugin awaits configResolved, guards SSR window in HMR snippet, and ignores Astro frontmatter/comment <head>', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-vite-cfg-'));
    try {
      fs.writeFileSync(path.join(tmpRoot, 'glide.config.json'), JSON.stringify({ sourceAttribute: 'data-custom-source' }), 'utf-8');
      const plugin = glideSourceStamping({ editor: false }) as any;
      await plugin.configResolved({ command: 'serve', root: tmpRoot });

      const jsxRes = plugin.transform.handler.call({}, 'export const A = () => <div>Hi</div>;', path.join(tmpRoot, 'src', 'A.tsx'));
      expect(jsxRes.code).toContain('data-custom-source=');
      expect(jsxRes.code).toContain("typeof window !== 'undefined' && window !== window.top");

      const astroPage = [
        '---',
        'const fake = "<head><title>Not real</title></head>";',
        '---',
        '<!-- <head>commented</head> -->',
        '<html>',
        '  <head><title>Real</title></head>',
        '  <body><main>Hi</main></body>',
        '</html>',
      ].join('\n');
      const astroRes = plugin.transform.handler.call({}, astroPage, path.join(tmpRoot, 'src', 'pages', 'index.astro'));
      expect(astroRes.code).toContain('const fake = "<head><title>Not real</title></head>";');
      expect(astroRes.code).toContain('<!-- <head>commented</head> -->');
      expect(astroRes.code).toContain('  <head><script is:inline>');
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
