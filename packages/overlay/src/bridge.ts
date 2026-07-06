export interface ElementRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const HOVER_STYLE = [
  'outline: 2px solid #38bdf8',
  'outline-offset: 2px',
  'transition: outline 0.1s',
].join(';');

export class GlideBridge {
  private targetWindow: Window;
  private activeHoverElement: HTMLElement | null = null;
  private selectedElement: HTMLElement | null = null;
  private styleSheet: HTMLStyleElement | null = null;

  constructor(targetWindow: Window = window) {
    this.targetWindow = targetWindow;
  }

  public init(): void {
    this.injectStyles();
    this.targetWindow.document.addEventListener('mousemove', this.handleMouseMove);
    this.targetWindow.document.addEventListener('click', this.handleClick, true);
    if (typeof this.targetWindow.addEventListener === 'function') {
      this.targetWindow.addEventListener('message', this.handleMessage);
    }
  }

  public dispose(): void {
    this.clearHover();
    this.clearSelection();
    this.styleSheet?.remove();
    this.targetWindow.document.removeEventListener('mousemove', this.handleMouseMove);
    this.targetWindow.document.removeEventListener('click', this.handleClick, true);
    if (typeof this.targetWindow.removeEventListener === 'function') {
      this.targetWindow.removeEventListener('message', this.handleMessage);
    }
  }

  private injectStyles(): void {
    const doc = this.targetWindow.document;
    if (doc.getElementById('__glide_styles__')) return;
    this.styleSheet = doc.createElement('style');
    this.styleSheet.id = '__glide_styles__';
    this.styleSheet.textContent = `
      [data-glide-hover] {
        outline: 2px solid rgba(56,189,248,0.6) !important;
        outline-offset: 1px;
      }
      [data-glide-selected] {
        outline: 2px solid #38bdf8 !important;
        outline-offset: 2px;
      }
    `;
    doc.head.appendChild(this.styleSheet);
  }

  private clearHover(): void {
    if (this.activeHoverElement) {
      this.activeHoverElement.removeAttribute('data-glide-hover');
      this.activeHoverElement = null;
    }
  }

  private clearSelection(): void {
    if (this.selectedElement) {
      this.selectedElement.removeAttribute('data-glide-selected');
      this.selectedElement = null;
    }
  }

  private handleMessage = (event: MessageEvent): void => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'glide:select-element-by-id') {
      const el = this.targetWindow.document.querySelector(
        `[data-gl-source="${data.id}"]`
      ) as HTMLElement | null;
      if (el) {
        this.clearSelection();
        this.selectedElement = el;
        el.setAttribute('data-glide-selected', '');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        // Send telemetry so the editor gets glide:overlay with rect + computedStyles
        // This drives the canvas overlay highlight and properties panel population.
        this.sendTelemetry('glide:element-selected', el);
      }
    }
  };

  private handleMouseMove = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const sourceEl = target.closest('[data-gl-source]') as HTMLElement | null;

    if (sourceEl) {
      if (this.activeHoverElement !== sourceEl) {
        this.clearHover();
        this.activeHoverElement = sourceEl;
        sourceEl.setAttribute('data-glide-hover', '');
        this.sendTelemetry('glide:element-hovered', sourceEl);
      }
    } else if (this.activeHoverElement) {
      this.clearHover();
      this.targetWindow.parent.postMessage({ type: 'glide:element-hover-exit' }, '*');
    }
  };

  private handleClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const sourceEl = target.closest('[data-gl-source]') as HTMLElement | null;
    if (sourceEl) {
      event.preventDefault();
      event.stopPropagation();
      this.clearSelection();
      this.selectedElement = sourceEl;
      sourceEl.setAttribute('data-glide-selected', '');
      this.sendTelemetry('glide:element-selected', sourceEl);
    }
  };

  private sendTelemetry(type: string, el: HTMLElement): void {
    const source = el.getAttribute('data-gl-source') || '';
    const rect = el.getBoundingClientRect();
    const getCS = (this.targetWindow as any).getComputedStyle;
    const cs = typeof getCS === 'function' ? getCS(el) : {} as CSSStyleDeclaration;

    const computedStyles = {
      tagName: el.tagName.toLowerCase(),
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
      tagName: el.tagName.toLowerCase(),
      classNames: el.className,
      rect: {
        left: rect.left + this.targetWindow.scrollX,
        top: rect.top + this.targetWindow.scrollY,
        width: rect.width,
        height: rect.height,
      },
    };

    if (this.targetWindow !== this.targetWindow.parent) {
      this.targetWindow.parent.postMessage(normalized, '*');

      // Also emit overlay message with full computed styles for properties panel
      this.targetWindow.parent.postMessage({
        type: 'glide:overlay',
        source,
        rect: {
          x: rect.left + this.targetWindow.scrollX,
          y: rect.top + this.targetWindow.scrollY,
          width: rect.width,
          height: rect.height,
        },
        isHover: type === 'glide:element-hovered',
        computedStyles,
      }, '*');
    }
  }
}
