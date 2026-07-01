import { Plugin } from 'vite';
import * as babel from '@babel/core';
import * as path from 'path';

function normalizePath(filePath: string, rootDir: string): string {
  const relativePath = path.relative(rootDir, filePath);
  return relativePath.replace(/\\/g, '/');
}

/**
 * Inline bridge script injected into the browser — zero Node.js dependencies.
 * This is a self-contained IIFE that registers hover/click handlers and
 * posts messages to the parent Glide editor window.
 */
const BRIDGE_SCRIPT = `
(function() {
  if (window.__glide_initialized__) return;
  window.__glide_initialized__ = true;

  // Inject highlight styles
  var style = document.createElement('style');
  style.id = '__glide_styles__';
  style.textContent = [
    '[data-glide-hover]{outline:2px solid rgba(56,189,248,0.6)!important;outline-offset:1px;}',
    '[data-glide-selected]{outline:2px solid #38bdf8!important;outline-offset:2px;}'
  ].join('');
  document.head.appendChild(style);

  var hovered = null;
  var selected = null;

  function sendMsg(type, el) {
    var src = el.getAttribute('data-cf-source') || '';
    var r = el.getBoundingClientRect();
    window.parent.postMessage({
      type: type,
      source: src,
      tagName: el.tagName.toLowerCase(),
      classNames: el.className,
      rect: {
        left: r.left + window.scrollX,
        top: r.top + window.scrollY,
        width: r.width,
        height: r.height
      }
    }, '*');
  }

  document.addEventListener('mousemove', function(e) {
    var el = e.target && e.target.closest && e.target.closest('[data-cf-source]');
    if (el) {
      if (hovered !== el) {
        if (hovered) hovered.removeAttribute('data-glide-hover');
        hovered = el;
        el.setAttribute('data-glide-hover', '');
        sendMsg('glide:element-hovered', el);
      }
    } else if (hovered) {
      hovered.removeAttribute('data-glide-hover');
      hovered = null;
      window.parent.postMessage({ type: 'glide:element-hover-exit' }, '*');
    }
  });

  document.addEventListener('click', function(e) {
    var el = e.target && e.target.closest && e.target.closest('[data-cf-source]');
    if (el) {
      e.preventDefault();
      e.stopPropagation();
      if (selected) selected.removeAttribute('data-glide-selected');
      selected = el;
      el.setAttribute('data-glide-selected', '');
      sendMsg('glide:element-selected', el);
    }
  }, true);

  window.addEventListener('message', function(e) {
    if (!e.data || e.data.type !== 'glide:select-element-by-id') return;
    var el = document.querySelector('[data-cf-source="' + e.data.id + '"]');
    if (el) {
      if (selected) selected.removeAttribute('data-glide-selected');
      selected = el;
      el.setAttribute('data-glide-selected', '');
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      sendMsg('glide:element-selected', el);
    }
  });
})();
`;

export function glideSourceStamping(): Plugin {
  let isDev = false;
  let rootDir = process.cwd();
  let mainEntryInjected = false;

  return {
    name: 'vite-plugin-glide-source-stamping',

    configResolved(config) {
      isDev = config.command === 'serve';
      rootDir = config.root || process.cwd();
      mainEntryInjected = false;
    },

    /**
     * Inject the bridge script as an inline <script> tag into index.html.
     * This runs entirely in the browser with no Node.js imports.
     */
    transformIndexHtml(html) {
      if (!isDev) return html;
      return html.replace(
        '<head>',
        `<head><script>${BRIDGE_SCRIPT}<\/script>`
      );
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

      // Only return the stamped code — bridge is injected via transformIndexHtml
      return {
        code: result.code ?? code,
        map: result.map,
      };
    },
  };
}
