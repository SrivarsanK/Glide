import { Plugin } from 'vite';
import * as babel from '@babel/core';
import * as path from 'path';
import * as fs from 'fs';

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
    '[data-glide-selected]{outline:2px solid #38bdf8!important;outline-offset:2px;}',
    'html, body { overflow: hidden !important; height: auto !important; }',
    
    /* ── Type Classes Standardized Behaviors ── */
    /* Ensure all inline elements with typography type classes flow as inline-block for precise boundaries & dragging */
    'span[data-gl-source], strong[data-gl-source], em[data-gl-source], a[data-gl-source], label[data-gl-source] { display: inline-block !important; }',
    'span.highlight, span.stat-value, span.stat-label, span.brand-name, span.brand-icon, span.section-label, span.feature-tag, span.member-tag, a.nav-link { display: inline-block !important; }',
    
    /* ── Stacking Context Bug Bypass ── */
    /* Override background clip when gradient text element (or any of its ancestors) is hovered, selected, positioned, or dragged */
    '.highlight[data-glide-selected], .highlight[data-glide-hover], .highlight[style*="transform"], .highlight[style*="position"], [data-glide-selected] .highlight, [data-glide-hover] .highlight, [style*="transform"] .highlight, [style*="position"] .highlight { -webkit-background-clip: initial !important; background-clip: initial !important; -webkit-text-fill-color: var(--accent, #38bdf8) !important; color: var(--accent, #38bdf8) !important; background: none !important; }',
    '[class*="highlight"][data-glide-selected], [class*="highlight"][data-glide-hover], [class*="highlight"][style*="transform"], [class*="highlight"][style*="position"], [data-glide-selected] [class*="highlight"], [data-glide-hover] [class*="highlight"], [style*="transform"] [class*="highlight"], [style*="position"] [class*="highlight"] { -webkit-background-clip: initial !important; background-clip: initial !important; -webkit-text-fill-color: var(--accent, #38bdf8) !important; color: var(--accent, #38bdf8) !important; background: none !important; }',
    '[class*="gradient"][data-glide-selected], [class*="gradient"][data-glide-hover], [class*="gradient"][style*="transform"], [class*="gradient"][style*="position"], [data-glide-selected] [class*="gradient"], [data-glide-hover] [class*="gradient"], [style*="transform"] [class*="gradient"], [style*="position"] [class*="gradient"] { -webkit-background-clip: initial !important; background-clip: initial !important; -webkit-text-fill-color: var(--accent, #38bdf8) !important; color: var(--accent, #38bdf8) !important; background: none !important; }'
  ].join(' ');
  document.head.appendChild(style);

  var hovered = null;
  var selected = null;

  window.__glide_refresh_selection__ = function() {
    if (selected) {
      sendMsg('glide:element-selected', selected);
    }
  };

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

  var isMarqueeing = false;
  var wasMarqueeing = false;
  var marqueeStartX = 0;
  var marqueeStartY = 0;
  var componentRoots = new Set();

  // ── Snap state ─────────────────────────────────────────────────────────
  // OUR threshold — not Figma's. Figma does not publish its capture radius.
  var OUR_SNAP_THRESHOLD_PX = 4;
  var snapObjectEnabled = true;   // toggled by editor (postMessage)
  var snapPixelEnabled  = true;   // toggled by editor (postMessage)
  var snapDisabledForDrag = false; // true while Ctrl/Cmd is held during a drag
  var dragStartRect = null;        // live rect captured fresh on drag start
  var siblingRects  = [];          // fresh rects of siblings, captured on drag start

  // Compute six snap candidates (left/right/hCenter, top/bottom/vCenter) from a rect.
  function xCandidates(r) {
    return [
      { pos: r.left,                isCenter: false },
      { pos: r.right,               isCenter: false },
      { pos: r.left + r.width / 2,  isCenter: true  },
    ];
  }
  function yCandidates(r) {
    return [
      { pos: r.top,                  isCenter: false },
      { pos: r.bottom,               isCenter: false },
      { pos: r.top + r.height / 2,   isCenter: true  },
    ];
  }
  // Drag element's own snap anchors at the current offset.
  function dragXAnchors(r, dx) {
    return [
      { anchor: r.left  + dx,            isCenter: false },
      { anchor: r.right + dx,            isCenter: false },
      { anchor: r.left  + dx + r.width / 2, isCenter: true },
    ];
  }
  function dragYAnchors(r, dy) {
    return [
      { anchor: r.top    + dy,             isCenter: false },
      { anchor: r.bottom + dy,             isCenter: false },
      { anchor: r.top    + dy + r.height / 2, isCenter: true },
    ];
  }

  // Resolve snap on one axis. Returns { snappedOffset, guidePosition }.
  // No snap fires if no candidate is within threshold (constraint #6).
  function resolveSnapAxis(rawOffset, dragAnchors, sibCands, threshold) {
    var bestDelta = Infinity;
    var bestGuide = null;
    var bestIsCenter = true;
    var bestAnchorOffset = 0;
    for (var i = 0; i < dragAnchors.length; i++) {
      var da = dragAnchors[i];
      for (var j = 0; j < sibCands.length; j++) {
        var cp = sibCands[j];
        var delta = Math.abs(da.anchor - cp.pos);
        if (delta > threshold) continue;
        var currentIsCenter = cp.isCenter; // tie-break by candidate type
        var currentIsEdge   = !currentIsCenter;
        var isBetter = false;
        if (delta < bestDelta) {
          isBetter = true;
        } else if (delta === bestDelta) {
          isBetter = currentIsEdge && bestIsCenter; // edge upgrades center only
        }
        if (isBetter) {
          bestDelta        = delta;
          bestGuide        = cp.pos;
          bestIsCenter     = currentIsCenter;
          bestAnchorOffset = cp.pos - da.anchor;
        }
      }
    }
    return { snappedOffset: bestGuide === null ? rawOffset : rawOffset + bestAnchorOffset, guidePosition: bestGuide };
  }

  // Full object-snap: resolve X and Y independently, return guides.
  function resolveObjectSnap(dragRect, dx, dy, siblings) {
    if (!snapObjectEnabled || snapDisabledForDrag) {
      return { dx: dx, dy: dy, guides: [] };
    }
    var xCands = [];
    var yCands = [];
    for (var i = 0; i < siblings.length; i++) {
      var s = siblings[i];
      xCands = xCands.concat(xCandidates(s));
      yCands = yCands.concat(yCandidates(s));
    }
    var xr = resolveSnapAxis(dx, dragXAnchors(dragRect, dx), xCands, OUR_SNAP_THRESHOLD_PX);
    var yr = resolveSnapAxis(dy, dragYAnchors(dragRect, dy), yCands, OUR_SNAP_THRESHOLD_PX);
    var guides = [];
    if (xr.guidePosition !== null) guides.push({ axis: 'x', position: xr.guidePosition });
    if (yr.guidePosition !== null) guides.push({ axis: 'y', position: yr.guidePosition });
    return { dx: xr.snappedOffset, dy: yr.snappedOffset, guides: guides };
  }

  // Pixel-grid snap — separate final pass (spec constraint #5).
  function resolvePixelGridSnap(x, y) {
    return { x: Math.round(x), y: Math.round(y) };
  }

  // Collect fresh sibling rects from the same parent. Called on drag start.
  function collectSiblingRects(el) {
    var parent = el.parentNode;
    if (!parent) return [];
    var rects = [];
    var children = parent.querySelectorAll('[data-gl-source]');
    for (var i = 0; i < children.length; i++) {
      if (children[i] === el) continue; // skip the dragged element itself
      // Fresh getBoundingClientRect — never cached.
      rects.push(children[i].getBoundingClientRect());
    }
    return rects;
  }

  function resolveSelectTarget(el, isCmdClick) {
    if (isCmdClick) return el;
    var ancestors = [];
    var curr = el;
    while (curr) {
      if (curr.hasAttribute && curr.hasAttribute('data-gl-source')) {
        ancestors.push(curr);
      }
      curr = curr.parentNode;
    }
    var compAncestors = ancestors.filter(function(node) {
      var src = node.getAttribute('data-gl-source');
      return componentRoots.has(src);
    });
    if (compAncestors.length === 0) return el;
    for (var i = compAncestors.length - 1; i >= 0; i--) {
      if (compAncestors[i].hasAttribute('data-glide-selected')) {
        if (i > 0) return compAncestors[i - 1];
        return el;
      }
    }
    return compAncestors[compAncestors.length - 1];
  }

  function rafDragLoop() {
    if (!isDragging || !dragEl) { rafId = null; return; }
    // Compute snap every frame using FRESH rect from dragStartRect (captured on pointerdown).
    // siblingRects are also captured fresh on pointerdown — do not reuse across drags.
    var snap = resolveObjectSnap(dragStartRect, currentDx, currentDy, siblingRects);
    var snappedDx = snap.dx;
    var snappedDy = snap.dy;
    dragEl.style.transform = 'translate(' + snappedDx + 'px, ' + snappedDy + 'px)';
    dragEl.style.zIndex = '9999';
    window.parent.postMessage({ type: 'glide:drag-delta', dx: snappedDx, dy: snappedDy, guides: snap.guides }, '*');
    rafId = requestAnimationFrame(rafDragLoop);
  }

  document.addEventListener('pointerdown', function(e) {
    var target = e.target;
    if (target.nodeType === 3) target = target.parentNode;
    var el = target && target.closest && target.closest('[data-gl-source]');
    var isShift = e.shiftKey || e.ctrlKey || e.metaKey;
    var isCmdClick = e.metaKey || e.ctrlKey;

    if (el) {
      var selectTarget = resolveSelectTarget(el, isCmdClick);
      isDragging = true;
      dragEl = selectTarget;
      startX = e.clientX;
      startY = e.clientY;
      currentDx = 0;
      currentDy = 0;

      if (!isShift) {
        var old = document.querySelectorAll('[data-glide-selected]');
        for (var i = 0; i < old.length; i++) {
          old[i].removeAttribute('data-glide-selected');
        }
      }

      if (isShift && selectTarget.hasAttribute('data-glide-selected')) {
        selectTarget.removeAttribute('data-glide-selected');
        sendMsg('glide:element-deselected', selectTarget, isShift);
        selected = document.querySelector('[data-glide-selected]');
      } else {
        selected = selectTarget;
        selectTarget.setAttribute('data-glide-selected', '');
        sendMsg('glide:element-selected', selectTarget, isShift);
      }

      var cs = window.getComputedStyle(selectTarget);
      initialMarginLeft = parseInt(cs.marginLeft) || 0;
      initialMarginTop = parseInt(cs.marginTop) || 0;
      var styleLeft = cs.left;
      var styleTop = cs.top;
      initialLeft = styleLeft === 'auto' ? 0 : (parseInt(styleLeft) || 0);
      initialTop = styleTop === 'auto' ? 0 : (parseInt(styleTop) || 0);

      selectTarget.style.setProperty('transition', 'none', 'important');
      selectTarget.style.setProperty('transition-property', 'none', 'important');
      // Capture fresh drag rect and sibling rects on drag start — never reused across drags.
      var r = selectTarget.getBoundingClientRect();
      dragStartRect = { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      siblingRects  = collectSiblingRects(selectTarget);
      snapDisabledForDrag = false; // reset; Ctrl/Cmd on pointermove will set this
      selectTarget.setPointerCapture(e.pointerId);

      if (!rafId) rafId = requestAnimationFrame(rafDragLoop);

      window.parent.postMessage({
        type: 'glide:element-drag-start',
        source: selectTarget.getAttribute('data-gl-source'),
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
    } else {
      isMarqueeing = true;
      marqueeStartX = e.clientX;
      marqueeStartY = e.clientY;
      window.parent.postMessage({
        type: 'glide:marquee-start',
        x: marqueeStartX,
        y: marqueeStartY
      }, '*');
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  document.addEventListener('pointermove', function(e) {
    if (isDragging && dragEl) {
      // Ctrl/Cmd held during drag disables object-snap for this entire drag operation
      // (mirrors Figma's documented Ctrl/Cmd override behavior).
      if (e.ctrlKey || e.metaKey) {
        snapDisabledForDrag = true;
      }

      currentDx = e.clientX - startX;
      currentDy = e.clientY - startY;

      if (selected !== dragEl) {
        var old = document.querySelectorAll('[data-glide-selected]');
        for (var i = 0; i < old.length; i++) {
          old[i].removeAttribute('data-glide-selected');
        }
        selected = dragEl;
        dragEl.setAttribute('data-glide-selected', '');
        sendMsg('glide:element-selected', dragEl, false);
      }

      e.preventDefault();
      e.stopPropagation();
    } else if (isMarqueeing) {
      window.parent.postMessage({
        type: 'glide:marquee-move',
        startX: marqueeStartX,
        startY: marqueeStartY,
        x: e.clientX,
        y: e.clientY
      }, '*');
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
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      dragEl.releasePointerCapture(e.pointerId);

      // Apply snap to get the final snapped deltas.
      var snapResult = resolveObjectSnap(dragStartRect, currentDx, currentDy, siblingRects);
      var finalDx = snapResult.dx;
      var finalDy = snapResult.dy;

      // Pixel-grid snap: separate final pass after object-snap (spec constraint #5).
      if (snapPixelEnabled) {
        var pg = resolvePixelGridSnap(finalDx, finalDy);
        finalDx = pg.x;
        finalDy = pg.y;
      }

      var finalLeft = initialLeft + finalDx;
      var finalTop  = initialTop  + finalDy;

      // Clear guide lines on drag end.
      window.parent.postMessage({ type: 'glide:snap-guides-clear' }, '*');

      dragEl.style.setProperty('position', 'relative', 'important');
      dragEl.style.setProperty('left', finalLeft + 'px', 'important');
      dragEl.style.setProperty('top', finalTop + 'px', 'important');

      dragEl.style.removeProperty('transition');
      dragEl.style.removeProperty('transition-property');
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
    } else if (isMarqueeing) {
      isMarqueeing = false;
      wasMarqueeing = true;
      setTimeout(function() { wasMarqueeing = false; }, 50);
      var isShift = e.shiftKey || e.ctrlKey || e.metaKey;
      window.parent.postMessage({
        type: 'glide:marquee-end',
        startX: marqueeStartX,
        startY: marqueeStartY,
        endX: e.clientX,
        endY: e.clientY,
        isRightToLeft: (e.clientX < marqueeStartX),
        isShift: isShift
      }, '*');
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
    } else if (!e.target.closest('#glide-context-menu')) {
      if (!wasMarqueeing) {
        var old = document.querySelectorAll('[data-glide-selected]');
        for (var i = 0; i < old.length; i++) {
          old[i].removeAttribute('data-glide-selected');
        }
        selected = null;
        window.parent.postMessage({ type: 'glide:clear-selection' }, '*');
      }
    }
  }, true);

  document.addEventListener('dblclick', function(e) {
    var target = e.target;
    if (target.nodeType === 3) target = target.parentNode;
    var el = target && target.closest && target.closest('[data-gl-source]');
    if (el) {
      e.preventDefault();
      e.stopPropagation();
      var old = document.querySelectorAll('[data-glide-selected]');
      for (var i = 0; i < old.length; i++) {
        old[i].removeAttribute('data-glide-selected');
      }
      selected = el;
      el.setAttribute('data-glide-selected', '');
      sendMsg('glide:element-selected', el, false);
    }
  }, true);

  window.addEventListener('message', function(e) {
    if (!e.data) return;
    if (e.data.type === 'glide:update-component-roots') {
      componentRoots = new Set(e.data.roots || []);
    }
    if (e.data.type === 'glide:set-snap-object') {
      snapObjectEnabled = !!e.data.enabled;
    }
    if (e.data.type === 'glide:set-snap-pixel') {
      snapPixelEnabled = !!e.data.enabled;
    }
    if (e.data.type === 'glide:select-marquee') {
      var x = e.data.x;
      var y = e.data.y;
      var w = e.data.w;
      var h = e.data.h;
      var isRightToLeft = e.data.isRightToLeft;
      var isShift = e.data.isShift;
      var elements = document.querySelectorAll('[data-gl-source]');
      var newSelections = [];
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        var elRect = el.getBoundingClientRect();
        if (isRightToLeft) {
          var overlaps = !(elRect.left > x + w || elRect.right < x || elRect.top > y + h || elRect.bottom < y);
          if (overlaps) {
            newSelections.push(el.getAttribute('data-gl-source'));
          }
        } else {
          var enclosed = (elRect.left >= x && elRect.right <= x + w && elRect.top >= y && elRect.bottom <= y + h);
          if (enclosed) {
            newSelections.push(el.getAttribute('data-gl-source'));
          }
        }
      }
      if (!isShift) {
        var old = document.querySelectorAll('[data-glide-selected]');
        for (var i = 0; i < old.length; i++) {
          old[i].removeAttribute('data-glide-selected');
        }
      }
      newSelections.forEach(function(src) {
        var el = document.querySelector('[data-gl-source="' + src + '"]');
        if (el) {
          el.setAttribute('data-glide-selected', '');
        }
      });
      var allSelected = document.querySelectorAll('[data-glide-selected]');
      if (allSelected.length > 0) {
        window.parent.postMessage({ type: 'glide:clear-selection' }, '*');
        for (var i = 0; i < allSelected.length; i++) {
          sendMsg('glide:element-selected', allSelected[i], true);
        }
      } else if (!isShift) {
        window.parent.postMessage({ type: 'glide:clear-selection' }, '*');
      }
    }
    if (e.data.type === 'glide:select-elements-batch') {
      var sources = e.data.sources || [];
      var isShift = e.data.isShift;
      if (!isShift) {
        var old = document.querySelectorAll('[data-glide-selected]');
        for (var i = 0; i < old.length; i++) {
          old[i].removeAttribute('data-glide-selected');
        }
      }
      sources.forEach(function(src) {
        var el = document.querySelector('[data-gl-source="' + src + '"]');
        if (el) {
          el.setAttribute('data-glide-selected', '');
        }
      });
      var allSelected = document.querySelectorAll('[data-glide-selected]');
      if (allSelected.length > 0) {
        window.parent.postMessage({ type: 'glide:clear-selection' }, '*');
        for (var i = 0; i < allSelected.length; i++) {
          sendMsg('glide:element-selected', allSelected[i], true);
        }
      } else if (!isShift) {
        window.parent.postMessage({ type: 'glide:clear-selection' }, '*');
      }
    }
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
    if (e.data.type === 'glide:clear-selection') {
      var old = document.querySelectorAll('[data-glide-selected]');
      for (var i = 0; i < old.length; i++) {
        old[i].removeAttribute('data-glide-selected');
      }
      selected = null;
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

      // If we are actively dragging, skip sending style and layout updates to the parent editor
      // to prevent layout thrashing, lagging, and screen flashing.
      if (isDragging) {
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true
        });
        return;
      }

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

    
  // Post document height back to parent on load, resize, and DOM mutations
  var lastHeight = 0;
  function sendHeight() {
    var h = document.body ? document.body.scrollHeight : 0;
    if (h && h !== lastHeight) {
      lastHeight = h;
      window.parent.postMessage({ type: 'glide:document-height', height: h }, '*');
    }
  }
  window.addEventListener('load', sendHeight);
  window.addEventListener('resize', sendHeight);
  if (typeof ResizeObserver !== 'undefined' && document.body) {
    new ResizeObserver(sendHeight).observe(document.body);
  }
  setInterval(sendHeight, 500);

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
  let viteServer: any = null;

  /**
   * Build CSS rules from glide-positions.json for the current root.
   * Each entry maps a data-gl-source value to position styles.
   */
  function buildPositionCSS(): string {
    const posFile = path.join(rootDir, 'glide-positions.json');
    if (!fs.existsSync(posFile)) return '';
    try {
      const positions: Record<string, Record<string, string>> = JSON.parse(
        fs.readFileSync(posFile, 'utf-8')
      );
      return Object.entries(positions)
        .map(([sourceId, styles]) => {
          const escapedId = sourceId.replace(/\\/g, '/').replace(/"/g, '\\"');
          const styleStr = Object.entries(styles)
            .map(([k, v]) => {
              const prop = k.replace(/([A-Z])/g, '-$1').toLowerCase();
              return `${prop}:${v}!important`;
            })
            .join(';');
          return `[data-gl-source="${escapedId}"]{${styleStr}}`;
        })
        .join('\n');
    } catch {
      return '';
    }
  }

  return {
    name: 'vite-plugin-glide-source-stamping',
    enforce: 'pre',

    configResolved(config) {
      isDev = config.command === 'serve';
      rootDir = config.root || process.cwd();
      mainEntryInjected = false;
    },

    configureServer(server) {
      viteServer = server;
      // Watch glide-positions.json for changes
      const posFile = path.join(rootDir, 'glide-positions.json');
      // Use chokidar (available from Vite) to watch the file
      server.watcher.add(posFile);
      
      const handlePositionsChange = (changedFile: string) => {
        const normChanged = changedFile.replace(/\\/g, '/').toLowerCase();
        const normPosFile = posFile.replace(/\\/g, '/').toLowerCase();
        if (normChanged === normPosFile) {
          // Send a custom HMR event with the updated CSS — no React reload needed
          const css = buildPositionCSS();
          server.ws.send({
            type: 'custom',
            event: 'glide:positions-updated',
            data: { css }
          });
        }
      };

      server.watcher.on('add', handlePositionsChange);
      server.watcher.on('change', handlePositionsChange);
    },

    /**
     * Inject the bridge script and position CSS injector as inline script tags into index.html.
     * This runs entirely in the browser with no Node.js imports.
     */
    transformIndexHtml(html) {
      if (!isDev) return html;
      const initialCSS = buildPositionCSS();
      const positionInjector = `<script>
(function() {
  var styleEl = document.createElement('style');
  styleEl.id = '__glide_positions__';
  styleEl.textContent = ${JSON.stringify(initialCSS)};
  document.head.appendChild(styleEl);

  // Listen for position updates from the Vite HMR websocket
  if (import.meta && import.meta.hot) {
    import.meta.hot.on('glide:positions-updated', function(data) {
      var el = document.getElementById('__glide_positions__');
      if (el) el.textContent = data.css;
    });
  }
})();
</script>`;
      const initialStyle = `<style id="__glide_positions__">${initialCSS}</style>`;
      return html.replace(
        '<head>',
        `<head>${initialStyle}<script>${BRIDGE_SCRIPT}<\/script>`
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
      const hmrInjection = `
if (import.meta.hot && !window.__glide_hmr_registered__) {
  window.__glide_hmr_registered__ = true;
  import.meta.hot.on('glide:positions-updated', function(data) {
    var el = document.getElementById('__glide_positions__');
    if (el) el.textContent = data.css;
    
    // Defer clearing inline styles by 2 frames to ensure the browser has parsed the new CSS and rendered it.
    // This eliminates the visual snap-back/flashing caused by removing inline styles before style recalculation completes.
    var raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : function(cb) { setTimeout(cb, 16); };
    raf(function() {
      raf(function() {
        var elements = document.querySelectorAll('[data-gl-source]');
        for (var i = 0; i < elements.length; i++) {
          var item = elements[i];
          item.style.removeProperty('left');
          item.style.removeProperty('top');
          item.style.removeProperty('position');
        }
      });
    });

    if (typeof window.__glide_refresh_selection__ === 'function') {
      setTimeout(window.__glide_refresh_selection__, 0);
    }
  });
}
`;
      return {
        code: (result.code ?? code) + hmrInjection,
        map: result.map,
      };
    },
  };
}
