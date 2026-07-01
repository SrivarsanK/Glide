export function getEditorHTML(port: number): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Glide — Code-Native Visual Designer</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          :root {
            --bg-base: #090d16;
            --bg-surface: #111827;
            --bg-element: #1f2937;
            --border-color: #374151;
            --text-primary: #f9fafb;
            --text-secondary: #9ca3af;
            --accent-color: #38bdf8;
            --accent-hover: #0ea5e9;
            --danger: #ef4444;
            --success: #22c55e;
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
            width: 30px;
            height: 30px;
            border-radius: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.15s;
            font-size: 14px;
            position: relative;
          }
          .tool-btn:hover { color: var(--text-primary); background: rgba(255,255,255,0.05); }
          .tool-btn.active { color: var(--accent-color); background: rgba(56,189,248,0.15); }
          .tool-btn-sep { width: 1px; height: 20px; background: var(--border-color); margin: 0 2px; }

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
            overflow: hidden;
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
          .layers-scroll { flex: 1; overflow-y: auto; padding: 6px; }
          .layer-item {
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 1px;
            transition: background 0.12s;
            user-select: none;
            position: relative;
          }
          .layer-item:hover { background: var(--bg-element); }
          .layer-item.active {
            background: rgba(56,189,248,0.12);
            color: var(--accent-color);
          }
          .layer-item.locked { opacity: 0.4; }
          .layer-item.component-root { background: rgba(0,120,255,0.07); }
          .layer-icon { font-size: 12px; flex-shrink: 0; opacity: 0.7; }
          .layer-name-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .layer-class { color: #a78bfa; font-size: 10px; font-family: monospace; margin-left: 2px; }
          .layer-text-snippet { color: #fbbf24; font-size: 10px; font-style: italic; margin-left: 2px; }
          .layer-actions { display: none; align-items: center; gap: 4px; margin-left: auto; }
          .layer-item:hover .layer-actions { display: flex; }
          .layer-action-btn {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 2px;
            border-radius: 3px;
            font-size: 11px;
            line-height: 1;
            transition: color 0.15s;
          }
          .layer-action-btn:hover { color: var(--text-primary); }
          .layer-action-btn.hidden-state { color: #ef4444; }
          .layer-tag-badge {
            font-size: 8px;
            padding: 1px 3px;
            border-radius: 3px;
            font-weight: 700;
            text-transform: uppercase;
            flex-shrink: 0;
          }
          .layer-tag-badge.component { background: rgba(167,139,250,0.15); color: #c084fc; }
          .layer-tag-badge.html { background: rgba(156,163,175,0.1); color: #6b7280; }

          /* ── CANVAS ── */
          .canvas-container {
            flex: 1;
            background: #0d1117;
            background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0);
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
        </style>
      </head>
      <body>
        <!-- ═══════════════════════════════════ HEADER ═══════════════════════════════════ -->
        <header>
          <div class="logo">
            ⚡ <span>Glide</span>
          </div>

          <!-- App URL input -->
          <div class="toolbar" style="display: flex; align-items: center; gap: 8px;">
            <div class="toolbar-input-group" style="display: flex; align-items: center; background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 8px; height: 30px;">
              <label for="app-url" style="font-size: 10px; text-transform: uppercase; color: var(--text-secondary); margin-right: 6px; font-weight: 700; letter-spacing: 0.5px;">URL</label>
              <input type="text" id="app-url" value="http://localhost:5173/" style="background: transparent; border: none; color: var(--text-primary); font-family: inherit; font-size: 12px; outline: none; width: 180px;">
            </div>
            <button class="device-btn" id="btn-load" style="height: 30px; padding: 0 10px;">Connect</button>
          </div>

          <!-- Figma-style tool switcher -->
          <div class="figma-toolbar" id="figma-toolbar">
            <button class="tool-btn active" id="tool-select" data-tool="select" title="Select (V)">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M1 1l5.5 12 1.5-5 5-1.5L1 1z"/></svg>
            </button>
            <button class="tool-btn" id="tool-hand" data-tool="hand" title="Hand (H)">✋</button>
            <div class="tool-btn-sep"></div>
            <button class="tool-btn" id="tool-frame" data-tool="frame" title="Frame (F/A)">⬜</button>
            <button class="tool-btn" id="tool-rect" data-tool="rect" title="Rectangle (R)">▬</button>
            <button class="tool-btn" id="tool-ellipse" data-tool="ellipse" title="Ellipse (O)">⬤</button>
            <button class="tool-btn" id="tool-text" data-tool="text" title="Text (T)">T</button>
            <div class="tool-btn-sep"></div>
            <button class="tool-btn" id="tool-comment" data-tool="comment" title="Comment (C)">💬</button>
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

          <!-- Zoom controls -->
          <div class="zoom-control">
            <button class="zoom-btn" id="zoom-out" title="Zoom out">−</button>
            <span id="zoom-label">100%</span>
            <button class="zoom-btn" id="zoom-in" title="Zoom in">+</button>
            <button class="zoom-btn" id="zoom-fit" title="Fit (Ctrl+0)" style="font-size:10px;width:auto;padding:0 4px;">Fit</button>
          </div>
        </header>

        <!-- ═══════════════════════════════════ MAIN LAYOUT ═══════════════════════════════════ -->
        <div class="main-container">

          <!-- LEFT SIDEBAR — LAYERS -->
          <div class="sidebar" id="glide-layers">
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

          <!-- CANVAS -->
          <div class="canvas-container" id="canvas-container">
            <div class="canvas-viewport" id="canvas-viewport">
              <div class="preview-frame-wrapper" id="frame-wrapper">
                <div class="canvas-loading" id="canvas-loading">
                  <div class="spinner"></div>
                  <span id="load-status" style="font-size:13px;color:var(--text-secondary)">Loading app…</span>
                </div>
                <iframe id="app-iframe" src="http://localhost:${port}" title="App Preview"></iframe>
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
          </div>

          <!-- RIGHT SIDEBAR — PROPERTIES -->
          <div class="sidebar sidebar-right" id="glide-properties">
            <div class="sidebar-header">
              <span>Properties</span>
              <span id="selected-tag" style="font-size:10px;color:var(--accent-color);font-weight:400;font-family:monospace"></span>
            </div>

            <div id="no-selection-msg" class="no-selection">
              <div class="no-selection-icon">🎯</div>
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
                    <button class="icon-btn" id="flex-row" title="Row">⇒ Row</button>
                    <button class="icon-btn" id="flex-col" title="Column">⇓ Col</button>
                  </div>
                </div>
                <div class="props-row">
                  <span class="props-label" style="min-width:60px;">Justify</span>
                  <div class="icon-btn-group" style="flex:1;">
                    <button class="icon-btn" id="jc-start" title="flex-start">⟤</button>
                    <button class="icon-btn" id="jc-center" title="center">⊡</button>
                    <button class="icon-btn" id="jc-end" title="flex-end">⟥</button>
                    <button class="icon-btn" id="jc-between" title="space-between">⟺</button>
                    <button class="icon-btn" id="jc-around" title="space-around">⟛</button>
                  </div>
                </div>
                <div class="props-row">
                  <span class="props-label" style="min-width:60px;">Align</span>
                  <div class="icon-btn-group" style="flex:1;">
                    <button class="icon-btn" id="ai-start" title="flex-start">⤒</button>
                    <button class="icon-btn" id="ai-center" title="center">⊞</button>
                    <button class="icon-btn" id="ai-end" title="flex-end">⤓</button>
                    <button class="icon-btn" id="ai-stretch" title="stretch">⤡</button>
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
                    <button class="icon-btn" id="ta-left" title="Left">⬅</button>
                    <button class="icon-btn" id="ta-center" title="Center">↔</button>
                    <button class="icon-btn" id="ta-right" title="Right">➡</button>
                    <button class="icon-btn" id="ta-justify" title="Justify">☰</button>
                  </div>
                </div>
                <div class="props-row" style="margin-bottom:6px;">
                  <span class="props-label" style="min-width:40px;">Style</span>
                  <div class="icon-btn-group" style="flex:1;">
                    <button class="icon-btn" id="td-underline" title="Underline" style="text-decoration:underline;">U</button>
                    <button class="icon-btn" id="td-italic" title="Italic" style="font-style:italic;">I</button>
                    <button class="icon-btn" id="td-strike" title="Strikethrough" style="text-decoration:line-through;">S</button>
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
                  <div class="props-row">
                    <span class="props-label" style="min-width:50px;">Type</span>
                    <div class="icon-btn-group" style="flex:1;">
                      <button class="icon-btn active" id="grad-linear">Linear</button>
                      <button class="icon-btn" id="grad-radial">Radial</button>
                    </div>
                  </div>
                  <div class="props-field">
                    <span class="props-label">Angle (°)</span>
                    <input class="props-input" id="prop-grad-angle" type="number" value="90">
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
          let hoveredElement = null;
          let hoveredRect = null;
          let currentTool = 'select';
          let zoomLevel = 1.0;
          let panX = 0, panY = 0;
          let isPanning = false, panStart = {x:0,y:0};
          let lockedIds = new Set();
          let hiddenIds = new Set();
          let shadowCount = 0;

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
                  renderLayersTree(message.tree);
                } else if (message.type === 'status') {
                  if (message.success) {
                    if (currentFile && socket && socket.readyState === WebSocket.OPEN) {
                      socket.send(JSON.stringify({ type: 'get-tree', file: currentFile }));
                    }
                  } else {
                    console.error('[Glide] Server error:', message.error);
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
              viewportWidth: iframeWidth.current,
              change
            }));
          }

          // ═══════════════════════════════════════════════════════════════
          // SOURCE HELPERS
          // ═══════════════════════════════════════════════════════════════
          function parseSource(source) {
            if (!source) return null;
            const match = source.match(/^(.*):(\\d+):(\\d+)$/);
            if (!match) return null;
            return { file: match[1], line: parseInt(match[2], 10), column: parseInt(match[3], 10) };
          }

          function convertNodeIdToSource(nodeId, file) {
            const match = nodeId.match(/^line:(\\d+):col:(\\d+)$/);
            if (match) {
              const line = parseInt(match[1], 10);
              const col = parseInt(match[2], 10) + 1;
              return file + ':' + line + ':' + col;
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
              hoveredElement = null;
              hoveredRect = null;
              clearOverlay();
              showNoSelection();
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

          document.addEventListener('mousemove', (e) => {
            if (isPanning) {
              panX = e.clientX - panStart.x;
              panY = e.clientY - panStart.y;
              applyTransform();
            }
            // Update cursor coords in status bar
            const rect = canvasContainer.getBoundingClientRect();
            const cx = Math.round((e.clientX - rect.left - panX) / zoomLevel);
            const cy = Math.round((e.clientY - rect.top - panY) / zoomLevel);
            document.getElementById('cursor-pos').textContent = cx + ', ' + cy + ' px';
          });

          document.addEventListener('mouseup', () => {
            if (isPanning) {
              isPanning = false;
              canvasContainer.style.cursor = currentTool === 'hand' ? 'grab' : 'default';
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

          // ═══════════════════════════════════════════════════════════════
          // OVERLAY SVG — selection + hover
          // ═══════════════════════════════════════════════════════════════
          const svg = document.getElementById('overlay-svg');

          function clearOverlay() {
            while (svg.childNodes.length > 1) svg.removeChild(svg.lastChild);
          }

          function drawSelectionBox(rect, isHover) {
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
            svg.appendChild(r);

            if (!isHover) {
              // Draw 8 resize handles
              const handles = [
                [rect.x, rect.y], [rect.x + rect.width/2, rect.y], [rect.x + rect.width, rect.y],
                [rect.x + rect.width, rect.y + rect.height/2],
                [rect.x + rect.width, rect.y + rect.height], [rect.x + rect.width/2, rect.y + rect.height],
                [rect.x, rect.y + rect.height], [rect.x, rect.y + rect.height/2]
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
                svg.appendChild(h);
              });
            }
          }

          function drawOverlay() {
            clearOverlay();
            if (selectedRect) {
              drawSelectionBox(selectedRect, false);
            }
            if (hoveredRect && (!selectedElement || hoveredElement.source !== selectedElement.source)) {
              drawSelectionBox(hoveredRect, true);
            }
          }

          // ═══════════════════════════════════════════════════════════════
          // BRIDGE COMMUNICATION (postMessage from iframe)
          // ═══════════════════════════════════════════════════════════════
          window.addEventListener('message', (event) => {
            const data = event.data;
            if (!data || !data.type) return;

            if (data.type === 'glide:element-selected' || data.type === 'glide:element-hovered') {
              updateLayersPanel(data);
            }
            if (data.type === 'glide:overlay') {
              if (data.isHover) {
                hoveredElement = { source: data.source };
                hoveredRect = data.rect;
              } else {
                selectedElement = { source: data.source };
                selectedRect = data.rect;
                selectedComputedStyles = data.computedStyles;
                populatePropsFromComputed(data.computedStyles || {}, data.rect || {});
              }
              drawOverlay();
            }
            if (data.type === 'glide:element-hover-exit') {
              hoveredElement = null;
              hoveredRect = null;
              drawOverlay();
            }
            if (data.type === 'glide:element-dragging') {
              if (selectedRect) {
                const shiftedRect = {
                  x: selectedRect.x + data.dx,
                  y: selectedRect.y + data.dy,
                  width: selectedRect.width,
                  height: selectedRect.height
                };
                clearOverlay();
                drawSelectionBox(shiftedRect, false);
              }
            }
            if (data.type === 'glide:element-drag-end') {
              // Write final offset back to source file
              sendStyleChange(data.source, 'marginLeft', data.marginLeft + 'px');
              sendStyleChange(data.source, 'marginTop', data.marginTop + 'px');
              // Clear current stored rect so HMR redraws fresh bounds
              selectedRect = null;
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
          function getLayerIcon(name) {
            const n = name.toLowerCase();
            if (n === 'svg') return '◈';
            if (n === 'img') return '🖼';
            if (n === 'button' || n === 'a') return '⬡';
            if (['p','span','h1','h2','h3','h4','h5','h6','label','em','strong','small'].includes(n)) return '𝐓';
            if (['input','textarea','select'].includes(n)) return '⬜';
            if (['ul','ol','li'].includes(n)) return '≡';
            // Component (uppercase)
            if (name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase()) return '⬡';
            return '▣'; // div/section/article/main/etc
          }

          let layerTree = null;

          function renderLayersTree(tree) {
            layerTree = tree;
            const list = document.getElementById('layers-list');
            list.innerHTML = '';

            let totalCount = 0;
            function renderNode(node, depth) {
              totalCount++;
              if (lockedIds.has(node.id)) return; // skip locked hidden children

              const item = document.createElement('div');
              item.className = 'layer-item';
              item.dataset.nodeId = node.id;

              const nodeSource = convertNodeIdToSource(node.id, currentFile);
              item.dataset.source = nodeSource;

              // Component root highlight
              const isComponent = node.name.length > 0 && node.name[0].toUpperCase() === node.name[0] && node.name[0] !== node.name[0].toLowerCase();
              if (isComponent) item.classList.add('component-root');

              // Active state
              if (selectedElement && selectedElement.source === nodeSource) {
                item.classList.add('active');
              }

              // Hidden state
              if (hiddenIds.has(node.id)) {
                item.style.opacity = '0.35';
              }

              item.style.paddingLeft = (10 + depth * 14) + 'px';

              const icon = getLayerIcon(node.name);
              const badge = isComponent
                ? '<span class="layer-tag-badge component">Comp</span>'
                : '<span class="layer-tag-badge html">' + node.name + '</span>';

              let extras = '';
              if (node.className) {
                const cls = node.className.split(' ').filter(Boolean).slice(0,2).map(c => '.' + c).join('');
                extras += '<span class="layer-class">' + cls + '</span>';
              }
              if (node.text) {
                extras += '<span class="layer-text-snippet">"' + node.text + '"</span>';
              }

              const eyeIcon = hiddenIds.has(node.id) ? '🚫' : '👁';
              const lockIcon = lockedIds.has(node.id) ? '🔒' : '🔓';

              item.innerHTML =
                '<span class="layer-icon">' + icon + '</span>' +
                badge +
                '<span class="layer-name-text">' + node.name + extras + '</span>' +
                '<div class="layer-actions">' +
                  '<button class="layer-action-btn eye-btn" data-node-id="' + node.id + '" title="Toggle visibility">' + eyeIcon + '</button>' +
                  '<button class="layer-action-btn lock-btn" data-node-id="' + node.id + '" title="Toggle lock">' + lockIcon + '</button>' +
                '</div>';

              // Click → select
              item.addEventListener('click', (e) => {
                if (e.target.closest('.layer-actions')) return;
                if (lockedIds.has(node.id)) return;
                const iframe = document.getElementById('app-iframe');
                if (iframe && iframe.contentWindow) {
                  iframe.contentWindow.postMessage({
                    type: 'glide:select-element-by-id',
                    id: nodeSource
                  }, '*');
                }
                selectedElement = { source: nodeSource };
                document.querySelectorAll('.layer-item').forEach(li => li.classList.remove('active'));
                item.classList.add('active');
                document.getElementById('selected-tag').textContent = '<' + node.name + '>';
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

              // Lock button
              item.querySelector('.lock-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const nid = e.currentTarget.dataset.nodeId;
                if (lockedIds.has(nid)) {
                  lockedIds.delete(nid);
                } else {
                  lockedIds.add(nid);
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
                const position = (e.clientY - rect.top) < rect.height / 2 ? 'before' : 'after';
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
                if (e.target.closest('.layer-actions')) return;
                const nameSpan = item.querySelector('.layer-name-text');
                const original = node.name + (node.text ? ': ' + node.text : '');
                const inp = document.createElement('input');
                inp.value = node.text || node.name;
                inp.style.cssText = 'background:var(--bg-base);border:1px solid var(--accent-color);color:var(--text-primary);padding:2px 4px;border-radius:3px;font-size:12px;font-family:inherit;outline:none;width:100%;';
                nameSpan.innerHTML = '';
                nameSpan.appendChild(inp);
                inp.focus();
                inp.select();

                let fontStr = '16px sans-serif';
                if (selectedComputedStyles) {
                  fontStr = (selectedComputedStyles.fontWeight || '400') + ' ' + 
                            (selectedComputedStyles.fontSize || '16px') + ' ' + 
                            (selectedComputedStyles.fontFamily || 'sans-serif');
                }

                inp.addEventListener('input', () => {
                  const text = inp.value;
                  const containerWidth = selectedRect ? selectedRect.width : 200;
                  const containerHeight = selectedRect ? selectedRect.height : 40;
                  
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  ctx.font = fontStr;
                  const textWidth = ctx.measureText(text).width;
                  
                  if (textWidth > containerWidth || (textWidth / containerWidth * 20) > containerHeight) {
                    inp.style.border = '1px solid var(--danger)';
                    inp.style.boxShadow = '0 0 4px rgba(239, 68, 68, 0.5)';
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
                        line: parseInt((nodeSource.match(/:(\\d+):(\\d+)$/) || [])[1] || '0', 10),
                        column: parseInt((nodeSource.match(/:(\\d+)$/) || [])[0].slice(1) || '0', 10),
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

              if (node.children && node.children.length > 0) {
                node.children.forEach(child => renderNode(child, depth + 1));
              }
            }

            if (tree && tree.length > 0) {
              tree.forEach(node => renderNode(node, 0));
              document.getElementById('layer-count').textContent = totalCount + ' nodes';
            } else {
              list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-secondary);font-size:12px;">No JSX elements found</div>';
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

            // Fill
            const bg = styles.backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
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

          // Fill mode buttons
          ['fill-none','fill-solid','fill-gradient'].forEach(id => {
            document.getElementById(id).addEventListener('click', () => setFillMode(id.replace('fill-','')) );
          });

          // Gradient type
          document.getElementById('grad-linear').addEventListener('click', () => setActiveBtn(['grad-linear','grad-radial'],'grad-linear'));
          document.getElementById('grad-radial').addEventListener('click', () => setActiveBtn(['grad-linear','grad-radial'],'grad-radial'));

          // Color swatches sync
          document.getElementById('prop-color').addEventListener('input', (e) => {
            document.getElementById('prop-color-hex').value = e.target.value;
            document.getElementById('color-swatch-text').style.background = e.target.value;
            sendEdit({ type: 'class', property: 'color', value: e.target.value });
          });
          document.getElementById('prop-color-hex').addEventListener('change', (e) => {
            document.getElementById('prop-color').value = e.target.value;
            document.getElementById('color-swatch-text').style.background = e.target.value;
            sendEdit({ type: 'class', property: 'color', value: e.target.value });
          });

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

          connectSocket();
          // Load default url on start
          const defaultUrl = document.getElementById('app-url').value.trim();
          if (defaultUrl) {
            loadApp(defaultUrl);
          }
          applyTransform();
        </script>
      </body>
    </html>
  `;
}
