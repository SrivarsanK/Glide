// @ts-nocheck
/**
 * Runs in the user's page inside the editor iframe, never in Node. buildBridgeScript sends this
 * function's source text, so the body must not use imports or anything declared outside it.
 * __GLIDE_*_ATTR__ strings are replaced with the configured attribute names.
 */
export function glideBridge(snapThresholdPx, trustedWindowMessage, createFrameQueries) {
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
    '[__GLIDE_HOVER_ATTR__]{outline:2px solid rgba(56,189,248,0.6)!important;outline-offset:1px;}',
    '[__GLIDE_SELECTED_ATTR__]{outline:2px solid #38bdf8!important;outline-offset:2px;}',
    // Editing must preserve authored layout, typography and gradient paint.
    'html[data-glide-design-mode] *, html[data-glide-design-mode] *::before, html[data-glide-design-mode] *::after { animation: none !important; transition: none !important; caret-color: transparent; }',
    'html[data-glide-design-mode] [contenteditable="true"] { caret-color: auto; }'
  ].join(' ');
  document.head.appendChild(style);
  var interactionMode = false;
  if (document.documentElement) document.documentElement.setAttribute('data-glide-design-mode', '');

  var hovered = null;
  var selected = null;
  // Where the selection sits among the stamped elements: a remount after a save can move every stamp.
  var selectedSlot = null;
  function rememberSlot(el) {
    var stamped = document.querySelectorAll('[__GLIDE_SOURCE_ATTR__]');
    selectedSlot = { index: Array.prototype.indexOf.call(stamped, el), count: stamped.length };
  }
  var readyStateSent = false;
  var readyInterval = null;

  // ── CST: CSS Selector Tree element detection (100% fallback) ──────────
  // Generates a unique CSS selector path for ANY DOM element, even those
  // without the Vite-stamped source attribute. Used as a stable identifier
  // so the editor can track, highlight, and inspect any clicked element.
  function getCSSPath(el) {
    if (!el || el === document.documentElement) return 'html';
    if (el === document.body) return 'body';
    // Prefer id — guarantees uniqueness in one step
    if (el.id && /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(el.id)) {
      return '#' + el.id;
    }
    var tag = el.tagName.toLowerCase();
    var parent = el.parentNode;
    if (!parent) return tag;
    // Build a class-based selector and test uniqueness within parent
    var classes = [];
    for (var i = 0; i < el.classList.length; i++) {
      var c = el.classList[i];
      // skip glide-internal classes
      if (c.indexOf('__glide') === 0) continue;
      classes.push('.' + CSS.escape(c));
    }
    var classSel = tag + classes.join('');
    // Only use class selector if it matches exactly one sibling
    try {
      if (classes.length > 0 && parent.querySelectorAll(classSel).length === 1) {
        return getCSSPath(parent) + ' > ' + classSel;
      }
    } catch(e) { /* malformed class, fall through */ }
    // Fall back to nth-child index — always unique
    var siblings = parent.children;
    var idx = 1;
    for (var j = 0; j < siblings.length; j++) {
      if (siblings[j] === el) break;
      if (siblings[j].tagName === el.tagName) idx++;
    }
    return getCSSPath(parent) + ' > ' + tag + ':nth-of-type(' + idx + ')';
  }

  // Returns the element's stable identifier: sourceAttr value if present,
  // otherwise a synthetic __glide_cst_<cssPath> key.
  function getElId(el) {
    var src = el.getAttribute && el.getAttribute('__GLIDE_SOURCE_ATTR__');
    if (src) return src;
    return '__glide_cst_' + getCSSPath(el);
  }

  // Resolves the deepest meaningful target element at (x, y).
  // Priority: sourceAttr ancestor → direct elementFromPoint → walk up to first
  // non-glide element with a non-zero bounding rect.
  function resolveElementAtPoint(x, y, preferSrc) {
    var direct = document.elementFromPoint(x, y);
    if (!direct || direct === document.body || direct === document.documentElement) return null;
    // Prefer source-attributed ancestor if any
    if (preferSrc !== false) {
      var src = direct.closest && direct.closest('[__GLIDE_SOURCE_ATTR__]');
      if (src) return src;
    }
    // Walk up until we find an element with a non-trivial bounding rect
    var cur = direct;
    while (cur && cur !== document.body) {
      if (cur.nodeType === 1) {
        var r = cur.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return cur;
      }
      cur = cur.parentNode;
    }
    return direct;
  }

  function getElementTextContent(el) {
    if (!el || el.nodeType !== 1) return undefined;
    var tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return el.value;
    if (tag === 'svg' || tag === 'img' || tag === 'canvas' || tag === 'video') return undefined;

    // Direct text node children
    var directText = '';
    el.childNodes.forEach(function(n) {
      if (n.nodeType === 3) directText += n.textContent;
    });
    directText = directText.trim();

    if (!el.children || el.children.length === 0) {
      return (directText || el.textContent || '').trim();
    }

    if (directText.length > 0) {
      return directText;
    }

    var inlineTags = { span:1, b:1, strong:1, em:1, i:1, code:1, a:1, small:1, sub:1, sup:1, mark:1, u:1, s:1, abbr:1, label:1 };
    var isInlineOnly = true;
    for (var i = 0; i < el.children.length; i++) {
      if (!inlineTags[el.children[i].tagName.toLowerCase()]) {
        isInlineOnly = false;
        break;
      }
    }
    if (isInlineOnly) {
      return (el.innerText || el.textContent || '').trim();
    }

    return undefined;
  }

  // Like sendMsg() but works for ANY element — with or without sourceAttr.
  function sendMsgForAny(type, el, isShift, refresh) {
    if (type === 'glide:element-selected') rememberSlot(el);
    var src = getElId(el);
    var r = el.getBoundingClientRect();
    var cs = window.getComputedStyle(el);
    var computedStyles = {
      tagName: el.tagName.toLowerCase(),
      display: cs.display, flexDirection: cs.flexDirection,
      justifyContent: cs.justifyContent, alignItems: cs.alignItems,
      flexWrap: cs.flexWrap, gap: cs.gap, rowGap: cs.rowGap, columnGap: cs.columnGap,
      marginTop: cs.marginTop, marginBottom: cs.marginBottom,
      marginLeft: cs.marginLeft, marginRight: cs.marginRight,
      paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight,
      fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing,
      textAlign: cs.textAlign, textDecoration: cs.textDecoration,
      color: cs.color, backgroundColor: cs.backgroundColor,
      background: cs.background, backgroundImage: cs.backgroundImage,
      opacity: cs.opacity, borderColor: cs.borderColor, borderWidth: cs.borderWidth,
      borderStyle: cs.borderStyle,
      borderRadius: cs.borderRadius,
      borderTopLeftRadius: cs.borderTopLeftRadius,
      borderTopRightRadius: cs.borderTopRightRadius,
      borderBottomRightRadius: cs.borderBottomRightRadius,
      borderBottomLeftRadius: cs.borderBottomLeftRadius,
      boxShadow: cs.boxShadow, transform: cs.transform,
      width: cs.width, height: cs.height, position: cs.position,
      top: cs.top, left: cs.left, flex: cs.flex, flexGrow: cs.flexGrow,
      alignSelf: cs.alignSelf,
      className: typeof el.className === 'string' ? el.className : ((el.getAttribute && el.getAttribute('class')) || ''),
      inlineStyle: (el.getAttribute && el.getAttribute('style')) || ''
    };
    var isUnstamped = !el.hasAttribute('__GLIDE_SOURCE_ATTR__');
    window.parent.postMessage({
      type: type,
      source: src,
      isUnstamped: isUnstamped,
      tagName: el.tagName.toLowerCase(),
      classNames: el.className,
      isShift: !!isShift,
      refresh: !!refresh,
      rect: { left: r.left, top: r.top, width: r.width, height: r.height }
    }, '*');
    if (type !== 'glide:element-deselected') {
      window.parent.postMessage({
        type: 'glide:overlay',
        source: src,
        isUnstamped: isUnstamped,
        isShift: !!isShift,
        refresh: !!refresh,
        rect: { x: r.left, y: r.top, width: r.width, height: r.height },
        isHover: type === 'glide:element-hovered',
        owners: type === 'glide:element-hovered' ? [] : glideOwners(el),
        computedStyles: computedStyles,
        textContent: getElementTextContent(el)
      }, '*');
    }
  }

  // ── DOM tree serializer ─────────────────────────────────────────────────
  // Builds a lightweight node tree from live DOM for the Layers panel.
  // Skips script/style/noscript/template and Glide-injected nodes.
  var SKIP_TAGS = { SCRIPT:1, STYLE:1, NOSCRIPT:1, TEMPLATE:1, META:1, LINK:1, TITLE:1 };
  var MAX_DEPTH = 12;
  function serializeDOMNode(el, depth) {
    if (!el || el.nodeType !== 1) return null;
    if (SKIP_TAGS[el.tagName]) return null;
    if (el.hasAttribute('data-glide-bridge')) return null;
    if (el.id === '__glide_styles__') return null;
    var id = getElId(el);
    var tag = el.tagName.toLowerCase();
    var cls = (typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '')).trim();
    // Gather direct text content
    var text = '';
    el.childNodes.forEach(function(n) { if (n.nodeType === 3) text += n.textContent; });
    text = text.trim().replace(/\s+/g, ' ');
    if (!text && (!el.children || el.children.length === 0)) {
      text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
    }
    if (text) text = text.slice(0, 60);

    var alt = '';
    var src = '';
    var imageLabel = '';
    if (tag === 'img') {
      alt = el.getAttribute('alt') || '';
      src = el.getAttribute('src') || '';
      var imgName = '';
      if (src) {
        try {
          var cleanSrc = src.split('?')[0].split('#')[0];
          var lastSlash = Math.max(cleanSrc.lastIndexOf('/'), cleanSrc.lastIndexOf(String.fromCharCode(92)));
          imgName = (lastSlash >= 0) ? cleanSrc.substring(lastSlash + 1) : cleanSrc;
        } catch(e) {}
      }
      imageLabel = alt || imgName || 'Image';
    }

    var children = [];
    if (depth < MAX_DEPTH && el.children) {
      for (var i = 0; i < el.children.length; i++) {
        var child = serializeDOMNode(el.children[i], depth + 1);
        if (child) children.push(child);
      }
    }
    return {
      id: id,
      name: tag,
      className: cls,
      text: text || undefined,
      alt: alt || undefined,
      src: src || undefined,
      imageLabel: imageLabel || undefined,
      children: children
    };
  }

  // ── SceneGraph serializer (includes live bounding rects) ─────────────────
  function serializeSceneNode(el, depth) {
    if (!el || el.nodeType !== 1) return null;
    if (SKIP_TAGS[el.tagName]) return null;
    if (el.hasAttribute('data-glide-bridge')) return null;
    if (el.id === '__glide_styles__') return null;
    var id = getElId(el);
    var tag = el.tagName.toLowerCase();
    var r = el.getBoundingClientRect();
    var sceneRect = {
      left: Math.round(r.left),
      top: Math.round(r.top),
      right: Math.round(r.right),
      bottom: Math.round(r.bottom),
      width: Math.round(r.width),
      height: Math.round(r.height)
    };
    if (sceneRect.width === 0 && sceneRect.height === 0) return null;
    var children = [];
    if (depth < MAX_DEPTH && el.children) {
      for (var i = 0; i < el.children.length; i++) {
        var child = serializeSceneNode(el.children[i], depth + 1);
        if (child) children.push(child);
      }
    }
    return { id: id, tag: tag, rect: sceneRect, children: children };
  }

  // `rendered`: the page was just rendered from source (loaded, or elements or stamps changed), so its stamps are current.
  function sendDOMTree(rendered) {
    var body = document.body;
    if (!body) return;
    var tree = [];
    for (var i = 0; i < body.children.length; i++) {
      var node = serializeDOMNode(body.children[i], 0);
      if (node) tree.push(node);
    }
    window.parent.postMessage({ type: 'glide:dom-tree', tree: tree, rendered: !!rendered }, '*');
    // Also send scene nodes (with rects) for the SceneGraph hit-test
    var sceneNodes = [];
    for (var j = 0; j < body.children.length; j++) {
      var sn = serializeSceneNode(body.children[j], 0);
      if (sn) sceneNodes.push(sn);
    }
    window.parent.postMessage({ type: 'glide:scene-nodes', nodes: sceneNodes }, '*');
  }

  function sendReadyState() {
    if (readyStateSent) return;
    // Try sourceAttr element first; fall back to any visible element in body
    var el = document.querySelector('[__GLIDE_SOURCE_ATTR__]') || (document.body && (document.body.firstElementChild || (document.body.children && document.body.children[0])));
    if (el) {
      var src = (el.getAttribute && el.getAttribute('__GLIDE_SOURCE_ATTR__')) || getElId(el);
      window.parent.postMessage({ type: 'glide:ready', source: src }, '*');
      sendDOMTree(true);
      readyStateSent = true;
      if (readyInterval) { clearInterval(readyInterval); readyInterval = null; }
    }
  }

  window.__glide_refresh_selection__ = function() {
    if (selected) {
      sendMsg('glide:element-selected', selected, false, true);
    }
  };

  window.__glide_update_selection_node__ = function() {
    var all = document.querySelectorAll('[__GLIDE_SOURCE_ATTR__]');
    if (selected && selected.isConnected === false) {
      var src = selected.getAttribute('__GLIDE_SOURCE_ATTR__');
      // A remount after a save can move every stamp, so another element may now carry the old one.
      // With the same stamped elements, the selection is the element in its place.
      var replacement = selectedSlot && selectedSlot.index >= 0 && selectedSlot.count === all.length ? all[selectedSlot.index] : null;
      if (!replacement && src) {
        for (var i = 0; i < all.length; i++) {
          if (all[i].getAttribute('__GLIDE_SOURCE_ATTR__') === src) {
            replacement = all[i];
            break;
          }
        }
      }
      selected = replacement;
      if (selected) selected.setAttribute('__GLIDE_SELECTED_ATTR__', '');
      else window.parent.postMessage({ type: 'glide:clear-selection' }, '*');
    }
    if (hovered && hovered.isConnected === false) {
      var src = hovered.getAttribute('__GLIDE_SOURCE_ATTR__');
      var replacement = null;
      if (src) {
        for (var i = 0; i < all.length; i++) {
          if (all[i].getAttribute('__GLIDE_SOURCE_ATTR__') === src) {
            replacement = all[i];
            break;
          }
        }
      }
      hovered = replacement;
      if (!hovered) window.parent.postMessage({ type: 'glide:element-hover-exit' }, '*');
    }
  };

  // Components that hold el, innermost first. React keeps each component's props on its
  // fiber, and the __GLIDE_SOURCE_ATTR__ prop there is where that component is used, not where it is defined.
  function glideComponentName(type) {
    if (!type) return 'Component';
    return type.displayName || type.name || (type.render && (type.render.displayName || type.render.name))
      || (type.type && glideComponentName(type.type)) || 'Component';
  }
  function glideRootElement(fiber) {
    for (var child = fiber.child; child; child = child.child) {
      if (typeof child.type === 'string') return child.stateNode;
    }
    return null;
  }
  function glideOwners(el) {
    var owners = [];
    try {
      var key = Object.keys(el).find(function(name) { return name.indexOf('__reactFiber$') === 0; });
      if (!key) return owners;
      // React's development build records the component that created each element. The definition of
      // that component holds el, also when el is not its root, and also when el is passed to another
      // component as a child. A production build has no record: only a component whose root is el is found.
      var dev = '_debugOwner' in el[key];
      // A className reaches el through a further component only if that component has the same root.
      var anchor = el;
      for (var fiber = dev ? el[key]._debugOwner : el[key].return, depth = 0; fiber && depth < 50 && owners.length < 6;
        fiber = dev ? fiber._debugOwner : fiber.return, depth++) {
        if (!dev && typeof fiber.type === 'string') break;
        var props = fiber.memoizedProps;
        if (!fiber.type || !props || typeof props !== 'object') { if (dev) break; continue; }
        var root = glideRootElement(fiber);
        if (root !== anchor && (owners.length || !dev)) break;
        var stamp = props['__GLIDE_SOURCE_ATTR__'];
        // A component that library code created has no usage in source to edit.
        if (typeof stamp !== 'string') { if (dev) break; continue; }
        if (owners.length && owners[owners.length - 1].source === stamp) continue;
        anchor = root;
        var simple = {};
        Object.keys(props).forEach(function(name) {
          var value = props[name];
          if (name !== 'children' && name !== '__GLIDE_SOURCE_ATTR__' && name.indexOf('data-gl-') !== 0
            && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) simple[name] = value;
        });
        owners.push({ name: glideComponentName(fiber.type), source: stamp, props: simple, root: root === el });
      }
    } catch (e) { /* Owner data is optional; selection works without it. */ }
    return owners;
  }

  // `refresh` re-reports an element that is already selected (it moved or re-rendered); it is not a click.
  function sendMsg(type, el, isShift, refresh) {
    if (type === 'glide:element-selected') rememberSlot(el);
    var src = (el.getAttribute && el.getAttribute('__GLIDE_SOURCE_ATTR__')) || getElId(el);
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
      alignSelf: cs.alignSelf,
      className: typeof el.className === 'string' ? el.className : ((el.getAttribute && el.getAttribute('class')) || ''),
      inlineStyle: (el.getAttribute && el.getAttribute('style')) || ''
    };

    window.parent.postMessage({
      type: type,
      source: src,
      tagName: el.tagName.toLowerCase(),
      classNames: el.className,
      isShift: !!isShift,
      refresh: !!refresh,
      rect: {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height
      }
    }, '*');

    if (type !== 'glide:element-deselected') {
      window.parent.postMessage({
        type: 'glide:overlay',
        source: src,
        isShift: !!isShift,
        refresh: !!refresh,
        rect: {
          x: r.left,
          y: r.top,
          width: r.width,
          height: r.height
        },
        isHover: type === 'glide:element-hovered',
        owners: type === 'glide:element-hovered' ? [] : glideOwners(el),
        computedStyles: computedStyles,
        textContent: getElementTextContent(el)
      }, '*');
    }
  }

  var isDragging = false;
  var dragCandidate = null;
  var dragPointerId = null;
  var startX = 0;
  var startY = 0;
  var dragEl = null;
  var initialMarginLeft = 0;
  var initialMarginTop = 0;
  var initialLeft = 0;
  var initialTop = 0;
  var initialPosition = 'static';
  var currentDx = 0;
  var currentDy = 0;
  // The editor's canvas zoom: page pixels times this are screen pixels.
  var canvasZoom = 1;
  var rafId = null;
  var dragOriginalStyles = null;
  var dragBaseTransform = '';

  function captureInlineStyles(el, properties) {
    var saved = {};
    properties.forEach(function(property) {
      saved[property] = { value: el.style.getPropertyValue(property), priority: el.style.getPropertyPriority(property) };
    });
    return saved;
  }

  function restoreInlineStyles(el, saved) {
    if (!saved) return;
    Object.keys(saved).forEach(function(property) {
      var original = saved[property];
      if (original.value) el.style.setProperty(property, original.value, original.priority);
      else el.style.removeProperty(property);
    });
  }

  var isMarqueeing = false;
  var wasMarqueeing = false;
  var marqueePointerId = null;
  var marqueeStartX = 0;
  var marqueeStartY = 0;
  var componentRoots = new Set();

  // ── Snap state ─────────────────────────────────────────────────────────
  // OUR threshold — not Figma's. Figma does not publish its capture radius.
  var OUR_SNAP_THRESHOLD_PX = snapThresholdPx;
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
    var children = parent.querySelectorAll('[__GLIDE_SOURCE_ATTR__]');
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
      if (curr.hasAttribute && curr.hasAttribute('__GLIDE_SOURCE_ATTR__')) {
        ancestors.push(curr);
      }
      curr = curr.parentNode;
    }
    var compAncestors = ancestors.filter(function(node) {
      var src = node.getAttribute('__GLIDE_SOURCE_ATTR__');
      return componentRoots.has(src);
    });
    if (compAncestors.length === 0) return el;
    for (var i = compAncestors.length - 1; i >= 0; i--) {
      if (compAncestors[i].hasAttribute('__GLIDE_SELECTED_ATTR__')) {
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

    dragEl.style.transform = 'translate(' + snappedDx + 'px, ' + snappedDy + 'px)' + (dragBaseTransform ? ' ' + dragBaseTransform : '');
    dragEl.style.zIndex = '9999';
    window.parent.postMessage({ type: 'glide:drag-delta', dx: snappedDx, dy: snappedDy, guides: snap.guides }, '*');
    rafId = requestAnimationFrame(rafDragLoop);
  }

  document.addEventListener('pointerdown', function(e) {
    if (interactionMode) return;
    if (typeof e.button === 'number' && e.button !== 0) return;
    if (e.target.contentEditable === 'true' || e.target.closest('[contenteditable="true"]')) {
      return;
    }
    var target = e.target;
    if (target.nodeType === 3) target = target.parentNode;
    // ── CST DETECTION: prefer sourceAttr ancestor, fall back to point-at ──
    var el = target && target.closest && target.closest('[__GLIDE_SOURCE_ATTR__]');
    if (!el) {
      // No stamp → resolve via elementFromPoint (CST mode)
      el = resolveElementAtPoint(e.clientX, e.clientY, false);
      if (el && (el === document.body || el === document.documentElement)) el = null;
    }
    var isShift = !!e.shiftKey;
    var isCmdClick = !!(e.metaKey || e.ctrlKey);

    if (el) {
      // Clear hover when starting a drag
      if (hovered) {
        hovered.removeAttribute('__GLIDE_HOVER_ATTR__');
        hovered = null;
        window.parent.postMessage({ type: 'glide:element-hover-exit' }, '*');
      }

      // Use resolveSelectTarget only for source-attributed elements
      var isStamped = el.hasAttribute('__GLIDE_SOURCE_ATTR__');
      var selectTarget = isStamped ? resolveSelectTarget(el, isCmdClick) : el;
      dragCandidate = isStamped ? selectTarget : null;
      dragEl = null;
      isDragging = false;
      dragPointerId = isStamped ? e.pointerId : null;
      startX = e.clientX;
      startY = e.clientY;
      currentDx = 0;
      currentDy = 0;

      if (!isShift) {
        var old = document.querySelectorAll('[__GLIDE_SELECTED_ATTR__]');
        for (var i = 0; i < old.length; i++) {
          old[i].removeAttribute('__GLIDE_SELECTED_ATTR__');
        }
      }

      if (isShift && selectTarget.hasAttribute('__GLIDE_SELECTED_ATTR__')) {
        selectTarget.removeAttribute('__GLIDE_SELECTED_ATTR__');
        sendMsgForAny('glide:element-deselected', selectTarget, isShift);
        selected = document.querySelector('[__GLIDE_SELECTED_ATTR__]');
        if (selected) {
          if (selected.hasAttribute('__GLIDE_SOURCE_ATTR__')) {
            sendMsg('glide:element-selected', selected, false, true);
          } else {
            sendMsgForAny('glide:element-selected', selected, false, true);
          }
        }
      } else {
        selected = selectTarget;
        selectTarget.setAttribute('__GLIDE_SELECTED_ATTR__', '');
        sendMsgForAny('glide:element-selected', selectTarget, isShift);
      }

      var cs = window.getComputedStyle(selectTarget);
      initialPosition = cs.position;
      initialMarginLeft = parseInt(cs.marginLeft) || 0;
      initialMarginTop = parseInt(cs.marginTop) || 0;
      var styleLeft = cs.left;
      var styleTop = cs.top;
      initialLeft = styleLeft === 'auto' ? 0 : (parseInt(styleLeft) || 0);
      initialTop = styleTop === 'auto' ? 0 : (parseInt(styleTop) || 0);

      var r = selectTarget.getBoundingClientRect();
      dragStartRect = { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      siblingRects  = collectSiblingRects(selectTarget);
      snapDisabledForDrag = false; // reset; Ctrl/Cmd on pointermove will set this

      e.preventDefault();
      e.stopPropagation();
    } else {
      // Clear hover when starting a marquee selection
      if (hovered) {
        hovered.removeAttribute('__GLIDE_HOVER_ATTR__');
        hovered = null;
        window.parent.postMessage({ type: 'glide:element-hover-exit' }, '*');
      }

      isMarqueeing = true;
      marqueePointerId = e.pointerId;
      marqueeStartX = e.clientX;
      marqueeStartY = e.clientY;
      try { document.documentElement.setPointerCapture(e.pointerId); } catch(err) {}
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
    if (interactionMode) return;
    if (dragCandidate && !isDragging) {
      if (typeof e.buttons === 'number' && (e.buttons & 1) === 0) {
        dragCandidate = null;
        dragPointerId = null;
        return;
      }
      // 4 screen pixels at any zoom, so a click that wobbles never moves the element.
      var moveDist = Math.hypot(e.clientX - startX, e.clientY - startY) * canvasZoom;
      if (moveDist >= 4) {
        isDragging = true;
        dragEl = dragCandidate;
        dragOriginalStyles = captureInlineStyles(dragEl, ['transform', 'z-index', 'transition', 'transition-property']);
        var transform = window.getComputedStyle(dragEl).transform;
        dragBaseTransform = transform && transform !== 'none' ? transform : '';
        dragEl.style.setProperty('transition', 'none', 'important');
        dragEl.style.setProperty('transition-property', 'none', 'important');
        try { dragEl.setPointerCapture(dragPointerId); } catch(err) {}

        var r = dragStartRect;
        window.parent.postMessage({
          type: 'glide:element-drag-start',
          source: dragEl.getAttribute('__GLIDE_SOURCE_ATTR__'),
          initialMarginLeft: initialMarginLeft,
          initialMarginTop: initialMarginTop,
          clientX: startX,
          clientY: startY,
          rect: {
            x: r.left,
            y: r.top,
            width: r.width,
            height: r.height
          }
        }, '*');

        if (!rafId) rafId = requestAnimationFrame(rafDragLoop);
      }
    }

    if (isDragging && dragEl) {
      // Ctrl/Cmd held during drag disables object-snap dynamically
      // (mirrors Figma's documented Ctrl/Cmd override behavior).
      snapDisabledForDrag = !!(e.ctrlKey || e.metaKey);

      currentDx = e.clientX - startX;
      currentDy = e.clientY - startY;

      if (selected !== dragEl) {
        var old = document.querySelectorAll('[__GLIDE_SELECTED_ATTR__]');
        for (var i = 0; i < old.length; i++) {
          old[i].removeAttribute('__GLIDE_SELECTED_ATTR__');
        }
        selected = dragEl;
        dragEl.setAttribute('__GLIDE_SELECTED_ATTR__', '');
        sendMsg('glide:element-selected', dragEl, false);
      }

      e.preventDefault();
      e.stopPropagation();
    } else if (isMarqueeing) {
      if (typeof e.buttons === 'number' && (e.buttons & 1) === 0) {
        isMarqueeing = false;
        if (marqueePointerId !== null) {
          try { document.documentElement.releasePointerCapture(marqueePointerId); } catch(err) {}
          marqueePointerId = null;
        }
        window.parent.postMessage({ type: 'glide:marquee-cancel' }, '*');
        return;
      }
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
      // ── CST HOVER DETECTION ───────────────────────────────────────────
      var el = target && target.closest && target.closest('[__GLIDE_SOURCE_ATTR__]');
      if (!el) {
        el = resolveElementAtPoint(e.clientX, e.clientY, false);
        if (el && (el === document.body || el === document.documentElement)) el = null;
      }
      if (el) {
        if (hovered !== el) {
          if (hovered) hovered.removeAttribute('__GLIDE_HOVER_ATTR__');
          hovered = el;
          el.setAttribute('__GLIDE_HOVER_ATTR__', '');
          sendMsgForAny('glide:element-hovered', el);
        }
      } else if (hovered) {
        hovered.removeAttribute('__GLIDE_HOVER_ATTR__');
        hovered = null;
        window.parent.postMessage({ type: 'glide:element-hover-exit' }, '*');
      }
    }
  }, true);

  document.addEventListener('pointerup', function(e) {
    if (interactionMode) return;
    if (isDragging && dragEl) {
      isDragging = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      try { dragEl.releasePointerCapture(e.pointerId); } catch(err) {}

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

      restoreInlineStyles(dragEl, dragOriginalStyles);
      dragOriginalStyles = null;
      dragBaseTransform = '';

      // Record pre-drag inline styles in the shared preview snapshot map before applying
      // optimistic layout offsets (without !important) so Staged Discard/Before and Undo restore cleanly.
      var nextPosition = initialPosition === 'static' ? 'relative' : initialPosition;
      if (!dragEl.__glide_original_styles__) dragEl.__glide_original_styles__ = {};
      if (!('position' in dragEl.__glide_original_styles__)) dragEl.__glide_original_styles__.position = dragEl.style.position || '';
      if (!('left' in dragEl.__glide_original_styles__)) dragEl.__glide_original_styles__.left = dragEl.style.left || '';
      if (!('top' in dragEl.__glide_original_styles__)) dragEl.__glide_original_styles__.top = dragEl.style.top || '';
      dragEl.style.position = nextPosition;
      dragEl.style.left = finalLeft + 'px';
      dragEl.style.top = finalTop + 'px';

      var finalR = dragEl.getBoundingClientRect();

      window.parent.postMessage({
        type: 'glide:element-drag-end',
        clientX: e.clientX,
        clientY: e.clientY,
        outsideViewport: e.clientX < 0 || e.clientY < 0 || e.clientX > window.innerWidth || e.clientY > window.innerHeight,
        layoutPosition: initialPosition,
        source: dragEl.getAttribute('__GLIDE_SOURCE_ATTR__'),
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
      dragCandidate = null;
      e.preventDefault();
      e.stopPropagation();
    } else if (isMarqueeing) {
      isMarqueeing = false;
      if (marqueePointerId !== null) {
        try { document.documentElement.releasePointerCapture(marqueePointerId); } catch(err) {}
        marqueePointerId = null;
      }
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
    } else {
      if (dragCandidate) {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        dragCandidate = null;
      }
      dragEl = null;
      isDragging = false;
    }
  }, true);

  document.addEventListener('pointercancel', function() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (dragEl) restoreInlineStyles(dragEl, dragOriginalStyles);
    dragOriginalStyles = null;
    dragEl = dragCandidate = null;
    var wasMarquee = isMarqueeing;
    if (marqueePointerId !== null) {
      try { document.documentElement.releasePointerCapture(marqueePointerId); } catch(err) {}
      marqueePointerId = null;
    }
    isDragging = isMarqueeing = false;
    window.parent.postMessage({ type: 'glide:snap-guides-clear' }, '*');
    if (wasMarquee) window.parent.postMessage({ type: 'glide:marquee-cancel' }, '*');
  }, true);

  document.addEventListener('contextmenu', function(e) {
    if (interactionMode) return;
    // ── CST CONTEXTMENU DETECTION ─────────────────────────────────────
    var target = e.target;
    if (target.nodeType === 3) target = target.parentNode;
    // Try sourceAttr walk-up first
    var srcEl = target && target.closest && target.closest('[__GLIDE_SOURCE_ATTR__]');
    if (!srcEl) {
      // CST fallback
      srcEl = resolveElementAtPoint(e.clientX, e.clientY, false);
      if (srcEl && (srcEl === document.body || srcEl === document.documentElement)) srcEl = null;
    }
    if (srcEl) {
      e.preventDefault();
      var layerStack = [];
      var curr = srcEl;
      while (curr && curr !== document.body && curr !== document.documentElement) {
        if (curr.hasAttribute && curr.hasAttribute('__GLIDE_SOURCE_ATTR__')) {
          var src = curr.getAttribute('__GLIDE_SOURCE_ATTR__') || '';
          var tagName = (curr.tagName || '').toLowerCase();
          var name = curr.getAttribute('data-gl-name') || tagName;
          layerStack.push({ source: src, tagName: tagName, name: name });
        }
        curr = curr.parentElement;
      }
      window.parent.postMessage({
        type: 'glide:contextmenu',
        source: getElId(srcEl),
        clientX: e.clientX,
        clientY: e.clientY,
        layerStack: layerStack
      }, '*');
    }
  }, true);

  document.addEventListener('click', function(e) {
    if (interactionMode || e.target.isContentEditable) return;
    var target = e.target;
    if (target.nodeType === 3) target = target.parentNode;
    var el = target && target.closest && target.closest('[__GLIDE_SOURCE_ATTR__]');
    if (!el) el = resolveElementAtPoint(e.clientX, e.clientY, false);
    var isShift = e.shiftKey || e.ctrlKey || e.metaKey;
    if (el) {
      e.preventDefault();
      e.stopPropagation();
    } else if (!e.target.closest('#glide-context-menu')) {
      if (!wasMarqueeing) {
        var old = document.querySelectorAll('[__GLIDE_SELECTED_ATTR__]');
        for (var i = 0; i < old.length; i++) {
          old[i].removeAttribute('__GLIDE_SELECTED_ATTR__');
        }
        selected = null;
        window.parent.postMessage({ type: 'glide:clear-selection' }, '*');
      }
    }
  }, true);

  document.addEventListener('dblclick', function(e) {
    if (interactionMode || e.target.isContentEditable) return;
    var target = e.target;
    if (target.nodeType === 3) target = target.parentNode;
    var el = target && target.closest && target.closest('[__GLIDE_SOURCE_ATTR__]');
    if (!el) el = resolveElementAtPoint(e.clientX, e.clientY, false);
    if (el) {
      e.preventDefault();
      e.stopPropagation();
      var old = document.querySelectorAll('[__GLIDE_SELECTED_ATTR__]');
      for (var i = 0; i < old.length; i++) {
        old[i].removeAttribute('__GLIDE_SELECTED_ATTR__');
      }
      selected = el;
      el.setAttribute('__GLIDE_SELECTED_ATTR__', '');
      sendMsg('glide:element-selected', el, false);

      var textVal = getElementTextContent(el);
      // Rich text/container edits need a source-aware operation; contentEditable
      // would flatten their nested markup before a source write can validate it.
      if (typeof textVal === 'string' && (!el.children || el.children.length === 0)) {
        var originalText = el.textContent;
        var originalContentEditable = el.getAttribute('contenteditable');
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
        var prevOutlineOffset = el.style.outlineOffset;
        el.style.outline = '2px dashed #38bdf8';
        el.style.outlineOffset = '2px';

        window.__glide_inline_editing__ = el;

        var finished = false;
        function commitInlineEdit() {
          if (finished) return;
          finished = true;
          el.removeEventListener('blur', onBlur);
          el.removeEventListener('keydown', onKeyDown);
          if (originalContentEditable === null) el.removeAttribute('contenteditable');
          else el.setAttribute('contenteditable', originalContentEditable);
          el.style.outline = prevOutline;
          el.style.outlineOffset = prevOutlineOffset;
          window.__glide_inline_editing__ = null;

          var newText = el.textContent ? el.textContent.trim() : '';
          var src = (el.getAttribute && el.getAttribute('__GLIDE_SOURCE_ATTR__')) || el.getAttribute('data-gl-source') || getElId(el);
          if (newText !== (originalText ? originalText.trim() : '')) {
            // The edit is trimmed, but an edge space that separates the text from adjacent page text is a word break.
            var value = newText, before = el.previousSibling, after = el.nextSibling;
            if (value && (originalText || '').charAt(0) === ' ' && before && before.nodeType === 3 && (before.nodeValue || '').slice(-1).trim()) value = ' ' + value;
            if (value && (originalText || '').slice(-1) === ' ' && after && after.nodeType === 3 && (after.nodeValue || '').charAt(0).trim()) value += ' ';
            window.parent.postMessage({
              type: 'glide:inline-text-edit',
              source: src,
              value: value
            }, '*');
          }
        }

        function onBlur() {
          commitInlineEdit();
        }

        function onKeyDown(ev) {
          if (ev.key === 'Enter' && !ev.shiftKey) {
            ev.preventDefault();
            el.blur();
          }
          if (ev.key === 'Escape') {
            ev.preventDefault();
            el.textContent = originalText;
            el.blur();
          }
        }

        el.addEventListener('blur', onBlur);
        el.addEventListener('keydown', onKeyDown);
      }
    }
  }, true);

  window.addEventListener('keydown', function(e) {
    if (e.key === 'Alt') {
      window.parent.postMessage({ type: 'glide:alt-state', pressed: true }, '*');
    }
    if (interactionMode || window.__glide_inline_editing__) return;
    var t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    var ctrl = !!(e.ctrlKey || e.metaKey);
    if (ctrl && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
      e.preventDefault();
      window.parent.postMessage({ type: 'glide:shortcut', action: 'undo' }, '*');
    } else if (ctrl && (((e.key === 'z' || e.key === 'Z') && e.shiftKey) || e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      window.parent.postMessage({ type: 'glide:shortcut', action: 'redo' }, '*');
    } else if (!ctrl && e.key === 'Escape') {
      e.preventDefault();
      window.parent.postMessage({ type: 'glide:shortcut', action: 'escape' }, '*');
    }
  });
  window.addEventListener('keyup', function(e) {
    if (e.key === 'Alt') {
      window.parent.postMessage({ type: 'glide:alt-state', pressed: false }, '*');
    }
  });

  function stripSourceHash(id) {
    return typeof id === 'string' ? id.replace(/^(.+?:\d+:\d+):[a-fA-F0-9]+$/, '$1') : '';
  }

  function resolveElementById(targetId) {
    if (!targetId) return null;
    var baseId = stripSourceHash(targetId);
    // A repeated JSX template has several DOM instances. Keep the clicked one.
    if (selected && selected.isConnected) {
      var selAttr = selected.getAttribute('__GLIDE_SOURCE_ATTR__');
      if (selAttr === targetId || selAttr === baseId) return selected;
    }
    var pcst = '__glide_cst_';
    if (targetId.indexOf(pcst) === 0) {
      try { return document.querySelector(targetId.slice(pcst.length)); } catch(err) {}
    }
    // 1. Exact data-gl-source match (with or without trailing :hash)
    var candidates = baseId && baseId !== targetId ? [targetId, baseId] : [targetId];
    for (var c = 0; c < candidates.length; c++) {
      try {
        var exact = document.querySelector('[__GLIDE_SOURCE_ATTR__="' + candidates[c].replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]');
        if (exact) return exact;
      } catch(err) {}
    }
    // 2. Normalized path match (casing, backslashes vs forward slashes)
    var normTarget = (baseId || targetId).replace(/\\/g, '/').toLowerCase();
    var allStamped = document.querySelectorAll('[__GLIDE_SOURCE_ATTR__]');
    for (var i = 0; i < allStamped.length; i++) {
      var s = (allStamped[i].getAttribute('__GLIDE_SOURCE_ATTR__') || '').replace(/\\/g, '/').toLowerCase();
      if (s === normTarget) return allStamped[i];
    }
    // Never resolve by line/column alone: unrelated files share coordinates.
    return null;
  }

  window.addEventListener('message', function(e) {
    // The editor may have another origin than this page. The referrer names it only until
    // the page navigates; ancestorOrigins names the embedding page for the whole session.
    var locOrigin = window.location && window.location.origin && window.location.origin !== 'null' ? window.location.origin : '';
    var editorUrl = (window.location && window.location.ancestorOrigins && window.location.ancestorOrigins[0]) || document.referrer || locOrigin;
    if (!trustedWindowMessage(e, window.parent, editorUrl)) return;
    if (!e.data) return;
    if (e.data.type === 'glide:query') {
      var answer = null;
      try {
        answer = createFrameQueries(window, { source: '__GLIDE_SOURCE_ATTR__', selected: '__GLIDE_SELECTED_ATTR__', hover: '__GLIDE_HOVER_ATTR__' })(e.data.query, e.data.payload);
      } catch (_) {}
      window.parent.postMessage({ type: 'glide:query-result', id: e.data.id, result: answer }, '*');
      return;
    }
    if (e.data.type === 'glide:set-interaction-mode') {
      interactionMode = !!e.data.enabled;
      if (document.documentElement) {
        if (interactionMode) document.documentElement.removeAttribute('data-glide-design-mode');
        else document.documentElement.setAttribute('data-glide-design-mode', '');
      }
      if (interactionMode) {
        if (hovered) hovered.removeAttribute('__GLIDE_HOVER_ATTR__');
        hovered = null;
        var marked = document.querySelectorAll('[__GLIDE_SELECTED_ATTR__]');
        for (var m = 0; m < marked.length; m++) marked[m].removeAttribute('__GLIDE_SELECTED_ATTR__');
      } else if (selected && selected.isConnected !== false) {
        selected.setAttribute('__GLIDE_SELECTED_ATTR__', '');
        sendMsg('glide:element-selected', selected, false, true);
      }
      return;
    }
    if (e.data.type === 'glide:scroll-by') {
      window.scrollBy({
        top: e.data.y,
        left: e.data.x,
        behavior: 'auto'
      });
    }
    if (e.data.type === 'glide:optimistic-text' || e.data.type === 'glide:preview-text') {
      var el = resolveElementById(e.data.source || e.data.sourceId || e.data.id);
      if (el) {
        if (e.data.type === 'glide:preview-text' && !('__glide_original_text__' in el)) {
          el.__glide_original_text__ = (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea')
            ? el.value : el.textContent;
        }
        if (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea') {
          el.value = e.data.value;
        } else if (!el.children || el.children.length === 0) {
          el.textContent = e.data.value;
        }
      }
    }
    if (e.data.type === 'glide:optimistic-style') {
      var el = resolveElementById(e.data.id || e.data.sourceId || e.data.source);
      if (el) {
        var styles = e.data.styles || {};
        for (var prop in styles) {
          if (styles.hasOwnProperty(prop)) {
            el.style[prop] = styles[prop];
          }
        }
      }
    }
    if (e.data.type === 'glide:preview-style') {
      var pid = e.data.sourceId || e.data.source || e.data.id;
      var pstyles = e.data.styles;
      var pel = resolveElementById(pid);
      if (pel && pstyles) {
        if (!pel.__glide_original_styles__) pel.__glide_original_styles__ = {};
        for (var pprop in pstyles) {
          if (!(pprop in pel.__glide_original_styles__)) {
            pel.__glide_original_styles__[pprop] = pel.style[pprop] || '';
          }
          pel.style[pprop] = pstyles[pprop];
        }
      }
    }
    if (e.data.type === 'glide:clear-preview') {
      var cid = e.data.sourceId || e.data.source || e.data.id;
      var ctargets = [];
      if (cid) {
        var cel = resolveElementById(cid);
        if (cel) ctargets.push(cel);
      } else {
        document.querySelectorAll('*').forEach(function(node) {
          if (node.__glide_original_styles__ || '__glide_original_text__' in node) ctargets.push(node);
        });
      }
      ctargets.forEach(function(targetEl) {
        if (targetEl.__glide_original_styles__) {
          for (var p in targetEl.__glide_original_styles__) {
            targetEl.style[p] = targetEl.__glide_original_styles__[p];
          }
          delete targetEl.__glide_original_styles__;
        }
        if ('__glide_original_text__' in targetEl) {
          if (targetEl.tagName.toLowerCase() === 'input' || targetEl.tagName.toLowerCase() === 'textarea') {
            targetEl.value = targetEl.__glide_original_text__;
          } else if (!targetEl.children || targetEl.children.length === 0) {
            targetEl.textContent = targetEl.__glide_original_text__;
          }
          delete targetEl.__glide_original_text__;
        }
      });
    }
    if (e.data.type === 'glide:resize-start') {
      var el = resolveElementById(e.data.source);
      if (el) {
        if (!el.__glide_resize_styles__) el.__glide_resize_styles__ = captureInlineStyles(el, ['transition', 'transition-property']);
        el.style.setProperty('transition', 'none', 'important');
        el.style.setProperty('transition-property', 'none', 'important');
      }
    }
    if (e.data.type === 'glide:resize-end') {
      var el = resolveElementById(e.data.source);
      if (el) {
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            if (el) {
              restoreInlineStyles(el, el.__glide_resize_styles__);
              delete el.__glide_resize_styles__;
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
    if (e.data.type === 'glide:set-zoom') {
      var zoom = Number(e.data.zoom);
      if (zoom > 0 && isFinite(zoom)) canvasZoom = zoom;
    }
    if (e.data.type === 'glide:select-marquee') {
      var x = e.data.x;
      var y = e.data.y;
      var w = e.data.w;
      var h = e.data.h;
      var isRightToLeft = e.data.isRightToLeft;
      var isShift = e.data.isShift;
      var elements = document.querySelectorAll('[__GLIDE_SOURCE_ATTR__]');
      var newSelectionEls = [];
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        var elRect = el.getBoundingClientRect();
        if (isRightToLeft) {
          var overlaps = !(elRect.left > x + w || elRect.right < x || elRect.top > y + h || elRect.bottom < y);
          if (overlaps) {
            newSelectionEls.push(el);
          }
        } else {
          var enclosed = (elRect.left >= x && elRect.right <= x + w && elRect.top >= y && elRect.bottom <= y + h);
          if (enclosed) {
            newSelectionEls.push(el);
          }
        }
      }
      if (!isShift) {
        var old = document.querySelectorAll('[__GLIDE_SELECTED_ATTR__]');
        for (var i = 0; i < old.length; i++) {
          old[i].removeAttribute('__GLIDE_SELECTED_ATTR__');
        }
      }
      newSelectionEls.forEach(function(el) {
        el.setAttribute('__GLIDE_SELECTED_ATTR__', '');
      });
      var allSelected = document.querySelectorAll('[__GLIDE_SELECTED_ATTR__]');
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
        var old = document.querySelectorAll('[__GLIDE_SELECTED_ATTR__]');
        for (var i = 0; i < old.length; i++) {
          old[i].removeAttribute('__GLIDE_SELECTED_ATTR__');
        }
      }
      sources.forEach(function(src) {
        var el = resolveElementById(src);
        if (el) {
          el.setAttribute('__GLIDE_SELECTED_ATTR__', '');
        }
      });
      var allSelected = document.querySelectorAll('[__GLIDE_SELECTED_ATTR__]');
      if (allSelected.length > 0) {
        window.parent.postMessage({ type: 'glide:clear-selection' }, '*');
        for (var i = 0; i < allSelected.length; i++) {
          sendMsg('glide:element-selected', allSelected[i], true);
        }
      } else if (!isShift) {
        window.parent.postMessage({ type: 'glide:clear-selection' }, '*');
      }
    }
    if (e.data.type === 'glide:request-dom-tree') {
      sendDOMTree();
    }
    if (e.data.type === 'glide:request-scene-nodes') {
      sendDOMTree();
    }

    if (e.data.type === 'glide:select-element-by-id') {
      var el = resolveElementById(e.data.id);
      var isShift = e.data.isShift;
      if (el) {
        if (!isShift) {
          var old = document.querySelectorAll('[__GLIDE_SELECTED_ATTR__]');
          for (var i = 0; i < old.length; i++) {
            old[i].removeAttribute('__GLIDE_SELECTED_ATTR__');
          }
        }
        if (isShift && el.hasAttribute('__GLIDE_SELECTED_ATTR__')) {
          el.removeAttribute('__GLIDE_SELECTED_ATTR__');
          sendMsg('glide:element-deselected', el, isShift);
          selected = document.querySelector('[__GLIDE_SELECTED_ATTR__]');
          if (selected) sendMsg('glide:element-selected', selected, false, true);
        } else {
          selected = el;
          el.setAttribute('__GLIDE_SELECTED_ATTR__', '');
          if (e.data.scrollIntoView) el.scrollIntoView({ behavior: 'instant', block: 'nearest' });
          sendMsg('glide:element-selected', el, isShift);
        }
      }
    }
    if (e.data.type === 'glide:hover-element-by-id') {
      var el = resolveElementById(e.data.id);
      if (el) {
        if (hovered && hovered !== el) {
          hovered.removeAttribute('__GLIDE_HOVER_ATTR__');
        }
        hovered = el;
        el.setAttribute('__GLIDE_HOVER_ATTR__', '');
        sendMsg('glide:element-hovered', el, false);
      }
    }
    if (e.data.type === 'glide:hover-element-exit') {
      if (hovered) {
        hovered.removeAttribute('__GLIDE_HOVER_ATTR__');
        hovered = null;
      }
      window.parent.postMessage({ type: 'glide:element-hover-exit' }, '*');
    }
    if (e.data.type === 'glide:clear-selection') {
      var old = document.querySelectorAll('[__GLIDE_SELECTED_ATTR__]');
      for (var i = 0; i < old.length; i++) {
        old[i].removeAttribute('__GLIDE_SELECTED_ATTR__');
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
    if (interactionMode) return;
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
    if (interactionMode) return;
    if (hovered) {
      hovered.removeAttribute('__GLIDE_HOVER_ATTR__');
      hovered = null;
      window.parent.postMessage({ type: 'glide:element-hover-exit' }, '*');
    }
  }, true);

  // Sync selection/hover outline on iframe scroll events
  window.addEventListener('scroll', function() {
    if (interactionMode) return;
    if (selected) {
      sendMsg('glide:element-selected', selected, false, true);
    }
    if (hovered) {
      sendMsg('glide:element-hovered', hovered);
    }
  }, true);

  // Sync selection/hover outline on window resize events
  window.addEventListener('resize', function() {
    if (interactionMode) return;
    if (selected) {
      sendMsg('glide:element-selected', selected, false, true);
    }
    if (hovered) {
      sendMsg('glide:element-hovered', hovered);
    }
  });

  // Real-time selection outline alignment loop
  var lastSentRect = null;
  function updateSelectionLoop() {
    if (selected && selected.isConnected !== false && !isDragging && !interactionMode) {
      var r = selected.getBoundingClientRect();
      if (!lastSentRect ||
          lastSentRect.left !== r.left ||
          lastSentRect.top !== r.top ||
          lastSentRect.width !== r.width ||
          lastSentRect.height !== r.height) {
        lastSentRect = { left: r.left, top: r.top, width: r.width, height: r.height };
        sendMsg('glide:element-selected', selected, false, true);
      }
    } else {
      lastSentRect = null;
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(updateSelectionLoop);
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(updateSelectionLoop);

  // Ignore our highlight bookkeeping and coalesce application updates once per
  // animation frame. Telemetry must never feed back into another DOM refresh.
  if (typeof MutationObserver !== 'undefined') {
    var mutationFrame = null;
    var treeDirty = false;
    // Stamped elements were added or removed, or stamps moved: the source was re-rendered. A class change may be the
    // editor's preview, and a <style> swap is Tailwind's CSS update; neither means the stamps are current.
    var stampsDirty = false;
    function stamped(node) {
      return node.nodeType === 1 && (node.hasAttribute('__GLIDE_SOURCE_ATTR__') || !!node.querySelector('[__GLIDE_SOURCE_ATTR__]'));
    }
    function rendersSource(record) {
      if (record.type === 'attributes') return record.attributeName === '__GLIDE_SOURCE_ATTR__';
      return record.type === 'childList' && (Array.prototype.some.call(record.addedNodes || [], stamped)
        || Array.prototype.some.call(record.removedNodes || [], stamped));
    }
    var observer = new MutationObserver(function(records) {
      var relevant = false;
      records.forEach(function(record) {
        if (record.type === 'attributes' && (record.attributeName === '__GLIDE_HOVER_ATTR__' || record.attributeName === '__GLIDE_SELECTED_ATTR__' || record.attributeName === 'data-glide-design-mode')) return;
        var target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (target && ((target.id || '').indexOf('__glide_') === 0 || (target.closest && target.closest('[data-glide-bridge]')))) return;
        relevant = true;
        if (record.type !== 'attributes' || record.attributeName === '__GLIDE_SOURCE_ATTR__' || record.attributeName === 'class' || record.attributeName === 'data-gl-name') treeDirty = true;
        if (rendersSource(record)) stampsDirty = true;
      });
      if (!relevant || mutationFrame !== null) return;
      mutationFrame = requestAnimationFrame(function() {
        mutationFrame = null;
        if (isDragging || window.__glide_inline_editing__) return;
        sendReadyState();
        // The tree goes first: it tells the editor the page re-rendered, so the stamps that follow are current.
        if (treeDirty) { treeDirty = false; sendDOMTree(stampsDirty); stampsDirty = false; }
        window.__glide_update_selection_node__();
        if (selected && !interactionMode) sendMsg('glide:element-selected', selected, false, true);
        if (hovered && !interactionMode) sendMsg('glide:element-hovered', hovered);
      });
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
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
  if (typeof setInterval === 'function') {
    setInterval(sendHeight, 500);
    // Start polling to send ready state as soon as elements exist
    readyInterval = setInterval(sendReadyState, 200);
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    sendReadyState();
  } else {
    window.addEventListener('DOMContentLoaded', sendReadyState);
  }
}
