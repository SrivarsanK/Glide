import { Plugin } from 'vite';
import * as babel from '@babel/core';
import * as path from 'path';

function normalizePath(filePath: string, rootDir: string): string {
  const relativePath = path.relative(rootDir, filePath);
  return relativePath.replace(/\\/g, '/');
}

export function glideSourceStamping(): Plugin {
  let isDev = false;
  let rootDir = process.cwd();

  return {
    name: 'vite-plugin-glide-source-stamping',

    configResolved(config) {
      isDev = config.command === 'serve';
      rootDir = config.root || process.cwd();
    },

    transform(code, id) {
      // Only stamp in development mode (command === 'serve')
      if (!isDev) return null;

      // Target only source files (.jsx, .tsx) and exclude node_modules or queries
      const cleanId = id.split('?')[0];
      if (cleanId.includes('node_modules') || !/\.[jt]sx$/.test(cleanId)) {
        return null;
      }

      const result = babel.transformSync(code, {
        filename: cleanId,
        configFile: false,
        babelrc: false,
        parserOpts: {
          plugins: ['jsx', 'typescript'],
        },
        plugins: [
          {
            visitor: {
              JSXOpeningElement(nodePath, state) {
                const filename = state.file.opts.filename;
                if (!filename) return;

                const loc = nodePath.node.loc;
                if (!loc) return;

                const relativePath = normalizePath(filename, rootDir);
                const sourceVal = `${relativePath}:${loc.start.line}:${loc.start.column + 1}`;

                // Check if already has data-cf-source
                const hasSourceAttr = nodePath.node.attributes.some(
                  (attr: any) =>
                    attr.type === 'JSXAttribute' &&
                    attr.name.name === 'data-cf-source'
                );

                if (!hasSourceAttr) {
                  const t = babel.types;
                  const attr = t.jsxAttribute(
                    t.jsxIdentifier('data-cf-source'),
                    t.stringLiteral(sourceVal)
                  );
                  nodePath.node.attributes.push(attr);
                }
              },
            },
          },
        ],
        sourceMaps: true,
      });

      if (!result) return null;

      return {
        code: result.code ?? code,
        map: result.map,
      };
    },

    transformIndexHtml(html) {
      if (!isDev) return html;
      return {
        html,
        tags: [
          {
            tag: 'script',
            attrs: { type: 'module' },
            children: `
              import { GlideBridge, GlideOverlay } from '/node_modules/@srivarsank/glide/dist/index.js';
              if (typeof window !== 'undefined') {
                const bridge = new GlideBridge(window);
                bridge.init();

                const overlay = new GlideOverlay(window);
                overlay.init();

                overlay.onResize((source, rect, delta) => {
                  window.parent.postMessage({
                    type: 'glide:element-resized',
                    source,
                    rect,
                    delta
                  }, '*');
                });
              }
            `,
            injectTo: 'body',
          }
        ]
      };
    },
  };
}
