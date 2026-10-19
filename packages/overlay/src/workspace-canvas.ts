interface WorkspaceObject {
  id: string;
  source: string;
  file: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tagName: string;
  text: string;
  styles: Record<string, string | number>;
  children?: WorkspaceObject[];
}

/** Source-derived pasteboard. No secondary object store or executable preview HTML. */
export function createWorkspaceCanvas(options: {
  host: HTMLElement;
  layers: HTMLElement;
  point(event: PointerEvent): { x: number; y: number };
  inside(x: number, y: number): boolean;
  destination(x: number, y: number): { parentId: string; file: string; x: number; y: number } | null;
  mutate(source: string, change: Record<string, unknown>): void;
  error(message: string): void;
  select(source: string): void;
}) {
  const files = new Map<string, WorkspaceObject[]>();
  let selected: string | null = null;
  let moving = false;
  let deferredRender = false;
  const safeStyles = new Set(['color', 'backgroundColor', 'borderRadius', 'border', 'borderWidth',
    'borderStyle', 'borderColor', 'fontSize', 'fontFamily', 'fontWeight', 'lineHeight', 'textAlign',
    'padding', 'display', 'gap', 'flexDirection', 'alignItems', 'justifyContent', 'opacity', 'boxShadow']);
  function preview(object: WorkspaceObject): HTMLElement {
    const element = document.createElement('div');
    for (const [key, value] of Object.entries(object.styles || {})) {
      if (safeStyles.has(key)) (element.style as any)[key] = String(value);
    }
    // A symbolic preview never executes expressions, loads URLs, or invokes components.
    element.textContent = object.text || '';
    for (const child of object.children || []) element.appendChild(preview(child));
    if (!element.textContent && /^[A-Z]/.test(object.tagName || '')) element.textContent = '<' + object.tagName + '>';
    return element;
  }
  function button(label: string, action: () => void) {
    const el = document.createElement('button');
    el.type = 'button'; el.textContent = label;
    el.style.cssText = 'background:#333;color:#eee;border:1px solid #555;border-radius:4px;padding:4px 6px;cursor:pointer';
    el.addEventListener('click', action);
    return el;
  }
  function choose(object: WorkspaceObject) {
    selected = object.id;
    options.select(object.source);
    options.host.querySelectorAll<HTMLElement>('[data-workspace-id]').forEach(el => {
      el.style.outline = el.dataset.workspaceId === selected ? '2px solid #0d99ff' : '1px solid #777';
    });
  }
  function render() {
    if (moving) { deferredRender = true; return; }
    options.host.replaceChildren(); options.layers.replaceChildren();
    const objects = [...files.values()].flat();
    if (!objects.length) return;
    const title = document.createElement('div');
    title.textContent = 'Outside frame';
    title.style.cssText = 'padding:10px 8px;color:#aaa;font-size:11px';
    options.layers.appendChild(title);
    for (const object of objects) {
      const element = preview(object);
      element.dataset.workspaceId = object.id;
      Object.assign(element.style, { position: 'absolute', left: object.x + 'px', top: object.y + 'px',
        width: Math.max(1, object.width || 120) + 'px', height: Math.max(1, object.height || 32) + 'px',
        boxSizing: 'border-box', pointerEvents: 'auto', cursor: 'move', userSelect: 'none', overflow: 'hidden',
        outline: object.id === selected ? '2px solid #0d99ff' : '1px solid #777' });
      element.title = 'Drag into the frame to restore this source element';
      element.addEventListener('click', event => { event.stopPropagation(); choose(object); });
      element.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        event.preventDefault(); event.stopPropagation(); choose(object);
        moving = true;
        const start = options.point(event);
        let x = object.x, y = object.y;
        element.setPointerCapture(event.pointerId);
        const move = (next: PointerEvent) => {
          const point = options.point(next);
          x = Math.round(object.x + point.x - start.x); y = Math.round(object.y + point.y - start.y);
          element.style.left = x + 'px'; element.style.top = y + 'px';
        };
        const finish = (next: PointerEvent) => {
          element.removeEventListener('pointermove', move);
          element.removeEventListener('pointerup', finish);
          element.removeEventListener('pointercancel', cancel);
          moving = false;
          if (element.hasPointerCapture(next.pointerId)) element.releasePointerCapture(next.pointerId);
          if (next.type === 'pointercancel') { render(); return; }
          if (Math.abs(x - object.x) + Math.abs(y - object.y) < 2) { if (deferredRender) { deferredRender = false; render(); } return; }
          const drop = options.point(next);
          if (options.inside(drop.x, drop.y)) {
            const target = options.destination(drop.x, drop.y);
            if (!target || target.file.replace(/\\/g, '/') !== object.file.replace(/\\/g, '/')) {
              options.error('Choose a container in the same source file to preserve this element’s bindings.');
              render(); return;
            }
            // destination offsets are for the pointer; retain the grabbed offset.
            options.mutate(object.source, { type: 'attach', parentId: target.parentId,
              x: target.x - (drop.x - x), y: target.y - (drop.y - y) });
          } else options.mutate(object.source, { type: 'workspace-position', x, y });
          if (deferredRender) { deferredRender = false; render(); }
        };
        const cancel = (next: PointerEvent) => finish(next);
        element.addEventListener('pointermove', move);
        element.addEventListener('pointerup', finish);
        element.addEventListener('pointercancel', cancel);
      });
      options.host.appendChild(element);
      const row = document.createElement('div');
      row.dataset.workspaceLayer = object.id;
      row.style.cssText = 'padding:6px 8px;display:flex;flex-wrap:wrap;gap:5px;border-bottom:1px solid #333';
      const name = document.createElement('input');
      name.value = object.text || object.tagName;
      name.setAttribute('aria-label', 'Canvas object text');
      name.title = 'Edit authored text';
      name.style.cssText = 'width:100%;background:#222;border:1px solid #444;color:#eee;padding:4px';
      name.addEventListener('focus', () => choose(object));
      name.addEventListener('change', () => options.mutate(object.source, { type: 'text', value: name.value }));
      row.append(name, button('Restore', () => options.mutate(object.source, { type: 'attach' })),
        button('Delete', () => options.mutate(object.source, { type: 'delete' })));
      for (const property of ['width', 'height'] as const) {
        const input = document.createElement('input');
        input.type = 'number'; input.min = '1'; input.max = '10000'; input.value = String(object[property]);
        input.setAttribute('aria-label', 'Canvas object ' + property);
        input.title = property;
        input.style.cssText = 'width:65px;background:#222;border:1px solid #444;color:#eee;padding:4px';
        input.addEventListener('change', () => {
          const value = Number(input.value);
          if (Number.isFinite(value) && value > 0 && value <= 10000) {
            options.mutate(object.source, { type: 'style', value: { [property]: value + 'px' }, authoringRepresentation: 'inline' });
          }
        });
        row.appendChild(input);
      }
      options.layers.appendChild(row);
    }
  }
  return {
    update(file: string, objects: WorkspaceObject[]) { files.set(file, objects); render(); },
    clearSelection() { selected = null; },
    refresh: render,
  };
}
