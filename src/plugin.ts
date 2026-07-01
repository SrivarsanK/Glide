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
    var src = el.getAttribute('data-gl-source') || '';
    var r = el.getBoundingClientRect();
    
    // Extract computed styles
    var cs = window.getComputedStyle(el);
    var computedStyles = {
      tagName: el.tagName.toLowerCase(),
      display: cs.display,
      flexDirection: cs.flexDirection,
      justifyContent: cs.justifyContent,
      alignItems: cs.alignItems,
      flexWrap: cs.flexWrap,
      gap: cs.gap,
      rowGap: cs.rowGap,
      columnGap: cs.columnGap,
      marginTop: cs.marginTop,
      marginBottom: cs.marginBottom,
      marginLeft: cs.marginLeft,
      marginRight: cs.marginRight,
      paddingTop: cs.paddingTop,
      paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft,
      paddingRight: cs.paddingRight,
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      textAlign: cs.textAlign,
      textDecoration: cs.textDecoration,
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      background: cs.background,
      backgroundImage: cs.backgroundImage,
      opacity: cs.opacity,
      borderColor: cs.borderColor,
      borderWidth: cs.borderWidth,
      borderStyle: cs.borderStyle,
      borderTopLeftRadius: cs.borderTopLeftRadius,
      borderTopRightRadius: cs.borderTopRightRadius,
      borderBottomRightRadius: cs.borderBottomRightRadius,
      borderBottomLeftRadius: cs.borderBottomLeftRadius,
      boxShadow: cs.boxShadow,
      transform: cs.transform,
      width: cs.width,
      height: cs.height,
      position: cs.position,
      top: cs.top,
      left: cs.left
    };

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

    window.parent.postMessage({
      type: 'glide:overlay',
      source: src,
      rect: {
        x: r.left + window.scrollX,
        y: r.top + window.scrollY,
        width: r.width,
        height: r.height
      },
      isHover: type === 'glide:element-hovered',
      computedStyles: computedStyles
    }, '*');
  }

  document.addEventListener('pointerdown', function(e) {
    var target = e.target;
    if (target.nodeType === 3) target = target.parentNode;
    var el = target && target.closest && target.closest('[data-gl-source]');
    if (el) {
      var cs = window.getComputedStyle(el);
      var initML = parseInt(cs.marginLeft) || 0;
      var initMT = parseInt(cs.marginTop) || 0;

      window.parent.postMessage({
        type: 'glide:element-drag-start',
        source: el.getAttribute('data-gl-source'),
        initialMarginLeft: initML,
        initialMarginTop: initMT,
        clientX: e.clientX,
        clientY: e.clientY
      }, '*');

      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  document.addEventListener('pointermove', function(e) {
    var target = e.target;
    if (target.nodeType === 3) target = target.parentNode;
    var el = target && target.closest && target.closest('[data-gl-source]');
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
  }, true);

  document.addEventListener('click', function(e) {
    var target = e.target;
    if (target.nodeType === 3) target = target.parentNode;
    var el = target && target.closest && target.closest('[data-gl-source]');
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
    if (!e.data) return;
    if (e.data.type === 'glide:select-element-by-id') {
      var el = document.querySelector('[data-gl-source="' + e.data.id + '"]');
      if (el) {
        if (selected) selected.removeAttribute('data-glide-selected');
        selected = el;
        el.setAttribute('data-glide-selected', '');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        sendMsg('glide:element-selected', el);
      }
    }
    if (e.data.type === 'glide:apply-drag-delta') {
      var el = document.querySelector('[data-gl-source="' + e.data.source + '"]');
      if (el) {
        el.style.transform = 'translate(' + e.data.dx + 'px, ' + e.data.dy + 'px)';
        el.style.zIndex = '9999';
      }
    }
    if (e.data.type === 'glide:apply-drag-commit') {
      var el = document.querySelector('[data-gl-source="' + e.data.source + '"]');
      if (el) {
        el.style.transform = '';
        el.style.zIndex = '';
      }
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
    enforce: 'pre',

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

                const absolutePath = filename.replace(/\\/g, '/');
                const sourceVal = `${absolutePath}:${loc.start.line}:${loc.start.column + 1}`;

                // Check if already has data-gl-source
                const hasSourceAttr = nodePath.node.attributes.some(
                  (attr: any) =>
                    attr.type === 'JSXAttribute' &&
                    attr.name.name === 'data-gl-source'
                );

                if (!hasSourceAttr) {
                  const t = babel.types;
                  const attr = t.jsxAttribute(
                    t.jsxIdentifier('data-gl-source'),
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
