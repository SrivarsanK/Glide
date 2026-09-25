export interface ElementRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export class GlideBridge {
  private targetWindow: Window;
  private activeHoverElement: HTMLElement | null = null;
  private selectedElement: HTMLElement | null = null;
  private styleSheet: HTMLStyleElement | null = null;
  private sourceAttribute: string;
  private hoverAttribute: string;
  private selectedAttribute: string;
  private selectedElements: Set<HTMLElement> = new Set();

  constructor(targetWindow: Window = window, options?: { sourceAttribute?: string; hoverAttribute?: string; selectedAttribute?: string }) {
    this.targetWindow = targetWindow;
    this.sourceAttribute = options?.sourceAttribute ?? 'data-gl-source';
    this.hoverAttribute = options?.hoverAttribute ?? 'data-glide-hover';
    this.selectedAttribute = options?.selectedAttribute ?? 'data-glide-selected';
  }

  public init(): void {
    this.injectStyles();
    this.targetWindow.document.addEventListener('mousemove', this.handleMouseMove);
    this.targetWindow.document.addEventListener('click', this.handleClick, true);
    this.targetWindow.document.addEventListener('dblclick', this.handleDblClick, true);
    this.targetWindow.document.addEventListener('contextmenu', this.handleContextMenu, true);
    if (typeof this.targetWindow.addEventListener === 'function') {
      this.targetWindow.addEventListener('scroll', this.handleScrollOrResize, { passive: true, capture: true });
      this.targetWindow.addEventListener('resize', this.handleScrollOrResize, { passive: true });
      this.targetWindow.addEventListener('message', this.handleMessage);
    }
  }

  public dispose(): void {
    this.clearHover();
    this.clearSelection();
    this.styleSheet?.remove();
    this.targetWindow.document.removeEventListener('mousemove', this.handleMouseMove);
    this.targetWindow.document.removeEventListener('click', this.handleClick, true);
    this.targetWindow.document.removeEventListener('dblclick', this.handleDblClick, true);
    this.targetWindow.document.removeEventListener('contextmenu', this.handleContextMenu, true);
    if (typeof this.targetWindow.removeEventListener === 'function') {
      this.targetWindow.removeEventListener('scroll', this.handleScrollOrResize, true);
      this.targetWindow.removeEventListener('resize', this.handleScrollOrResize);
      this.targetWindow.removeEventListener('message', this.handleMessage);
    }
  }

  public getSelectedElements(): HTMLElement[] {
    return Array.from(this.selectedElements);
  }

  private findTopStampedContainer(leaf: HTMLElement): HTMLElement {
    let top: HTMLElement = leaf;
    let curr: HTMLElement | null = leaf.parentElement;
    while (curr && curr !== this.targetWindow.document?.body) {
      const hasAttr = typeof curr.hasAttribute === 'function' ? curr.hasAttribute(this.sourceAttribute) : !!curr.getAttribute?.(this.sourceAttribute);
      if (hasAttr) {
        top = curr;
      }
      curr = curr.parentElement;
    }
    return top;
  }

  private handleScrollOrResize = (): void => {
    if (this.selectedElement) {
      this.sendTelemetry('glide:element-selected', this.selectedElement);
    }
    if (this.activeHoverElement) {
      this.sendTelemetry('glide:element-hovered', this.activeHoverElement);
    }
  };

  private injectStyles(): void {
    const doc = this.targetWindow.document;
    if (doc.getElementById('__glide_styles__')) return;
    this.styleSheet = doc.createElement('style');
    this.styleSheet.id = '__glide_styles__';
    this.styleSheet.textContent = `
      [${this.hoverAttribute}] {
        outline: 2px solid rgba(56,189,248,0.6) !important;
        outline-offset: 1px;
      }
      [${this.selectedAttribute}] {
        outline: 2px solid #38bdf8 !important;
        outline-offset: 2px;
      }
    `;
    doc.head.appendChild(this.styleSheet);
  }

  private clearHover(): void {
    if (this.activeHoverElement) {
      if (typeof this.activeHoverElement.removeAttribute === 'function') {
        this.activeHoverElement.removeAttribute(this.hoverAttribute);
      }
      this.activeHoverElement = null;
    }
  }

  private clearSelection(): void {
    for (const el of this.selectedElements) {
      if (typeof el.removeAttribute === 'function') {
        el.removeAttribute(this.selectedAttribute);
      }
    }
    this.selectedElements.clear();
    if (this.selectedElement) {
      if (typeof this.selectedElement.removeAttribute === 'function') {
        this.selectedElement.removeAttribute(this.selectedAttribute);
      }
      this.selectedElement = null;
    }
  }

  private handleMessage = (event: MessageEvent): void => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'glide:select-element-by-id') {
      const el = this.targetWindow.document.querySelector(
        `[${this.sourceAttribute}="${data.id}"]`
      ) as HTMLElement | null;
      if (el) {
        this.clearSelection();
        this.selectedElement = el;
        this.selectedElements.add(el);
        if (typeof el.setAttribute === 'function') {
          el.setAttribute(this.selectedAttribute, '');
        }
        if (typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        // Send telemetry so the editor gets glide:overlay with rect + computedStyles
        // This drives the canvas overlay highlight and properties panel population.
        this.sendTelemetry('glide:element-selected', el);
      }
    }

    if (data.type === 'glide:clear-selection') {
      this.clearSelection();
    }

    if (data.type === 'glide:refresh-selection' || data.type === 'glide:refresh-rects') {
      if (this.selectedElement) {
        this.sendTelemetry('glide:element-selected', this.selectedElement);
      }
    }

    if (data.type === 'glide:hover-element-by-id') {
      const el = this.targetWindow.document.querySelector(
        `[${this.sourceAttribute}="${data.id}"]`
      ) as HTMLElement | null;
      if (el) {
        if (this.activeHoverElement && this.activeHoverElement !== el) {
          if (typeof this.activeHoverElement.removeAttribute === 'function') {
            this.activeHoverElement.removeAttribute(this.hoverAttribute);
          }
        }
        this.activeHoverElement = el;
        if (typeof el.setAttribute === 'function') {
          el.setAttribute(this.hoverAttribute, '');
        }
        this.sendTelemetry('glide:element-hovered', el);
      }
    }

    if (data.type === 'glide:hover-element-exit') {
      if (this.activeHoverElement) {
        if (typeof this.activeHoverElement.removeAttribute === 'function') {
          this.activeHoverElement.removeAttribute(this.hoverAttribute);
        }
        this.activeHoverElement = null;
      }
      if (this.targetWindow !== this.targetWindow.parent) {
        this.targetWindow.parent.postMessage({ type: 'glide:element-hover-exit' }, '*');
      }
    }
  };

  private handleMouseMove = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const sourceEl = (typeof target.closest === 'function' ? target.closest(`[${this.sourceAttribute}]`) : null) as HTMLElement | null;

    if (sourceEl) {
      if (this.activeHoverElement !== sourceEl) {
        this.clearHover();
        this.activeHoverElement = sourceEl;
        if (typeof sourceEl.setAttribute === 'function') {
          sourceEl.setAttribute(this.hoverAttribute, '');
        }
        this.sendTelemetry('glide:element-hovered', sourceEl);
      }
    } else if (this.activeHoverElement) {
      this.clearHover();
      if (this.targetWindow !== this.targetWindow.parent) {
        this.targetWindow.parent.postMessage({ type: 'glide:element-hover-exit' }, '*');
      }
    }
  };

  private handleClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const leaf = (typeof target.closest === 'function' ? target.closest(`[${this.sourceAttribute}]`) : null) as HTMLElement | null;
    if (!leaf) {
      if (this.selectedElement || this.selectedElements.size > 0) {
        this.clearSelection();
        if (this.targetWindow !== this.targetWindow.parent) {
          this.targetWindow.parent.postMessage({ type: 'glide:clear-selection' }, '*');
        }
      }
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const isDeep = !!(event.metaKey || event.ctrlKey);
    const isShift = !!event.shiftKey;
    const targetEl = isDeep ? leaf : this.findTopStampedContainer(leaf);

    if (isShift) {
      // Rule 3: Multi-selection toggle
      if (this.selectedElements.has(targetEl)) {
        this.selectedElements.delete(targetEl);
        if (typeof targetEl.removeAttribute === 'function') {
          targetEl.removeAttribute(this.selectedAttribute);
        }
        const remaining = Array.from(this.selectedElements);
        this.selectedElement = remaining.length > 0 ? remaining[remaining.length - 1] : null;
        const source = targetEl.getAttribute?.(this.sourceAttribute) || '';
        if (this.targetWindow !== this.targetWindow.parent) {
          this.targetWindow.parent.postMessage({ type: 'glide:element-deselected', source }, '*');
        }
      } else {
        this.selectedElements.add(targetEl);
        this.selectedElement = targetEl;
        if (typeof targetEl.setAttribute === 'function') {
          targetEl.setAttribute(this.selectedAttribute, '');
        }
        this.sendTelemetry('glide:element-selected', targetEl, { isShift: true, isDeep });
      }
    } else {
      // Single selection: replace current selection (Rule 1 top container, or Rule 2 deep leaf)
      this.clearSelection();
      this.selectedElements.add(targetEl);
      this.selectedElement = targetEl;
      if (typeof targetEl.setAttribute === 'function') {
        targetEl.setAttribute(this.selectedAttribute, '');
      }
      this.sendTelemetry('glide:element-selected', targetEl, { isShift: false, isDeep });
    }
  };

  private handleDblClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const leaf = (typeof target.closest === 'function' ? target.closest(`[${this.sourceAttribute}]`) : null) as HTMLElement | null;
    if (!leaf) return;

    event.preventDefault();
    event.stopPropagation();

    // Rule 1: Double-click drill-down
    // If an element is already selected and contains the clicked leaf (but is not the leaf itself), drill down 1 level
    if (this.selectedElement && typeof this.selectedElement.contains === 'function' && this.selectedElement.contains(leaf) && this.selectedElement !== leaf) {
      let stampedUnder: HTMLElement = leaf;
      let curr: HTMLElement | null = leaf;
      while (curr && curr !== this.selectedElement) {
        const hasAttr = typeof curr.hasAttribute === 'function' ? curr.hasAttribute(this.sourceAttribute) : !!curr.getAttribute?.(this.sourceAttribute);
        if (hasAttr) {
          stampedUnder = curr;
        }
        curr = curr.parentElement;
      }
      this.clearSelection();
      this.selectedElements.add(stampedUnder);
      this.selectedElement = stampedUnder;
      if (typeof stampedUnder.setAttribute === 'function') {
        stampedUnder.setAttribute(this.selectedAttribute, '');
      }
      this.sendTelemetry('glide:element-selected', stampedUnder, { isDrillDown: true });
    }
  };

  private handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();

    const clientX = event.clientX;
    const clientY = event.clientY;

    // Rule 4: Depth-stacked layer raycast along z-axis (innermost child first)
    const layerStack: Array<{ source: string; tagName: string; name: string }> = [];
    let curr = event.target as HTMLElement | null;
    while (curr && curr !== this.targetWindow.document?.body) {
      const hasAttr = typeof curr.hasAttribute === 'function' ? curr.hasAttribute(this.sourceAttribute) : !!curr.getAttribute?.(this.sourceAttribute);
      if (hasAttr) {
        const source = curr.getAttribute?.(this.sourceAttribute) || '';
        const tagName = (curr.tagName || '').toLowerCase();
        const name = curr.getAttribute?.('data-gl-name') || tagName;
        layerStack.push({ source, tagName, name });
      }
      curr = curr.parentElement;
    }

    if (this.targetWindow !== this.targetWindow.parent) {
      this.targetWindow.parent.postMessage({
        type: 'glide:contextmenu',
        clientX,
        clientY,
        layerStack,
      }, '*');
    }
  };

  private sendTelemetry(
    type: string,
    el: HTMLElement,
    options?: { isShift?: boolean; isDeep?: boolean; isDrillDown?: boolean }
  ): void {
    const source = (el.getAttribute && el.getAttribute(this.sourceAttribute)) || el.closest?.(`[${this.sourceAttribute}]`)?.getAttribute(this.sourceAttribute) || '';
    const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    const getCS = this.targetWindow.getComputedStyle;
    const cs = typeof getCS === 'function' ? getCS.call(this.targetWindow, el) : {} as CSSStyleDeclaration;

    const computedStyles = {
      tagName: (el.tagName || '').toLowerCase(),
      // Layout
      display: cs.display,
      flexDirection: cs.flexDirection,
      justifyContent: cs.justifyContent,
      alignItems: cs.alignItems,
      flexWrap: cs.flexWrap,
      gap: cs.gap,
      rowGap: cs.rowGap,
      columnGap: cs.columnGap,
      // Spacing
      marginTop: cs.marginTop,
      marginBottom: cs.marginBottom,
      marginLeft: cs.marginLeft,
      marginRight: cs.marginRight,
      paddingTop: cs.paddingTop,
      paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft,
      paddingRight: cs.paddingRight,
      // Typography
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      textAlign: cs.textAlign,
      textDecoration: cs.textDecoration,
      color: cs.color,
      // Background / Fill
      backgroundColor: cs.backgroundColor,
      background: cs.background,
      backgroundImage: cs.backgroundImage,
      opacity: cs.opacity,
      // Border
      borderColor: cs.borderColor,
      borderWidth: cs.borderWidth,
      borderStyle: cs.borderStyle,
      borderTopLeftRadius: cs.borderTopLeftRadius,
      borderTopRightRadius: cs.borderTopRightRadius,
      borderBottomRightRadius: cs.borderBottomRightRadius,
      borderBottomLeftRadius: cs.borderBottomLeftRadius,
      // Shadow & transform
      boxShadow: cs.boxShadow,
      transform: cs.transform,
      width: cs.width,
      height: cs.height,
      position: cs.position,
      top: cs.top,
      left: cs.left,
    };

    const normalized = {
      type,
      source,
      tagName: (el.tagName || '').toLowerCase(),
      classNames: el.className || '',
      rect: {
        left: rect.left + (this.targetWindow.scrollX || 0),
        top: rect.top + (this.targetWindow.scrollY || 0),
        width: rect.width || 0,
        height: rect.height || 0,
      },
    };

    if (this.targetWindow !== this.targetWindow.parent) {
      this.targetWindow.parent.postMessage(normalized, '*');

      // Also emit overlay message with full computed styles for properties panel
      this.targetWindow.parent.postMessage({
        type: 'glide:overlay',
        source,
        isShift: options?.isShift ?? false,
        isDeep: options?.isDeep ?? false,
        isDrillDown: options?.isDrillDown ?? false,
        rect: {
          x: rect.left + (this.targetWindow.scrollX || 0),
          y: rect.top + (this.targetWindow.scrollY || 0),
          width: rect.width || 0,
          height: rect.height || 0,
        },
        isHover: type === 'glide:element-hovered',
        computedStyles,
      }, '*');
    }
  }
}
