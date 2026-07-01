export interface ElementRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type ResizeCallback = (
  source: string,
  rect: ElementRect,
  delta: { width: number; height: number; left: number; top: number }
) => void;

export class GlideOverlay {
  private targetWindow: Window;
  private container: HTMLElement;
  private svg: SVGSVGElement | null = null;
  private selectionRect: ElementRect | null = null;
  private activeSource: string | null = null;
  private resizeCallback: ResizeCallback | null = null;

  // Drag states
  private dragHandle: string | null = null;
  private startPointerX = 0;
  private startPointerY = 0;
  private startRect: ElementRect | null = null;

  constructor(targetWindow: Window = window, container: HTMLElement = targetWindow.document.body) {
    this.targetWindow = targetWindow;
    this.container = container;
  }

  public init(): void {
    this.targetWindow.addEventListener('message', this.handleMessage);
    this.targetWindow.addEventListener('pointermove', this.handlePointerMove);
    this.targetWindow.addEventListener('pointerup', this.handlePointerUp);
  }

  public dispose(): void {
    this.targetWindow.removeEventListener('message', this.handleMessage);
    this.targetWindow.removeEventListener('pointermove', this.handlePointerMove);
    this.targetWindow.removeEventListener('pointerup', this.handlePointerUp);
    this.removeOverlay();
  }

  public onResize(callback: ResizeCallback): void {
    this.resizeCallback = callback;
  }

  private handleMessage = (event: MessageEvent): void => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'glide:element-selected') {
      this.activeSource = data.source;
      this.selectionRect = data.rect;
      this.renderOverlay();
    }
  };

  private renderOverlay(): void {
    if (!this.selectionRect) return;

    if (!this.svg) {
      const doc = this.targetWindow.document;
      this.svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
      this.svg.style.position = 'absolute';
      this.svg.style.top = '0';
      this.svg.style.left = '0';
      this.svg.style.width = '100%';
      this.svg.style.height = '100%';
      this.svg.style.pointerEvents = 'none';
      this.svg.style.zIndex = '999999';
      this.container.appendChild(this.svg);
    }

    // Clear contents
    this.svg.innerHTML = '';

    const rect = this.selectionRect;
    
    // Draw boundary box outline
    const outline = this.targetWindow.document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    outline.setAttribute('x', String(rect.left));
    outline.setAttribute('y', String(rect.top));
    outline.setAttribute('width', String(rect.width));
    outline.setAttribute('height', String(rect.height));
    outline.setAttribute('fill', 'none');
    outline.setAttribute('stroke', '#0070f3');
    outline.setAttribute('stroke-width', '2');
    this.svg.appendChild(outline);

    // Create 8 handles
    const handlePositions = [
      { id: 'tl', x: rect.left, y: rect.top },
      { id: 'tc', x: rect.left + rect.width / 2, y: rect.top },
      { id: 'tr', x: rect.left + rect.width, y: rect.top },
      { id: 'ml', x: rect.left, y: rect.top + rect.height / 2 },
      { id: 'mr', x: rect.left + rect.width, y: rect.top + rect.height / 2 },
      { id: 'bl', x: rect.left, y: rect.top + rect.height },
      { id: 'bc', x: rect.left + rect.width / 2, y: rect.top + rect.height },
      { id: 'br', x: rect.left + rect.width, y: rect.top + rect.height },
    ];

    handlePositions.forEach((pos) => {
      const handle = this.targetWindow.document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const size = 6;
      handle.setAttribute('x', String(pos.x - size / 2));
      handle.setAttribute('y', String(pos.y - size / 2));
      handle.setAttribute('width', String(size));
      handle.setAttribute('height', String(size));
      handle.setAttribute('fill', '#ffffff');
      handle.setAttribute('stroke', '#0070f3');
      handle.setAttribute('stroke-width', '1.5');
      handle.style.pointerEvents = 'auto';
      handle.style.cursor = this.getCursorForHandle(pos.id);

      handle.addEventListener('pointerdown', (e: PointerEvent) => {
        e.stopPropagation();
        this.dragHandle = pos.id;
        this.startPointerX = e.clientX;
        this.startPointerY = e.clientY;
        this.startRect = { ...rect };
      });

      this.svg!.appendChild(handle);
    });
  }

  private removeOverlay(): void {
    if (this.svg && this.svg.parentNode) {
      this.svg.parentNode.removeChild(this.svg);
    }
    this.svg = null;
  }

  private getCursorForHandle(id: string): string {
    switch (id) {
      case 'tl': case 'br': return 'nwse-resize';
      case 'tr': case 'bl': return 'nesw-resize';
      case 'tc': case 'bc': return 'ns-resize';
      case 'ml': case 'mr': return 'ew-resize';
      default: return 'default';
    }
  }

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.dragHandle || !this.startRect || !this.activeSource) return;

    const dx = e.clientX - this.startPointerX;
    const dy = e.clientY - this.startPointerY;

    let width = this.startRect.width;
    let height = this.startRect.height;
    let left = this.startRect.left;
    let top = this.startRect.top;

    // Resizing logic depending on the handle
    if (this.dragHandle.includes('r')) {
      width = Math.max(10, this.startRect.width + dx);
    } else if (this.dragHandle.includes('l')) {
      const targetWidth = this.startRect.width - dx;
      if (targetWidth >= 10) {
        width = targetWidth;
        left = this.startRect.left + dx;
      }
    }

    if (this.dragHandle.includes('b')) {
      height = Math.max(10, this.startRect.height + dy);
    } else if (this.dragHandle.includes('t')) {
      const targetHeight = this.startRect.height - dy;
      if (targetHeight >= 10) {
        height = targetHeight;
        top = this.startRect.top + dy;
      }
    }

    const delta = {
      width: width - this.startRect.width,
      height: height - this.startRect.height,
      left: left - this.startRect.left,
      top: top - this.startRect.top,
    };

    this.selectionRect = { left, top, width, height };
    this.renderOverlay();

    if (this.resizeCallback) {
      this.resizeCallback(this.activeSource, this.selectionRect, delta);
    }
  };

  private handlePointerUp = (): void => {
    this.dragHandle = null;
    this.startRect = null;
  };
}
