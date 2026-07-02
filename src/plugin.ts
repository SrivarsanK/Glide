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
  // ── GUARD: Only activate inside the Glide editor iframe ──────────────
  // When accessed directly in a browser tab (localhost:5173), window === window.top.
  // We bail out immediately so end-users see a normal, uneditable page.
  if (window === window.top) return;

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

  function sendMsg(type, el, isShift) {
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
      isShift: !!isShift,
      rect: {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height
      }
    }, '*');

    window.parent.postMessage({
      type: 'glide:overlay',
      source: src,
      isShift: !!isShift,
      rect: {
        x: r.left,
        y: r.top,
        width: r.width,
        height: r.height
      },
      isHover: type === 'glide:element-hovered',
      computedStyles: computedStyles
    }, '*');
  }

  var isDragging = false;
  var startX = 0;
  var startY = 0;
  var dragEl = null;
  var initialMarginLeft = 0;
  var initialMarginTop = 0;
  var initialLeft = 0;
  var initialTop = 0;
  var currentDx = 0;
  var currentDy = 0;
  var rafId = null;

  // Pure local rAF loop — zero postMessage during drag for true 60fps
  function rafDragLoop() {
    if (!isDragging || !dragEl) { rafId = null; return; }
    dragEl.style.transform = 'translate(' + currentDx + 'px, ' + currentDy + 'px)';
    dragEl.style.zIndex = '9999';
    // Tell parent the current delta so its overlay can follow (single shared object, no alloc)
    window.parent.postMessage({ type: 'glide:drag-delta', dx: currentDx, dy: currentDy }, '*');
    rafId = requestAnimationFrame(rafDragLoop);
  }

  document.addEventListener('pointerdown', function(e) {
    var target = e.target;
    if (target.nodeType === 3) target = target.parentNode;
    var el = target && target.closest && target.closest('[data-gl-source]');
    if (el) {
      isDragging = true;
      dragEl = el;
      startX = e.clientX;
      startY = e.clientY;
      currentDx = 0;
      currentDy = 0;

      var cs = window.getComputedStyle(el);
      initialMarginLeft = parseInt(cs.marginLeft) || 0;
      initialMarginTop = parseInt(cs.marginTop) || 0;

      // Extract existing left/top styles from the element directly to accumulate position correctly
      initialLeft = parseInt(el.style.left) || 0;
      initialTop = parseInt(el.style.top) || 0;

      // Temporarily disable CSS transitions to prevent lagging when dragging elements with transitions (e.g. .btn-primary)
      el.style.transition = 'none';
      el.style.transitionProperty = 'none';

      // Capture rect BEFORE pointer capture so it's accurate
      var r = el.getBoundingClientRect();

      el.setPointerCapture(e.pointerId);

      // Kick off local rAF loop immediately
      if (!rafId) rafId = requestAnimationFrame(rafDragLoop);

      window.parent.postMessage({
        type: 'glide:element-drag-start',
        source: el.getAttribute('data-gl-source'),
        initialMarginLeft: initialMarginLeft,
        initialMarginTop: initialMarginTop,
        clientX: e.clientX,
        clientY: e.clientY,
        rect: {
          x: r.left,
          y: r.top,
          width: r.width,
          height: r.height
        }
      }, '*');

      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  document.addEventListener('pointermove', function(e) {
    if (isDragging && dragEl) {
      currentDx = e.clientX - startX;
      currentDy = e.clientY - startY;
      // rAF loop is already running — just update the shared state
      e.preventDefault();
      e.stopPropagation();
    } else {
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
    }
  }, true);

  document.addEventListener('pointerup', function(e) {
    if (isDragging && dragEl) {
      isDragging = false;
      // Stop the rAF loop
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      dragEl.releasePointerCapture(e.pointerId);

      // Compute final cumulative offsets (existing left/top style + current drag offset)
      var finalLeft = initialLeft + currentDx;
      var finalTop = initialTop + currentDy;

      // Apply position inline BEFORE clearing transform so element stays at dropped position.
      dragEl.style.position = 'relative';
      dragEl.style.left = finalLeft + 'px';
      dragEl.style.top = finalTop + 'px';

      // Restore original transition properties
      dragEl.style.transition = '';
      dragEl.style.transitionProperty = '';

      // Now safe to clear transform and zIndex
      dragEl.style.transform = '';
      dragEl.style.zIndex = '';

      window.parent.postMessage({
        type: 'glide:element-drag-end',
        source: dragEl.getAttribute('data-gl-source'),
        dx: finalLeft,
        dy: finalTop
      }, '*');

      dragEl = null;
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  document.addEventListener('click', function(e) {
    var target = e.target;
    if (target.nodeType === 3) target = target.parentNode;
    var el = target && target.closest && target.closest('[data-gl-source]');
    var isShift = e.shiftKey || e.ctrlKey || e.metaKey;
    if (el) {
      e.preventDefault();
      e.stopPropagation();
      
      if (!isShift) {
        var old = document.querySelectorAll('[data-glide-selected]');
        for (var i = 0; i < old.length; i++) {
          old[i].removeAttribute('data-glide-selected');
        }
      }
      
      if (isShift && el.hasAttribute('data-glide-selected')) {
        el.removeAttribute('data-glide-selected');
        sendMsg('glide:element-deselected', el, isShift);
        // Reset selected reference to another selected element, if any
        selected = document.querySelector('[data-glide-selected]');
      } else {
        selected = el;
        el.setAttribute('data-glide-selected', '');
        sendMsg('glide:element-selected', el, isShift);
      }
    } else if (!e.target.closest('#glide-context-menu')) {
      // Clear selection if clicking empty canvas space
      var old = document.querySelectorAll('[data-glide-selected]');
      for (var i = 0; i < old.length; i++) {
        old[i].removeAttribute('data-glide-selected');
      }
      selected = null;
      window.parent.postMessage({ type: 'glide:clear-selection' }, '*');
    }
  }, true);

  window.addEventListener('message', function(e) {
    if (!e.data) return;
    if (e.data.type === 'glide:select-element-by-id') {
      var el = document.querySelector('[data-gl-source="' + e.data.id + '"]');
      var isShift = e.data.isShift;
      if (el) {
        if (!isShift) {
          var old = document.querySelectorAll('[data-glide-selected]');
          for (var i = 0; i < old.length; i++) {
            old[i].removeAttribute('data-glide-selected');
          }
        }
        
        if (isShift && el.hasAttribute('data-glide-selected')) {
          el.removeAttribute('data-glide-selected');
          sendMsg('glide:element-deselected', el, isShift);
          selected = document.querySelector('[data-glide-selected]');
        } else {
          selected = el;
          el.setAttribute('data-glide-selected', '');
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          sendMsg('glide:element-selected', el, isShift);
        }
      }
    }
  });
  document.addEventListener('dragstart', function(e) {
    // Prevent native dragging of buttons, links, images, etc. inside the iframe
    e.preventDefault();
  }, true);

  document.addEventListener('selectstart', function(e) {
    // Prevent text selection highlight during active element dragging
    if (isDragging) {
      e.preventDefault();
    }
  }, true);

  // Sync selection/hover outline on iframe scroll events
  window.addEventListener('scroll', function() {
    if (selected) {
      sendMsg('glide:element-selected', selected);
    }
    if (hovered) {
      sendMsg('glide:element-hovered', hovered);
    }
  }, true);

  // Sync selection/hover outline on window resize events
  window.addEventListener('resize', function() {
    if (selected) {
      sendMsg('glide:element-selected', selected);
    }
    if (hovered) {
      sendMsg('glide:element-hovered', hovered);
    }
  });

  // Watch for HMR updates and DOM structural changes to keep selection/hover overlays perfectly aligned
  if (typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function() {
      // Disconnect observer to avoid recursion from our own DOM mutations
      observer.disconnect();

      // Re-query selection/hover elements if they got replaced in the DOM by HMR
      if (selected) {
        var src = selected.getAttribute('data-gl-source');
        if (src) {
          var newEl = document.querySelector('[data-gl-source="' + src + '"]');
          if (newEl && newEl !== selected) {
            selected = newEl;
            selected.setAttribute('data-glide-selected', '');
          }
        }
        sendMsg('glide:element-selected', selected);
      }
      if (hovered) {
        var src = hovered.getAttribute('data-gl-source');
        if (src) {
          var newEl = document.querySelector('[data-gl-source="' + src + '"]');
          if (newEl && newEl !== hovered) {
            hovered = newEl;
          }
        }
        sendMsg('glide:element-hovered', hovered);
      }

      // Re-observe after mutations are complete
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
  }
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
