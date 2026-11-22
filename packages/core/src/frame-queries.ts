/**
 * Answers the editor's questions about the app page: which container is at a
 * point, which sources are rendered, what an export needs.
 *
 * Self-contained, with no imports: the editor runs it directly while the
 * preview has the editor's origin, and the injected bridge runs it when the
 * preview has a different origin and the editor cannot read its document.
 */
export function createFrameQueries(win: any, attributes: { source: string; selected: string; hover: string }) {
  const doc = win.document;
  const containers = ['div', 'main', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'form', 'fieldset', 'li', 'td'];

  /** The authored container at a viewport point, with the point as an offset in its containing block. */
  function containerAt(x: number, y: number) {
    let stamped = doc.elementFromPoint(x, y);
    while (stamped && (!stamped.hasAttribute(attributes.source) || containers.indexOf(stamped.localName) < 0)) stamped = stamped.parentElement;
    if (!stamped) return null;
    // Absolute offsets are relative to the containing block, not the hit node.
    let block = stamped;
    while (block && win.getComputedStyle(block).position === 'static' && win.getComputedStyle(block).transform === 'none') block = block.parentElement;
    const rect = block ? block.getBoundingClientRect() : { left: -win.scrollX, top: -win.scrollY };
    const parentId = stamped.getAttribute(attributes.source) || '';
    return {
      parentId,
      x: Math.round(x - rect.left - (block ? block.clientLeft : 0) + (block ? block.scrollLeft : 0)),
      y: Math.round(y - rect.top - (block ? block.clientTop : 0) + (block ? block.scrollTop : 0)),
      ...siblingAt(stamped, parentId, x, y),
    };
  }

  /**
   * The in-flow child a new element goes next to, in the container's reading order.
   * Only children stamped from the container's own file can be its direct JSX children.
   */
  function siblingAt(container: any, parentId: string, x: number, y: number): { siblingId?: string; position?: 'before' | 'after' } {
    const file = (id: string) => id.replace(/:\d+:\d+(?::[a-fA-F0-9]+)?$/, '');
    const style = win.getComputedStyle(container);
    const display = String(style.display || ''), direction = String(style.flexDirection || '');
    const flex = display.indexOf('flex') >= 0, reverse = flex && direction.indexOf('reverse') >= 0;
    const row = flex && direction.indexOf('row') === 0;
    const wraps = display.indexOf('grid') >= 0 || (row && style.flexWrap && style.flexWrap !== 'nowrap');
    // `wrap-reverse` stacks the lines bottom to top, whatever the row direction.
    const upward = row && style.flexWrap === 'wrap-reverse';
    let last: any = null;
    for (const child of Array.prototype.slice.call(container.children || [])) {
      const id = child.getAttribute(attributes.source);
      const position = win.getComputedStyle(child).position;
      if (!id || file(id) !== file(parentId) || position === 'absolute' || position === 'fixed') continue;
      const r = child.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      // A reversed row runs right to left, also within each wrapped line.
      const later = reverse && row ? cx < x : cx > x;
      const after = wraps ? (upward ? r.top + r.height < y || (r.top < y && later) : r.top > y || (r.top + r.height > y && later))
        : row ? later : (reverse ? cy < y : cy > y);
      if (after) return { siblingId: id, position: 'before' };
      last = child;
    }
    return last ? { siblingId: last.getAttribute(attributes.source), position: 'after' } : {};
  }

  function stampedElements(): any[] {
    return Array.prototype.slice.call(doc.querySelectorAll('[' + attributes.source + ']'));
  }

  /** The first authored block container: where a shape drawn outside the frame is kept. */
  function firstContainer() {
    const root = stampedElements().filter(el => ['div', 'main', 'section', 'article'].indexOf(el.localName) >= 0)[0];
    return root ? { parentId: root.getAttribute(attributes.source) || '' } : null;
  }

  /** The markup, styles and size that the editor needs to render an export of one element or the page. */
  function exportData(source?: string) {
    let target = null;
    if (source) {
      target = doc.querySelector('[' + attributes.selected + ']')
        || stampedElements().filter(el => el.getAttribute(attributes.source) === source)[0] || null;
    }
    const label = target ? target.tagName.toLowerCase() : 'canvas';
    if (!target) target = doc.body;
    const rect = target.getBoundingClientRect();
    const size = { width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)) };
    if (target.tagName.toLowerCase() === 'svg') {
      return { label, width: size.width, height: size.height, svg: new win.XMLSerializer().serializeToString(target) };
    }
    let css = '';
    for (let s = 0; s < doc.styleSheets.length; s++) {
      try {
        const rules = doc.styleSheets[s].cssRules || [];
        for (let r = 0; r < rules.length; r++) css += rules[r].cssText + '\n';
      } catch (_) { /* A stylesheet from another origin cannot be read. */ }
    }
    const clone = target.cloneNode(true);
    const strip = (el: any) => { el.removeAttribute(attributes.selected); el.removeAttribute(attributes.hover); };
    strip(clone);
    Array.prototype.forEach.call(clone.querySelectorAll('*'), strip);
    // The editor puts this markup in an SVG, which is XML: <input> and <img> must be closed.
    return { label, width: size.width, height: size.height, css, html: new win.XMLSerializer().serializeToString(clone),
      background: win.getComputedStyle(target).backgroundColor || '' };
  }

  return function run(query: string, payload: any): unknown {
    payload = payload || {};
    switch (query) {
      case 'container-at': return containerAt(Number(payload.x), Number(payload.y));
      case 'first-container': return firstContainer();
      case 'sources': return stampedElements().map(el => el.getAttribute(attributes.source));
      case 'link-info': {
        const all = stampedElements().filter(item => item.getAttribute(attributes.source) === payload.source), el = all[0];
        if (!el) return null;
        const overlayOf = (item: any) => {
          const overlay = item.parentElement && item.parentElement.closest ? item.parentElement.closest('[popover]') : null;
          return overlay ? overlay.id || null : null;
        };
        // One source can render in several places, and Close writes one target for all of them.
        const around = all.map(overlayOf), shared = around.every(id => id === around[0]);
        return { tag: el.localName, href: el.getAttribute('href'), target: el.getAttribute('target'), rel: el.getAttribute('rel'),
          type: el.getAttribute('type'), popoverTarget: el.getAttribute('popovertarget'), popoverAction: el.getAttribute('popovertargetaction'),
          inPopover: shared ? around[0] : null, overlayMixed: !shared, className: el.getAttribute('class') || '' };
      }
      case 'ids': {
        // How many elements use each id: a fragment link goes to the first, so only unique ids are targets.
        // No prototype, so ids like "constructor" count from zero.
        const counts: Record<string, number> = Object.create(null), popovers: Record<string, boolean> = Object.create(null);
        Array.prototype.forEach.call(doc.querySelectorAll('[id]'), (el: any) => {
          counts[el.id] = (counts[el.id] || 0) + 1;
          if (el.hasAttribute('popover')) popovers[el.id] = true;
        });
        return Object.keys(counts).filter(id => !/^_*glide/i.test(id)).map(id => ({ id, count: counts[id], popover: !!popovers[id] }));
      }
      case 'show-popover': {
        // A closed overlay is not rendered, so the editor opens it to make it selectable.
        const el = doc.getElementById(String(payload.id || ''));
        if (!el || typeof el.showPopover !== 'function') return false;
        try { el.showPopover(); return true; } catch (_) { return false; }
      }
      case 'export': return exportData(typeof payload.source === 'string' ? payload.source : undefined);
      case 'print': win.focus(); win.print(); return true;
      default: return null;
    }
  };
}
