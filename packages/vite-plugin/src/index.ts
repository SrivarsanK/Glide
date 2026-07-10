import { Plugin } from 'vite';
import * as babel from '@babel/core';
import * as path from 'path';
import * as fs from 'fs';
import glideSourceStampingPlugin from '@srivarsank/babel-plugin';
import { loadConfigFromDisk, DEFAULT_CONFIG, type GlideConfig } from '@srivarsank/core';

function normalizePath(filePath: string, rootDir: string): string {
  const relativePath = path.relative(rootDir, filePath);
  return relativePath.replace(/\\/g, '/');
}

/**
 * Inline bridge script injected into the browser — zero Node.js dependencies.
 * This is a self-contained IIFE that registers hover/click handlers and
 * posts messages to the parent Glide editor window.
 * @param sourceAttr  data attribute stamped on each element (e.g. 'data-gl-source')
 * @param hoverAttr   data attribute for hover state
 * @param selectedAttr data attribute for selected state
 * @param snapThresholdPx pixel radius for snap-to-object
 */
function buildBridgeScript(
  sourceAttr: string,
  hoverAttr: string,
  selectedAttr: string,
  snapThresholdPx: number
): string {
  return `
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
    '[${hoverAttr}]{outline:2px solid rgba(56,189,248,0.6)!important;outline-offset:1px;}',
    '[${selectedAttr}]{outline:2px solid #38bdf8!important;outline-offset:2px;}',
    'html, body { overflow: auto !important; height: auto !important; -ms-overflow-style: none !important; scrollbar-width: none !important; } html::-webkit-scrollbar, body::-webkit-scrollbar { display: none !important; }',
    
    /* ── Type Classes Standardized Behaviors ── */
    /* Ensure all inline elements with typography type classes flow as inline-block for precise boundaries & dragging */
    'span[${sourceAttr}], strong[${sourceAttr}], em[${sourceAttr}], a[${sourceAttr}], label[${sourceAttr}] { display: inline-block !important; }',
    'span.highlight, span.stat-value, span.stat-label, span.brand-name, span.brand-icon, span.section-label, span.feature-tag, span.member-tag, a.nav-link { display: inline-block !important; }',
    
    /* ── Stacking Context Bug Bypass ── */
    /* Override background clip when gradient text element (or any of its ancestors) is hovered, selected, positioned, dragged, or styled with opacity/filter/mix-blend-mode */
    '.highlight[data-glide-selected], .highlight[data-glide-hover], .highlight[style*="transform"], .highlight[style*="position"], .highlight[style*="opacity"], .highlight[style*="filter"], .highlight[style*="mix-blend-mode"], [data-glide-selected] .highlight, [data-glide-hover] .highlight, [style*="transform"] .highlight, [style*="position"] .highlight, [style*="opacity"] .highlight, [style*="filter"] .highlight, [style*="mix-blend-mode"] .highlight { -webkit-background-clip: initial !important; background-clip: initial !important; -webkit-text-fill-color: var(--accent, #38bdf8) !important; color: var(--accent, #38bdf8) !important; background: none !important; }',
    '[class*="highlight"][data-glide-selected], [class*="highlight"][data-glide-hover], [class*="highlight"][style*="transform"], [class*="highlight"][style*="position"], [class*="highlight"][style*="opacity"], [class*="highlight"][style*="filter"], [class*="highlight"][style*="mix-blend-mode"], [data-glide-selected] [class*="highlight"], [data-glide-hover] [class*="highlight"], [style*="transform"] [class*="highlight"], [style*="position"] [class*="highlight"], [style*="opacity"] [class*="highlight"], [style*="filter"] [class*="highlight"], [style*="mix-blend-mode"] [class*="highlight"] { -webkit-background-clip: initial !important; background-clip: initial !important; -webkit-text-fill-color: var(--accent, #38bdf8) !important; color: var(--accent, #38bdf8) !important; background: none !important; }',
    '[class*="gradient"][data-glide-selected], [class*="gradient"][data-glide-hover], [class*="gradient"][style*="transform"], [class*="gradient"][style*="position"], [class*="gradient"][style*="opacity"], [class*="gradient"][style*="filter"], [class*="gradient"][style*="mix-blend-mode"], [data-glide-selected] [class*="gradient"], [data-glide-hover] [class*="gradient"], [style*="transform"] [class*="gradient"], [style*="position"] [class*="gradient"], [style*="opacity"] [class*="gradient"], [style*="filter"] [class*="gradient"], [style*="mix-blend-mode"] [class*="gradient"] { -webkit-background-clip: initial !important; background-clip: initial !important; -webkit-text-fill-color: var(--accent, #38bdf8) !important; color: var(--accent, #38bdf8) !important; background: none !important; }'
  ].join(' ');
  document.head.appendChild(style);

  var hovered = null;
  var selected = null;
  var readyStateSent = false;
  var readyInterval = null;

  function sendReadyState() {
    if (readyStateSent) return;
    var el = document.querySelector('[${sourceAttr}]');
    if (el) {
      var src = el.getAttribute('${sourceAttr}');
      if (src) {
        window.parent.postMessage({ type: 'glide:ready', source: src }, '*');
        readyStateSent = true;
        if (readyInterval) {
          clearInterval(readyInterval);
          readyInterval = null;
        }
      }
    }
  }

  window.__glide_refresh_selection__ = function() {
    if (selected) {
      sendMsg('glide:element-selected', selected);
    }
  };

  window.__glide_update_selection_node__ = function() {
    var all = document.querySelectorAll('[${sourceAttr}]');
    if (selected) {
      var src = selected.getAttribute('${sourceAttr}');
      if (src) {
        for (var i = 0; i < all.length; i++) {
          if (all[i].getAttribute('${sourceAttr}') === src) {
            selected = all[i];
            selected.setAttribute('${selectedAttr}', '');
            break;
          }
        }
      }
    }
    if (hovered) {
      var src = hovered.getAttribute('${sourceAttr}');
      if (src) {
        for (var i = 0; i < all.length; i++) {
          if (all[i].getAttribute('${sourceAttr}') === src) {
            hovered = all[i];
            break;
          }
        }
      }
    }
  };

  function sendMsg(type, el, isShift) {
    var src = el.getAttribute('${sourceAttr}') || '';
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
      left: cs.left,
      flex: cs.flex,
      flexGrow: cs.flexGrow,
      alignSelf: cs.alignSelf
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
      computedStyles: computedStyles,
      textContent: (function() {
        // Only allow text editing for leaf text nodes (no child element nodes)
        if (el.children && el.children.length > 0) return undefined;
        // Collect only direct JSXText children (not text from nested elements)
        var directText = '';
        el.childNodes.forEach(function(n) {
          if (n.nodeType === 3) {
            directText += n.textContent;
          }
        });
        return directText.trim();
      })()
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
  var OUR_SNAP_THRESHOLD_PX = ${snapThresholdPx};
  var snapObjectEnabled = true;   // toggled by editor (postMessage)
  var snapPixelEnabled  = true;   // toggled by editor (postMessage)
  var gridVisible       = false;  // toggled by editor (postMessage)
  var snapDisabledForDrag = false; // true while Ctrl/Cmd is held during a drag
  var dragStartRect = null;        // live rect captured fresh on drag start
  var siblingRects  = [];          // fresh rects of siblings, captured on drag start
  var userGuides    = [];          // synchronized user-created ruler guides

  // Compute six snap candidates (left/right/hCenter, top/bottom/vCenter) from a rect.
  function xCandidates(r) {
    return [
      { pos: r.left,                isCenter: false, rect: r },
      { pos: r.right,               isCenter: false, rect: r },
      { pos: r.left + r.width / 2,  isCenter: true,  rect: r },
    ];
  }
  function yCandidates(r) {
    return [
      { pos: r.top,                  isCenter: false, rect: r },
      { pos: r.bottom,               isCenter: false, rect: r },
      { pos: r.top + r.height / 2,   isCenter: true,  rect: r },
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

  // Resolve snap on one axis. Returns { snappedOffset, guidePosition, rect }.
  // No snap fires if no candidate is within threshold (constraint #6).
  function resolveSnapAxis(rawOffset, dragAnchors, sibCands, threshold) {
    var bestDelta = Infinity;
    var bestGuide = null;
    var bestIsCenter = true;
    var bestAnchorOffset = 0;
    var bestRect = null;
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
          bestRect         = cp.rect;
        }
      }
    }
    return { snappedOffset: bestGuide === null ? rawOffset : rawOffset + bestAnchorOffset, guidePosition: bestGuide, rect: bestRect };
  }

  function findHorizontalGaps(siblings) {
    var gaps = [];
    var sorted = siblings.slice().sort(function(a, b) { return a.left - b.left; });
    for (var i = 0; i < sorted.length - 1; i++) {
      var a = sorted[i];
      var b = sorted[i+1];
      var overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (overlap > 0) {
        var gap = b.left - a.right;
        if (gap > 0 && gap < 500) {
          gaps.push({ type: 'h', a: a, b: b, size: gap });
        }
      }
    }
    return gaps;
  }

  function findVerticalGaps(siblings) {
    var gaps = [];
    var sorted = siblings.slice().sort(function(a, b) { return a.top - b.top; });
    for (var i = 0; i < sorted.length - 1; i++) {
      var a = sorted[i];
      var b = sorted[i+1];
      var overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      if (overlap > 0) {
        var gap = b.top - a.bottom;
        if (gap > 0 && gap < 500) {
          gaps.push({ type: 'v', a: a, b: b, size: gap });
        }
      }
    }
    return gaps;
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
    for (var i = 0; i < userGuides.length; i++) {
      var ug = userGuides[i];
      if (ug.axis === 'x') {
        xCands.push({ pos: ug.position, isCenter: false, rect: null });
      } else {
        yCands.push({ pos: ug.position, isCenter: false, rect: null });
      }
    }
    var xr = resolveSnapAxis(dx, dragXAnchors(dragRect, dx), xCands, OUR_SNAP_THRESHOLD_PX);
    var yr = resolveSnapAxis(dy, dragYAnchors(dragRect, dy), yCands, OUR_SNAP_THRESHOLD_PX);
    
    var guides = [];
    var snappedDx = xr.snappedOffset;
    var snappedDy = yr.snappedOffset;

    // Horizontal Gap Snapping
    var hGaps = findHorizontalGaps(siblings);
    var bestHGapDelta = OUR_SNAP_THRESHOLD_PX;
    var snappedHGapDx = null;
    var hGapGuide = null;

    for (var i = 0; i < hGaps.length; i++) {
      var gap = hGaps[i];
      if (dragRect.left + dx > gap.b.right - 20) {
        var targetLeft = gap.b.right + gap.size;
        var delta = Math.abs((dragRect.left + dx) - targetLeft);
        if (delta < bestHGapDelta) {
          bestHGapDelta = delta;
          snappedHGapDx = targetLeft - dragRect.left;
          hGapGuide = {
            type: 'gap-distribution',
            axis: 'x',
            gapSize: gap.size,
            rects: [gap.a, gap.b, { left: targetLeft, right: targetLeft + dragRect.width, top: dragRect.top + dy, bottom: dragRect.bottom + dy }]
          };
        }
      }
      if (gap.a.left > dragRect.right + dx - 20) {
        var targetRight = gap.a.left - gap.size;
        var delta = Math.abs((dragRect.right + dx) - targetRight);
        if (delta < bestHGapDelta) {
          bestHGapDelta = delta;
          snappedHGapDx = targetRight - dragRect.right;
          hGapGuide = {
            type: 'gap-distribution',
            axis: 'x',
            gapSize: gap.size,
            rects: [{ left: targetRight - dragRect.width, right: targetRight, top: dragRect.top + dy, bottom: dragRect.bottom + dy }, gap.a, gap.b]
          };
        }
      }
    }

    // Vertical Gap Snapping
    var vGaps = findVerticalGaps(siblings);
    var bestVGapDelta = OUR_SNAP_THRESHOLD_PX;
    var snappedVGapDy = null;
    var vGapGuide = null;

    for (var i = 0; i < vGaps.length; i++) {
      var gap = vGaps[i];
      if (dragRect.top + dy > gap.b.bottom - 20) {
        var targetTop = gap.b.bottom + gap.size;
        var delta = Math.abs((dragRect.top + dy) - targetTop);
        if (delta < bestVGapDelta) {
          bestVGapDelta = delta;
          snappedVGapDy = targetTop - dragRect.top;
          vGapGuide = {
            type: 'gap-distribution',
            axis: 'y',
            gapSize: gap.size,
            rects: [gap.a, gap.b, { left: dragRect.left + dx, right: dragRect.right + dx, top: targetTop, bottom: targetTop + dragRect.height }]
          };
        }
      }
      if (gap.a.top > dragRect.bottom + dy - 20) {
        var targetBottom = gap.a.top - gap.size;
        var delta = Math.abs((dragRect.bottom + dy) - targetBottom);
        if (delta < bestVGapDelta) {
          bestVGapDelta = delta;
          snappedVGapDy = targetBottom - dragRect.bottom;
          vGapGuide = {
            type: 'gap-distribution',
            axis: 'y',
            gapSize: gap.size,
            rects: [{ left: dragRect.left + dx, right: dragRect.right + dx, top: targetBottom - dragRect.height, bottom: targetBottom }, gap.a, gap.b]
          };
        }
      }
    }

    if (xr.guidePosition !== null) {
      if (xr.rect) {
        for (var i = 0; i < siblings.length; i++) {
          var s = siblings[i];
          var cands = xCandidates(s);
          for (var j = 0; j < cands.length; j++) {
            if (Math.abs(cands[j].pos - xr.guidePosition) < 0.1) {
              var y1 = Math.min(dragRect.top + snappedDy, s.top);
              var y2 = Math.max(dragRect.bottom + snappedDy, s.bottom);
              guides.push({
                type: 'snap-line',
                x1: xr.guidePosition,
                y1: y1,
                x2: xr.guidePosition,
                y2: y2
              });
            }
          }
        }
      } else {
        guides.push({
          type: 'snap-line',
          axis: 'x',
          position: xr.guidePosition
        });
      }
    } else if (snappedHGapDx !== null) {
      snappedDx = snappedHGapDx;
      var r0 = hGapGuide.rects[0];
      var r1 = hGapGuide.rects[1];
      var r2 = hGapGuide.rects[2];
      var midY01 = (Math.max(r0.top, r1.top) + Math.min(r0.bottom, r1.bottom))/2;
      var midY12 = (Math.max(r1.top, r2.top) + Math.min(r1.bottom, r2.bottom))/2;
      
      guides.push({
        type: 'distance-indicator',
        x1: r0.right,
        y1: midY01,
        x2: r1.left,
        y2: midY01,
        text: Math.round(hGapGuide.gapSize) + 'px'
      });
      guides.push({
        type: 'distance-indicator',
        x1: r1.right,
        y1: midY12,
        x2: r2.left + snappedDx,
        y2: midY12,
        text: Math.round(hGapGuide.gapSize) + 'px'
      });
    }

    if (yr.guidePosition !== null) {
      if (yr.rect) {
        for (var i = 0; i < siblings.length; i++) {
          var s = siblings[i];
          var cands = yCandidates(s);
          for (var j = 0; j < cands.length; j++) {
            if (Math.abs(cands[j].pos - yr.guidePosition) < 0.1) {
              var x1 = Math.min(dragRect.left + snappedDx, s.left);
              var x2 = Math.max(dragRect.right + snappedDx, s.right);
              guides.push({
                type: 'snap-line',
                x1: x1,
                y1: yr.guidePosition,
                x2: x2,
                y2: yr.guidePosition
              });
            }
          }
        }
      } else {
        guides.push({
          type: 'snap-line',
          axis: 'y',
          position: yr.guidePosition
        });
      }
    } else if (snappedVGapDy !== null) {
      snappedDy = snappedVGapDy;
      var r0 = vGapGuide.rects[0];
      var r1 = vGapGuide.rects[1];
      var r2 = vGapGuide.rects[2];
      var midX01 = (Math.max(r0.left, r1.left) + Math.min(r0.right, r1.right))/2;
      var midX12 = (Math.max(r1.left, r2.left) + Math.min(r1.right, r2.right))/2;

      guides.push({
        type: 'distance-indicator',
        x1: midX01,
        y1: r0.bottom,
        x2: midX01,
        y2: r1.top,
        text: Math.round(vGapGuide.gapSize) + 'px'
      });
      guides.push({
        type: 'distance-indicator',
        x1: midX12,
        y1: r1.bottom,
        x2: midX12,
        y2: r2.top + snappedDy,
        text: Math.round(vGapGuide.gapSize) + 'px'
      });
    }

    // Adjacent distance indicators (only if not snapped to gaps)
    if (snappedHGapDx === null && snappedVGapDy === null) {
      for (var i = 0; i < siblings.length; i++) {
        var s = siblings[i];
        // Check horizontal alignment
        var dTop = Math.abs((dragRect.top + snappedDy) - s.top);
        var dBottom = Math.abs((dragRect.bottom + snappedDy) - s.bottom);
        if (dTop < 2 || dBottom < 2) {
          if (dragRect.left + snappedDx > s.right) {
            var gap = (dragRect.left + snappedDx) - s.right;
            if (gap > 0 && gap < 120) {
              var midY = (dragRect.top + dragRect.bottom)/2 + snappedDy;
              guides.push({
                type: 'distance-indicator',
                x1: s.right,
                y1: midY,
                x2: dragRect.left + snappedDx,
                y2: midY,
                text: Math.round(gap) + 'px'
              });
            }
          } else if (s.left > dragRect.right + snappedDx) {
            var gap = s.left - (dragRect.right + snappedDx);
            if (gap > 0 && gap < 120) {
              var midY = (dragRect.top + dragRect.bottom)/2 + snappedDy;
              guides.push({
                type: 'distance-indicator',
                x1: dragRect.right + snappedDx,
                y1: midY,
                x2: s.left,
                y2: midY,
                text: Math.round(gap) + 'px'
              });
            }
          }
        }

        // Check vertical alignment
        var dLeft = Math.abs((dragRect.left + snappedDx) - s.left);
        var dRight = Math.abs((dragRect.right + snappedDx) - s.right);
        if (dLeft < 2 || dRight < 2) {
          if (dragRect.top + snappedDy > s.bottom) {
            var gap = (dragRect.top + snappedDy) - s.bottom;
            if (gap > 0 && gap < 120) {
              var midX = (dragRect.left + dragRect.right)/2 + snappedDx;
              guides.push({
                type: 'distance-indicator',
                x1: midX,
                y1: s.bottom,
                x2: midX,
                y2: dragRect.top + snappedDy,
                text: Math.round(gap) + 'px'
              });
            }
          } else if (s.top > dragRect.bottom + snappedDy) {
            var gap = s.top - (dragRect.bottom + snappedDy);
            if (gap > 0 && gap < 120) {
              var midX = (dragRect.left + dragRect.right)/2 + snappedDx;
              guides.push({
                type: 'distance-indicator',
                x1: midX,
                y1: dragRect.bottom + snappedDy,
                x2: midX,
                y2: s.top,
                text: Math.round(gap) + 'px'
              });
            }
          }
        }
      }
    }

    return { dx: snappedDx, dy: snappedDy, guides: guides };
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
    if (parent && parent.getBoundingClientRect && parent.tagName.toLowerCase() !== 'body' && parent.tagName.toLowerCase() !== 'html') {
      rects.push(parent.getBoundingClientRect());
    }
    var children = parent.querySelectorAll('[${sourceAttr}]');
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
      if (curr.hasAttribute && curr.hasAttribute('${sourceAttr}')) {
        ancestors.push(curr);
      }
      curr = curr.parentNode;
    }
    var compAncestors = ancestors.filter(function(node) {
      var src = node.getAttribute('${sourceAttr}');
      return componentRoots.has(src);
    });
    if (compAncestors.length === 0) return el;
    for (var i = compAncestors.length - 1; i >= 0; i--) {
      if (compAncestors[i].hasAttribute('${selectedAttr}')) {
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
    
    if (!snapDisabledForDrag) {
      if (gridVisible) {
        var rawLeft = initialLeft + snappedDx;
        var rawTop = initialTop + snappedDy;
        var snapL = Math.round(rawLeft / 8) * 8;
        var snapT = Math.round(rawTop / 8) * 8;
        snappedDx = snapL - initialLeft;
        snappedDy = snapT - initialTop;
      } else if (snapPixelEnabled) {
        var rawLeft = initialLeft + snappedDx;
        var rawTop = initialTop + snappedDy;
        var snapL = Math.round(rawLeft);
        var snapT = Math.round(rawTop);
        snappedDx = snapL - initialLeft;
        snappedDy = snapT - initialTop;
      }
    }
    
    dragEl.style.transform = 'translate(' + snappedDx + 'px, ' + snappedDy + 'px)';
    dragEl.style.zIndex = '9999';
    window.parent.postMessage({ type: 'glide:drag-delta', dx: snappedDx, dy: snappedDy, guides: snap.guides }, '*');
    rafId = requestAnimationFrame(rafDragLoop);
  }

  document.addEventListener('pointerdown', function(e) {
    if (e.target.contentEditable === 'true' || e.target.closest('[contenteditable="true"]')) {
      return;
    }
    var target = e.target;
    if (target.nodeType === 3) target = target.parentNode;
    var el = target && target.closest && target.closest('[${sourceAttr}]');
    var isShift = e.shiftKey || e.ctrlKey || e.metaKey;
    var isCmdClick = e.metaKey || e.ctrlKey;

    if (el) {
      // Clear hover when starting a drag
      if (hovered) {
        hovered.removeAttribute('${hoverAttr}');
        hovered = null;
        window.parent.postMessage({ type: 'glide:element-hover-exit' }, '*');
      }

      var selectTarget = resolveSelectTarget(el, isCmdClick);
      isDragging = true;
      dragEl = selectTarget;
      startX = e.clientX;
      startY = e.clientY;
      currentDx = 0;
      currentDy = 0;

      if (!isShift) {
        var old = document.querySelectorAll('[${selectedAttr}]');
        for (var i = 0; i < old.length; i++) {
          old[i].removeAttribute('${selectedAttr}');
        }
      }

      if (isShift && selectTarget.hasAttribute('${selectedAttr}')) {
        selectTarget.removeAttribute('${selectedAttr}');
        sendMsg('glide:element-deselected', selectTarget, isShift);
        selected = document.querySelector('[${selectedAttr}]');
      } else {
        selected = selectTarget;
        selectTarget.setAttribute('${selectedAttr}', '');
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
        source: selectTarget.getAttribute('${sourceAttr}'),
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
      // Clear hover when starting a marquee selection
      if (hovered) {
        hovered.removeAttribute('${hoverAttr}');
        hovered = null;
        window.parent.postMessage({ type: 'glide:element-hover-exit' }, '*');
      }

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
      // Ctrl/Cmd held during drag disables object-snap dynamically
      // (mirrors Figma's documented Ctrl/Cmd override behavior).
      snapDisabledForDrag = !!(e.ctrlKey || e.metaKey);

      currentDx = e.clientX - startX;
      currentDy = e.clientY - startY;

      if (selected !== dragEl) {
        var old = document.querySelectorAll('[${selectedAttr}]');
        for (var i = 0; i < old.length; i++) {
          old[i].removeAttribute('${selectedAttr}');
        }
        selected = dragEl;
        dragEl.setAttribute('${selectedAttr}', '');
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
      var el = target && target.closest && target.closest('[${sourceAttr}]');
      if (el) {
        if (hovered !== el) {
          if (hovered) hovered.removeAttribute('${hoverAttr}');
          hovered = el;
          el.setAttribute('${hoverAttr}', '');
          sendMsg('glide:element-hovered', el);
        }
      } else if (hovered) {
        hovered.removeAttribute('${hoverAttr}');
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
      if (!snapDisabledForDrag) {
        if (gridVisible) {
          var rawLeft = initialLeft + finalDx;
          var rawTop = initialTop + finalDy;
          var snapL = Math.round(rawLeft / 8) * 8;
          var snapT = Math.round(rawTop / 8) * 8;
          finalDx = snapL - initialLeft;
          finalDy = snapT - initialTop;
        } else if (snapPixelEnabled) {
          var rawLeft = initialLeft + finalDx;
          var rawTop = initialTop + finalDy;
          var snapL = Math.round(rawLeft);
          var snapT = Math.round(rawTop);
          finalDx = snapL - initialLeft;
          finalDy = snapT - initialTop;
        }
      }

      var finalLeft = initialLeft + finalDx;
      var finalTop  = initialTop  + finalDy;

      // Clear guide lines on drag end.
      window.parent.postMessage({ type: 'glide:snap-guides-clear' }, '*');

      dragEl.style.setProperty('position', 'relative', 'important');
      dragEl.style.setProperty('left', finalLeft + 'px', 'important');
      dragEl.style.setProperty('top', finalTop + 'px', 'important');
      dragEl.style.transform = '';
      dragEl.style.zIndex = '';

      var finalR = dragEl.getBoundingClientRect();
      var elForTransition = dragEl;
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          if (elForTransition) {
            elForTransition.style.removeProperty('transition');
            elForTransition.style.removeProperty('transition-property');
          }
        });
      });

      window.parent.postMessage({
        type: 'glide:element-drag-end',
        source: dragEl.getAttribute('${sourceAttr}'),
        dx: finalLeft,
        dy: finalTop,
        rect: {
          x: finalR.left,
          y: finalR.top,
          width: finalR.width,
          height: finalR.height
        }
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

  document.addEventListener('contextmenu', function(e) {
    var target = e.target;
    while (target && target !== document.documentElement) {
      if (target.hasAttribute && target.hasAttribute('${sourceAttr}')) {
        e.preventDefault();
        window.parent.postMessage({
          type: 'glide:contextmenu',
          source: target.getAttribute('${sourceAttr}'),
          clientX: e.clientX,
          clientY: e.clientY
        }, '*');
        return;
      }
      target = target.parentNode || target.parentElement;
    }
  }, true);

  document.addEventListener('click', function(e) {
    var target = e.target;
    if (target.nodeType === 3) target = target.parentNode;
    var el = target && target.closest && target.closest('[${sourceAttr}]');
    var isShift = e.shiftKey || e.ctrlKey || e.metaKey;
    if (el) {
      e.preventDefault();
      e.stopPropagation();
    } else if (!e.target.closest('#glide-context-menu')) {
      if (!wasMarqueeing) {
        var old = document.querySelectorAll('[${selectedAttr}]');
        for (var i = 0; i < old.length; i++) {
          old[i].removeAttribute('${selectedAttr}');
        }
        selected = null;
        window.parent.postMessage({ type: 'glide:clear-selection' }, '*');
      }
    }
  }, true);

  document.addEventListener('dblclick', function(e) {
    var target = e.target;
    if (target.nodeType === 3) target = target.parentNode;
    var el = target && target.closest && target.closest('[${sourceAttr}]');
    if (el) {
      e.preventDefault();
      e.stopPropagation();
      var old = document.querySelectorAll('[${selectedAttr}]');
      for (var i = 0; i < old.length; i++) {
        old[i].removeAttribute('${selectedAttr}');
      }
      selected = el;
      el.setAttribute('${selectedAttr}', '');
      sendMsg('glide:element-selected', el, false);

      // Check if this element has direct text node children
      var hasText = false;
      el.childNodes.forEach(function(n) {
        if (n.nodeType === 3 && n.textContent.trim().length > 0) {
          hasText = true;
        }
      });

      if (hasText && (!el.children || el.children.length === 0)) {
        var originalText = el.textContent;
        el.contentEditable = "true";
        el.focus();
        
        // Select all text content
        var range = document.createRange();
        range.selectNodeContents(el);
        var sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }

        // Add visual indicator styling
        var prevOutline = el.style.outline;
        el.style.outline = '2px dashed #38bdf8';
        el.style.outlineOffset = '2px';
        
        window.__glide_inline_editing__ = el;

        var finished = false;
        function commitInlineEdit() {
          if (finished) return;
          finished = true;
          el.contentEditable = "false";
          el.style.outline = prevOutline;
          window.__glide_inline_editing__ = null;
          
          var newText = el.textContent;
          if (newText !== originalText) {
            window.parent.postMessage({
              type: 'glide:text-edited',
              source: el.getAttribute('data-gl-source'),
              value: newText
            }, '*');
          }
        }

        el.addEventListener('blur', function onBlur() {
          commitInlineEdit();
          el.removeEventListener('blur', onBlur);
        });

        el.addEventListener('keydown', function onKeyDown(ev) {
          if (ev.key === 'Enter' && !ev.shiftKey) {
            ev.preventDefault();
            el.blur();
            el.removeEventListener('keydown', onKeyDown);
          }
          if (ev.key === 'Escape') {
            ev.preventDefault();
            el.textContent = originalText;
            el.blur();
            el.removeEventListener('keydown', onKeyDown);
          }
        });
      }
    }
  }, true);

  window.addEventListener('keydown', function(e) {
    if (e.key === 'Alt') {
      window.parent.postMessage({ type: 'glide:alt-state', pressed: true }, '*');
    }
  });
  window.addEventListener('keyup', function(e) {
    if (e.key === 'Alt') {
      window.parent.postMessage({ type: 'glide:alt-state', pressed: false }, '*');
    }
  });

  window.addEventListener('message', function(e) {
    if (!e.data) return;
    if (e.data.type === 'glide:scroll-by') {
      window.scrollBy({
        top: e.data.y,
        left: e.data.x,
        behavior: 'auto'
      });
    }
    if (e.data.type === 'glide:optimistic-text') {
      var el = document.querySelector('[${sourceAttr}="' + e.data.source + '"]');
      if (el) {
        el.textContent = e.data.value;
      }
    }
    if (e.data.type === 'glide:optimistic-style') {
      var el = document.querySelector('[${sourceAttr}="' + e.data.id + '"]');
      if (el) {
        var styles = e.data.styles || {};
        for (var prop in styles) {
          if (styles.hasOwnProperty(prop)) {
            el.style[prop] = styles[prop];
          }
        }
      }
    }
    if (e.data.type === 'glide:resize-start') {
      var el = document.querySelector('[${sourceAttr}="' + e.data.source + '"]');
      if (el) {
        el.style.setProperty('transition', 'none', 'important');
        el.style.setProperty('transition-property', 'none', 'important');
      }
    }
    if (e.data.type === 'glide:resize-end') {
      var el = document.querySelector('[${sourceAttr}="' + e.data.source + '"]');
      if (el) {
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            if (el) {
              el.style.removeProperty('transition');
              el.style.removeProperty('transition-property');
            }
          });
        });
      }
    }
    if (e.data.type === 'glide:update-component-roots') {
      componentRoots = new Set(e.data.roots || []);
    }
    if (e.data.type === 'glide:update-user-guides') {
      userGuides = e.data.guides || [];
    }
    if (e.data.type === 'glide:set-snap-object') {
      snapObjectEnabled = !!e.data.enabled;
    }
    if (e.data.type === 'glide:set-snap-pixel') {
      snapPixelEnabled = !!e.data.enabled;
    }
    if (e.data.type === 'glide:set-grid-visible') {
      gridVisible = !!e.data.enabled;
    }
    if (e.data.type === 'glide:select-marquee') {
      var x = e.data.x;
      var y = e.data.y;
      var w = e.data.w;
      var h = e.data.h;
      var isRightToLeft = e.data.isRightToLeft;
      var isShift = e.data.isShift;
      var elements = document.querySelectorAll('[${sourceAttr}]');
      var newSelections = [];
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        var elRect = el.getBoundingClientRect();
        if (isRightToLeft) {
          var overlaps = !(elRect.left > x + w || elRect.right < x || elRect.top > y + h || elRect.bottom < y);
          if (overlaps) {
            newSelections.push(el.getAttribute('${sourceAttr}'));
          }
        } else {
          var enclosed = (elRect.left >= x && elRect.right <= x + w && elRect.top >= y && elRect.bottom <= y + h);
          if (enclosed) {
            newSelections.push(el.getAttribute('${sourceAttr}'));
          }
        }
      }
      if (!isShift) {
        var old = document.querySelectorAll('[${selectedAttr}]');
        for (var i = 0; i < old.length; i++) {
          old[i].removeAttribute('${selectedAttr}');
        }
      }
      newSelections.forEach(function(src) {
        var el = document.querySelector('[${sourceAttr}="' + src + '"]');
        if (el) {
          el.setAttribute('${selectedAttr}', '');
        }
      });
      var allSelected = document.querySelectorAll('[${selectedAttr}]');
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
        var old = document.querySelectorAll('[${selectedAttr}]');
        for (var i = 0; i < old.length; i++) {
          old[i].removeAttribute('${selectedAttr}');
        }
      }
      sources.forEach(function(src) {
        var el = document.querySelector('[${sourceAttr}="' + src + '"]');
        if (el) {
          el.setAttribute('${selectedAttr}', '');
        }
      });
      var allSelected = document.querySelectorAll('[${selectedAttr}]');
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
      var el = document.querySelector('[${sourceAttr}="' + e.data.id + '"]');
      var isShift = e.data.isShift;
      if (el) {
        if (!isShift) {
          var old = document.querySelectorAll('[${selectedAttr}]');
          for (var i = 0; i < old.length; i++) {
            old[i].removeAttribute('${selectedAttr}');
          }
        }
        if (isShift && el.hasAttribute('${selectedAttr}')) {
          el.removeAttribute('${selectedAttr}');
          sendMsg('glide:element-deselected', el, isShift);
          selected = document.querySelector('[${selectedAttr}]');
        } else {
          selected = el;
          el.setAttribute('${selectedAttr}', '');
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          sendMsg('glide:element-selected', el, isShift);
        }
      }
    }
    if (e.data.type === 'glide:hover-element-by-id') {
      var el = document.querySelector('[${sourceAttr}="' + e.data.id + '"]');
      if (el) {
        if (hovered && hovered !== el) {
          hovered.removeAttribute('${hoverAttr}');
        }
        hovered = el;
        el.setAttribute('${hoverAttr}', '');
        sendMsg('glide:element-hovered', el, false);
      }
    }
    if (e.data.type === 'glide:hover-element-exit') {
      if (hovered) {
        hovered.removeAttribute('${hoverAttr}');
        hovered = null;
      }
      window.parent.postMessage({ type: 'glide:element-hover-exit' }, '*');
    }
    if (e.data.type === 'glide:clear-selection') {
      var old = document.querySelectorAll('[${selectedAttr}]');
      for (var i = 0; i < old.length; i++) {
        old[i].removeAttribute('${selectedAttr}');
      }
      selected = null;
    }
    if (e.data.type === 'glide:refresh-selection') {
      if (window.__glide_refresh_selection__) {
        window.__glide_refresh_selection__();
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

  document.addEventListener('pointerleave', function(e) {
    if (hovered) {
      hovered.removeAttribute('${hoverAttr}');
      hovered = null;
      window.parent.postMessage({ type: 'glide:element-hover-exit' }, '*');
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

  // Real-time selection outline alignment loop
  var lastSentRect = null;
  function updateSelectionLoop() {
    if (selected && !isDragging) {
      var r = selected.getBoundingClientRect();
      if (!lastSentRect ||
          lastSentRect.left !== r.left ||
          lastSentRect.top !== r.top ||
          lastSentRect.width !== r.width ||
          lastSentRect.height !== r.height) {
        lastSentRect = { left: r.left, top: r.top, width: r.width, height: r.height };
        sendMsg('glide:element-selected', selected);
      }
    } else {
      lastSentRect = null;
    }
    requestAnimationFrame(updateSelectionLoop);
  }
  requestAnimationFrame(updateSelectionLoop);

  // Watch for HMR updates and DOM structural changes to keep selection/hover overlays perfectly aligned
  if (typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function() {
      // Disconnect observer to avoid recursion from our own DOM mutations
      observer.disconnect();

      // Check if we can send the ready state now
      sendReadyState();

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
        var src = selected.getAttribute('${sourceAttr}');
        if (src) {
          var newEl = document.querySelector('[${sourceAttr}="' + src + '"]');
          if (newEl && newEl !== selected) {
            selected = newEl;
            selected.setAttribute('${selectedAttr}', '');
          }
        }
        sendMsg('glide:element-selected', selected);
      }
      if (hovered) {
        var src = hovered.getAttribute('${sourceAttr}');
        if (src) {
          var newEl = document.querySelector('[${sourceAttr}="' + src + '"]');
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

  // Start polling to send ready state as soon as elements exist
  readyInterval = setInterval(sendReadyState, 200);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    sendReadyState();
  } else {
    window.addEventListener('DOMContentLoaded', sendReadyState);
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
}

export function glideSourceStamping(): Plugin {
  let isDev = false;
  let rootDir = process.cwd();
  let mainEntryInjected = false;
  let viteServer: any = null;
  let glideConfig: GlideConfig = DEFAULT_CONFIG;
  let bridgeScript: string = buildBridgeScript(
    DEFAULT_CONFIG.sourceAttribute,
    DEFAULT_CONFIG.hoverAttribute,
    DEFAULT_CONFIG.selectedAttribute,
    DEFAULT_CONFIG.snapThresholdPx
  );

  /**
   * Build CSS rules from glide-positions.json for the current root.
   * Each entry maps a data-gl-source value to position styles.
   */
  function buildPositionCSS(sourceAttr = glideConfig.sourceAttribute): string {
    const posFile = path.join(rootDir, 'glide-positions.json');
    if (!fs.existsSync(posFile)) return '';
    try {
      const positions: Record<string, Record<string, string> | null> = JSON.parse(
        fs.readFileSync(posFile, 'utf-8')
      );
      return Object.entries(positions)
        .map(([sourceId, styles]) => {
          if (!styles) return '';
          const escapedId = sourceId.replace(/\\/g, '/').replace(/"/g, '\\"');
          const styleStr = Object.entries(styles)
            .map(([k, v]) => {
              const prop = k.replace(/([A-Z])/g, '-$1').toLowerCase();
              return `${prop}:${v}!important`;
            })
            .join(';');
          return `[${sourceAttr}="${escapedId}"]{${styleStr}}`;
        })
        .filter(Boolean)
        .join('\n');
    } catch {
      return '';
    }
  }

  function stampHTMLTemplate(code: string, filepath: string): string {
    // Replace script, style and comments with spaces to preserve line/col numbers
    let cleanCode = code
      .replace(/<!--[\s\S]*?-->/g, match => ' '.repeat(match.length))
      .replace(/<script[\s\S]*?<\/script>/gi, match => ' '.repeat(match.length))
      .replace(/<style[\s\S]*?<\/style>/gi, match => ' '.repeat(match.length));

    const tagRegex = /<([a-zA-Z][a-zA-Z0-9.-]*)/g;
    let match;
    let offset = 0;
    let result = code;

    while ((match = tagRegex.exec(cleanCode)) !== null) {
      const tagName = match[1];
      
      // Ignore template, script, style tags
      if (['template', 'script', 'style'].includes(tagName.toLowerCase())) {
        continue;
      }
      
      const index = match.index;
      
      // Check if tag already has data-gl-source
      const restOfTag = cleanCode.substring(index, index + 500);
      const tagEnd = restOfTag.indexOf('>');
      const tagContent = tagEnd !== -1 ? restOfTag.substring(0, tagEnd) : restOfTag;
      if (tagContent.includes(glideConfig.sourceAttribute)) {
        continue;
      }

      const prefix = code.substring(0, index);
      const lines = prefix.split('\n');
      const line = lines.length;
      const col = lines[lines.length - 1].length + 1;
      
      const sourceAttrVal = ` ${glideConfig.sourceAttribute}="${filepath}:${line}:${col}"`;
      const insertPos = index + 1 + tagName.length;
      const adjustedPos = insertPos + offset;
      
      result = result.substring(0, adjustedPos) + sourceAttrVal + result.substring(adjustedPos);
      offset += sourceAttrVal.length;
    }
    
    return result;
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
          cors: true,                       // allow Glide editor (port 7777) to fetch from dev server
        },
      };
    },

    configResolved(config) {
      isDev = config.command === 'serve';
      rootDir = config.root || process.cwd();
      mainEntryInjected = false;
      // Load glide.config.ts from the user's project root synchronously.
      // jiti is used under the hood by loadConfigFromDisk — no await needed at plugin init time.
      try {
        loadConfigFromDisk(rootDir).then(cfg => {
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
      viteServer = server;

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

      // Watch glide-positions.json for changes
      const posFile = path.join(rootDir, 'glide-positions.json');
      // Use chokidar (available from Vite) to watch the file
      server.watcher.add(posFile);
      
      const handlePositionsChange = (changedFile: string) => {
        const normChanged = changedFile.replace(/\\/g, '/').toLowerCase();
        const normPosFile = posFile.replace(/\\/g, '/').toLowerCase();
        if (normChanged === normPosFile) {
          console.log('[Glide Plugin] glide-positions.json changed, broadcasting glide:positions-updated');
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
      const positionInjector = `<script type="module">
(function() {
  var styleEl = document.createElement('style');
  styleEl.id = '__glide_positions__';
  styleEl.textContent = ${JSON.stringify(initialCSS)};
  document.head.appendChild(styleEl);

  // Listen for position updates from the Vite HMR websocket
    import.meta.hot.on('glide:positions-updated', function(data) {
      var el = document.getElementById('__glide_positions__');
      if (el) el.textContent = data.css;
      if (window.__glide_refresh_selection__) {
        window.__glide_refresh_selection__();
      }
      window.parent.postMessage({ type: 'glide:positions-applied' }, '*');
    });
})();
</script>`;
      return html.replace(
        '<head>',
        `<head>${positionInjector}<script>${bridgeScript}<\/script>`
      );
    },

    transform(code, id) {
      // Only stamp in development mode (command === 'serve')
      if (!isDev) return null;

      const cleanId = id.split('?')[0];
      if (cleanId.includes('node_modules')) {
        return null;
      }

      const isJSX = /\.[jt]sx$/.test(cleanId);
      const isHTML = /\.html$/.test(cleanId);
      const isVue = /\.vue$/.test(cleanId);
      const isSvelte = /\.svelte$/.test(cleanId);

      if (!isJSX && !isHTML && !isVue && !isSvelte) {
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
          plugins: [
            glideSourceStampingPlugin
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
        var elements = document.querySelectorAll('[${glideConfig.sourceAttribute}]');
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

if (import.meta.hot) {
  import.meta.hot.on('vite:afterUpdate', function() {
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
  });
}
`;
        return {
          code: (result.code ?? code) + hmrInjection,
          map: result.map,
        };
      }

      // For HTML, Vue, and Svelte templates, stamp them using stampHTMLTemplate
      const relativePath = normalizePath(cleanId, rootDir);
      const stampedCode = stampHTMLTemplate(code, relativePath);
      return {
        code: stampedCode,
        map: null
      };
    },
  };
}
