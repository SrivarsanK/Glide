import { Plugin } from 'vite';
import * as babel from '@babel/core';
import * as path from 'path';
import glideSourceStampingPlugin from '@srivarsank/babel-plugin';
import { loadConfigFromDisk, detectProjectMeta, DEFAULT_CONFIG, buildBridgeScript, stampHTMLTemplate as stampTemplate, type GlideConfig } from '@srivarsank/core';
import { GlideServer } from '@srivarsank/server';

export { buildBridgeScript };

function normalizePath(filePath: string, rootDir: string): string {
  const relativePath = path.relative(rootDir, filePath);
  return relativePath.replace(/\\/g, '/');
}

/**
 * `editor: false` skips serving the editor at /__glide/, for projects that run
 * the glide command instead.
 */
export function glideSourceStamping(options: { editor?: boolean } = {}): Plugin {
  let isDev = false;
  let configReady: Promise<unknown> = Promise.resolve();
  let rootDir = process.cwd();
  let stampPages = false;
  /** Stops the attached editor once; set while one is running. */
  let stopEditor: (() => Promise<void>) | null = null;
  let glideConfig: GlideConfig = DEFAULT_CONFIG;
  let bridgeScript: string = buildBridgeScript(
    DEFAULT_CONFIG.sourceAttribute,
    DEFAULT_CONFIG.hoverAttribute,
    DEFAULT_CONFIG.selectedAttribute,
    DEFAULT_CONFIG.snapThresholdPx
  );

  const stampHTMLTemplate = (code: string, filepath: string) => stampTemplate(code, filepath, glideConfig.sourceAttribute);

  /**
   * Stamp the authored elements of a page, but not <html>, <head> or <body>. Scripts add
   * elements to those at runtime; with a stamp there, each such element would look like
   * an authored one and the editor could not tell the user that it has no source.
   */
  function stampPage(html: string, filepath: string): string {
    const stamped = stampHTMLTemplate(html, filepath);
    const end = (pattern: RegExp) => { const match = pattern.exec(stamped); return match ? match.index + match[0].length : 0; };
    const scaffold = end(/<body\b[^>]*>/i) || end(/<\/head\s*>/i) || end(/<html\b[^>]*>/i);
    const stamp = new RegExp(` ${glideConfig.sourceAttribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}="[^"]*"`, 'g');
    return stamped.slice(0, scaffold).replace(stamp, '') + stamped.slice(scaffold);
  }

  return {
    name: 'vite-plugin-glide-source-stamping',
    enforce: 'pre',

    // Remove X-Frame-Options so Glide can embed the app in an iframe.
    // Different ports = different origins; browsers refuse the iframe if this header is set.
    config() {
      return {
        server: {
          headers: {
            'X-Frame-Options': '',          // empty = header not sent
            'Content-Security-Policy': '',  // Glide doesn't need CSP on dev server
          },
          // Vite's default CORS policy already admits localhost origins such as the editor on port 7777.
          // `cors: true` would let any website read the project's source from the dev server.
        },
      };
    },

    configResolved(config) {
      isDev = config.command === 'serve';
      rootDir = config.root || process.cwd();
      // In a project with no UI framework the HTML pages are the source, so their elements get stamps.
      // With a framework, index.html is only a mount point and stays unmapped.
      try { stampPages = detectProjectMeta(rootDir).framework === 'unknown'; } catch { stampPages = false; }
      // Load glide.config.ts from the user's project root synchronously.
      // jiti is used under the hood by loadConfigFromDisk — no await needed at plugin init time.
      try {
        configReady = loadConfigFromDisk(rootDir).then(cfg => {
          glideConfig = cfg;
          bridgeScript = buildBridgeScript(
            cfg.sourceAttribute,
            cfg.hoverAttribute,
            cfg.selectedAttribute,
            cfg.snapThresholdPx
          );
        }).catch(() => { /* use defaults */ });
      } catch { /* use defaults */ }
    },

    configureServer(server) {
      // The MCP run file holds the agent token. Vite serves files under the root (also as /@fs/...),
      // and its deny list is fixed before plugins see the resolved config, so refuse the path here.
      server.middlewares.use((req, res, next) => {
        let pathname = (req.url || '').split('?')[0];
        try { pathname = decodeURIComponent(pathname); } catch { /* keep the raw path */ }
        if (/\/node_modules\/\.cache\/glide(\/|$)/i.test(path.posix.normalize(pathname.replace(/\\/g, '/')))) {
          res.statusCode = 403;
          res.end('Glide keeps this file private.');
          return;
        }
        next();
      });
      // ── EDITOR AT /__glide/ ──────────────────────────────────────────────
      // Glide's server attaches to this dev server: the editor, its assets and
      // its socket share the app's origin, so the preview needs no proxy and
      // Vite's HMR socket works as it does without Glide.
      if (options.editor !== false && server.httpServer) {
        const httpServer = server.httpServer as import('http').Server;
        let handle: ((req: any, res: any, next: () => void) => void) | null = null;
        const glide = configReady.then(() => {
          const port = Number(server.config.server.port) || 5173;
          return new GlideServer(port, port, glideConfig, rootDir);
        });
        glide.then(instance => instance.attach(httpServer)).then(middleware => { handle = middleware; })
          .catch(error => server.config.logger.error(`[Glide] Editor failed to start: ${error?.message ?? error}`));
        server.middlewares.use((req, res, next) => handle ? handle(req, res, next) : next());
        httpServer.once('listening', () => {
          const address = httpServer.address();
          const port = address && typeof address === 'object' ? address.port : server.config.server.port;
          // The editor answers on the loopback IP, a different origin than the app on "localhost".
          const host = glideConfig.remoteAccess ? 'localhost' : address && typeof address === 'object' && address.address === '::1' ? '[::1]' : '127.0.0.1';
          const scheme = server.config.server.https ? 'https' : 'http';
          server.config.logger.info(`  [Glide] Editor: ${scheme}://${host}:${port}/__glide/`);
        });
        // Vite's server.close() does not always emit 'close' on the HTTP server (for example
        // when it never listened), so closeBundle below stops the editor as well.
        let stopped: Promise<void> | null = null;
        stopEditor = () => stopped ??= glide.then(instance => instance.stop()).catch(() => {});
        httpServer.once('close', () => { stopEditor?.(); });
      }

      // ── IFRAME EMBEDDING FIX ─────────────────────────────────────────────
      // Glide embeds the user's app in an iframe from a different origin
      // (localhost:7777 vs localhost:5173). Browsers block this by default
      // when the embedded page sends X-Frame-Options: SAMEORIGIN or a
      // Content-Security-Policy with a restrictive frame-ancestors directive.
      // Strip those headers so Glide can embed the app without connection errors.
      server.middlewares.use((_req, res, next) => {
        const originalSetHeader = res.setHeader.bind(res);
        const originalWriteHead = res.writeHead.bind(res);

        // Intercept setHeader to strip framing-related headers
        res.setHeader = function(name: string, value: any) {
          const lower = name.toLowerCase();
          if (lower === 'x-frame-options') return res; // drop
          if (lower === 'content-security-policy' || lower === 'content-security-policy-report-only') {
            // Strip frame-ancestors directive only, preserve rest of CSP
            if (typeof value === 'string') {
              value = value
                .split(';')
                .map((d: string) => d.trim())
                .filter((d: string) => !d.toLowerCase().startsWith('frame-ancestors'))
                .join('; ');
            }
          }
          return originalSetHeader(name, value);
        } as typeof res.setHeader;

        // Also intercept writeHead (some middleware sets headers there)
        res.writeHead = function(statusCode: number, ...args: any[]) {
          // Remove x-frame-options from the headers object if provided
          if (args.length > 0 && typeof args[args.length - 1] === 'object' && args[args.length - 1] !== null) {
            const headers = args[args.length - 1] as Record<string, any>;
            delete headers['x-frame-options'];
            delete headers['X-Frame-Options'];
            if (headers['content-security-policy']) {
              headers['content-security-policy'] = String(headers['content-security-policy'])
                .split(';')
                .map((d: string) => d.trim())
                .filter((d: string) => !d.toLowerCase().startsWith('frame-ancestors'))
                .join('; ');
            }
          }
          return originalWriteHead(statusCode, ...args);
        } as typeof res.writeHead;

        next();
      });

    },


    /**
     * Inject the development bridge. Layout is persisted in authored source.
     * This runs entirely in the browser with no Node.js imports.
     */
    /** Vite runs this when the dev server closes; stop the editor's watchers with it. */
    async closeBundle() {
      const stop = stopEditor;
      stopEditor = null;
      await stop?.();
    },

    transformIndexHtml: {
      // 'pre' gives the page as it is on disk, so stamped positions match the source file.
      order: 'pre',
      handler(html: string, ctx?: { filename?: string }) {
        if (!isDev) return html;
        // Stamp before the bridge goes in: the bridge script would move every later line.
        const page = stampPages && ctx?.filename ? stampPage(html, normalizePath(ctx.filename, rootDir)) : html;
        // A replacer function inserts the script literally; a replacement string would expand `$'` and `$&`.
        return page.replace(/<head(\s[^>]*)?>/, tag => `${tag}<script>${bridgeScript}<\/script>`);
      },
    },

    transform: {
      // 'pre' runs this before other plugins compile the file. Astro's own plugin comes first in
      // the plugin list; without this, the stamper saw compiled JavaScript and wrote wrong positions.
      order: 'pre',
      handler(code: string, id: string) {
        // Only stamp in development mode (command === 'serve')
        if (!isDev) return null;

        const cleanId = id.split('?')[0];
        // Skip framework virtual script/style modules (extracted TypeScript/CSS,
        // not HTML templates) and Vite asset-modifier queries (?raw, ?url, etc.).
        const queryIndex = id.indexOf('?');
        if (queryIndex !== -1) {
          const params = new URLSearchParams(id.slice(queryIndex + 1));
          const subModuleType = params.get('type');
          if (
            ((params.has('vue') || params.has('svelte') || params.has('astro')) &&
              (subModuleType === 'script' || subModuleType === 'style')) ||
            params.has('raw') ||
            params.has('url') ||
            params.has('inline') ||
            params.has('worker') ||
            params.has('sharedworker')
          ) {
            return null;
          }
        }
        if (cleanId.includes('node_modules')) {
          return null;
        }

        const isJSX = /\.[jt]sx$/.test(cleanId);
        const isHTML = /\.html$/.test(cleanId);
        const isVue = /\.vue$/.test(cleanId);
        const isSvelte = /\.svelte$/.test(cleanId);
        const isAstro = /\.astro$/.test(cleanId);

        if (!isJSX && !isHTML && !isVue && !isSvelte && !isAstro) {
          return null;
        }

        if (isJSX) {
          const result = babel.transformSync(code, {
            filename: cleanId,
            configFile: false,
            babelrc: false,
            parserOpts: {
              plugins: ['jsx', 'typescript'],
            },
            // Stamp with the configured attribute, which the bridge reads on elements and component props.
            plugins: [
              [glideSourceStampingPlugin, { sourceAttribute: glideConfig.sourceAttribute }]
            ],
            sourceMaps: true,
          });

          if (!result) return null;

          // Only return the stamped code — bridge is injected via transformIndexHtml
          const hmrInjection = `
  if (import.meta.hot && window !== window.top) {
    const __glideAfterUpdate = function() {
      if (window.__glide_refresh_pending__) return;
      window.__glide_refresh_pending__ = true;
      var raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : function(cb) { setTimeout(cb, 16); };
      raf(function() {
        raf(function() {
          window.__glide_refresh_pending__ = false;
          if (typeof window.__glide_update_selection_node__ === 'function') {
            window.__glide_update_selection_node__();
          }
          if (typeof window.__glide_refresh_selection__ === 'function') {
            window.__glide_refresh_selection__();
          }
        });
      });
    };
    import.meta.hot.on('vite:afterUpdate', __glideAfterUpdate);
    import.meta.hot.dispose(function() {
      import.meta.hot.off('vite:afterUpdate', __glideAfterUpdate);
    });
  }
  `;
          return {
            code: (result.code ?? code) + hmrInjection,
            map: result.map,
          };
        }

        // For HTML, Vue, Svelte, and Astro templates, stamp them using stampHTMLTemplate
        if (isHTML || isVue || isSvelte || isAstro) {
          const relativePath = normalizePath(cleanId, rootDir);
          let stampedCode = stampHTMLTemplate(code, relativePath);
          // Astro renders its pages itself and never calls transformIndexHtml, so the bridge goes
          // into the page or layout that has the <head>. It is added after stamping: the stamps
          // hold positions in the file on disk. `is:inline` keeps Astro from processing the script.
          if (isAstro) {
            stampedCode = stampedCode.replace(/<head(\s[^>]*)?>/, tag => `${tag}<script is:inline>${bridgeScript}<\/script>`);
          }
          return {
            code: stampedCode,
            map: null
          };
        }
      return null;
      },
    },
  };
}
