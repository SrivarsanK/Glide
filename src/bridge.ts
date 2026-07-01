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
        `[data-cf-source="${data.id}"]`
      ) as HTMLElement | null;
      if (el) {
        this.clearSelection();
        this.selectedElement = el;
        el.setAttribute('data-glide-selected', '');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        this.sendTelemetry('glide:element-selected', el);
      }
    }
  };

  private handleMouseMove = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const sourceEl = target.closest('[data-cf-source]') as HTMLElement | null;

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

    const sourceEl = target.closest('[data-cf-source]') as HTMLElement | null;
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
    const source = el.getAttribute('data-cf-source') || '';
    const rect = el.getBoundingClientRect();

    this.targetWindow.parent.postMessage(
      {
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
      },
      '*'
    );
  }
}
