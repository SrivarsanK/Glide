/** Native top-layer controls: never alter the canvas document or source. */
export const editorNavigationHTML = `
  <div id="editor-zoom-menu" class="editor-zoom-menu" popover="auto" aria-label="Canvas zoom">
    <div class="editor-menu-heading">Canvas zoom</div>
    <button type="button" data-canvas-zoom="0.5">50%</button>
    <button type="button" data-canvas-zoom="1">100% <kbd>Ctrl 1</kbd></button>
    <button type="button" data-canvas-zoom="2">200%</button>
    <button type="button" data-canvas-zoom="fit">Fit frame <kbd>Shift 1</kbd></button>
    <button type="button" data-canvas-zoom="selection">Fit selection <kbd>Shift 2</kbd></button>
  </div>
  <dialog id="editor-shortcut-dialog" class="editor-shortcut-dialog" aria-labelledby="editor-shortcut-title">
    <form method="dialog"><h2 id="editor-shortcut-title">Keyboard shortcuts</h2><button aria-label="Close shortcuts" value="close">×</button></form>
    <p>Edit the canvas. Keep your source.</p>
    <dl>
      <dt>Select / Hand</dt><dd><kbd>V</kbd> <kbd>H</kbd></dd>
      <dt>Frame / Rectangle / Ellipse / Text</dt><dd><kbd>F</kbd> <kbd>R</kbd> <kbd>O</kbd> <kbd>T</kbd></dd>
      <dt>Pan canvas</dt><dd><kbd>Space</kbd> + drag</dd>
      <dt>Zoom at pointer</dt><dd><kbd>Ctrl</kbd> + scroll</dd>
      <dt>Fit frame / selection</dt><dd><kbd>Shift 1</kbd> <kbd>Shift 2</kbd></dd>
      <dt>Undo / Redo</dt><dd><kbd>Ctrl Z</kbd> <kbd>Ctrl Shift Z</kbd></dd>
      <dt>Group / Ungroup</dt><dd><kbd>Ctrl G</kbd> <kbd>Ctrl Shift G</kbd></dd>
      <dt>Toggle grid / rulers</dt><dd><kbd>Shift G</kbd> <kbd>Ctrl ;</kbd></dd>
      <dt>Nudge / large nudge</dt><dd><kbd>Arrow</kbd> <kbd>Shift Arrow</kbd></dd>
      <dt>Show or hide panels</dt><dd><kbd>\\</kbd></dd>
      <dt>Cancel / clear selection</dt><dd><kbd>Esc</kbd></dd>
    </dl>
    <p>On macOS, use Command in place of Ctrl.</p>
  </dialog>`;

/** Self-contained because this function is embedded in the served editor. */
export function createEditorNavigation(doc: Document, actions: {
  zoom: (value: number) => void; fit: () => void; selection: () => void;
}) {
  const menu = doc.getElementById('editor-zoom-menu') as HTMLElement;
  const help = doc.getElementById('editor-shortcut-dialog') as HTMLDialogElement;
  const helpButton = doc.getElementById('btn-help-floating');
  const showHelp = () => { if (!help.open) help.showModal(); };
  helpButton?.addEventListener('click', showHelp);
  doc.getElementById('btn-editor-shortcuts')?.addEventListener('click', showHelp);
  menu.addEventListener('click', event => {
    const target = (event.target as Element).closest<HTMLElement>('[data-canvas-zoom]');
    if (!target) return;
    const value = target.dataset.canvasZoom;
    if (value === 'fit') actions.fit();
    else if (value === 'selection') actions.selection();
    else if (value && Number.isFinite(Number(value))) actions.zoom(Number(value));
    menu.hidePopover();
  });
  menu.addEventListener('beforetoggle', event => {
    if ((event as ToggleEvent).newState !== 'open') return;
    const button = doc.getElementById('zoom-label')!;
    const rect = button.getBoundingClientRect();
    menu.style.top = (rect.bottom + 8) + 'px';
    menu.style.left = Math.max(8, Math.min(rect.right - 224, doc.documentElement.clientWidth - 232)) + 'px';
  });
  return { showHelp };
}
