export function getEditorHTML(port: number): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Glide — Code-Native Visual Designer</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <script src="https://unpkg.com/lucide@latest"></script>
        <style>
          :root {
            /* FIGMA CUSTOM THEME DESIGN TOKENS */
            --bg-canvas: #1e1e1e; /* OBSERVED */
            --bg-panel: #2c2c2c; /* INFERRED */
            --bg-panel-elevated: #2c2c2c; /* INFERRED */
            --border-subtle: #333333; /* INFERRED */
            --text-primary: #ffffff; /* INFERRED */
            --text-secondary: #b3b3b3; /* INFERRED */
            --accent: #0c8ce9; /* OBSERVED */

            /* COMPATIBILITY ALIASES FOR VERIFIED CODEBASE LAYOUTS */
            --bg-base: var(--bg-canvas);
            --bg-surface: var(--bg-panel);
            --bg-element: var(--bg-panel-elevated);
            --border-color: var(--border-subtle);
            --accent-color: var(--accent);
            --accent-hover: #0a7ccf;
            --danger: #ef4444;
            --success: #22c55e;
          }
          
          /* Lucide Icons Styling */
          .lucide {
            width: 14px;
            height: 14px;
            stroke-width: 1.5px;
            display: inline-block;
            vertical-align: middle;
          }

          /* ── UTILITY RAIL & PAGES ── */
          .utility-rail .rail-btn {
            opacity: 0.6;
            transition: opacity 0.15s, color 0.15s;
          }
          .utility-rail .rail-btn:hover {
            opacity: 1;
            color: var(--text-primary) !important;
          }
          .utility-rail .rail-btn.active {
            opacity: 1;
            color: var(--accent-color) !important;
          }

          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Inter', sans-serif;
            background: var(--bg-base);
            color: var(--text-primary);
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
          }

          /* ── HEADER ── */
          header {
            height: 48px;
            background: var(--bg-surface);
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 16px;
            z-index: 10;
            flex-shrink: 0;
            gap: 12px;
          }
          .logo {
            font-weight: 700;
            font-size: 15px;
            color: var(--accent-color);
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
          }
          .logo span { color: var(--text-primary); }

          /* ── FIGMA-STYLE TOOL TOOLBAR ── */
          .figma-toolbar {
            display: flex;
            align-items: center;
            background: var(--bg-element);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 2px;
            gap: 1px;
          }
          .tool-btn {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            width: 38px;
            height: 38px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.15s;
            font-size: 16px;
            position: relative;
          }
          .tool-btn:hover { color: var(--text-primary); background: rgba(255,255,255,0.05); }
          .tool-btn.active { color: var(--accent-color); background: rgba(56,189,248,0.15); }
          .tool-btn-sep { width: 1px; height: 26px; background: var(--border-color); margin: 0 2px; }

          /* ── DEVICE PREVIEW TOOLBAR ── */
          .device-bar {
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .device-btn {
            background: transparent;
            border: 1px solid var(--border-color);
            color: var(--text-secondary);
            padding: 3px 7px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s;
            white-space: nowrap;
          }
          .device-btn:hover { color: var(--text-primary); border-color: var(--text-secondary); }
          .device-btn.active { color: var(--accent-color); border-color: var(--accent-color); background: rgba(56,189,248,0.1); }
          .device-custom-input {
            background: var(--bg-element);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 3px 6px;
            border-radius: 4px;
            font-size: 11px;
            width: 60px;
            outline: none;
            font-family: inherit;
          }

          /* ── ZOOM CONTROLS ── */
          .zoom-control {
            display: flex;
            align-items: center;
            gap: 4px;
            background: var(--bg-element);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 3px 8px;
          }
          .zoom-btn {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 14px;
            width: 20px;
            height: 20px;
            display: flex; align-items: center; justify-content: center;
            border-radius: 3px;
            transition: color 0.15s;
          }
          .zoom-btn:hover { color: var(--text-primary); }
          #zoom-label { font-size: 12px; color: var(--text-primary); min-width: 36px; text-align: center; }

          /* ── MAIN LAYOUT ── */
          .main-container {
            display: flex;
            flex: 1;
            height: calc(100vh - 48px);
            overflow: hidden;
          }

          /* ── SIDEBARS ── */
          .sidebar {
            width: 260px;
            flex-shrink: 0;
            background: var(--bg-surface);
            border-right: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            overflow: visible;
            position: relative;
          }
          .sidebar-right {
            border-right: none;
            border-left: 1px solid var(--border-color);
            width: 270px;
            overflow-y: auto;
          }
          .sidebar-header {
            padding: 10px 14px;
            font-size: 11px;
            text-transform: uppercase;
            color: var(--text-secondary);
            font-weight: 700;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
            letter-spacing: 0.6px;
            flex-shrink: 0;
          }

          /* ── LAYERS PANEL ── */
          .layers-scroll { flex: 1; overflow-y: auto; padding: 4px 2px; }

          /* Section dividers for Background vs Elements */
          .layer-section-header {
            padding: 6px 14px 4px;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-secondary);
            opacity: 0.6;
            user-select: none;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .layer-section-header::after {
            content: '';
            flex: 1;
            height: 1px;
            background: var(--border-color);
          }
          .layer-section-divider {
            height: 1px;
            background: var(--border-color);
            margin: 6px 10px;
          }

          .layer-item {
            padding: 0 8px;
            height: 28px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
            margin-bottom: 0;
            transition: background 0.1s;
            user-select: none;
            position: relative;
            color: var(--text-primary);
          }
          .layer-item:hover { background: rgba(255,255,255,0.055); }
          .layer-item.active {
            background: rgba(56,189,248,0.13);
            color: var(--accent-color);
          }
          .layer-item.active .layer-tag { color: var(--accent-color); }
          .layer-item.active .layer-icon-svg { color: var(--accent-color); }

          /* Group container: teal left border + subtle bg */
          .layer-item.group-container {
            border-left: 2px solid rgba(45,212,191,0.5);
            padding-left: 6px;
          }
          .layer-item.group-container .layer-icon-svg { color: #2dd4bf; opacity: 1; }
          .layer-item.group-container .layer-name { color: #5eead4; }
          .layer-item.group-container.active .layer-name { color: var(--accent-color); }

          /* caret: triangle to expand/collapse */
          .layer-caret {
            width: 14px;
            height: 14px;
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: var(--text-secondary);
            cursor: pointer;
            transition: color 0.1s;
            border-radius: 2px;
          }
          .layer-caret:hover { color: var(--text-primary); }
          /* monochrome SVG icon */
          .layer-icon-svg {
            width: 14px;
            height: 14px;
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: var(--text-secondary);
            opacity: 0.85;
          }
          .layer-item.active .layer-icon-svg { opacity: 1; }
          /* label area */
          .layer-label {
            flex: 1;
            min-width: 0;
            display: flex;
            align-items: baseline;
            gap: 5px;
            overflow: hidden;
          }
          .layer-name {
            font-size: 12px;
            font-weight: 450;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: inherit;
            letter-spacing: 0;
          }
          .layer-tag {
            font-size: 10px;
            color: #6b7280;
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
            white-space: nowrap;
            flex-shrink: 0;
            max-width: 80px;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          /* text content shown when hovering — italic amber */
          .layer-text {
            font-size: 10px;
            color: #d97706;
            font-style: italic;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            flex-shrink: 1;
          }
          /* component root: subtle purple left-border accent */
          .layer-item.component-root {
            border-left: 2px solid rgba(167,139,250,0.4);
            padding-left: 6px;
          }
          .layer-item.component-root .layer-icon-svg { color: #a78bfa; opacity: 1; }
          /* hidden/locked tint */
          .layer-item.hidden-node { opacity: 0.38; }
          /* hover actions: eye only */
          .layer-actions {
            display: none;
            align-items: center;
            gap: 2px;
            margin-left: auto;
            flex-shrink: 0;
          }
          .layer-item:hover .layer-actions { display: flex; }
          .layer-action-btn {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 2px 3px;
            border-radius: 3px;
            font-size: 11px;
            line-height: 1;
            display: flex;
            align-items: center;
            transition: color 0.12s;
          }
          .layer-action-btn:hover { color: var(--text-primary); background: rgba(255,255,255,0.07); }
          .layer-action-btn.hidden-state { color: #ef4444; }

          /* ── CANVAS ── */
          .canvas-container {
            flex: 1;
            background: var(--bg-base);
            background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0);
            background-size: 24px 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
          }
          .canvas-viewport {
            position: relative;
            transform-origin: center center;
            transition: transform 0.05s;
          }
          .preview-frame-wrapper {
            background: #fff;
            border-radius: 6px;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08);
            position: relative;
            overflow: hidden;
          }
          #app-iframe {
            width: 1440px;
            height: 880px;
            border: none;
            display: block;
          }
          .canvas-loading {
            position: absolute;
            inset: 0;
            background: rgba(9,13,22,0.85);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            z-index: 5;
            border-radius: 6px;
          }
          .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid var(--border-color);
            border-top-color: var(--accent-color);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }

          /* ── COLLAPSIBLE SIDEBARS ── */
          .sidebar.collapsed {
            display: none !important;
          }
          /* ── SIDEBAR TOGGLE TAB ── */
          .sidebar-toggle-btn {
            position: absolute;
            right: -20px;
            bottom: 48px;
            width: 20px;
            height: 44px;
            background: var(--bg-surface);
            border: 1px solid var(--border-color);
            border-left: none;
            color: var(--text-secondary);
            border-radius: 0 6px 6px 0;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 20;
            transition: all 0.2s;
            box-shadow: 2px 0 8px rgba(0,0,0,0.3);
            padding: 0;
          }
          .sidebar-toggle-btn:hover {
            color: var(--text-primary);
            background: var(--bg-element);
          }
          .sidebar-toggle-btn svg, .sidebar-toggle-btn i {
            width: 12px;
            height: 12px;
            flex-shrink: 0;
          }

          /* ── CONTEXT MENU ── */
          .context-menu {
            background: var(--bg-surface);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
            padding: 4px;
            width: 220px;
            font-size: 12px;
            font-family: inherit;
            color: var(--text-primary);
          }
          .context-menu-item {
            padding: 6px 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            border-radius: 4px;
            transition: background 0.15s;
          }
          .context-menu-item:hover {
            background: var(--accent-color);
            color: #000;
          }
          .context-menu-item.disabled {
            opacity: 0.4;
            pointer-events: none;
          }
          .context-menu-item .shortcut {
            font-size: 10px;
            color: var(--text-secondary);
          }
          .context-menu-item:hover .shortcut {
            color: #000;
          }
          .context-menu-separator {
            height: 1px;
            background: var(--border-color);
            margin: 4px 0;
          }

          /* ── SELECTION OVERLAY SVG ── */
          #overlay-svg {
            position: absolute;
            inset: 0;
            pointer-events: none;
            overflow: visible;
            z-index: 10;
          }

          /* ── PROPERTIES PANEL ── */
          .props-section {
            border-bottom: 1px solid var(--border-color);
            padding: 12px 14px;
          }
          .props-section-title {
            font-size: 10px;
            text-transform: uppercase;
            color: var(--text-secondary);
            font-weight: 700;
            letter-spacing: 0.6px;
            margin-bottom: 10px;
          }
          .props-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
          }
          .props-grid-4 {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr 1fr;
            gap: 4px;
          }
          .props-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
          }
          .props-field {
            display: flex;
            flex-direction: column;
            gap: 3px;
          }
          .props-label {
            font-size: 10px;
            color: var(--text-secondary);
            font-weight: 500;
          }
          .props-input {
            background: var(--bg-element);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 4px 7px;
            border-radius: 4px;
            font-size: 12px;
            font-family: inherit;
            outline: none;
            width: 100%;
            transition: border-color 0.15s;
          }
          .props-input:focus { border-color: var(--accent-color); }
          .props-select {
            background: var(--bg-element);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 4px 6px;
            border-radius: 4px;
            font-size: 12px;
            font-family: inherit;
            outline: none;
            width: 100%;
            cursor: pointer;
          }
          .icon-btn-group { display: flex; gap: 3px; }
          .icon-btn {
            background: var(--bg-element);
            border: 1px solid var(--border-color);
            color: var(--text-secondary);
            padding: 5px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.15s;
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .icon-btn:hover { color: var(--text-primary); border-color: var(--text-secondary); }
          .icon-btn.active { color: var(--accent-color); border-color: var(--accent-color); background: rgba(56,189,248,0.1); }

          /* Box model diagram */
          .box-model {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 4px;
          }
          .box-outer {
            border: 1px dashed #4b5563;
            border-radius: 4px;
            padding: 18px;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
          }
          .box-inner {
            border: 1px solid #4b5563;
            border-radius: 2px;
            padding: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
          }
          .box-label {
            font-size: 9px;
            color: #6b7280;
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 0.5px;
          }
          .box-input {
            position: absolute;
            background: var(--bg-element);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            font-size: 11px;
            font-family: inherit;
            outline: none;
            width: 32px;
            text-align: center;
            padding: 2px 2px;
            border-radius: 3px;
          }
          .box-input:focus { border-color: var(--accent-color); }
          .mt-input { top: 2px; left: 50%; transform: translateX(-50%); }
          .mb-input { bottom: 2px; left: 50%; transform: translateX(-50%); }
          .ml-input { left: 2px; top: 50%; transform: translateY(-50%); }
          .mr-input { right: 2px; top: 50%; transform: translateY(-50%); }
          .pt-input { top: 2px; left: 50%; transform: translateX(-50%); }
          .pb-input { bottom: 2px; left: 50%; transform: translateX(-50%); }
          .pl-input { left: 2px; top: 50%; transform: translateY(-50%); }
          .pr-input { right: 2px; top: 50%; transform: translateY(-50%); }

          /* Color swatch */
          .color-row { display: flex; align-items: center; gap: 8px; }
          .color-swatch {
            width: 28px;
            height: 28px;
            border-radius: 4px;
            border: 1px solid var(--border-color);
            cursor: pointer;
            flex-shrink: 0;
            position: relative;
            overflow: hidden;
          }
          .color-swatch input[type="color"] {
            position: absolute;
            inset: -4px;
            width: calc(100% + 8px);
            height: calc(100% + 8px);
            opacity: 0;
            cursor: pointer;
          }
          .opacity-row { display: flex; align-items: center; gap: 6px; }
          .opacity-slider {
            flex: 1;
            accent-color: var(--accent-color);
          }

          /* Shadow rows */
          .shadow-row {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 6px 0;
            border-bottom: 1px solid var(--border-color);
          }
          .shadow-row:last-child { border-bottom: none; }
          .add-btn {
            display: flex;
            align-items: center;
            gap: 4px;
            background: none;
            border: 1px dashed var(--border-color);
            color: var(--text-secondary);
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            width: 100%;
            justify-content: center;
            transition: all 0.15s;
          }
          .add-btn:hover { color: var(--accent-color); border-color: var(--accent-color); }

          .no-selection {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
            color: var(--text-secondary);
            padding: 20px;
            text-align: center;
          }
          .no-selection-icon { font-size: 32px; opacity: 0.3; }
          .no-selection-text { font-size: 12px; line-height: 1.5; }

          /* ── COMMENT PINS ── */
          .comment-pin {
            position: absolute;
            z-index: 1000;
            cursor: default;
          }
          .pin-dot {
            width: 24px; height: 24px;
            background: var(--accent-color);
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex; align-items: center; justify-content: center;
            color: #000; font-size: 11px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            border: 2px solid white;
          }
          .pin-dot span { transform: rotate(45deg); display: inline-block; }

          /* ── STATUS BAR ── */
          .status-bar {
            height: 24px;
            background: var(--bg-surface);
            border-top: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            padding: 0 14px;
            gap: 16px;
            font-size: 11px;
            color: var(--text-secondary);
            flex-shrink: 0;
          }
          .status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--success); }
          .status-dot.error { background: var(--danger); }

          /* Scrollbar */
          ::-webkit-scrollbar { width: 4px; height: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #374151; border-radius: 2px; }

          /* ── PAGES ── */
          .page-item {
            transition: background 0.15s;
          }
          .page-item:hover {
            background: rgba(255, 255, 255, 0.08) !important;
          }

          /* ── GRID OVERLAY ── */
          .grid-overlay {
            position: absolute;
            inset: 0;
            pointer-events: none;
            background-image: 
              linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
            background-size: 8px 8px;
            z-index: 1;
          }

          /* ── RULERS & GUIDES ── */
          #glide-rulers-corner {
            border-right: 1px solid var(--border-color);
            border-bottom: 1px solid var(--border-color);
            background: var(--bg-surface);
          }
          #glide-ruler-h {
            border-bottom: 1px solid var(--border-color);
            background: var(--bg-surface);
          }
          #glide-ruler-v {
            border-right: 1px solid var(--border-color);
            background: var(--bg-surface);
          }

          /* ── TOAST NOTIFICATIONS ── */
          .toast-container {
            position: absolute;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 8px;
            pointer-events: none;
          }
          .toast {
            pointer-events: auto;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: var(--text-primary);
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.5);
            animation: slideUp 0.2s ease-out;
          }
          .toast.success {
            border-left: 4px solid var(--success);
          }
          .toast.error {
            border-left: 4px solid var(--danger);
          }
          .toast-undo {
            color: var(--accent-color);
            text-decoration: underline;
            cursor: pointer;
            margin-left: 8px;
            font-weight: 600;
          }
          @keyframes slideUp {
            from { transform: translateY(12px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }

          /* ── BRANCHING DIALOG ── */
          .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 20000;
            backdrop-filter: blur(4px);
          }
          .modal-content {
            background: #1e1e1e;
            border: 1px solid var(--border-color);
            border-radius: 12px;
            width: 400px;
            padding: 24px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 10px 10px -5px rgba(0, 0, 0, 0.7);
          }
          .modal-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 16px;
          }
          .modal-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-primary);
          }
          .modal-body {
            color: var(--text-secondary);
            font-size: 13px;
            line-height: 1.5;
            margin-bottom: 20px;
          }
          .modal-input {
            width: 100%;
            background: #2a2a2a;
            border: 1px solid #3a3a3a;
            color: var(--text-primary);
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            outline: none;
            margin-top: 10px;
            font-family: monospace;
          }
          .modal-input:focus {
            border-color: var(--accent-color);
          }
          .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
          }
        </style>
      </head>
      <body>
        <!-- ═══════════════════════════════════ HEADER ═══════════════════════════════════ -->
        <header>
          <!-- Left top panel status -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="logo" style="margin-right: 16px;">⚡ <span>Glide</span></div>
            <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; line-height: 1.2;">
              <span id="header-file-name" style="font-size: 12px; font-weight: 600; color: var(--text-primary);">Untitled</span>
              <span style="font-size: 10px; color: var(--text-secondary);">Team project</span>
            </div>
          </div>

          <!-- App URL input -->
          <div class="toolbar" style="display: flex; align-items: center; gap: 8px;">
            <div class="toolbar-input-group" style="display: flex; align-items: center; background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; height: 30px;">
              <label for="app-url" style="font-size: 10px; text-transform: uppercase; color: var(--text-secondary); margin-right: 6px; font-weight: 700; letter-spacing: 0.5px;">URL</label>
              <input type="text" id="app-url" value="http://localhost:5173/" style="background: transparent; border: none; color: var(--text-primary); font-family: inherit; font-size: 12px; outline: none; width: 180px;">
            </div>
            <button class="device-btn" id="btn-load" style="height: 30px; padding: 0 10px;">Connect</button>
          </div>

          <!-- Device preview -->
          <div class="device-bar" id="device-bar">
            <button class="device-btn" data-width="320" title="Mobile S">📱 320</button>
            <button class="device-btn" data-width="375" title="Mobile M">375</button>
            <button class="device-btn" data-width="425" title="Mobile L">425</button>
            <button class="device-btn" data-width="768" title="Tablet">768</button>
            <button class="device-btn" data-width="1024" title="Laptop">1024</button>
            <button class="device-btn active" data-width="1440" title="Desktop">🖥 1440</button>
            <button class="device-btn" data-width="2560" title="4K">4K</button>
            <input class="device-custom-input" id="custom-width" type="number" placeholder="Custom" title="Custom width (px)">
          </div>

          <!-- Snapping, Grid, Guides, and Branch controls -->
          <div class="device-bar" style="margin-right: 8px;">
            <button class="device-btn active" id="btn-snap-object" title="Snap to Sibling Objects">🎯 Snap Obj</button>
            <button class="device-btn active" id="btn-snap-pixel" title="Snap to Pixel Grid">🔢 Snap Pixel</button>
            <button class="device-btn" id="btn-toggle-grid" title="Toggle 8px Grid Overlay (Ctrl+G)">⊞ Grid</button>
            <button class="device-btn active" id="btn-toggle-guides" title="Toggle Rulers & Guides (Ctrl+;)">😎 Guides</button>
            <button class="device-btn" id="btn-branching" title="Git Branching Mode">⎇ Branch</button>
          </div>

          <!-- Present, Share & Zoom controls -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="device-btn" style="border: none; background: transparent; font-size: 14px; cursor: pointer; color: var(--text-secondary);" title="Present">▷</button>
            <button class="device-btn" style="background: #0d99ff; color: white; border: none; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 500; cursor: pointer;" title="Share">Share</button>

            <div class="zoom-control">
              <button class="zoom-btn" id="zoom-out" title="Zoom out">−</button>
              <span id="zoom-label">100%</span>
              <button class="zoom-btn" id="zoom-in" title="Zoom in">+</button>
              <button class="zoom-btn" id="zoom-fit" title="Fit (Ctrl+0)" style="font-size:10px;width:auto;padding:0 4px;">Fit</button>
            </div>
          </div>
        </header>

        <!-- ═══════════════════════════════════ MAIN LAYOUT ═══════════════════════════════════ -->
        <div class="main-container">

          <!-- LEFT SIDEBAR — LAYERS -->
          <div class="sidebar" id="glide-layers">
            <!-- Pages Subsection -->
            <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
              <div class="sidebar-header" style="border-bottom: none;">
                <span>Pages</span>
                <div style="display:flex;gap:8px;color:var(--text-secondary);align-items:center;">
                  <button id="btn-search-layers" title="Search" style="background: transparent; border: none; padding: 0; color: inherit; cursor: pointer; display: flex; align-items: center;">
                    <i data-lucide="search" style="width: 12px; height: 12px;"></i>
                  </button>
                  <i data-lucide="plus" style="width: 12px; height: 12px; cursor:pointer;" title="Add Page"></i>
                </div>
              </div>
              <div class="page-item" style="padding: 6px 14px; font-size: 12px; display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.05); color: var(--text-primary); cursor: pointer; font-weight: 500;">
                <i data-lucide="file" style="width: 12px; height: 12px;"></i> <span id="active-page-name">Page 1</span>
              </div>
            </div>
            
            <!-- Search Input Container -->
            <div id="search-container" style="display: none; padding: 6px 14px; border-bottom: 1px solid var(--border-color);">
              <input type="text" id="layer-search-input" placeholder="Search layers..." style="width: 100%; box-sizing: border-box; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); border-radius: 4px; padding: 4px 8px; color: var(--text-primary); font-size: 11px; outline: none;" />
            </div>

            <!-- Layers Subsection -->
            <div style="display: flex; flex-direction: column; flex: 1; overflow: hidden;">
              <div class="sidebar-header">
                <span>Layers</span>
                <span id="layer-count" style="font-size:10px;color:var(--text-secondary);font-weight:400"></span>
              </div>
              <div class="layers-scroll" id="layers-list">
                <div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:12px;line-height:1.5;">
                  Click an element<br>on the canvas to<br>see layers.
                </div>
              </div>
            </div>
            <!-- Sidebar Toggle Tab -->
            <button id="toggle-left-sidebar" class="sidebar-toggle-btn" title="Toggle Layers Panel ( [ )" style="position: absolute;">
              <i data-lucide="panel-left-close" id="icon-toggle-left" style="width: 10px; height: 10px;"></i>
            </button>
          </div>

          <!-- CANVAS -->
          <div class="canvas-container" id="canvas-container" style="position: relative;">
            <button id="toggle-right-sidebar" class="sidebar-toggle-btn right-toggle" title="Toggle Properties Sidebar ( ] )" style="position: absolute; right: -12px; bottom: 48px; border-radius: 6px 0 0 6px; border-right: none; border-left: 1px solid var(--border-color);">▶</button>
            
            <!-- RULERS -->
            <div id="glide-rulers-corner" style="position: absolute; top: 0; left: 0; width: 20px; height: 20px; z-index: 10;"></div>
            <div id="glide-ruler-h" style="position: absolute; top: 0; left: 20px; right: 0; height: 20px; z-index: 9; overflow: hidden;">
              <canvas id="ruler-h-canvas" style="display: block; width: 100%; height: 100%;"></canvas>
            </div>
            <div id="glide-ruler-v" style="position: absolute; top: 20px; left: 0; bottom: 0; width: 20px; z-index: 9; overflow: hidden;">
              <canvas id="ruler-v-canvas" style="display: block; width: 100%; height: 100%;"></canvas>
            </div>

            <div class="canvas-viewport" id="canvas-viewport">
              <div class="preview-frame-wrapper" id="frame-wrapper">
                <!-- GRID OVERLAY -->
                <div id="grid-overlay" class="grid-overlay" style="display: none;"></div>
                
                <div class="canvas-loading" id="canvas-loading">
                  <div class="spinner"></div>
                  <span id="load-status" style="font-size:13px;color:var(--text-secondary)">Loading app…</span>
                </div>
                <iframe id="app-iframe" title="App Preview"></iframe>
                <svg id="overlay-svg" style="position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:10;">
                  <defs>
                    <filter id="shadow-filter">
                      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
                    </filter>
                  </defs>
                  <!-- selection/hover drawn dynamically -->
                </svg>
              </div>
            </div>

            <!-- TOAST CONTAINER -->
            <div id="toast-container" class="toast-container"></div>

            <!-- BRANCHING MODE DIALOGS -->
            <div id="branching-modal" class="modal-overlay" style="display: none;">
              <div class="modal-content">
                <div class="modal-header">
                  <i data-lucide="git-branch" style="width: 20px; height: 20px; color: var(--accent-color);"></i>
                  <div class="modal-title">Glide Branching Mode</div>
                </div>
                <div class="modal-body">
                  Edit visually on a safe git branch. Merge when ready.<br><br>
                  Glide will create a new branch and route all visual source edits to it. When satisfied, finalize to commit changes.
                  <input type="text" id="branch-name-input" class="modal-input" placeholder="glide/visual-edit-...">
                </div>
                <div class="modal-footer">
                  <button class="device-btn" id="btn-modal-cancel" style="height: 32px; padding: 0 16px;">Cancel</button>
                  <button class="device-btn" id="btn-modal-confirm" style="background: var(--accent-color); color: white; border: none; height: 32px; padding: 0 16px;">Start Editing</button>
                </div>
              </div>
            </div>

            <div id="finalize-modal" class="modal-overlay" style="display: none;">
              <div class="modal-content">
                <div class="modal-header">
                  <i data-lucide="check-circle" style="width: 20px; height: 20px; color: var(--success);"></i>
                  <div class="modal-title">Finalize Changes</div>
                </div>
                <div class="modal-body">
                  Staging and committing all visual edits on branch <strong id="active-branch-label">branch-name</strong>.<br><br>
                  Enter a commit message:
                  <input type="text" id="commit-msg-input" class="modal-input" placeholder="Visual style updates">
                </div>
                <div class="modal-footer">
                  <button class="device-btn" id="btn-finalize-cancel" style="height: 32px; padding: 0 16px;">Cancel</button>
                  <button class="device-btn" id="btn-finalize-confirm" style="background: var(--success); color: white; border: none; height: 32px; padding: 0 16px;">Commit Changes</button>
                </div>
              </div>
            </div>

            <!-- Floating Bottom Toolbar -->
            <div class="figma-toolbar" id="figma-toolbar" style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 100; box-shadow: 0 8px 32px rgba(0,0,0,0.5); display: flex; align-items: center; background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 10px; padding: 4px; gap: 2px;">
              <button class="tool-btn active" id="tool-select" data-tool="select" title="Select (V)">
                <i data-lucide="mouse-pointer-2" style="width: 18px; height: 18px;"></i>
              </button>
              <button class="tool-btn" id="tool-hand" data-tool="hand" title="Hand (H)">
                <i data-lucide="hand" style="width: 18px; height: 18px;"></i>
              </button>
              <div class="tool-btn-sep" style="width: 1px; height: 26px; background: var(--border-color); margin: 0 4px;"></div>
              <button class="tool-btn" id="tool-comment" data-tool="comment" title="Comment (C)">
                <i data-lucide="message-square" style="width: 18px; height: 18px;"></i>
              </button>
              <div class="tool-btn-sep" style="width: 1px; height: 26px; background: var(--border-color); margin: 0 4px;"></div>
              <button class="tool-btn" id="tool-dev" title="Dev Mode" style="opacity: 0.6; display: flex; align-items: center; justify-content: center;">
                <i data-lucide="code-2" style="width: 18px; height: 18px;"></i>
              </button>
            </div>
          </div>

          <!-- RIGHT SIDEBAR — PROPERTIES -->
          <div class="sidebar sidebar-right" id="glide-properties">
            <div class="sidebar-header">
              <span>Properties</span>
              <span id="selected-tag" style="font-size:10px;color:var(--accent-color);font-weight:400;font-family:monospace"></span>
            </div>

            <div id="no-selection-msg" class="no-selection">
              <i data-lucide="target" style="width: 32px; height: 32px; opacity: 0.3; margin-bottom: 8px;"></i>
              <div class="no-selection-text">Select an element on the canvas to edit its properties</div>
            </div>

            <div id="props-content" style="display:none;">

              <!-- Position & Size -->
              <div class="props-section" id="section-geometry">
                <div class="props-section-title">Position & Size</div>
                <div class="props-grid" style="margin-bottom:6px;">
                  <div class="props-field">
                    <span class="props-label">X</span>
                    <input class="props-input" id="prop-x" type="number" placeholder="0">
                  </div>
                  <div class="props-field">
                    <span class="props-label">Y</span>
                    <input class="props-input" id="prop-y" type="number" placeholder="0">
                  </div>
                  <div class="props-field">
                    <span class="props-label">W</span>
                    <input class="props-input" id="prop-w" type="number" placeholder="auto">
                  </div>
                  <div class="props-field">
                    <span class="props-label">H</span>
                    <input class="props-input" id="prop-h" type="number" placeholder="auto">
                  </div>
                </div>
                <div class="props-field">
                  <span class="props-label">Rotation (°)</span>
                  <input class="props-input" id="prop-rotation" type="number" placeholder="0" value="0">
                </div>
              </div>

              <!-- Layout (Flex) — shown only when display=flex -->
              <div class="props-section" id="section-flex" style="display:none;">
                <div class="props-section-title">Layout (Flex)</div>
                <div class="props-row">
                  <span class="props-label" style="min-width:60px;">Direction</span>
                  <div class="icon-btn-group" style="flex:1;">
                    <button class="icon-btn" id="flex-row" title="Row" style="display: flex; align-items: center; gap: 4px;"><i data-lucide="arrow-right" style="width: 12px; height: 12px;"></i> Row</button>
                    <button class="icon-btn" id="flex-col" title="Column" style="display: flex; align-items: center; gap: 4px;"><i data-lucide="arrow-down" style="width: 12px; height: 12px;"></i> Col</button>
                  </div>
                </div>
                <div class="props-row">
                  <span class="props-label" style="min-width:60px;">Justify</span>
                  <div class="icon-btn-group" style="flex:1;">
                    <button class="icon-btn" id="jc-start" title="flex-start"><i data-lucide="align-start-vertical" style="width: 12px; height: 12px;"></i></button>
                    <button class="icon-btn" id="jc-center" title="center"><i data-lucide="align-center-vertical" style="width: 12px; height: 12px;"></i></button>
                    <button class="icon-btn" id="jc-end" title="flex-end"><i data-lucide="align-end-vertical" style="width: 12px; height: 12px;"></i></button>
                    <button class="icon-btn" id="jc-between" title="space-between"><i data-lucide="align-justify" style="width: 12px; height: 12px; transform: rotate(90deg);"></i></button>
                    <button class="icon-btn" id="jc-around" title="space-around"><i data-lucide="stretch-horizontal" style="width: 12px; height: 12px;"></i></button>
                  </div>
                </div>
                <div class="props-row">
                  <span class="props-label" style="min-width:60px;">Align</span>
                  <div class="icon-btn-group" style="flex:1;">
                    <button class="icon-btn" id="ai-start" title="flex-start"><i data-lucide="align-start-horizontal" style="width: 12px; height: 12px;"></i></button>
                    <button class="icon-btn" id="ai-center" title="center"><i data-lucide="align-center-horizontal" style="width: 12px; height: 12px;"></i></button>
                    <button class="icon-btn" id="ai-end" title="flex-end"><i data-lucide="align-end-horizontal" style="width: 12px; height: 12px;"></i></button>
                    <button class="icon-btn" id="ai-stretch" title="stretch"><i data-lucide="stretch-vertical" style="width: 12px; height: 12px;"></i></button>
                  </div>
                </div>
                <div class="props-grid">
                  <div class="props-field">
                    <span class="props-label">Gap</span>
                    <input class="props-input" id="prop-gap" type="number" placeholder="0">
                  </div>
                  <div class="props-field">
                    <span class="props-label">Row Gap</span>
                    <input class="props-input" id="prop-row-gap" type="number" placeholder="0">
                  </div>
                </div>
              </div>

              <!-- Spacing (Box Model) -->
              <div class="props-section">
                <div class="props-section-title">Spacing</div>
                <!-- Margin -->
                <div style="font-size:10px;color:#6b7280;margin-bottom:4px;font-weight:600;">Margin</div>
                <div class="box-outer" style="position:relative;margin-bottom:6px;">
                  <input class="box-input mt-input" id="prop-mt" type="number" placeholder="0" title="Margin Top">
                  <input class="box-input mb-input" id="prop-mb" type="number" placeholder="0" title="Margin Bottom">
                  <input class="box-input ml-input" id="prop-ml" type="number" placeholder="0" title="Margin Left">
                  <input class="box-input mr-input" id="prop-mr" type="number" placeholder="0" title="Margin Right">
                  <span class="box-label">M</span>
                </div>
                <!-- Padding -->
                <div style="font-size:10px;color:#6b7280;margin-bottom:4px;font-weight:600;">Padding</div>
                <div class="box-outer" style="position:relative;">
                  <input class="box-input pt-input" id="prop-pt" type="number" placeholder="0" title="Padding Top">
                  <input class="box-input pb-input" id="prop-pb" type="number" placeholder="0" title="Padding Bottom">
                  <input class="box-input pl-input" id="prop-pl" type="number" placeholder="0" title="Padding Left">
                  <input class="box-input pr-input" id="prop-pr" type="number" placeholder="0" title="Padding Right">
                  <span class="box-label">P</span>
                </div>
              </div>

              <!-- Typography -->
              <div class="props-section" id="section-typography">
                <div class="props-section-title">Typography</div>
                <div class="props-field" style="margin-bottom:6px;">
                  <span class="props-label">Font Family</span>
                  <input class="props-input" id="prop-font-family" type="text" placeholder="Inter, sans-serif">
                </div>
                <div class="props-grid" style="margin-bottom:6px;">
                  <div class="props-field">
                    <span class="props-label">Size (px)</span>
                    <input class="props-input" id="prop-font-size" type="number" placeholder="16">
                  </div>
                  <div class="props-field">
                    <span class="props-label">Weight</span>
                    <select class="props-select" id="prop-font-weight">
                      <option value="100">100</option>
                      <option value="200">200</option>
                      <option value="300">300 Light</option>
                      <option value="400" selected>400 Normal</option>
                      <option value="500">500 Medium</option>
                      <option value="600">600 Semibold</option>
                      <option value="700">700 Bold</option>
                      <option value="800">800 Extrabold</option>
                      <option value="900">900 Black</option>
                    </select>
                  </div>
                  <div class="props-field">
                    <span class="props-label">Line Height</span>
                    <input class="props-input" id="prop-line-height" type="number" placeholder="1.5">
                  </div>
                  <div class="props-field">
                    <span class="props-label">Letter Spacing</span>
                    <input class="props-input" id="prop-letter-spacing" type="number" placeholder="0">
                  </div>
                </div>
                <div class="props-row" style="margin-bottom:6px;">
                  <span class="props-label" style="min-width:40px;">Align</span>
                  <div class="icon-btn-group" style="flex:1;">
                    <button class="icon-btn" id="ta-left" title="Left"><i data-lucide="align-left" style="width: 12px; height: 12px;"></i></button>
                    <button class="icon-btn" id="ta-center" title="Center"><i data-lucide="align-center" style="width: 12px; height: 12px;"></i></button>
                    <button class="icon-btn" id="ta-right" title="Right"><i data-lucide="align-right" style="width: 12px; height: 12px;"></i></button>
                    <button class="icon-btn" id="ta-justify" title="Justify"><i data-lucide="align-justify" style="width: 12px; height: 12px;"></i></button>
                  </div>
                </div>
                <div class="props-row" style="margin-bottom:6px;">
                  <span class="props-label" style="min-width:40px;">Style</span>
                  <div class="icon-btn-group" style="flex:1;">
                    <button class="icon-btn" id="td-underline" title="Underline"><i data-lucide="underline" style="width: 12px; height: 12px;"></i></button>
                    <button class="icon-btn" id="td-italic" title="Italic"><i data-lucide="italic" style="width: 12px; height: 12px;"></i></button>
                    <button class="icon-btn" id="td-strike" title="Strikethrough"><i data-lucide="strikethrough" style="width: 12px; height: 12px;"></i></button>
                  </div>
                </div>
                <div class="props-field">
                  <span class="props-label">Color</span>
                  <div class="color-row">
                    <div class="color-swatch" id="color-swatch-text">
                      <input type="color" id="prop-color" value="#ffffff" title="Text Color">
                    </div>
                    <input class="props-input" id="prop-color-hex" type="text" placeholder="#ffffff" style="font-family:monospace;">
                  </div>
                </div>
              </div>

              <!-- Fill / Background -->
              <div class="props-section">
                <div class="props-section-title">Fill</div>
                <div class="props-row" style="margin-bottom:8px;">
                  <div class="icon-btn-group" style="flex:1;">
                    <button class="icon-btn active" id="fill-none" title="None">None</button>
                    <button class="icon-btn" id="fill-solid" title="Solid">Solid</button>
                    <button class="icon-btn" id="fill-gradient" title="Gradient">Grad</button>
                  </div>
                </div>
                <div id="fill-solid-controls">
                  <div class="color-row">
                    <div class="color-swatch" id="color-swatch-bg">
                      <input type="color" id="prop-bg-color" value="#000000" title="Background Color">
                    </div>
                    <input class="props-input" id="prop-bg-hex" type="text" placeholder="#000000" style="font-family:monospace;">
                    <input class="props-input" id="prop-bg-opacity" type="number" min="0" max="100" placeholder="100" style="width:52px;" title="Opacity %">
                    <span style="font-size:11px;color:var(--text-secondary);">%</span>
                  </div>
                </div>
                <div id="fill-gradient-controls" style="display:none;">
                  <div class="props-row" style="margin-bottom:8px;">
                    <span class="props-label" style="min-width:50px;">Type</span>
                    <div class="icon-btn-group" style="flex:1;">
                      <button class="icon-btn active" id="grad-linear">Linear</button>
                      <button class="icon-btn" id="grad-radial">Radial</button>
                    </div>
                  </div>
                  <div class="props-field" style="margin-bottom:8px;">
                    <span class="props-label">Angle (°)</span>
                    <input class="props-input" id="prop-grad-angle" type="number" value="90">
                  </div>
                  <div class="props-row" style="margin-bottom:8px;">
                    <span class="props-label" style="min-width:50px;">Start</span>
                    <div class="color-swatch" id="color-swatch-grad-start" style="width:24px;height:24px;border-radius:4px;overflow:hidden;background:#000;">
                      <input type="color" id="prop-grad-start" value="#000000">
                    </div>
                    <input class="props-input" id="prop-grad-start-hex" type="text" value="#000000" style="flex:1;font-family:monospace;">
                  </div>
                  <div class="props-row" style="margin-bottom:8px;">
                    <span class="props-label" style="min-width:50px;">End</span>
                    <div class="color-swatch" id="color-swatch-grad-end" style="width:24px;height:24px;border-radius:4px;overflow:hidden;background:#fff;">
                      <input type="color" id="prop-grad-end" value="#ffffff">
                    </div>
                    <input class="props-input" id="prop-grad-end-hex" type="text" value="#ffffff" style="flex:1;font-family:monospace;">
                  </div>
                  <div style="height:16px;border-radius:4px;background:linear-gradient(90deg,#000,#fff);border:1px solid var(--border-color);margin-top:6px;" id="grad-preview"></div>
                </div>
              </div>

              <!-- Border -->
              <div class="props-section">
                <div class="props-section-title">Border</div>
                <div class="props-row" style="margin-bottom:6px;">
                  <div class="color-swatch" id="color-swatch-border">
                    <input type="color" id="prop-border-color" value="#374151" title="Border Color">
                  </div>
                  <input class="props-input" id="prop-border-width" type="number" placeholder="0" style="width:52px;" title="Width">
                  <select class="props-select" id="prop-border-style" style="flex:1;">
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div class="props-section-title" style="margin-bottom:6px;">Radius</div>
                <div class="props-grid-4">
                  <div class="props-field">
                    <span class="props-label">TL</span>
                    <input class="props-input" id="prop-br-tl" type="number" placeholder="0">
                  </div>
                  <div class="props-field">
                    <span class="props-label">TR</span>
                    <input class="props-input" id="prop-br-tr" type="number" placeholder="0">
                  </div>
                  <div class="props-field">
                    <span class="props-label">BR</span>
                    <input class="props-input" id="prop-br-br" type="number" placeholder="0">
                  </div>
                  <div class="props-field">
                    <span class="props-label">BL</span>
                    <input class="props-input" id="prop-br-bl" type="number" placeholder="0">
                  </div>
                </div>
              </div>

              <!-- Shadow -->
              <div class="props-section">
                <div class="props-section-title">Shadow</div>
                <div id="shadows-list"></div>
                <button class="add-btn" id="add-shadow-btn">+ Add Shadow</button>
              </div>

              <!-- Opacity -->
              <div class="props-section">
                <div class="props-section-title">Opacity</div>
                <div class="opacity-row">
                  <input type="range" class="opacity-slider" id="prop-opacity-slider" min="0" max="100" value="100">
                  <input class="props-input" id="prop-opacity" type="number" min="0" max="100" value="100" style="width:52px;">
                  <span style="font-size:11px;color:var(--text-secondary);">%</span>
                </div>
              </div>

            </div><!-- end #props-content -->
          </div>

        </div><!-- end .main-container -->

        <!-- CONTEXT MENU -->
        <div id="glide-context-menu" class="context-menu" style="display:none; position:fixed; z-index:10000;">
          <div class="context-menu-item" id="menu-group">Group Selection <span class="shortcut">Ctrl+G</span></div>
          <div class="context-menu-item" id="menu-ungroup">Ungroup Selection <span class="shortcut">Ctrl+Shift+G</span></div>
          <div class="context-menu-separator"></div>
          <div class="context-menu-item" id="menu-front">Bring to Front <span class="shortcut">]</span></div>
          <div class="context-menu-item" id="menu-back">Send to Back <span class="shortcut">[</span></div>
          <div class="context-menu-item" id="menu-forward">Bring Forward <span class="shortcut">Ctrl+]</span></div>
          <div class="context-menu-item" id="menu-backward">Send Backward <span class="shortcut">Ctrl+[</span></div>
        </div>

        <!-- STATUS BAR -->
        <div class="status-bar">
          <div class="status-dot" id="ws-dot"></div>
          <span id="ws-status">Connecting…</span>
          <span style="margin-left:auto;" id="cursor-pos"></span>
          <span id="shortcut-hint" style="color:var(--text-secondary)">V=Select H=Hand F=Frame R=Rect O=Ellipse T=Text C=Comment</span>
        </div>

        <script>
          // ═══════════════════════════════════════════════════════════════
          // STATE
          // ═══════════════════════════════════════════════════════════════
          let socket = null;
          let currentFile = null;
          let selectedElement = null;
          let selectedRect = null;
          let selectedComputedStyles = null;
          const componentRootSources = new Set();
          let currentGeneration = 0;
          const expandedNodeIds = new Set();
          
          // Phase 2 state
          let gridVisible = false;
          let guidesVisible = true;
          let guides = []; // Array of { axis: 'x' | 'y', position: number }
          let activeBranch = null;
          let draggingGuide = null;

          function findNodeBySource(nodes, source) {
            for (const node of nodes) {
              const nodeSource = convertNodeIdToSource(node.id, currentFile);
              if (nodeSource === source) return node;
              if (node.children) {
                const found = findNodeBySource(node.children, source);
                if (found) return found;
              }
            }
            return null;
          }

          function findAncestors(nodes, targetId, path = []) {
            for (const node of nodes) {
              if (node.id === targetId) {
                return path;
              }
              if (node.children) {
                const found = findAncestors(node.children, targetId, [...path, node.id]);
                if (found) return found;
              }
            }
            return null;
          }
          let selectedSources = [];
          let selectedRects = [];
          let hoveredElement = null;
          let hoveredRect = null;
          let currentTool = 'select';
          let zoomLevel = 1.0;
          let panX = 0, panY = 0;
          let isPanning = false, panStart = {x:0,y:0};
          let lockedIds = new Set();
          let hiddenIds = new Set();
          let shadowCount = 0;
           let dragStartPos = null;
           let dragSource = null;
           let dragInitialML = 0;
           let dragInitialMT = 0;
           let isDraggingElement = false;
           let lastPointerX = 0;
           let lastPointerY = 0;

            let leftSidebar = null;
            let rightSidebar = null;
            let btnLeft = null;
            let btnRight = null;

            function toggleLeft() {
              if (!leftSidebar) return;
              const isCollapsed = leftSidebar.classList.toggle('collapsed');
              const icon = document.getElementById('icon-toggle-left');
              if (icon) {
                icon.setAttribute('data-lucide', isCollapsed ? 'panel-left-open' : 'panel-left-close');
                if (window.lucide) window.lucide.createIcons();
              }
            }

            function toggleRight() {
              if (!rightSidebar) return;
              const isCollapsed = rightSidebar.classList.toggle('collapsed');
              btnRight.textContent = isCollapsed ? '◀' : '▶';
            }

           const iframeWidth = { current: 1440 };

          // ═══════════════════════════════════════════════════════════════
          // WEBSOCKET
          // ═══════════════════════════════════════════════════════════════
          function connectSocket() {
            socket = new WebSocket('ws://localhost:7777');
            const dot = document.getElementById('ws-dot');
            const statusEl = document.getElementById('ws-status');

            socket.addEventListener('open', () => {
              dot.classList.remove('error');
              statusEl.textContent = 'Connected to Glide server';
              setTimeout(() => { statusEl.textContent = 'Ready'; }, 2000);
            });

            socket.addEventListener('close', () => {
              dot.classList.add('error');
              statusEl.textContent = 'Disconnected — retrying…';
              setTimeout(connectSocket, 2000);
            });

            socket.addEventListener('error', () => {
              dot.classList.add('error');
              statusEl.textContent = 'Connection error';
            });

            socket.addEventListener('message', (event) => {
              try {
                const message = JSON.parse(event.data);
                if (message.type === 'tree') {
                  currentFile = message.file;
                  currentGeneration = message.generation || 0;
                  layerTree = message.tree;

                  const baseName = currentFile ? currentFile.split('/').pop() : 'Page 1';
                  const activePageName = document.getElementById('active-page-name');
                  if (activePageName) activePageName.textContent = baseName;
                  const headerFileName = document.getElementById('header-file-name');
                  if (headerFileName) headerFileName.textContent = baseName;
                  
                  // Pre-expand roots and depth-0 children on first load
                  if (expandedNodeIds.size === 0 && layerTree) {
                    layerTree.forEach(node => {
                      expandedNodeIds.add(node.id);
                      if (node.children) {
                        node.children.forEach(c => expandedNodeIds.add(c.id));
                      }
                    });
                  }

                  // Auto-expand ancestors of currently selected element(s)
                  if (layerTree && selectedSources.length > 0) {
                    selectedSources.forEach(source => {
                      const node = findNodeBySource(layerTree, source);
                      if (node) {
                        const ancestors = findAncestors(layerTree, node.id);
                        if (ancestors) {
                          ancestors.forEach(id => expandedNodeIds.add(id));
                        }
                      }
                    });
                  }
                  
                  renderLayersTree(layerTree);

                  // Auto-scroll selected element into view
                  if (selectedSources.length > 0) {
                    requestAnimationFrame(() => {
                      const activeEl = document.querySelector('.layer-item.active');
                      if (activeEl) {
                        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }
                    });
                  }
                } else if (message.type === 'status') {
                  if (message.success) {
                    if (currentFile && socket && socket.readyState === WebSocket.OPEN) {
                      socket.send(JSON.stringify({ type: 'get-tree', file: currentFile }));
                    }
                    if (message.action === 'undo' || message.action === 'redo') {
                      showToast('success', message.message || 'Action completed');
                    } else if (currentFile) {
                      showToast('success', currentFile.split('/').pop() + ' updated successfully.');
                    }
                  } else {
                    console.error('[Glide] Server error:', message.error);
                    showToast('error', message.error || 'Server error');
                  }
                } else if (message.type === 'git-status') {
                  if (message.success) {
                    if (message.action === 'create') {
                      activeBranch = message.branch;
                      const btn = document.getElementById('btn-branching');
                      if (btn) {
                        btn.classList.add('active');
                        btn.textContent = '⎇ ' + activeBranch.split('/').pop();
                      }
                      showToast('success', 'Checked out branch: ' + activeBranch);
                    } else if (message.action === 'finalize') {
                      showToast('success', 'Visual edits staged and committed successfully!');
                      activeBranch = null;
                      const btn = document.getElementById('btn-branching');
                      if (btn) {
                        btn.classList.remove('active');
                        btn.textContent = '⎇ Branch';
                      }
                    }
                  } else {
                    console.error('[Glide] Git error:', message.error);
                    showToast('error', 'Git error: ' + message.error);
                  }
                }
              } catch (e) {
                console.error('[Glide] WS parse error:', e);
              }
            });
          }

          function sendEdit(change) {
            if (!selectedElement || !socket || socket.readyState !== WebSocket.OPEN) return;
            const parsed = parseSource(selectedElement.source);
            if (!parsed) return;
            socket.send(JSON.stringify({
              type: 'edit',
              file: parsed.file,
              line: parsed.line,
              column: parsed.column,
              hash: parsed.hash,
              generation: currentGeneration,
              viewportWidth: iframeWidth.current,
              change
            }));
          }

          // ═══════════════════════════════════════════════════════════════
          // SOURCE HELPERS
          // ═══════════════════════════════════════════════════════════════
          function parseSource(source) {
            if (!source) return null;
            const match = source.match(/^(.*):(\\d+):(\\d+)(?::([a-f0-9]+))?$/);
            if (!match) return null;
            return {
              file: match[1],
              line: parseInt(match[2], 10),
              column: parseInt(match[3], 10),
              hash: match[4] || null
            };
          }

          function convertNodeIdToSource(nodeId, file) {
            const match = nodeId.match(/^line:(\\d+):col:(\\d+)(?::([a-f0-9]+))?$/);
            if (match) {
              const line = parseInt(match[1], 10);
              const col = parseInt(match[2], 10) + 1;
              const hash = match[3] || 'nohash';
              return file + ':' + line + ':' + col + ':' + hash;
            }
            return nodeId;
          }

          function findParentNodeInTree(tree, targetId) {
            function search(nodes, id) {
              for (const node of nodes) {
                for (const child of node.children || []) {
                  if (child.id === id) return node;
                  const found = search(child.children || [], id);
                  if (found) return found;
                }
              }
              return null;
            }
            return search(tree, targetId);
          }

          // ═══════════════════════════════════════════════════════════════
          // DEVICE PREVIEW
          // ═══════════════════════════════════════════════════════════════
          document.querySelectorAll('.device-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              const w = parseInt(btn.dataset.width, 10);
              setIframeWidth(w);
              document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              document.getElementById('custom-width').value = '';
            });
          });

          document.getElementById('custom-width').addEventListener('change', (e) => {
            const w = parseInt(e.target.value, 10);
            if (w >= 100 && w <= 4000) {
              setIframeWidth(w);
              document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
            }
          });

          function setIframeWidth(px) {
            const frame = document.getElementById('app-iframe');
            frame.style.width = px + 'px';
            iframeWidth.current = px;
          }

          // ═══════════════════════════════════════════════════════════════
          // ZOOM & PAN
          // ═══════════════════════════════════════════════════════════════
          function applyTransform() {
            const vp = document.getElementById('canvas-viewport');
            vp.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + zoomLevel + ')';
            document.getElementById('zoom-label').textContent = Math.round(zoomLevel * 100) + '%';
            
            drawRulers();
          }

          function drawRulers() {
            if (!guidesVisible) {
              document.getElementById('glide-rulers-corner').style.display = 'none';
              document.getElementById('glide-ruler-h').style.display = 'none';
              document.getElementById('glide-ruler-v').style.display = 'none';
              return;
            }
            document.getElementById('glide-rulers-corner').style.display = 'block';
            document.getElementById('glide-ruler-h').style.display = 'block';
            document.getElementById('glide-ruler-v').style.display = 'block';

            drawRulerH();
            drawRulerV();
          }

          function drawRulerH() {
            const canvas = document.getElementById('ruler-h-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            const width = canvas.parentElement.clientWidth;
            const height = canvas.parentElement.clientHeight;
            
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.scale(dpr, dpr);

            ctx.fillStyle = '#2c2c2c';
            ctx.fillRect(0, 0, width, height);

            ctx.strokeStyle = '#444444';
            ctx.fillStyle = '#888888';
            ctx.font = '9px monospace';
            ctx.lineWidth = 1;
            
            const iframe = document.getElementById('app-iframe');
            if (!iframe) return;
            const fw = iframe.clientWidth;
            const container = document.getElementById('canvas-container');
            const cw = container.clientWidth;
            
            const originX = (cw / 2) - (fw * zoomLevel / 2) + panX;

            const startX = Math.floor(-originX / zoomLevel);
            const endX = Math.ceil((width - originX) / zoomLevel);

            let step = 100;
            if (zoomLevel > 2) step = 10;
            else if (zoomLevel > 0.6) step = 50;
            else if (zoomLevel > 0.25) step = 100;
            else step = 500;

            const firstTick = Math.floor(startX / step) * step;

            for (let x = firstTick; x <= endX; x += step) {
              const rx = x * zoomLevel + originX;
              if (rx < 0 || rx > width) continue;

              ctx.beginPath();
              ctx.moveTo(rx, height);
              ctx.lineTo(rx, height - 8);
              ctx.stroke();

              ctx.fillText(x.toString(), rx + 2, height - 10);
              
              const subStep = step / 10;
              for (let j = 1; j < 10; j++) {
                const sx = rx + j * subStep * zoomLevel;
                if (sx >= 0 && sx <= width) {
                  ctx.beginPath();
                  ctx.moveTo(sx, height);
                  ctx.lineTo(sx, height - (j === 5 ? 5 : 3));
                  ctx.stroke();
                }
              }
            }
          }

          function drawRulerV() {
            const canvas = document.getElementById('ruler-v-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;
            const width = canvas.parentElement.clientWidth;
            const height = canvas.parentElement.clientHeight;
            
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.scale(dpr, dpr);

            ctx.fillStyle = '#2c2c2c';
            ctx.fillRect(0, 0, width, height);

            ctx.strokeStyle = '#444444';
            ctx.fillStyle = '#888888';
            ctx.font = '9px monospace';
            ctx.lineWidth = 1;
            
            const iframe = document.getElementById('app-iframe');
            if (!iframe) return;
            const fh = iframe.clientHeight;
            const container = document.getElementById('canvas-container');
            const ch = container.clientHeight;
            
            const originY = (ch / 2) - (fh * zoomLevel / 2) + panY;

            const startY = Math.floor(-originY / zoomLevel);
            const endY = Math.ceil((height - originY) / zoomLevel);

            let step = 100;
            if (zoomLevel > 2) step = 10;
            else if (zoomLevel > 0.6) step = 50;
            else if (zoomLevel > 0.25) step = 100;
            else step = 500;

            const firstTick = Math.floor(startY / step) * step;

            for (let y = firstTick; y <= endY; y += step) {
              const ry = y * zoomLevel + originY;
              if (ry < 0 || ry > height) continue;

              ctx.beginPath();
              ctx.moveTo(width, ry);
              ctx.lineTo(width - 8, ry);
              ctx.stroke();

              ctx.save();
              ctx.translate(width - 10, ry + 2);
              ctx.rotate(-Math.PI / 2);
              ctx.fillText(y.toString(), 2, 0);
              ctx.restore();
              
              const subStep = step / 10;
              for (let j = 1; j < 10; j++) {
                const sy = ry + j * subStep * zoomLevel;
                if (sy >= 0 && sy <= height) {
                  ctx.beginPath();
                  ctx.moveTo(width, sy);
                  ctx.lineTo(width - (j === 5 ? 5 : 3), sy);
                  ctx.stroke();
                }
              }
            }
          }

          document.getElementById('zoom-in').addEventListener('click', () => { zoomLevel = Math.min(4, zoomLevel + 0.1); applyTransform(); });
          document.getElementById('zoom-out').addEventListener('click', () => { zoomLevel = Math.max(0.1, zoomLevel - 0.1); applyTransform(); });
          document.getElementById('zoom-fit').addEventListener('click', fitToScreen);

          function fitToScreen() {
            const container = document.getElementById('canvas-container');
            const frame = document.getElementById('app-iframe');
            const cw = container.clientWidth - 80;
            const ch = container.clientHeight - 80;
            const fw = frame.clientWidth;
            const fh = frame.clientHeight;
            zoomLevel = Math.min(cw / fw, ch / fh, 1);
            panX = 0; panY = 0;
            applyTransform();
          }

          // Ctrl+Scroll zoom
          document.getElementById('canvas-container').addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              zoomLevel = Math.min(4, Math.max(0.1, zoomLevel - e.deltaY * 0.001));
              applyTransform();
            }
          }, { passive: false });

          // Snapping state
          let snapObjectEnabled = true;
          let snapPixelEnabled = true;

          const btnSnapObject = document.getElementById('btn-snap-object');
          const btnSnapPixel = document.getElementById('btn-snap-pixel');

          if (btnSnapObject) {
            btnSnapObject.addEventListener('click', () => {
              snapObjectEnabled = !snapObjectEnabled;
              btnSnapObject.classList.toggle('active', snapObjectEnabled);
              const iframe = document.getElementById('app-iframe');
              if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                  type: 'glide:set-snap-object',
                  enabled: snapObjectEnabled
                }, '*');
              }
            });
          }

          if (btnSnapPixel) {
            btnSnapPixel.addEventListener('click', () => {
              snapPixelEnabled = !snapPixelEnabled;
              btnSnapPixel.classList.toggle('active', snapPixelEnabled);
              const iframe = document.getElementById('app-iframe');
              if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                  type: 'glide:set-snap-pixel',
                  enabled: snapPixelEnabled
                }, '*');
              }
            });
          }

          // ═══════════════════════════════════════════════════════════════
          // TOOL SWITCHER
          // ═══════════════════════════════════════════════════════════════
          function setTool(name) {
            currentTool = name;
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            const btn = document.querySelector('[data-tool="' + name + '"]');
            if (btn) btn.classList.add('active');

            const container = document.getElementById('canvas-container');
            if (name === 'hand') {
              container.style.cursor = 'grab';
            } else {
              container.style.cursor = 'default';
            }
          }

          document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => setTool(btn.dataset.tool));
          });

          // ═══════════════════════════════════════════════════════════════
          // KEYBOARD SHORTCUTS
          // ═══════════════════════════════════════════════════════════════
          document.addEventListener('keydown', (e) => {
            // Don't fire if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

            const key = e.key;
            const ctrl = e.ctrlKey || e.metaKey;

            // Toggle grid: Ctrl+G
            if (ctrl && (key === 'g' || key === 'G')) {
              e.preventDefault();
              gridVisible = !gridVisible;
              const btn = document.getElementById('btn-toggle-grid');
              if (btn) btn.classList.toggle('active', gridVisible);
              document.getElementById('grid-overlay').style.display = gridVisible ? 'block' : 'none';
              return;
            }

            // Toggle guides: Ctrl+;
            if (ctrl && key === ';') {
              e.preventDefault();
              guidesVisible = !guidesVisible;
              const btn = document.getElementById('btn-toggle-guides');
              if (btn) btn.classList.toggle('active', guidesVisible);
              drawRulers();
              drawOverlay();
              return;
            }

            // Undo: Ctrl+Z
            if (ctrl && (key === 'z' || key === 'Z')) {
              e.preventDefault();
              if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'undo' }));
                showToast('info', 'Undoing last change...');
              }
              return;
            }

            // Redo: Ctrl+Y
            if (ctrl && (key === 'y' || key === 'Y')) {
              e.preventDefault();
              if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'redo' }));
                showToast('info', 'Redoing last change...');
              }
              return;
            }

            // Tool shortcuts
            if (!ctrl && key === 'v') { setTool('select'); return; }
            if (!ctrl && (key === 'h' || key === 'H')) { setTool('hand'); return; }
            if (!ctrl && (key === 'f' || key === 'F' || key === 'a' || key === 'A')) { setTool('frame'); return; }
            if (!ctrl && (key === 'r' || key === 'R')) { setTool('rect'); return; }
            if (!ctrl && (key === 'o' || key === 'O')) { setTool('ellipse'); return; }
            if (!ctrl && (key === 't' || key === 'T')) { setTool('text'); return; }
            if (!ctrl && (key === 'c' || key === 'C')) { setTool('comment'); return; }

            // Escape = deselect
            if (key === 'Escape') {
              selectedElement = null;
              selectedRect = null;
              selectedComputedStyles = null;
              selectedSources = [];
              selectedRects = [];
              hoveredElement = null;
              hoveredRect = null;
              clearOverlay();
              showNoSelection();
              return;
            }

            // Toggle left sidebar [ / Send to Back
            if (!ctrl && key === '[') {
              e.preventDefault();
              if (selectedSources.length > 0) {
                triggerArrange('back');
              } else {
                toggleLeft();
              }
              return;
            }
            // Toggle right sidebar ] / Bring to Front
            if (!ctrl && key === ']') {
              e.preventDefault();
              if (selectedSources.length > 0) {
                triggerArrange('front');
              } else {
                toggleRight();
              }
              return;
            }
            // Bring Forward Ctrl+]
            if (ctrl && key === ']') {
              e.preventDefault();
              if (selectedSources.length > 0) {
                triggerArrange('forward');
              }
              return;
            }
            // Send Backward Ctrl+[
            if (ctrl && key === '[') {
              e.preventDefault();
              if (selectedSources.length > 0) {
                triggerArrange('backward');
              }
              return;
            }
            // Toggle both sidebars \\\\
            if (key === '\\\\') {
              e.preventDefault();
              const leftState = leftSidebar.classList.contains('collapsed');
              const rightState = rightSidebar.classList.contains('collapsed');
              if (leftState && rightState) {
                leftSidebar.classList.remove('collapsed');
                rightSidebar.classList.remove('collapsed');
                btnLeft.textContent = '◀';
                btnRight.textContent = '▶';
              } else {
                leftSidebar.classList.add('collapsed');
                rightSidebar.classList.add('collapsed');
                btnLeft.textContent = '▶';
                btnRight.textContent = '◀';
              }
              return;
            }

            // Ctrl+G = Group, Ctrl+Shift+G = Ungroup
            if (ctrl && (key === 'g' || key === 'G') && !e.shiftKey) {
              e.preventDefault();
              triggerGroup();
              return;
            }
            if (ctrl && (key === 'g' || key === 'G') && e.shiftKey) {
              e.preventDefault();
              triggerUngroup();
              return;
            }

            // Ctrl+Z = undo, Ctrl+Shift+Z / Ctrl+Y = redo
            if (ctrl && key === 'z' && !e.shiftKey) {
              e.preventDefault();
              if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'undo' }));
              }
              return;
            }
            if (ctrl && ((key === 'z' && e.shiftKey) || key === 'y')) {
              e.preventDefault();
              if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'redo' }));
              }
              return;
            }

            // Ctrl+0 = fit, Ctrl+1 = 100%
            if (ctrl && key === '0') { e.preventDefault(); fitToScreen(); return; }
            if (ctrl && key === '1') { e.preventDefault(); zoomLevel = 1; panX = 0; panY = 0; applyTransform(); return; }

            // Arrow nudge (needs selected element)
            if (!selectedElement) return;
            const nudge = e.shiftKey ? 10 : 1;
            if (key === 'ArrowUp')    { e.preventDefault(); sendEdit({ type: 'class', property: 'marginTop', value: '-=' + nudge + 'px' }); return; }
            if (key === 'ArrowDown')  { e.preventDefault(); sendEdit({ type: 'class', property: 'marginTop', value: '+=' + nudge + 'px' }); return; }
            if (key === 'ArrowLeft')  { e.preventDefault(); sendEdit({ type: 'class', property: 'marginLeft', value: '-=' + nudge + 'px' }); return; }
            if (key === 'ArrowRight') { e.preventDefault(); sendEdit({ type: 'class', property: 'marginLeft', value: '+=' + nudge + 'px' }); return; }
          });

          // ═══════════════════════════════════════════════════════════════
          // CANVAS HAND-PANNING
          // ═══════════════════════════════════════════════════════════════
          const canvasContainer = document.getElementById('canvas-container');

          canvasContainer.addEventListener('mousedown', (e) => {
            if (currentTool === 'hand' || e.button === 1) {
              isPanning = true;
              panStart = { x: e.clientX - panX, y: e.clientY - panY };
              canvasContainer.style.cursor = 'grabbing';
              e.preventDefault();
            }
          });

          let canvasContainerRect = canvasContainer.getBoundingClientRect();
          window.addEventListener('resize', () => {
            canvasContainerRect = canvasContainer.getBoundingClientRect();
          });

          document.addEventListener('mousemove', (e) => {
            if (isPanning) {
              panX = e.clientX - panStart.x;
              panY = e.clientY - panStart.y;
              applyTransform();
            }
            if (draggingGuide) {
              const container = document.getElementById('canvas-container');
              const iframe = document.getElementById('app-iframe');
              if (iframe) {
                const fw = iframe.clientWidth;
                const fh = iframe.clientHeight;
                const cw = container.clientWidth;
                const ch = container.clientHeight;
                
                const originX = (cw / 2) - (fw * zoomLevel / 2) + panX;
                const originY = (ch / 2) - (fh * zoomLevel / 2) + panY;

                if (draggingGuide.axis === 'x') {
                  const pageX = Math.round((e.clientX - canvasContainerRect.left - originX) / zoomLevel);
                  guides[draggingGuide.index].position = pageX;
                } else {
                  const pageY = Math.round((e.clientY - canvasContainerRect.top - originY) / zoomLevel);
                  guides[draggingGuide.index].position = pageY;
                }
                drawOverlay();
              }
            }
            // Update cursor coords in status bar
            const cx = Math.round((e.clientX - canvasContainerRect.left - panX) / zoomLevel);
            const cy = Math.round((e.clientY - canvasContainerRect.top - panY) / zoomLevel);
            document.getElementById('cursor-pos').textContent = cx + ', ' + cy + ' px';
          });

          document.addEventListener('mouseup', () => {
            if (isPanning) {
              isPanning = false;
              canvasContainer.style.cursor = currentTool === 'hand' ? 'grab' : 'default';
            }
            if (draggingGuide) {
              const g = guides[draggingGuide.index];
              if (g && (g.position < -5000 || g.position > 5000)) {
                guides.splice(draggingGuide.index, 1);
              }
              draggingGuide = null;
              drawOverlay();
            }
          });

          // Spacebar = temp hand tool
          let spaceHeld = false;
          document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !spaceHeld && document.activeElement.tagName !== 'INPUT') {
              spaceHeld = true;
              canvasContainer.style.cursor = 'grab';
              e.preventDefault();
            }
          });
          document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
              spaceHeld = false;
              canvasContainer.style.cursor = currentTool === 'hand' ? 'grab' : 'default';
            }
          });

          // Click out of frame (empty canvas background) clears selection
          document.addEventListener('click', (e) => {
            const menu = document.getElementById('glide-context-menu');
            if (menu) menu.style.display = 'none';

            const isSidebar = e.target.closest('.sidebar');
            const isHeader = e.target.closest('header');
            const isToolbar = e.target.closest('#figma-toolbar');
            const isIframe = e.target.closest('#app-iframe');
            
            if (!isSidebar && !isHeader && !isToolbar && !isIframe) {
              selectedSources = [];
              selectedRects = [];
              selectedElement = null;
              selectedRect = null;
              clearOverlay();
              showNoSelection();
              document.querySelectorAll('.layer-item').forEach(item => item.classList.remove('active'));
              
              const iframe = document.getElementById('app-iframe');
              if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({ type: 'glide:clear-selection' }, '*');
              }
            }
          });

          // ═══════════════════════════════════════════════════════════════
          // OVERLAY SVG — selection + hover
          // ═══════════════════════════════════════════════════════════════
          const svg = document.getElementById('overlay-svg');

          function clearOverlay() {
            const g = document.getElementById('selection-group');
            if (g) {
              g.innerHTML = '';
              g.removeAttribute('transform');
            }
            const hoverRects = Array.from(svg.querySelectorAll('svg > rect'));
            hoverRects.forEach(r => svg.removeChild(r));
            
            const gGroup = document.getElementById('snap-guides-group');
            if (gGroup) {
              gGroup.innerHTML = '';
            }

            // Clear distance measures
            document.querySelectorAll('.glide-measure-element').forEach(el => el.remove());
          }

          function createSelectionGroup() {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.id = 'selection-group';
            svg.appendChild(g);
            return g;
          }

          function drawSelectionBox(rect, isHover) {
            const container = isHover ? svg : (document.getElementById('selection-group') || createSelectionGroup());

            const r = document.createElementNS('http://www.w3.org/2000/svg','rect');
            r.setAttribute('x', rect.x);
            r.setAttribute('y', rect.y);
            r.setAttribute('width', rect.width);
            r.setAttribute('height', rect.height);
            r.setAttribute('fill', 'none');
            r.setAttribute('stroke', '#0d99ff');
            r.setAttribute('stroke-width', '1');
            if (isHover) {
              r.setAttribute('stroke-dasharray', '4 2');
              r.setAttribute('opacity', '0.5');
            }
            container.appendChild(r);

            if (!isHover) {
              // Add corners resize handles
              const handles = [
                { x: rect.x, y: rect.y, cursor: 'nwse-resize' },
                { x: rect.x + rect.width, y: rect.y, cursor: 'nesw-resize' },
                { x: rect.x + rect.width, y: rect.y + rect.height, cursor: 'nwse-resize' },
                { x: rect.x, y: rect.y + rect.height, cursor: 'nesw-resize' },
                { x: rect.x + rect.width/2, y: rect.y, cursor: 'ns-resize' },
                { x: rect.x + rect.width, y: rect.y + rect.height/2, cursor: 'ew-resize' },
                { x: rect.x + rect.width/2, y: rect.y + rect.height, cursor: 'ns-resize' },
                { x: rect.x, y: rect.y + rect.height/2, cursor: 'ew-resize' },
              ];
              handles.forEach(([hx, hy]) => {
                const h = document.createElementNS('http://www.w3.org/2000/svg','rect');
                h.setAttribute('x', hx - 4);
                h.setAttribute('y', hy - 4);
                h.setAttribute('width', '8');
                h.setAttribute('height', '8');
                h.setAttribute('fill', 'white');
                h.setAttribute('stroke', '#0d99ff');
                h.setAttribute('stroke-width', '1');
                container.appendChild(h);
              });
            }
          }

          function drawDistanceIndicators(selRect, refRect) {
            if (!selRect || !refRect) return;
            const svgEl = document.getElementById('overlay-svg');
            if (!svgEl) return;
            
            let lines = [];
            
            // horizontal distance
            if (selRect.x + selRect.width <= refRect.x) {
              const y = selRect.y + selRect.height / 2;
              lines.push({ x1: selRect.x + selRect.width, y1: y, x2: refRect.x, y2: y, label: Math.round(refRect.x - (selRect.x + selRect.width)) });
            } else if (refRect.x + refRect.width <= selRect.x) {
              const y = selRect.y + selRect.height / 2;
              lines.push({ x1: refRect.x + refRect.width, y1: y, x2: selRect.x, y2: y, label: Math.round(selRect.x - (refRect.x + refRect.width)) });
            }

            // vertical distance
            if (selRect.y + selRect.height <= refRect.y) {
              const x = selRect.x + selRect.width / 2;
              lines.push({ x1: x, y1: selRect.y + selRect.height, x2: x, y2: refRect.y, label: Math.round(refRect.y - (selRect.y + selRect.height)) });
            } else if (refRect.y + refRect.height <= selRect.y) {
              const x = selRect.x + selRect.width / 2;
              lines.push({ x1: x, y1: refRect.y + refRect.height, x2: x, y2: selRect.y, label: Math.round(selRect.y - (refRect.y + refRect.height)) });
            }

            lines.forEach(l => {
              if (l.label <= 0) return;
              const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line.setAttribute('x1', l.x1);
              line.setAttribute('y1', l.y1);
              line.setAttribute('x2', l.x2);
              line.setAttribute('y2', l.y2);
              line.setAttribute('stroke', '#ff4444');
              line.setAttribute('stroke-width', '1.5');
              line.classList.add('glide-measure-element');
              svgEl.appendChild(line);

              const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
              txt.setAttribute('x', (l.x1 + l.x2) / 2);
              txt.setAttribute('y', (l.y1 + l.y2) / 2 - 4);
              txt.setAttribute('fill', '#ff4444');
              txt.setAttribute('font-size', '10');
              txt.setAttribute('font-family', 'monospace');
              txt.setAttribute('font-weight', 'bold');
              txt.setAttribute('text-anchor', 'middle');
              txt.textContent = l.label + 'px';
              txt.classList.add('glide-measure-element');
              svgEl.appendChild(txt);
            });
          }

          function drawGuides() {
            const svgEl = document.getElementById('overlay-svg');
            if (!svgEl) return;

            document.querySelectorAll('.glide-guide-line').forEach(el => el.remove());
            if (!guidesVisible) return;

            guides.forEach((g, idx) => {
              const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line.classList.add('glide-guide-line');
              line.dataset.index = idx;
              
              if (g.axis === 'x') {
                line.setAttribute('x1', g.position);
                line.setAttribute('y1', -5000);
                line.setAttribute('x2', g.position);
                line.setAttribute('y2', 5000);
                line.style.cursor = 'ew-resize';
              } else {
                line.setAttribute('x1', -5000);
                line.setAttribute('y1', g.position);
                line.setAttribute('x2', 5000);
                line.setAttribute('y2', g.position);
                line.style.cursor = 'ns-resize';
              }
              line.setAttribute('stroke', '#38bdf8'); // sky blue Figma style
              line.setAttribute('stroke-width', '1.5');
              line.setAttribute('pointer-events', 'auto');

              line.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                draggingGuide = { index: idx, axis: g.axis };
                line.setPointerCapture(e.pointerId);
              });

              line.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                guides.splice(idx, 1);
                drawGuides();
              });

              svgEl.appendChild(line);
            });
          }

          function drawOverlay() {
            clearOverlay();
            if (selectedRects && selectedRects.length > 0) {
              if (selectedRects.length === 1) {
                if (selectedRects[0]) {
                  drawSelectionBox(selectedRects[0], false);
                  if (hoveredRect && hoveredElement && !selectedSources.includes(hoveredElement.source)) {
                    drawDistanceIndicators(selectedRects[0], hoveredRect);
                  }
                }
              } else {
                let minX = Infinity;
                let minY = Infinity;
                let maxX = -Infinity;
                let maxY = -Infinity;
                selectedRects.forEach(r => {
                  if (r) {
                    minX = Math.min(minX, r.x);
                    minY = Math.min(minY, r.y);
                    maxX = Math.max(maxX, r.x + r.width);
                    maxY = Math.max(maxY, r.y + r.height);
                  }
                });
                if (minX !== Infinity) {
                  drawSelectionBox({
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY
                  }, false);
                }
              }
            }
            if (hoveredRect && (!hoveredElement || !selectedSources.includes(hoveredElement.source))) {
              drawSelectionBox(hoveredRect, true);
            }
            drawGuides();
          }

          function renderSnapGuides(guides) {
            let gGroup = document.getElementById('snap-guides-group');
            if (!gGroup) {
              gGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
              gGroup.id = 'snap-guides-group';
              svg.appendChild(gGroup);
            }
            gGroup.innerHTML = '';
            
            guides.forEach(guide => {
              const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              if (guide.axis === 'x') {
                line.setAttribute('x1', guide.position);
                line.setAttribute('y1', '0');
                line.setAttribute('x2', guide.position);
                line.setAttribute('y2', '100%');
              } else {
                line.setAttribute('x1', '0');
                line.setAttribute('y1', guide.position);
                line.setAttribute('x2', '100%');
                line.setAttribute('y2', guide.position);
              }
              line.setAttribute('stroke', '#38bdf8'); // Accent color
              line.setAttribute('stroke-width', '1');
              gGroup.appendChild(line);
            });
          }

          // ═══════════════════════════════════════════════════════════════
          // BRIDGE COMMUNICATION (postMessage from iframe)
          // ═══════════════════════════════════════════════════════════════
          window.addEventListener('message', (event) => {
            const data = event.data;
            if (!data || !data.type) return;

            if (data.type === 'glide:document-height') {
              const iframe = document.getElementById('app-iframe');
              if (iframe) {
                iframe.style.height = data.height + 'px';
              }
              return;
            }

            if (data.type === 'glide:marquee-start') {
              let rect = document.getElementById('marquee-select-rect');
              if (!rect) {
                rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.id = 'marquee-select-rect';
                rect.setAttribute('fill', 'rgba(13, 153, 255, 0.08)');
                rect.setAttribute('stroke', '#0d99ff');
                rect.setAttribute('stroke-width', '1');
                rect.setAttribute('stroke-dasharray', '3 3');
                svg.appendChild(rect);
              }
              rect.setAttribute('x', data.x);
              rect.setAttribute('y', data.y);
              rect.setAttribute('width', '0');
              rect.setAttribute('height', '0');
            }
            if (data.type === 'glide:marquee-move') {
              const rect = document.getElementById('marquee-select-rect');
              if (rect) {
                const startX = data.startX;
                const startY = data.startY;
                const curX = data.x;
                const curY = data.y;
                const x = Math.min(startX, curX);
                const y = Math.min(startY, curY);
                const w = Math.abs(startX - curX);
                const h = Math.abs(startY - curY);
                rect.setAttribute('x', x);
                rect.setAttribute('y', y);
                rect.setAttribute('width', w);
                rect.setAttribute('height', h);
              }
            }
            if (data.type === 'glide:marquee-end') {
              const rect = document.getElementById('marquee-select-rect');
              if (rect) {
                rect.remove();
              }
              const startX = data.startX;
              const startY = data.startY;
              const endX = data.endX;
              const endY = data.endY;
              const isRightToLeft = data.isRightToLeft;
              const isShift = data.isShift;

              const x = Math.min(startX, endX);
              const y = Math.min(startY, endY);
              const w = Math.abs(startX - endX);
              const h = Math.abs(startY - endY);

              if (w > 3 || h > 3) {
                const iframe = document.getElementById('app-iframe');
                if (iframe && iframe.contentWindow) {
                  iframe.contentWindow.postMessage({
                    type: 'glide:select-marquee',
                    x: x,
                    y: y,
                    w: w,
                    h: h,
                    isRightToLeft: isRightToLeft,
                    isShift: isShift
                  }, '*');
                }
              }
            }

            if (data.type === 'glide:element-selected' || data.type === 'glide:element-hovered') {
              updateLayersPanel(data);
            }
            if (data.type === 'glide:overlay') {
              if (data.isHover) {
                hoveredElement = { source: data.source };
                hoveredRect = data.rect;
              } else {
                const isShift = data.isShift;
                const source = data.source;
                const rect = data.rect;
                
                if (!isShift) {
                  selectedSources = [source];
                  selectedRects = [rect];
                } else {
                  if (!selectedSources.includes(source)) {
                    selectedSources.push(source);
                    selectedRects.push(rect);
                  }
                }
                
                selectedElement = { source: source };
                selectedRect = rect;
                selectedComputedStyles = data.computedStyles;
                populatePropsFromComputed(data.computedStyles || {}, rect || {});
                
                // Highlight selected items in layers tree
                document.querySelectorAll('.layer-item').forEach(item => {
                  if (selectedSources.includes(item.dataset.source)) {
                    item.classList.add('active');
                  } else {
                    item.classList.remove('active');
                  }
                });
              }
              drawOverlay();
            }
            if (data.type === 'glide:element-deselected') {
              const source = data.source;
              const idx = selectedSources.indexOf(source);
              if (idx !== -1) {
                selectedSources.splice(idx, 1);
                selectedRects.splice(idx, 1);
              }
              if (selectedSources.length > 0) {
                selectedElement = { source: selectedSources[selectedSources.length - 1] };
                selectedRect = selectedRects[selectedRects.length - 1];
              } else {
                selectedElement = null;
                selectedRect = null;
                showNoSelection();
              }
              drawOverlay();
              
              // Update highlights in layers tree
              document.querySelectorAll('.layer-item').forEach(item => {
                if (selectedSources.includes(item.dataset.source)) {
                  item.classList.add('active');
                } else {
                  item.classList.remove('active');
                }
              });
            }
            if (data.type === 'glide:clear-selection') {
              selectedSources = [];
              selectedRects = [];
              selectedElement = null;
              selectedRect = null;
              clearOverlay();
              showNoSelection();
              document.querySelectorAll('.layer-item').forEach(item => item.classList.remove('active'));
            }
            if (data.type === 'glide:element-hover-exit') {
              hoveredElement = null;
              hoveredRect = null;
              drawOverlay();
            }

            if (data.type === 'glide:drag-delta') {
              const g = document.getElementById('selection-group');
              if (g) {
                g.setAttribute('transform', 'translate(' + data.dx + ', ' + data.dy + ')');
              }
              renderSnapGuides(data.guides || []);
            }
            if (data.type === 'glide:element-drag-end') {
              sendPositionChange(data.source, {
                position: 'relative',
                left: data.dx + 'px',
                top: data.dy + 'px'
              });
              selectedRect = null;
              clearOverlay();
              renderSnapGuides([]);
            }
            if (data.type === 'glide:snap-guides-clear') {
              renderSnapGuides([]);
            }
            if (data.type === 'glide:contextmenu') {
              const iframe = document.getElementById('app-iframe');
              const rect = iframe.getBoundingClientRect();
              const menu = document.getElementById('glide-context-menu');
              if (menu) {
                const mGroup = document.getElementById('menu-group');
                const mUngroup = document.getElementById('menu-ungroup');

                if (selectedSources.length > 1) {
                  if (mGroup) mGroup.classList.remove('disabled');
                } else {
                  if (mGroup) mGroup.classList.add('disabled');
                }

                if (selectedElement && selectedElement.source) {
                  if (mUngroup) mUngroup.classList.remove('disabled');
                } else {
                  if (mUngroup) mUngroup.classList.add('disabled');
                }

                menu.style.display = 'block';
                menu.style.left = (rect.left + data.clientX) + 'px';
                menu.style.top = (rect.top + data.clientY) + 'px';
              }
            }
            if (data.type === 'glide:element-selected-by-id') {
              selectedElement = { source: data.source };
            }
          });

          function updateLayersPanel(data) {
            if (!data.source || !socket || socket.readyState !== WebSocket.OPEN) return;
            const parsed = parseSource(data.source);
            if (!parsed) return;
            socket.send(JSON.stringify({ type: 'get-tree', file: parsed.file }));
          }

          // ═══════════════════════════════════════════════════════════════
          // LAYERS TREE RENDERING
          // ═══════════════════════════════════════════════════════════════
          /* ── Layer icon SVGs — Figma-style monochrome ── */
          const LAYER_ICONS = {
            frame:    '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="10" height="10" rx="1"/><line x1="1" y1="4" x2="11" y2="4"/><line x1="1" y1="8" x2="11" y2="8"/><line x1="4" y1="1" x2="4" y2="11"/><line x1="8" y1="1" x2="8" y2="11"/></svg>',
            text:     '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><text x="1" y="10" font-size="10" font-family="serif" font-weight="700">T</text></svg>',
            button:   '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="3" width="10" height="6" rx="2"/></svg>',
            image:    '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="10" height="10" rx="1"/><polyline points="1,9 3.5,6.5 5.5,8.5 7.5,5.5 11,9"/><circle cx="8.5" cy="3.5" r="1"/></svg>',
            list:     '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="1" y="2" width="2" height="2" rx="1"/><rect x="1" y="5" width="2" height="2" rx="1"/><rect x="1" y="8" width="2" height="2" rx="1"/><rect x="4.5" y="2.5" width="6.5" height="1" rx="0.5"/><rect x="4.5" y="5.5" width="6.5" height="1" rx="0.5"/><rect x="4.5" y="8.5" width="6.5" height="1" rx="0.5"/></svg>',
            input:    '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="3" width="10" height="6" rx="1"/><line x1="3" y1="6" x2="3" y2="8" stroke-width="1"/></svg>',
            nav:      '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="10" height="3" rx="1"/><rect x="1" y="6" width="4" height="5" rx="1"/><rect x="7" y="6" width="4" height="5" rx="1"/></svg>',
            section:  '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="10" height="10" rx="1"/></svg>',
            svg:      '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 11 L4 4 L7 8 L9 6 L11 11 Z"/></svg>',
            link:     '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 7.5 A3 3 0 0 0 8.5 7.5 L9.5 6.5 A3 3 0 0 0 5.5 2.5 L4.5 3.5"/><path d="M7 4.5 A3 3 0 0 0 3.5 4.5 L2.5 5.5 A3 3 0 0 0 6.5 9.5 L7.5 8.5"/></svg>',
            component:'<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 1 L11 3.5 L11 8.5 L6 11 L1 8.5 L1 3.5 Z"/></svg>',
            div:      '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="10" height="10" rx="1" stroke-dasharray="2 1.5"/></svg>',
            group:    '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="2" width="8" height="7" rx="1"/><rect x="3.5" y="0.5" width="8" height="7" rx="1"/></svg>',
          };

          function getLayerIconSVG(name) {
            const n = name.toLowerCase();
            if (n === 'svg') return LAYER_ICONS.svg;
            if (n === 'img') return LAYER_ICONS.image;
            if (n === 'a') return LAYER_ICONS.link;
            if (n === 'button') return LAYER_ICONS.button;
            if (['input','textarea','select'].includes(n)) return LAYER_ICONS.input;
            if (['p','span','h1','h2','h3','h4','h5','h6','label','em','strong','small','b','i'].includes(n)) return LAYER_ICONS.text;
            if (['ul','ol','li'].includes(n)) return LAYER_ICONS.list;
            if (n === 'nav') return LAYER_ICONS.nav;
            if (['section','article','header','footer','main','aside'].includes(n)) return LAYER_ICONS.section;
            if (name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase()) return LAYER_ICONS.component;
            return LAYER_ICONS.div;
          }

          function isGroupNode(node) {
            return node.name.toLowerCase() === 'div' && node.id && String(node.id).includes('group');
          }

          let layerTree = null;

          function escapeHtml(s) {
            return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
          }

          function renderLayersTree(tree) {
            layerTree = tree;
            const list = document.getElementById('layers-list');
            list.innerHTML = '';
            
            componentRootSources.clear();

            const filterInput = document.getElementById('layer-search-input');
            const filterVal = (filterInput ? filterInput.value : '').trim().toLowerCase();

            function nodeMatchesQuery(n, q) {
              if (n.name.toLowerCase().includes(q)) return true;
              if (n.className && n.className.toLowerCase().includes(q)) return true;
              if (n.text && n.text.toLowerCase().includes(q)) return true;
              return false;
            }
            function hasMatchingDescendant(n, q) {
              if (nodeMatchesQuery(n, q)) return true;
              if (n.children) {
                for (const child of n.children) {
                  if (hasMatchingDescendant(child, q)) return true;
                }
              }
              return false;
            }

            let totalCount = 0;
            function renderNode(node, depth) {
              if (filterVal && !hasMatchingDescendant(node, filterVal)) {
                return;
              }
              totalCount++;
              if (lockedIds.has(node.id)) return;

              const item = document.createElement('div');
              item.className = 'layer-item';
              item.dataset.nodeId = node.id;

              const nodeSource = convertNodeIdToSource(node.id, currentFile);
              item.dataset.source = nodeSource;

              // Component root highlight
              const isComponent = node.name.length > 0 && node.name[0].toUpperCase() === node.name[0] && node.name[0] !== node.name[0].toLowerCase();
              if (isComponent) {
                item.classList.add('component-root');
                componentRootSources.add(nodeSource);
              }

              // Group container highlight
              if (isGroupNode(node)) {
                item.classList.add('group-container');
              }

              // Active state
              if (selectedSources.includes(nodeSource)) {
                item.classList.add('active');
              }

              const hasChildren = node.children && node.children.length > 0;
              item.style.paddingLeft = (6 + depth * 12) + 'px';

              const iconSVG = getLayerIconSVG(node.name);

              // Display: tagName as-is per FEATURES.md §18, first class as dim tag
              let displayName = node.name;
              let tagLabel = '';
              if (isComponent) {
                if (node.className) {
                  const firstClass = node.className.split(' ').filter(Boolean)[0];
                  if (firstClass) tagLabel = '.' + firstClass;
                }
              } else {
                if (node.className) {
                  const firstClass = node.className.split(' ').filter(Boolean)[0];
                  if (firstClass) tagLabel = '.' + firstClass;
                }
              }

              const isHidden = hiddenIds.has(node.id);
              if (isHidden) item.classList.add('hidden-node');

              const isExpanded = expandedNodeIds.has(node.id);
              const caretSVG = hasChildren
                ? '<span class="layer-caret" style="' + (isExpanded ? 'transform:rotate(90deg)' : '') + '">' +
                    '<i data-lucide="chevron-down" style="width: 8px; height: 8px;"></i>' +
                  '</span>'
                : '<span class="layer-caret" style="visibility:hidden"><i data-lucide="chevron-down" style="width: 8px; height: 8px;"></i></span>';

              // Eye icon SVG
              const eyeSVG = isHidden
                ? '<i data-lucide="eye-off" style="width: 12px; height: 12px;"></i>'
                : '<i data-lucide="eye" style="width: 12px; height: 12px;"></i>';

              item.innerHTML =
                caretSVG +
                '<span class="layer-icon-svg">' + iconSVG + '</span>' +
                '<span class="layer-label">' +
                  '<span class="layer-name">' + escapeHtml(displayName) + '</span>' +
                  (tagLabel ? '<span class="layer-tag">' + escapeHtml(tagLabel) + '</span>' : '') +
                  (node.text ? '<span class="layer-text">' + escapeHtml(node.text.slice(0, 20)) + (node.text.length > 20 ? '…' : '') + '</span>' : '') +
                '</span>' +
                '<div class="layer-actions">' +
                  '<button class="layer-action-btn eye-btn' + (isHidden ? ' hidden-state' : '') + '" data-node-id="' + node.id + '" title="Toggle visibility">' + eyeSVG + '</button>' +
                '</div>';

              // Caret click to toggle collapse/expand
              if (hasChildren) {
                item.querySelector('.layer-caret').addEventListener('click', (e) => {
                  e.stopPropagation();
                  if (expandedNodeIds.has(node.id)) {
                    expandedNodeIds.delete(node.id);
                  } else {
                    expandedNodeIds.add(node.id);
                  }
                  renderLayersTree(layerTree);
                });
              }

              // Click → select (with multi-select modifier)
              item.addEventListener('click', (e) => {
                if (e.target.closest('.layer-actions') || e.target.closest('.layer-caret')) return;
                if (lockedIds.has(node.id)) return;
                const isShift = e.shiftKey || e.ctrlKey || e.metaKey;
                const iframe = document.getElementById('app-iframe');
                if (iframe && iframe.contentWindow) {
                  iframe.contentWindow.postMessage({
                    type: 'glide:select-element-by-id',
                    id: nodeSource,
                    isShift: isShift
                  }, '*');
                }
              });

              // Eye button
              item.querySelector('.eye-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const nid = e.currentTarget.dataset.nodeId;
                if (hiddenIds.has(nid)) {
                  hiddenIds.delete(nid);
                  sendStyleChange(nodeSource, 'display', '');
                } else {
                  hiddenIds.add(nid);
                  sendStyleChange(nodeSource, 'display', 'none');
                }
                renderLayersTree(layerTree);
              });
              // Drag-and-drop reorder
              item.setAttribute('draggable', 'true');
              item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', nodeSource);
                item.style.opacity = '0.4';
                e.stopPropagation();
              });
              item.addEventListener('dragend', () => { item.style.opacity = ''; });
              item.addEventListener('dragover', (e) => {
                e.preventDefault();
                const rect = item.getBoundingClientRect();
                const mid = (e.clientY - rect.top) < rect.height / 2;
                item.style.borderTop = mid ? '2px solid var(--accent-color)' : '';
                item.style.borderBottom = mid ? '' : '2px solid var(--accent-color)';
              });
              item.addEventListener('dragleave', () => {
                item.style.borderTop = '';
                item.style.borderBottom = '';
              });
              item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.style.borderTop = '';
                item.style.borderBottom = '';
                const draggedSource = e.dataTransfer.getData('text/plain');
                if (!draggedSource || draggedSource === nodeSource) return;
                const rect = item.getBoundingClientRect();
                
                // Direct DOM order matching (natural visual order)
                const mid = (e.clientY - rect.top) < rect.height / 2;
                const position = mid ? 'before' : 'after';
                
                const parentNode = findParentNodeInTree(layerTree, node.id);
                if (parentNode && socket && socket.readyState === WebSocket.OPEN) {
                  const parentSource = convertNodeIdToSource(parentNode.id, currentFile);
                  socket.send(JSON.stringify({
                    type: 'reorder',
                    file: currentFile,
                    targetId: draggedSource,
                    parentId: parentSource,
                    siblingId: nodeSource,
                    position
                  }));
                }
              });

              // Double-click → inline edit
              item.addEventListener('dblclick', (e) => {
                if (e.target.closest('.layer-actions') || e.target.closest('.layer-caret')) return;
                const nameSpan = item.querySelector('.layer-name-text');
                const original = node.name + (node.text ? ': ' + node.text : '');
                const inp = document.createElement('input');
                inp.value = node.text || node.name;
                inp.style.cssText = 'background:var(--bg-base);border:1px solid var(--accent-color);color:var(--text-primary);padding:2px 4px;border-radius:3px;font-size:12px;font-family:inherit;outline:none;width:100%;';
                nameSpan.innerHTML = '';
                nameSpan.appendChild(inp);
                inp.focus();
                
                // auto-select text
                const len = inp.value.length;
                inp.setSelectionRange(0, len);

                inp.addEventListener('click', (ev) => {
                  ev.stopPropagation();
                });

                // Style validation during input
                inp.addEventListener('input', () => {
                  const newVal = inp.value.trim();
                  if (newVal === '') {
                    inp.style.border = '1px solid #ef4444';
                    inp.style.boxShadow = '0 0 0 1px #ef4444';
                  } else {
                    inp.style.border = '1px solid var(--accent-color)';
                    inp.style.boxShadow = 'none';
                  }
                });

                const commit = () => {
                  const newText = inp.value.trim();
                  if (newText && newText !== (node.text || node.name) && node.text !== undefined) {
                    if (socket && socket.readyState === WebSocket.OPEN) {
                      socket.send(JSON.stringify({
                        type: 'edit',
                        file: currentFile,
                        line: parseInt((nodeSource.match(/:(\d+):(\d+)$/) || [])[1] || '0', 10),
                        column: parseInt((nodeSource.match(/:(\d+)$/) || [])[0].slice(1) || '0', 10),
                        change: { type: 'text', value: newText }
                      }));
                    }
                  }
                  renderLayersTree(layerTree);
                };

                inp.addEventListener('keydown', (ev) => {
                  if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
                  if (ev.key === 'Escape') { renderLayersTree(layerTree); }
                  ev.stopPropagation();
                });
                inp.addEventListener('blur', commit);
              });

              list.appendChild(item);

              if (hasChildren && expandedNodeIds.has(node.id)) {
                // Natural DOM order (top-to-bottom) for easy web-page hierarchy
                node.children.forEach(child => renderNode(child, depth + 1));
              }
            }

            if (tree && tree.length > 0) {
              tree.forEach(node => renderNode(node, 0));
              document.getElementById('layer-count').textContent = totalCount + ' elements';
            } else {
              list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-secondary);font-size:12px;">No elements found</div>';
            }

            // Sync component roots list to iframe
            const iframe = document.getElementById('app-iframe');
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage({
                type: 'glide:update-component-roots',
                roots: Array.from(componentRootSources)
              }, '*');
            }
            if (window.lucide) {
              window.lucide.createIcons();
            }
          }

          // ═══════════════════════════════════════════════════════════════
          // LOAD APP IFRAME
          // ═══════════════════════════════════════════════════════════════
          function loadApp(url) {
            const iframe = document.getElementById('app-iframe');
            const loading = document.getElementById('canvas-loading');
            const statusEl = document.getElementById('load-status');

            if (loading) loading.style.display = 'flex';
            if (statusEl) statusEl.textContent = 'Loading ' + url + '...';

            iframe.onload = () => {
              setTimeout(() => { if (loading) loading.style.display = 'none'; }, 300);
              // Send the component roots and snap settings on load
              if (iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                  type: 'glide:update-component-roots',
                  roots: Array.from(componentRootSources)
                }, '*');
                iframe.contentWindow.postMessage({
                  type: 'glide:set-snap-object',
                  enabled: snapObjectEnabled
                }, '*');
                iframe.contentWindow.postMessage({
                  type: 'glide:set-snap-pixel',
                  enabled: snapPixelEnabled
                }, '*');
              }
            };
            iframe.onerror = () => {
              if (statusEl) statusEl.textContent = '❌ Failed to load. Is the app running at ' + url + '?';
            };

            iframe.src = url;
          }

          // ═══════════════════════════════════════════════════════════════
          // PROPERTIES PANEL
          // ═══════════════════════════════════════════════════════════════
          function showNoSelection() {
            document.getElementById('no-selection-msg').style.display = 'flex';
            document.getElementById('props-content').style.display = 'none';
            document.getElementById('selected-tag').textContent = '';
          }

          function showPropsPanel(tagName) {
            document.getElementById('no-selection-msg').style.display = 'none';
            document.getElementById('props-content').style.display = 'block';
            document.getElementById('selected-tag').textContent = '<' + (tagName || '?') + '>';
          }

          function parsePixels(val) {
            if (!val) return '';
            return parseInt(val, 10) || 0;
          }

          function populatePropsFromComputed(styles, rect) {
            showPropsPanel(styles.tagName);

            // Position & Size
            if (rect) {
              document.getElementById('prop-x').value = Math.round(rect.x || 0);
              document.getElementById('prop-y').value = Math.round(rect.y || 0);
              document.getElementById('prop-w').value = Math.round(rect.width || 0);
              document.getElementById('prop-h').value = Math.round(rect.height || 0);
            }

            // Rotation
            const transform = styles.transform || '';
            const rotMatch = transform.match(/rotate\\(([\\d.-]+)deg\\)/);
            document.getElementById('prop-rotation').value = rotMatch ? parseFloat(rotMatch[1]) : 0;

            // Flex section
            const isFlexContainer = styles.display === 'flex' || styles.display === 'inline-flex';
            document.getElementById('section-flex').style.display = isFlexContainer ? 'block' : 'none';
            if (isFlexContainer) {
              setActiveBtn(['flex-row','flex-col'], styles.flexDirection === 'column' ? 'flex-col' : 'flex-row');
              const jcMap = {'flex-start':'jc-start','center':'jc-center','flex-end':'jc-end','space-between':'jc-between','space-around':'jc-around'};
              setActiveBtn(Object.values(jcMap), jcMap[styles.justifyContent] || '');
              const aiMap = {'flex-start':'ai-start','center':'ai-center','flex-end':'ai-end','stretch':'ai-stretch'};
              setActiveBtn(Object.values(aiMap), aiMap[styles.alignItems] || '');
              document.getElementById('prop-gap').value = parsePixels(styles.gap) || '';
              document.getElementById('prop-row-gap').value = parsePixels(styles.rowGap) || '';
            }

            // Spacing
            document.getElementById('prop-mt').value = parsePixels(styles.marginTop);
            document.getElementById('prop-mb').value = parsePixels(styles.marginBottom);
            document.getElementById('prop-ml').value = parsePixels(styles.marginLeft);
            document.getElementById('prop-mr').value = parsePixels(styles.marginRight);
            document.getElementById('prop-pt').value = parsePixels(styles.paddingTop);
            document.getElementById('prop-pb').value = parsePixels(styles.paddingBottom);
            document.getElementById('prop-pl').value = parsePixels(styles.paddingLeft);
            document.getElementById('prop-pr').value = parsePixels(styles.paddingRight);

            // Typography
            if (styles.fontFamily) document.getElementById('prop-font-family').value = styles.fontFamily;
            if (styles.fontSize)   document.getElementById('prop-font-size').value = parsePixels(styles.fontSize);
            if (styles.fontWeight) document.getElementById('prop-font-weight').value = styles.fontWeight;
            if (styles.lineHeight) document.getElementById('prop-line-height').value = parseFloat(styles.lineHeight) || '';
            if (styles.letterSpacing) document.getElementById('prop-letter-spacing').value = parsePixels(styles.letterSpacing);

            const taMap = {'left':'ta-left','center':'ta-center','right':'ta-right','justify':'ta-justify'};
            setActiveBtn(Object.values(taMap), taMap[styles.textAlign] || 'ta-left');

            if (styles.color) {
              const hex = rgbToHex(styles.color);
              document.getElementById('prop-color').value = hex;
              document.getElementById('prop-color-hex').value = hex;
              document.getElementById('color-swatch-text').style.background = hex;
            }

            // Fill / Background
            const bgImg = styles.backgroundImage || '';
            const bg = styles.backgroundColor;
            if (bgImg && bgImg.includes('gradient')) {
              setFillMode('gradient');
              if (bgImg.includes('radial-gradient')) {
                gradType = 'radial';
                setActiveBtn(['grad-linear', 'grad-radial'], 'grad-radial');
              } else {
                gradType = 'linear';
                setActiveBtn(['grad-linear', 'grad-radial'], 'grad-linear');
                const angleMatch = bgImg.match(/(\d+)deg/);
                if (angleMatch) {
                  document.getElementById('prop-grad-angle').value = angleMatch[1];
                }
              }
              const colors = bgImg.match(/(#[0-9a-fA-F]{3,8}|rgba?\(.*?\))/g);
              if (colors && colors.length >= 2) {
                const startHex = rgbToHex(colors[0]);
                const endHex = rgbToHex(colors[1]);
                
                document.getElementById('prop-grad-start').value = startHex;
                document.getElementById('prop-grad-start-hex').value = startHex;
                document.getElementById('color-swatch-grad-start').style.background = startHex;
                
                document.getElementById('prop-grad-end').value = endHex;
                document.getElementById('prop-grad-end-hex').value = endHex;
                document.getElementById('color-swatch-grad-end').style.background = endHex;
              }
              document.getElementById('grad-preview').style.background = bgImg;
            } else if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
              const hex = rgbToHex(bg);
              document.getElementById('prop-bg-color').value = hex;
              document.getElementById('prop-bg-hex').value = hex;
              document.getElementById('color-swatch-bg').style.background = hex;
              setFillMode('solid');
            } else {
              setFillMode('none');
            }

            // Border
            if (styles.borderColor) {
              const hex = rgbToHex(styles.borderColor);
              document.getElementById('prop-border-color').value = hex;
              document.getElementById('color-swatch-border').style.background = hex;
            }
            document.getElementById('prop-border-width').value = parsePixels(styles.borderWidth) || 0;
            if (styles.borderStyle) document.getElementById('prop-border-style').value = styles.borderStyle;

            // Radius
            document.getElementById('prop-br-tl').value = parsePixels(styles.borderTopLeftRadius) || 0;
            document.getElementById('prop-br-tr').value = parsePixels(styles.borderTopRightRadius) || 0;
            document.getElementById('prop-br-br').value = parsePixels(styles.borderBottomRightRadius) || 0;
            document.getElementById('prop-br-bl').value = parsePixels(styles.borderBottomLeftRadius) || 0;

            // Opacity
            const opacity = styles.opacity !== undefined ? Math.round(parseFloat(styles.opacity || 1) * 100) : 100;
            document.getElementById('prop-opacity').value = opacity;
            document.getElementById('prop-opacity-slider').value = opacity;
          }

          function setActiveBtn(ids, activeId) {
            ids.forEach(id => {
              const el = document.getElementById(id);
              if (el) el.classList.toggle('active', id === activeId);
            });
          }

          function setFillMode(mode) {
            setActiveBtn(['fill-none','fill-solid','fill-gradient'], 'fill-' + mode);
            document.getElementById('fill-solid-controls').style.display = mode === 'solid' ? 'block' : 'none';
            document.getElementById('fill-gradient-controls').style.display = mode === 'gradient' ? 'block' : 'none';
          }

          function rgbToHex(rgb) {
            if (!rgb) return '#000000';
            if (rgb.startsWith('#')) return rgb;
            const m = rgb.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
            if (!m) return '#000000';
            return '#' + [m[1],m[2],m[3]].map(x => parseInt(x).toString(16).padStart(2,'0')).join('');
          }

          function updateGradientFill() {
            const angle = document.getElementById('prop-grad-angle').value || '90';
            const start = document.getElementById('prop-grad-start').value || '#000000';
            const end = document.getElementById('prop-grad-end').value || '#ffffff';
            
            let gradVal = '';
            if (gradType === 'linear') {
              gradVal = 'linear-gradient(' + angle + 'deg, ' + start + ', ' + end + ')';
            } else {
              gradVal = 'radial-gradient(circle, ' + start + ', ' + end + ')';
            }
            
            document.getElementById('grad-preview').style.background = gradVal;
            sendMultiClassChange(selectedElement.source, {
              backgroundImage: gradVal,
              backgroundColor: 'transparent'
            });
          }

          // Fill mode buttons
          document.getElementById('fill-none').addEventListener('click', () => {
            setFillMode('none');
            sendMultiClassChange(selectedElement.source, {
              backgroundImage: 'none',
              backgroundColor: 'transparent'
            });
          });

          document.getElementById('fill-solid').addEventListener('click', () => {
            setFillMode('solid');
            const val = document.getElementById('prop-bg-color').value;
            sendMultiClassChange(selectedElement.source, {
              backgroundImage: 'none',
              backgroundColor: val
            });
          });

          document.getElementById('fill-gradient').addEventListener('click', () => {
            setFillMode('gradient');
            updateGradientFill();
          });

          // Gradient type & angle
          document.getElementById('grad-linear').addEventListener('click', () => {
            gradType = 'linear';
            setActiveBtn(['grad-linear','grad-radial'],'grad-linear');
            updateGradientFill();
          });
          document.getElementById('grad-radial').addEventListener('click', () => {
            gradType = 'radial';
            setActiveBtn(['grad-linear','grad-radial'],'grad-radial');
            updateGradientFill();
          });
          document.getElementById('prop-grad-angle').addEventListener('input', () => {
            updateGradientFill();
          });

          // Gradient Start color
          document.getElementById('prop-grad-start').addEventListener('input', (e) => {
            document.getElementById('prop-grad-start-hex').value = e.target.value;
            document.getElementById('color-swatch-grad-start').style.background = e.target.value;
            updateGradientFill();
          });
          document.getElementById('prop-grad-start-hex').addEventListener('change', (e) => {
            document.getElementById('prop-grad-start').value = e.target.value;
            document.getElementById('color-swatch-grad-start').style.background = e.target.value;
            updateGradientFill();
          });

          // Gradient End color
          document.getElementById('prop-grad-end').addEventListener('input', (e) => {
            document.getElementById('prop-grad-end-hex').value = e.target.value;
            document.getElementById('color-swatch-grad-end').style.background = e.target.value;
            updateGradientFill();
          });
          document.getElementById('prop-grad-end-hex').addEventListener('change', (e) => {
            document.getElementById('prop-grad-end').value = e.target.value;
            document.getElementById('color-swatch-grad-end').style.background = e.target.value;
            updateGradientFill();
          });

          // Solid Background color
          document.getElementById('prop-bg-color').addEventListener('input', (e) => {
            document.getElementById('prop-bg-hex').value = e.target.value;
            document.getElementById('color-swatch-bg').style.background = e.target.value;
            sendEdit({ type: 'class', property: 'backgroundColor', value: e.target.value });
          });
          document.getElementById('prop-bg-hex').addEventListener('change', (e) => {
            document.getElementById('prop-bg-color').value = e.target.value;
            document.getElementById('color-swatch-bg').style.background = e.target.value;
            sendEdit({ type: 'class', property: 'backgroundColor', value: e.target.value });
          });

          // Opacity sync
          document.getElementById('prop-opacity-slider').addEventListener('input', (e) => {
            document.getElementById('prop-opacity').value = e.target.value;
            sendEdit({ type: 'class', property: 'opacity', value: (e.target.value / 100).toString() });
          });
          document.getElementById('prop-opacity').addEventListener('change', (e) => {
            document.getElementById('prop-opacity-slider').value = e.target.value;
            sendEdit({ type: 'class', property: 'opacity', value: (e.target.value / 100).toString() });
          });

          // Flex direction
          document.getElementById('flex-row').addEventListener('click', () => { setActiveBtn(['flex-row','flex-col'],'flex-row'); sendEdit({type:'class',property:'flexDirection',value:'row'}); });
          document.getElementById('flex-col').addEventListener('click', () => { setActiveBtn(['flex-row','flex-col'],'flex-col'); sendEdit({type:'class',property:'flexDirection',value:'column'}); });

          // Justify content
          const jcValues = {'jc-start':'flex-start','jc-center':'center','jc-end':'flex-end','jc-between':'space-between','jc-around':'space-around'};
          Object.entries(jcValues).forEach(([id, val]) => {
            document.getElementById(id).addEventListener('click', () => {
              setActiveBtn(Object.keys(jcValues), id);
              sendEdit({type:'class',property:'justifyContent',value:val});
            });
          });

          // Align items
          const aiValues = {'ai-start':'flex-start','ai-center':'center','ai-end':'flex-end','ai-stretch':'stretch'};
          Object.entries(aiValues).forEach(([id, val]) => {
            document.getElementById(id).addEventListener('click', () => {
              setActiveBtn(Object.keys(aiValues), id);
              sendEdit({type:'class',property:'alignItems',value:val});
            });
          });

          // Text align
          const taValues = {'ta-left':'left','ta-center':'center','ta-right':'right','ta-justify':'justify'};
          Object.entries(taValues).forEach(([id, val]) => {
            document.getElementById(id).addEventListener('click', () => {
              setActiveBtn(Object.keys(taValues), id);
              sendEdit({type:'class',property:'textAlign',value:val});
            });
          });

          // Text decoration
          document.getElementById('td-underline').addEventListener('click', (e) => { e.currentTarget.classList.toggle('active'); });
          document.getElementById('td-italic').addEventListener('click', (e) => { e.currentTarget.classList.toggle('active'); });
          document.getElementById('td-strike').addEventListener('click', (e) => { e.currentTarget.classList.toggle('active'); });

          // Numeric inputs — send on change
          const numericInputMap = {
            'prop-font-size': 'fontSize',
            'prop-line-height': 'lineHeight',
            'prop-letter-spacing': 'letterSpacing',
            'prop-gap': 'gap',
            'prop-row-gap': 'rowGap',
            'prop-w': 'width',
            'prop-h': 'height',
            'prop-border-width': 'borderWidth',
            'prop-br-tl': 'borderTopLeftRadius',
            'prop-br-tr': 'borderTopRightRadius',
            'prop-br-br': 'borderBottomRightRadius',
            'prop-br-bl': 'borderBottomLeftRadius',
          };
          Object.entries(numericInputMap).forEach(([id, prop]) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', (e) => { sendEdit({type:'class',property:prop,value:e.target.value+'px'}); });
          });

          // Font family
          document.getElementById('prop-font-family').addEventListener('change', (e) => { sendEdit({type:'class',property:'fontFamily',value:e.target.value}); });
          document.getElementById('prop-font-weight').addEventListener('change', (e) => { sendEdit({type:'class',property:'fontWeight',value:e.target.value}); });

          // Margin/Padding
          const spacingMap = {
            'prop-mt': 'marginTop', 'prop-mb': 'marginBottom', 'prop-ml': 'marginLeft', 'prop-mr': 'marginRight',
            'prop-pt': 'paddingTop', 'prop-pb': 'paddingBottom', 'prop-pl': 'paddingLeft', 'prop-pr': 'paddingRight',
          };
          Object.entries(spacingMap).forEach(([id, prop]) => {
            document.getElementById(id).addEventListener('change', (e) => { sendEdit({type:'class',property:prop,value:e.target.value+'px'}); });
          });

          // Rotation
          document.getElementById('prop-rotation').addEventListener('change', (e) => { sendEdit({type:'class',property:'transform',value:'rotate('+e.target.value+'deg)'}); });

          // Border style
          document.getElementById('prop-border-style').addEventListener('change', (e) => { sendEdit({type:'class',property:'borderStyle',value:e.target.value}); });
          document.getElementById('prop-border-color').addEventListener('input', (e) => {
            document.getElementById('color-swatch-border').style.background = e.target.value;
            sendEdit({type:'class',property:'borderColor',value:e.target.value});
          });

          // Shadow management
          document.getElementById('add-shadow-btn').addEventListener('click', () => {
            shadowCount++;
            const row = document.createElement('div');
            row.className = 'shadow-row';
            row.dataset.shadowId = shadowCount;
            row.innerHTML =
              '<input type="number" class="props-input" placeholder="X" style="width:36px;" title="X offset">' +
              '<input type="number" class="props-input" placeholder="Y" style="width:36px;" title="Y offset">' +
              '<input type="number" class="props-input" placeholder="Blur" style="width:40px;" title="Blur">' +
              '<input type="number" class="props-input" placeholder="Spread" style="width:40px;" title="Spread">' +
              '<div class="color-swatch" style="width:22px;height:22px;flex-shrink:0;background:#000;"><input type="color" value="#000000"></div>' +
              '<button style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;" title="Delete">✕</button>';
            row.querySelector('button').addEventListener('click', () => row.remove());
            document.getElementById('shadows-list').appendChild(row);
          });

          // Helper: send style change by source
          function sendStyleChange(source, property, value) {
            if (!socket || socket.readyState !== WebSocket.OPEN) return;
            const parsed = parseSource(source);
            if (!parsed) return;
            socket.send(JSON.stringify({
              type: 'edit',
              file: parsed.file,
              line: parsed.line,
              column: parsed.column,
              viewportWidth: iframeWidth.current,
              change: { type: 'class', property, value }
            }));
          }

          function sendStylePropsChange(source, styles) {
            if (!socket || socket.readyState !== WebSocket.OPEN) return;
            const parsed = parseSource(source);
            if (!parsed) return;
            socket.send(JSON.stringify({
              type: 'edit',
              file: parsed.file,
              line: parsed.line,
              column: parsed.column,
              viewportWidth: iframeWidth.current,
              change: { type: 'style', value: styles }
            }));
          }

          function sendMultiClassChange(source, styles) {
            if (!socket || socket.readyState !== WebSocket.OPEN) return;
            const parsed = parseSource(source);
            if (!parsed) return;
            socket.send(JSON.stringify({
              type: 'edit',
              file: parsed.file,
              line: parsed.line,
              column: parsed.column,
              hash: parsed.hash,
              generation: currentGeneration,
              viewportWidth: iframeWidth.current,
              change: { type: 'multi-class', value: styles }
            }));
          }

          function sendPositionChange(source, styles) {
            if (!socket || socket.readyState !== WebSocket.OPEN) return;
            const parsed = parseSource(source);
            if (!parsed) return;
            // Sends 'position' type — server writes to glide-positions.json, NOT App.tsx.
            // The Vite plugin injects CSS overrides via HMR event — zero flicker, zero reload.
            socket.send(JSON.stringify({
              type: 'edit',
              file: parsed.file,
              line: parsed.line,
              column: parsed.column,
              hash: parsed.hash,
              generation: currentGeneration,
              viewportWidth: iframeWidth.current,
              change: { type: 'position', value: styles }
            }));
          }

          function triggerGroup() {
            if (selectedSources.length < 2) {
              alert('Select 2 or more elements to group');
              return;
            }
            if (!socket || socket.readyState !== WebSocket.OPEN) return;
            const parsed = parseSource(selectedSources[0]);
            if (!parsed) return;
            socket.send(JSON.stringify({
              type: 'edit',
              file: parsed.file,
              line: parsed.line,
              column: parsed.column,
              generation: currentGeneration,
              viewportWidth: iframeWidth.current,
              change: {
                type: 'group',
                sources: selectedSources
              }
            }));
          }

          function triggerUngroup() {
            if (!selectedElement || !selectedElement.source) {
              alert('Select a group element to ungroup');
              return;
            }
            if (!socket || socket.readyState !== WebSocket.OPEN) return;
            const parsed = parseSource(selectedElement.source);
            if (!parsed) return;
            socket.send(JSON.stringify({
              type: 'edit',
              file: parsed.file,
              line: parsed.line,
              column: parsed.column,
              generation: currentGeneration,
              viewportWidth: iframeWidth.current,
              change: {
                type: 'ungroup',
                source: selectedElement.source
              }
            }));
          }

          // ═══════════════════════════════════════════════════════════════
          // INIT
          // ═══════════════════════════════════════════════════════════════
          // Load app by URL input
          document.getElementById('btn-load').addEventListener('click', () => {
            const url = document.getElementById('app-url').value.trim();
            if (url) loadApp(url);
          });

          document.getElementById('app-url').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              const url = e.target.value.trim();
              if (url) loadApp(url);
            }
          });

          leftSidebar = document.getElementById('glide-layers');
          rightSidebar = document.getElementById('glide-properties');
          btnLeft = document.getElementById('toggle-left-sidebar');
          btnRight = document.getElementById('toggle-right-sidebar');

          if (btnLeft) btnLeft.addEventListener('click', toggleLeft);
          if (btnRight) btnRight.addEventListener('click', toggleRight);

          const mGroup = document.getElementById('menu-group');
          if (mGroup) mGroup.addEventListener('click', triggerGroup);

          const mUngroup = document.getElementById('menu-ungroup');
          if (mUngroup) mUngroup.addEventListener('click', triggerUngroup);

          // Grid overlay toggle
          const btnToggleGrid = document.getElementById('btn-toggle-grid');
          if (btnToggleGrid) {
            btnToggleGrid.addEventListener('click', () => {
              gridVisible = !gridVisible;
              btnToggleGrid.classList.toggle('active', gridVisible);
              document.getElementById('grid-overlay').style.display = gridVisible ? 'block' : 'none';
            });
          }

          // Guides toggle
          const btnToggleGuides = document.getElementById('btn-toggle-guides');
          if (btnToggleGuides) {
            btnToggleGuides.addEventListener('click', () => {
              guidesVisible = !guidesVisible;
              btnToggleGuides.classList.toggle('active', guidesVisible);
              drawRulers();
              drawOverlay();
            });
          }

          // Branching modal click handlers
          const btnBranching = document.getElementById('btn-branching');
          if (btnBranching) {
            btnBranching.addEventListener('click', () => {
              if (!activeBranch) {
                // Show create branch modal
                document.getElementById('branch-name-input').value = 'glide/visual-edit-' + new Date().toISOString().slice(0, 10) + '-' + Math.floor(Math.random() * 1000);
                document.getElementById('branching-modal').style.display = 'flex';
              } else {
                // Show finalize branch modal
                document.getElementById('active-branch-label').textContent = activeBranch;
                document.getElementById('commit-msg-input').value = 'Visual style updates';
                document.getElementById('finalize-modal').style.display = 'flex';
              }
            });
          }

          document.getElementById('btn-modal-cancel').addEventListener('click', () => {
            document.getElementById('branching-modal').style.display = 'none';
          });

          document.getElementById('btn-modal-confirm').addEventListener('click', () => {
            const branchName = document.getElementById('branch-name-input').value.trim();
            if (branchName) {
              if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'git-branch-create', branchName }));
                showToast('info', 'Creating git branch ' + branchName + '...');
              }
            }
            document.getElementById('branching-modal').style.display = 'none';
          });

          document.getElementById('btn-finalize-cancel').addEventListener('click', () => {
            document.getElementById('finalize-modal').style.display = 'none';
          });

          document.getElementById('btn-finalize-confirm').addEventListener('click', () => {
            const commitMessage = document.getElementById('commit-msg-input').value.trim();
            if (commitMessage) {
              if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'git-branch-finalize', commitMessage }));
                showToast('info', 'Finalizing git branch and committing...');
              }
            }
            document.getElementById('finalize-modal').style.display = 'none';
          });

          // Rulers pointerdown drag to create guide lines
          document.getElementById('glide-ruler-h').addEventListener('pointerdown', (e) => {
            e.preventDefault();
            const container = document.getElementById('canvas-container');
            const iframe = document.getElementById('app-iframe');
            if (iframe) {
              const fh = iframe.clientHeight;
              const ch = container.clientHeight;
              const originY = (ch / 2) - (fh * zoomLevel / 2) + panY;
              const pageY = Math.round((e.clientY - canvasContainerRect.top - originY) / zoomLevel);
              
              guides.push({ axis: 'y', position: pageY });
              draggingGuide = { index: guides.length - 1, axis: 'y' };
              drawOverlay();
            }
          });

          document.getElementById('glide-ruler-v').addEventListener('pointerdown', (e) => {
            e.preventDefault();
            const container = document.getElementById('canvas-container');
            const iframe = document.getElementById('app-iframe');
            if (iframe) {
              const fw = iframe.clientWidth;
              const cw = container.clientWidth;
              const originX = (cw / 2) - (fw * zoomLevel / 2) + panX;
              const pageX = Math.round((e.clientX - canvasContainerRect.left - originX) / zoomLevel);
              
              guides.push({ axis: 'x', position: pageX });
              draggingGuide = { index: guides.length - 1, axis: 'x' };
              drawOverlay();
            }
          });

          function showToast(type, text) {
            const container = document.getElementById('toast-container');
            if (!container) return;
            
            const toast = document.createElement('div');
            toast.className = 'toast ' + type;
            
            let icon = '💡';
            if (type === 'success') icon = '✓';
            if (type === 'error') icon = '❌';
            if (type === 'info') icon = '⚡';

            let undoHTML = '';
            if (type === 'success' && text.includes('updated')) {
              undoHTML = '<span class="toast-undo" onclick="triggerUndo()">Undo</span>';
            }

            toast.innerHTML = '<span>' + icon + '</span><span style="flex:1;">' + text + '</span>' + undoHTML;
            container.appendChild(toast);
            
            setTimeout(() => {
              toast.style.animation = 'slideUp 0.2s ease-in reverse';
              setTimeout(() => toast.remove(), 200);
            }, 3000);
          }

          window.triggerUndo = function() {
            if (socket && socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: 'undo' }));
              showToast('info', 'Undoing last change...');
            }
          };

          document.getElementById('btn-search-layers').addEventListener('click', () => {
            const container = document.getElementById('search-container');
            const input = document.getElementById('layer-search-input');
            if (container.style.display === 'none') {
              container.style.display = 'block';
              input.focus();
            } else {
              container.style.display = 'none';
              input.value = '';
              renderLayersTree(layerTree);
            }
          });

          document.getElementById('layer-search-input').addEventListener('input', () => {
            renderLayersTree(layerTree);
          });

          document.getElementById('layer-search-input').addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
              const container = document.getElementById('search-container');
              const input = document.getElementById('layer-search-input');
              container.style.display = 'none';
              input.value = '';
              renderLayersTree(layerTree);
            }
          });

          connectSocket();
          // Load default url on start
          const defaultUrl = document.getElementById('app-url').value.trim();
          if (defaultUrl) {
            loadApp(defaultUrl);
          }
          applyTransform();

          // Initialize Lucide icons on page load
          if (typeof lucide !== 'undefined') {
            lucide.createIcons();
          }
        </script>
      </body>
    </html>
  `;
}
