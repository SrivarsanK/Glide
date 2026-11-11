/** Editor-only chrome. Page content remains isolated in the preview iframe. */
export const editorChromeCSS = `
  :root {
    --chrome-field: color-mix(in srgb, var(--bg-panel) 88%, white);
    --chrome-hover: color-mix(in srgb, var(--bg-panel) 82%, white);
    --chrome-selected: color-mix(in srgb, var(--accent-color) 20%, var(--bg-panel));
    --chrome-shadow: 0 8px 24px rgb(0 0 0 / 24%), 0 1px 3px rgb(0 0 0 / 20%);
  }
  body { font-size: 12px; line-height: 1.4; -webkit-font-smoothing: antialiased; }
  body > header {
    height: 96px; display: grid; grid-template-columns: minmax(220px, 1fr) auto;
    grid-template-rows: 48px 48px; gap: 0 12px; padding: 0 12px;
    background: var(--bg-panel); border-bottom: 1px solid var(--border-color);
  }
  body > header > * { flex-shrink: 0; }
  .editor-identity { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .editor-actions { grid-row: 2; grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; margin-left: 0; border-top: 1px solid var(--border-color); height: 48px; }
  .editor-view-controls { grid-row: 1; grid-column: 2; display: flex; align-items: center; gap: 8px; }
  body > header .logo img { width: 24px; height: 24px; object-fit: contain; }
  #header-file-name { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #branch-subtitle { line-height: 16px; }
  body > header .toolbar { gap: 8px !important; }
  body > header .toolbar-input-group { height: 32px !important; background: var(--chrome-field) !important; }
  #app-url { width: clamp(110px, 11vw, 180px) !important; }
  .header-sidebar-btn, .connection-btn, .zoom-btn, .device-btn, .icon-btn,
  .staging-btn, .writeback-mode-btn { font-family: inherit; transition: background-color 100ms, color 100ms; }
  .header-sidebar-btn { width: 32px; height: 32px; border-radius: 6px; }
  .header-sidebar-btn.active { background: var(--chrome-selected); color: var(--text-primary); }
  .connection-btn { height: 32px; padding: 0 10px; font-size: 12px; }
  #btn-interaction-preview, #btn-move-to-canvas {
    background: var(--chrome-field); border-color: var(--border-color); color: var(--text-primary);
  }
  #btn-interaction-preview[aria-pressed="true"] { background: var(--chrome-selected); border-color: var(--accent-color); }
  #btn-interaction-preview:hover, #btn-move-to-canvas:hover { background: var(--chrome-hover); }
  body > header .zoom-control { height: 32px !important; background: var(--chrome-field) !important; }
  #viewport-dropdown-trigger { height: 32px !important; width: 164px !important; color: var(--text-primary) !important; }
  .writeback-mode-pill { border-radius: 6px; padding: 2px; background: var(--chrome-field); box-shadow: none; }
  .writeback-mode-btn { height: 26px; border-radius: 4px; font-size: 11px; box-shadow: none !important; }
  .writeback-mode-btn.active { background: var(--chrome-hover); color: var(--text-primary); border-color: var(--border-color); }
  .writeback-mode-btn.active .mode-dot { box-shadow: none; }
  .main-container { min-height: 0; height: auto; }
  .sidebar { width: 248px; min-width: 0; }
  .sidebar-right { width: 272px; }
  .sidebar-header {
    min-height: 44px; padding: 12px 16px; text-transform: none; letter-spacing: 0;
    font-size: 12px; font-weight: 600; color: var(--text-primary);
  }
  .sidebar .page-item { min-height: 32px; margin: 0 8px; padding: 6px 8px !important; border-radius: 5px; }
  .sidebar .layers-scroll { padding: 4px 0 12px; scrollbar-gutter: stable; }
  .layer-item { min-height: 30px; height: 30px; margin: 1px 8px; font-size: 12px; gap: 6px; }
  .layer-item.active { background: var(--chrome-selected) !important; box-shadow: inset 2px 0 var(--accent-color); }
  .layer-item.active .layer-tag, .layer-item.active .layer-text { color: var(--text-secondary) !important; }
  .layer-section-header { padding: 12px 16px 8px; font-size: 11px; letter-spacing: 0; text-transform: none; opacity: 1; }
  .layer-action-btn { min-width: 24px; min-height: 24px; border-radius: 4px; }
  .layer-actions { display: flex; opacity: 0; }
  .layer-item:hover .layer-actions, .layer-item:focus-within .layer-actions { opacity: 1; }
  .props-section { padding: 16px; }
  .props-section-title { font-size: 12px; font-weight: 600; text-transform: none; letter-spacing: 0; color: var(--text-primary); margin-bottom: 12px; }
  .props-subheader { margin: 12px 0 8px; font-size: 11px; font-weight: 500; text-transform: none; letter-spacing: 0; color: var(--text-secondary); }
  .props-grid { gap: 8px; }
  .props-grid > *, .props-grid-4 > *, .props-row > * { min-width: 0; }
  .props-row { margin-bottom: 8px; }
  .props-field { height: 32px; border-radius: 5px; padding: 4px 8px; background: var(--chrome-field); }
  .props-field:hover { border-color: var(--border-color); }
  .props-field:focus-within { border-color: var(--accent-color); outline: 1px solid var(--accent-color); outline-offset: -1px; }
  .props-label { color: var(--text-secondary); font-weight: 500; }
  .props-input, .props-select { min-width: 0; font-size: 12px; font-variant-numeric: tabular-nums; }
  .props-select option { background: var(--bg-panel); color: var(--text-primary); }
  .icon-btn { min-height: 28px; background: var(--chrome-field); border-radius: 5px; }
  #edit-breakpoint, #edit-pseudo-state, #edit-representation, #edit-scope {
    min-width: 0; flex: 1; height: 28px; padding: 0 4px; border: 1px solid var(--border-color);
    border-radius: 5px; color: var(--text-primary); background: var(--chrome-field); font: inherit;
  }
  #layer-search-input { min-height: 32px; font-size: 12px !important; }
  #source-mapping-error { margin: 8px; border-radius: 6px; font-size: 12px; line-height: 1.5; }
  .canvas-container { min-width: 0; background-size: 24px 24px; }
  .preview-frame-wrapper { border-radius: 0; box-shadow: 0 0 0 1px rgb(255 255 255 / 10%), 0 4px 16px rgb(0 0 0 / 16%); }
  #figma-toolbar {
    bottom: 16px !important; max-width: calc(100% - 32px); overflow-x: auto;
    border-radius: 12px !important; padding: 6px !important; gap: 4px !important;
    background: var(--bg-panel) !important; box-shadow: var(--chrome-shadow) !important;
  }
  #figma-toolbar .tool-btn { width: 36px; height: 36px; flex-shrink: 0; border-radius: 7px; }
  #figma-toolbar .tool-btn-sep { flex-shrink: 0; margin: 0 2px !important; }
  .staging-bar {
    bottom: 80px; max-width: calc(100% - 32px); flex-wrap: wrap; justify-content: center;
    gap: 8px; padding: 8px; border-radius: 10px; border-color: var(--border-color);
    background: var(--bg-panel); box-shadow: var(--chrome-shadow); backdrop-filter: none; animation: none;
  }
  .staging-badge { padding: 4px 8px; border-radius: 5px; background: var(--chrome-selected); color: var(--text-primary); letter-spacing: 0; }
  .staging-badge-dot { background: var(--accent-color); box-shadow: none; }
  .staging-btn { height: 32px; border-radius: 6px; }
  .staging-btn.primary { background: var(--accent-color); color: #fff; }
  .staging-btn.primary:hover { background: var(--accent-hover); box-shadow: none; }
  .toast-container { top: 32px; bottom: auto; max-width: calc(100% - 48px); }
  .toast { background: var(--bg-panel); box-shadow: var(--chrome-shadow); font-size: 12px; line-height: 1.5; }
  .status-bar { min-height: 28px; font-size: 11px; gap: 8px; padding: 0 12px; }
  #shortcut-hint { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .context-menu, .dropdown-menu, .editor-zoom-menu {
    background: var(--bg-panel) !important; color: var(--text-primary); border: 1px solid var(--border-color);
    padding: 6px; border-radius: 8px; box-shadow: var(--chrome-shadow); font: inherit;
  }
  .context-menu-item { min-height: 32px; padding: 6px 8px; }
  .context-menu-item:hover { background: var(--chrome-hover); color: var(--text-primary); }
  .context-menu-item:hover .shortcut { color: var(--text-secondary); }
  .editor-zoom-menu { position: fixed; inset: auto; margin: 0; width: 224px; }
  .editor-menu-heading { padding: 6px 8px 8px; font-size: 11px; color: var(--text-secondary); }
  #zoom-label { background: none; border: 0; padding: 4px; cursor: pointer; font-family: inherit; }
  .editor-zoom-menu button {
    display: flex; align-items: center; justify-content: space-between; gap: 24px; width: 100%;
    min-height: 32px; padding: 6px 8px; border: 0; border-radius: 4px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer;
  }
  .editor-zoom-menu button:hover { background: var(--chrome-hover); }
  .editor-shortcut-dialog {
    margin: auto; width: min(560px, calc(100vw - 32px)); max-height: calc(100vh - 64px); overflow: auto;
    padding: 24px; background: var(--bg-panel); color: var(--text-primary); border: 1px solid var(--border-color);
    border-radius: 12px; box-shadow: var(--chrome-shadow); font: inherit;
  }
  .editor-shortcut-dialog::backdrop { background: rgb(0 0 0 / 48%); }
  .editor-shortcut-dialog form { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
  .editor-shortcut-dialog form h2 { margin: 0; }
  .editor-shortcut-dialog p { margin: 16px 0; color: var(--text-secondary); }
  .editor-shortcut-dialog h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
  .editor-shortcut-dialog h3 { font-size: 12px; font-weight: 600; margin: 16px 0 8px; }
  .editor-shortcut-dialog dl { display: grid; grid-template-columns: 1fr auto; gap: 8px 24px; }
  .editor-shortcut-dialog dt, .editor-shortcut-dialog dd { margin: 0; }
  .editor-shortcut-dialog kbd, .editor-zoom-menu kbd { font: inherit; color: var(--text-secondary); }
  .editor-shortcut-dialog button { min-height: 32px; padding: 0 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--chrome-field); color: inherit; font: inherit; cursor: pointer; }
  body > header :is(button, input):focus-visible,
  .sidebar :is(button, input, select, textarea, [tabindex]):focus-visible,
  #figma-toolbar button:focus-visible, .staging-bar button:focus-visible,
  .editor-zoom-menu button:focus-visible, .editor-shortcut-dialog :focus-visible {
    outline: 2px solid var(--accent-color) !important; outline-offset: 2px;
  }
  @media (max-width: 1500px) {
    body > header { column-gap: 8px; padding: 0 8px; }
    .editor-identity, .editor-actions, .editor-view-controls { gap: 4px; }
    #header-file-name { max-width: 112px; }
    #viewport-dropdown-trigger { width: 140px !important; }
    .sidebar { width: 224px; }
    .sidebar-right { width: 256px; }
  }
  @media (max-width: 1280px) {
    .editor-actions { margin-left: 0; }
    .sidebar { width: 208px; }
    .sidebar-right { width: 240px; }
    .props-section { padding: 12px; }
    #header-file-name { max-width: 96px; }
  }
  @media (max-width: 960px) {
    body > header { overflow-x: auto; scrollbar-width: thin; grid-template-columns: 240px 520px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .tool-btn, .header-sidebar-btn, .connection-btn, .layer-item, .props-field,
    .staging-btn, .writeback-mode-btn, .context-menu-item { transition: none; }
  }
`;
