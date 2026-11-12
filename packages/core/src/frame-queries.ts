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
    return {
      parentId: stamped.getAttribute(attributes.source) || '',
      x: Math.round(x - rect.left - (block ? block.clientLeft : 0) + (block ? block.scrollLeft : 0)),
      y: Math.round(y - rect.top - (block ? block.clientTop : 0) + (block ? block.scrollTop : 0)),
    };
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
    return { label, width: size.width, height: size.height, css, html: clone.outerHTML,
      background: win.getComputedStyle(target).backgroundColor || '' };
  }

  return function run(query: string, payload: any): unknown {
    payload = payload || {};
    switch (query) {
      case 'container-at': return containerAt(Number(payload.x), Number(payload.y));
      case 'first-container': return firstContainer();
      case 'sources': return stampedElements().map(el => el.getAttribute(attributes.source));
      case 'export': return exportData(typeof payload.source === 'string' ? payload.source : undefined);
      case 'print': win.focus(); win.print(); return true;
      default: return null;
    }
  };
}
