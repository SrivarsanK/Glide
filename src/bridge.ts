export interface ElementRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export class GlideBridge {
  private targetWindow: Window;
  private activeHoverElement: HTMLElement | null = null;

  constructor(targetWindow: Window = window) {
    this.targetWindow = targetWindow;
  }

  public init(): void {
    this.targetWindow.document.addEventListener('mousemove', this.handleMouseMove);
    this.targetWindow.document.addEventListener('click', this.handleClick, true);
  }

  public dispose(): void {
    this.targetWindow.document.removeEventListener('mousemove', this.handleMouseMove);
    this.targetWindow.document.removeEventListener('click', this.handleClick, true);
  }

  private handleMouseMove = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const sourceEl = target.closest('[data-cf-source]') as HTMLElement | null;

    if (sourceEl) {
      if (this.activeHoverElement !== sourceEl) {
        this.activeHoverElement = sourceEl;
        this.sendTelemetry('glide:element-hovered', sourceEl);
      }
    } else if (this.activeHoverElement) {
      this.activeHoverElement = null;
      this.targetWindow.parent.postMessage({ type: 'glide:element-hover-exit' }, '*');
    }
  };

  private handleClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const sourceEl = target.closest('[data-cf-source]') as HTMLElement | null;
    if (sourceEl) {
      // Prevent default app action during visual overlay interaction
      event.preventDefault();
      event.stopPropagation();
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
