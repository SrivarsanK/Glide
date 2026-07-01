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
          header {
            height: 56px;
            background: var(--bg-surface);
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 20px;
            z-index: 10;
          }
          .logo {
            font-weight: 700;
            font-size: 18px;
            color: var(--accent-color);
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .logo span {
            color: var(--text-primary);
          }
          .toolbar {
            display: flex;
            align-items: center;
            gap: 16px;
          }
          .toolbar-input-group {
            display: flex;
            align-items: center;
            background: var(--bg-element);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 4px 8px;
          }
          .toolbar-input-group label {
            font-size: 11px;
            text-transform: uppercase;
            color: var(--text-secondary);
            margin-right: 8px;
            font-weight: 600;
          }
          .toolbar-input-group input {
            background: transparent;
            border: none;
            color: var(--text-primary);
            font-family: inherit;
            font-size: 13px;
            outline: none;
            width: 140px;
          }
          .btn {
            background: var(--accent-color);
            color: var(--bg-base);
            border: none;
            padding: 6px 12px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            transition: background 0.2s;
          }
          .btn:hover {
            background: var(--accent-hover);
          }
          
          /* Figma-style Toolbar styles */
          .figma-toolbar {
            display: flex;
            align-items: center;
            background: var(--bg-element);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 2px;
            gap: 2px;
          }
          .tool-btn {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            width: 32px;
            height: 32px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
            position: relative;
          }
          .tool-btn:hover {
            color: var(--text-primary);
            background: rgba(255, 255, 255, 0.05);
          }
          .tool-btn.active {
            color: var(--accent-color);
            background: rgba(56, 189, 248, 0.15);
          }
          
          /* Comment Pin styles */
          .comment-pin {
            position: absolute;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: default;
          }
          .pin-dot {
            width: 24px;
            height: 24px;
            background: var(--accent-color);
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #000;
            font-size: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            border: 2px solid var(--text-primary);
          }
          .pin-dot span {
            transform: rotate(45deg);
            display: inline-block;
          }
          .pin-popover {
            position: absolute;
            top: 30px;
            left: 12px;
            background: var(--bg-surface);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 8px;
            width: 200px;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            gap: 6px;
            z-index: 1001;
          }
          .pin-popover textarea {
            background: var(--bg-base);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            color: var(--text-primary);
            padding: 6px;
            font-size: 12px;
            resize: none;
            outline: none;
            font-family: inherit;
          }
          .pin-btn {
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
          }
          .pin-cancel {
            background: transparent;
            color: var(--text-secondary);
          }
          .pin-submit {
            background: var(--accent-color);
            color: var(--bg-base);
          }
          .main-container {
            display: flex;
            flex: 1;
            height: calc(100vh - 56px);
            overflow: hidden;
          }
          .sidebar {
            width: 280px;
            background: var(--bg-surface);
            border-right: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            overflow-y: auto;
          }
          .sidebar-right {
            border-right: none;
            border-left: 1px solid var(--border-color);
          }
          .sidebar-header {
            padding: 14px 20px;
            font-size: 12px;
            text-transform: uppercase;
            color: var(--text-secondary);
            font-weight: 600;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .layers-list {
            padding: 10px;
          }
          .layer-item {
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 2px;
            transition: background 0.15s, opacity 0.15s, border 0.1s;
            user-select: none;
          }
          .layer-item:hover {
            background: var(--bg-element);
          }
          .layer-item.active {
            background: rgba(56, 189, 248, 0.15);
            color: var(--accent-color);
            border-left: 2px solid var(--accent-color);
          }
          .layer-item.dragging {
            opacity: 0.4;
            background: rgba(255, 255, 255, 0.05);
          }
          .layer-name {
            display: flex;
            align-items: center;
            gap: 6px;
            width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .layer-tag-badge {
            font-size: 9px;
            padding: 2px 4px;
            border-radius: 4px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .layer-tag-badge.component {
            background: rgba(167, 139, 250, 0.15);
            color: #c084fc;
          }
          .layer-tag-badge.html {
            background: rgba(156, 163, 175, 0.12);
            color: #9ca3af;
          }
          .layer-info-name {
            font-weight: 500;
            color: var(--text-primary);
          }
          .layer-info-class {
            color: #a78bfa;
            font-size: 11px;
            font-family: monospace;
            opacity: 0.85;
          }
          .layer-info-text {
            color: #fbbf24;
            font-size: 11px;
            font-style: italic;
            opacity: 0.85;
          }
          .canvas-container {
            flex: 1;
            background: var(--bg-base);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px;
            position: relative;
            overflow: auto;
          }
          .preview-frame-wrapper {
            background: transparent;
            border-radius: 8px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
            border: 1px solid var(--border-color);
            position: relative;
            overflow: hidden;
            transition: width 0.3s, height 0.3s;
          }
          iframe {
            width: 100%;
            height: 100%;
            border: none;
            border-radius: 8px;
            background: transparent;
            display: block;
          }
          .properties-group {
            padding: 20px;
            border-bottom: 1px solid var(--border-color);
          }
          .properties-title {
            font-size: 11px;
            text-transform: uppercase;
            color: var(--text-secondary);
            font-weight: 600;
            margin-bottom: 14px;
          }
          .prop-row {
            display: flex;
            gap: 12px;
            margin-bottom: 12px;
          }
          .prop-field {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .prop-field label {
            font-size: 11px;
            color: var(--text-secondary);
          }
          .prop-field input, .prop-field select {
            background: var(--bg-element);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 6px 8px;
            color: var(--text-primary);
            font-family: inherit;
            font-size: 13px;
            outline: none;
          }
          .status-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: var(--text-secondary);
          }
          .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #ef4444;
          }
          .status-dot.connected {
            background: #10b981;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <header>
          <div class="logo" style="width:200px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Glide <span>Canvas</span>
          </div>

          <!-- Figma Tools in the Center -->
          <div class="figma-toolbar">
            <button class="tool-btn active" id="tool-move" title="Move Tool (V)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="3 3 10.07 19.97 12.58 12.58 19.97 10.07 3 3"/>
                <line x1="13" y1="13" x2="19" y2="19"/>
              </svg>
            </button>
            <button class="tool-btn" id="tool-frame" title="Frame Tool (F)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="3" y1="15" x2="21" y2="15"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
                <line x1="15" y1="3" x2="15" y2="21"/>
              </svg>
            </button>
            <button class="tool-btn" id="tool-rectangle" title="Rectangle Tool (R)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              </svg>
            </button>
            <button class="tool-btn" id="tool-ellipse" title="Ellipse Tool (O)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
              </svg>
            </button>
            <button class="tool-btn" id="tool-text" title="Text Tool (T)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4 7 4 4 20 4 20 7"/>
                <line x1="9" y1="20" x2="15" y2="20"/>
                <line x1="12" y1="4" x2="12" y2="20"/>
              </svg>
            </button>
            <button class="tool-btn" id="tool-hand" title="Hand Tool (H)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5"/>
                <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6"/>
                <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8.5"/>
                <path d="M6 14v-1.5a1.5 1.5 0 0 0-3 0V18a6 6 0 0 0 6 6h4a8 8 0 0 0 8-8v-3a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2"/>
              </svg>
            </button>
            <button class="tool-btn" id="tool-comment" title="Comment Tool (C)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
          </div>

          <div class="toolbar">
            <div class="toolbar-input-group">
              <label for="app-url">App Url</label>
              <input type="text" id="app-url" value="http://localhost:5173/">
            </div>
            <button class="btn" id="btn-load">Connect App</button>
            <div class="status-badge" style="display:flex;align-items:center;gap:8px;margin-left:8px;">
              <div class="status-dot" id="status-dot"></div>
              <span id="status-text" style="font-size:12px;color:var(--text-secondary)">Disconnected</span>
            </div>
          </div>
        </header>

        <div class="main-container">
          <!-- Left Panel -->
          <div class="sidebar">
            <div class="sidebar-header">
              <span>Layers</span>
            </div>
            <div class="layers-list" id="layers-list">
              <div style="color: var(--text-secondary); font-size: 13px; padding: 10px;">Select an element in the canvas to view hierarchy</div>
            </div>
          </div>

          <!-- Center Canvas -->
          <div class="canvas-container">
            <div class="preview-frame-wrapper" id="preview-wrapper" style="width: 1024px; height: 768px;">
              <div id="canvas-loading" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg-surface);z-index:10;border-radius:8px;gap:12px;">
                <div style="width:32px;height:32px;border:3px solid var(--border-color);border-top-color:var(--accent-color);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
                <span id="load-status" style="font-size:13px;color:var(--text-secondary);">Loading app...</span>
              </div>
              <iframe id="app-iframe" src="about:blank"></iframe>
            </div>
          </div>

          <!-- Right Panel -->
          <div class="sidebar sidebar-right">
            <div class="sidebar-header">
              <span>Properties</span>
            </div>

            <div class="properties-group" id="element-info" style="display:none">
              <div class="properties-title">Element</div>
              <div style="margin-bottom:8px;">
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:2px">Tag</div>
                <div id="info-tag" style="font-size:13px;color:var(--accent-color);font-weight:600;"></div>
              </div>
              <div style="margin-bottom:8px;">
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:2px">Source</div>
                <div id="info-source" style="font-size:11px;color:var(--text-secondary);word-break:break-all;font-family:monospace;"></div>
              </div>
              <div>
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:2px">Classes</div>
                <div id="info-classes" style="font-size:11px;color:#a78bfa;word-break:break-all;font-family:monospace;"></div>
              </div>
            </div>

            <div class="properties-group">
              <div class="properties-title">Spacing (Margin & Padding)</div>
              <div class="prop-row">
                <div class="prop-field">
                  <label>Margin Left</label>
                  <input type="text" id="prop-ml" placeholder="auto">
                </div>
                <div class="prop-field">
                  <label>Margin Right</label>
                  <input type="text" id="prop-mr" placeholder="auto">
                </div>
              </div>
              <div class="prop-row">
                <div class="prop-field">
                  <label>Padding Left</label>
                  <input type="text" id="prop-pl" placeholder="0">
                </div>
                <div class="prop-field">
                  <label>Padding Right</label>
                  <input type="text" id="prop-pr" placeholder="0">
                </div>
              </div>
            </div>

            <div class="properties-group">
              <div class="properties-title">Sizing</div>
              <div class="prop-row">
                <div class="prop-field">
                  <label>Width</label>
                  <input type="text" id="prop-width" placeholder="auto">
                </div>
                <div class="prop-field">
                  <label>Height</label>
                  <input type="text" id="prop-height" placeholder="auto">
                </div>
              </div>
            </div>
          </div>
        </div>

        <script>
          let socket = null;
          let selectedElement = null;
          let currentFile = '';

          function connectWebSocket() {
            socket = new WebSocket('ws://localhost:${port}');
            const dot = document.getElementById('status-dot');
            const text = document.getElementById('status-text');

            socket.addEventListener('open', () => {
              dot.className = 'status-dot connected';
              text.textContent = 'Connected';
            });

            socket.addEventListener('close', () => {
              dot.className = 'status-dot';
              text.textContent = 'Disconnected';
              setTimeout(connectWebSocket, 2000);
            });

            socket.addEventListener('message', (event) => {
              try {
                const message = JSON.parse(event.data);
                if (message.type === 'tree') {
                  currentFile = message.file;
                  renderLayersTree(message.tree);
                }
              } catch {}
            });
          }

          function loadApp(url) {
            const iframe = document.getElementById('app-iframe');
            const loading = document.getElementById('canvas-loading');
            const statusEl = document.getElementById('load-status');

            // Show loading overlay
            if (loading) loading.style.display = 'flex';
            if (statusEl) statusEl.textContent = 'Loading ' + url + '...';

            iframe.onload = () => {
              // Hide overlay once the page is in — give a tiny delay for paint
              setTimeout(() => {
                if (loading) loading.style.display = 'none';
              }, 300);
            };
            iframe.onerror = () => {
              if (statusEl) statusEl.textContent = '❌ Failed to load. Is the app running at ' + url + '?';
            };

            iframe.src = url;
            document.getElementById('app-url').value = url;
          }

          // Load Iframe — button click
          document.getElementById('btn-load').addEventListener('click', () => {
            const url = document.getElementById('app-url').value.trim();
            if (url) loadApp(url);
          });

          // Also trigger on Enter key in the URL input
          document.getElementById('app-url').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              const url = e.target.value.trim();
              if (url) loadApp(url);
            }
          });

          // Auto-load the default app URL when page opens
          window.addEventListener('DOMContentLoaded', () => {
            const defaultUrl = document.getElementById('app-url').value.trim();
            if (defaultUrl && defaultUrl !== 'about:blank') {
              loadApp(defaultUrl);
            }
          });

          function parseSource(source) {
            if (!source) return null;
            const match = source.match(/^(.*):(\\d+):(\\d+)$/);
            if (!match) return null;
            return {
              file: match[1],
              line: parseInt(match[2], 10),
              column: parseInt(match[3], 10)
            };
          }

          // Figma Tools State Management
          let activeTool = 'move';
          const tools = {
            move: document.getElementById('tool-move'),
            frame: document.getElementById('tool-frame'),
            rectangle: document.getElementById('tool-rectangle'),
            ellipse: document.getElementById('tool-ellipse'),
            text: document.getElementById('tool-text'),
            hand: document.getElementById('tool-hand'),
            comment: document.getElementById('tool-comment')
          };

          function setTool(toolName) {
            activeTool = toolName;
            Object.keys(tools).forEach(name => {
              if (tools[name]) {
                if (name === toolName) {
                  tools[name].classList.add('active');
                } else {
                  tools[name].classList.remove('active');
                }
              }
            });

            // Set cursor style for iframe & canvas-container
            const iframe = document.getElementById('app-iframe');
            const container = document.querySelector('.canvas-container');
            
            const cursorMap = {
              move: 'default',
              hand: 'grab',
              text: 'text',
              rectangle: 'crosshair',
              ellipse: 'crosshair',
              frame: 'crosshair',
              comment: 'cell'
            };
            
            const cursor = cursorMap[toolName] || 'default';
            if (iframe) iframe.style.cursor = cursor;
            if (container) container.style.cursor = cursor;
          }

          // Toolbar click events
          Object.keys(tools).forEach(name => {
            if (tools[name]) {
              tools[name].addEventListener('click', () => setTool(name));
            }
          });

          // Figma Keyboard Shortcuts
          window.addEventListener('keydown', (e) => {
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
            const key = e.key.toLowerCase();
            if (key === 'v') setTool('move');
            else if (key === 'f' || key === 'a') setTool('frame');
            else if (key === 'r') setTool('rectangle');
            else if (key === 'o') setTool('ellipse');
            else if (key === 't') setTool('text');
            else if (key === 'h') setTool('hand');
            else if (key === 'c') setTool('comment');
          });

          // Hand tool canvas panning
          const canvasContainer = document.querySelector('.canvas-container');
          let isPanning = false;
          let startX, startY, scrollLeft, scrollTop;

          canvasContainer.addEventListener('mousedown', (e) => {
            if (activeTool !== 'hand') return;
            isPanning = true;
            canvasContainer.style.cursor = 'grabbing';
            startX = e.pageX - canvasContainer.offsetLeft;
            startY = e.pageY - canvasContainer.offsetTop;
            scrollLeft = canvasContainer.scrollLeft;
            scrollTop = canvasContainer.scrollTop;
          });

          canvasContainer.addEventListener('mouseleave', () => {
            isPanning = false;
            if (activeTool === 'hand') canvasContainer.style.cursor = 'grab';
          });

          canvasContainer.addEventListener('mouseup', () => {
            isPanning = false;
            if (activeTool === 'hand') canvasContainer.style.cursor = 'grab';
          });

          canvasContainer.addEventListener('mousemove', (e) => {
            if (!isPanning || activeTool !== 'hand') return;
            e.preventDefault();
            const x = e.pageX - canvasContainer.offsetLeft;
            const y = e.pageY - canvasContainer.offsetTop;
            const walkX = (x - startX) * 1.5;
            const walkY = (y - startY) * 1.5;
            canvasContainer.scrollLeft = scrollLeft - walkX;
            canvasContainer.scrollTop = scrollTop - walkY;
          });

          // Comment tool pinning on canvas
          canvasContainer.addEventListener('click', (e) => {
            if (activeTool !== 'comment') return;
            
            // Drop a pin at click location relative to canvas-container
            const rect = canvasContainer.getBoundingClientRect();
            const x = e.clientX - rect.left + canvasContainer.scrollLeft;
            const y = e.clientY - rect.top + canvasContainer.scrollTop;

            const pin = document.createElement('div');
            pin.className = 'comment-pin';
            pin.style.left = (x - 12) + 'px';
            pin.style.top = (y - 12) + 'px';
            
            pin.innerHTML = 
              '<div class="pin-dot"><span>💬</span></div>' +
              '<div class="pin-popover">' +
              '  <textarea placeholder="Write a comment..." rows="2"></textarea>' +
              '  <div style="display:flex;justify-content:flex-end;gap:4px;margin-top:4px;">' +
              '    <button class="pin-btn pin-cancel">Cancel</button>' +
              '    <button class="pin-btn pin-submit">Post</button>' +
              '  </div>' +
              '</div>';

            canvasContainer.appendChild(pin);

            const textarea = pin.querySelector('textarea');
            textarea.focus();

            pin.querySelector('.pin-cancel').addEventListener('click', (ev) => {
              ev.stopPropagation();
              pin.remove();
            });

            pin.querySelector('.pin-submit').addEventListener('click', (ev) => {
              ev.stopPropagation();
              const text = textarea.value.trim();
              if (text) {
                pin.querySelector('.pin-popover').innerHTML = 
                  '<div style="font-weight:600;font-size:12px;color:var(--accent-color)">You</div>' +
                  '<div style="font-size:12px;margin-top:2px;color:var(--text-primary)">' + text + '</div>';
              } else {
                pin.remove();
              }
            });
            
            pin.addEventListener('click', (ev) => ev.stopPropagation());
          });

          function convertNodeIdToSource(nodeId, file) {
            if (!nodeId) return '';
            if (nodeId.startsWith('line:')) {
              const match = nodeId.match(/^line:(\d+):col:(\d+)$/);
              if (match) {
                const line = match[1];
                const col = parseInt(match[2], 10) + 1; // Convert 0-indexed column to 1-indexed
                return file + ':' + line + ':' + col;
              }
            }
            return nodeId;
          }

          function highlightActiveLayerItem(source) {
            const items = document.querySelectorAll('.layer-item');
            items.forEach(item => {
              if (item.dataset.source === source) {
                item.classList.add('active');
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              } else {
                item.classList.remove('active');
              }
            });
          }

          // Handle message communication from GlideBridge running inside iframe
          window.addEventListener('message', (event) => {
            const data = event.data;
            if (!data || typeof data !== 'object') return;

            if (data.type === 'glide:element-selected') {
              if (activeTool !== 'move') {
                // If a creation tool is active, insert the element into the clicked element as a parent!
                const parsed = parseSource(data.source);
                if (parsed && socket && socket.readyState === WebSocket.OPEN) {
                  socket.send(JSON.stringify({
                    type: 'insert',
                    file: parsed.file,
                    parentId: data.source,
                    elementType: activeTool
                  }));
                  setTool('move'); // Reset to selection mode
                }
                return;
              }
              
              selectedElement = data;
              updatePropertiesPanel(data);
              updateLayersPanel(data);
              highlightActiveLayerItem(data.source);
            }

            if (data.type === 'glide:element-resized') {
              const { source, rect, delta } = data;
              const parsed = parseSource(source);
              if (parsed && socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                  type: 'edit',
                  file: parsed.file,
                  line: parsed.line,
                  column: parsed.column,
                  change: {
                    type: 'class',
                    property: 'width',
                    value: rect.width
                  }
                }));
              }
            }
          });

          function updatePropertiesPanel(data) {
            const { source, tagName, classNames, rect } = data;

            // Show element info panel
            const infoPanel = document.getElementById('element-info');
            if (infoPanel) infoPanel.style.display = 'block';

            const tagEl = document.getElementById('info-tag');
            if (tagEl) tagEl.textContent = '<' + (tagName || '?') + '>';

            const srcEl = document.getElementById('info-source');
            if (srcEl) srcEl.textContent = source;

            const clsEl = document.getElementById('info-classes');
            if (clsEl) clsEl.textContent = classNames || '(none)';

            document.getElementById('prop-width').value = Math.round(rect.width) + 'px';
            document.getElementById('prop-height').value = Math.round(rect.height) + 'px';
          }

          function updateLayersPanel(data) {
            const parsed = parseSource(data.source);
            if (parsed && socket && socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({
                type: 'get-tree',
                file: parsed.file
              }));
            }
          }

          function findParentNodeInTree(nodes, targetId) {
            for (const node of nodes) {
              if (node.children && node.children.some(child => child.id === targetId)) {
                return node;
              }
              const found = findParentNodeInTree(node.children || [], targetId);
              if (found) return found;
            }
            return null;
          }

          function renderLayersTree(tree) {
            const list = document.getElementById('layers-list');
            list.innerHTML = '';
            
            function renderNode(node, depth) {
              const item = document.createElement('div');
              item.className = 'layer-item';
              
              const nodeSource = convertNodeIdToSource(node.id, currentFile);
              item.dataset.source = nodeSource;
              
              if (selectedElement && selectedElement.source === nodeSource) {
                item.className += ' active';
              }
              item.style.paddingLeft = (12 + depth * 16) + 'px';
              
              // 1. Labeling: Generate rich descriptive HTML
              const isComponent = node.name[0].toUpperCase() === node.name[0];
              const badgeClass = isComponent ? 'layer-tag-badge component' : 'layer-tag-badge html';
              const badgeText = isComponent ? 'Comp' : 'HTML';
              
              let detailsHTML = '';
              if (node.className) {
                const cleanClasses = node.className.split(' ').slice(0, 2).map(c => '.' + c).join('');
                detailsHTML += ' <span class="layer-info-class">' + cleanClasses + '</span>';
              }
              if (node.text) {
                detailsHTML += ' <span class="layer-info-text">"' + node.text + '"</span>';
              }

              item.innerHTML = 
                '<div class="layer-name">' +
                '  <span class="' + badgeClass + '">' + badgeText + '</span>' +
                '  <span class="layer-info-name">' + node.name + '</span>' +
                detailsHTML +
                '</div>';
              
              // Select item on click
              item.addEventListener('click', (e) => {
                const iframe = document.getElementById('app-iframe');
                if (iframe && iframe.contentWindow) {
                  iframe.contentWindow.postMessage({
                    type: 'glide:select-element-by-id',
                    id: nodeSource
                  }, '*');
                }
              });

              // 2. Movable: HTML5 Drag & Drop reordering
              item.setAttribute('draggable', 'true');
              
              item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', nodeSource);
                item.classList.add('dragging');
                e.stopPropagation();
              });

              item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
              });

              item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const rect = item.getBoundingClientRect();
                const relativeY = e.clientY - rect.top;
                
                if (relativeY < rect.height / 2) {
                  item.style.borderTop = '2px solid var(--accent-color)';
                  item.style.borderBottom = '';
                } else {
                  item.style.borderBottom = '2px solid var(--accent-color)';
                  item.style.borderTop = '';
                }
              });

              item.addEventListener('dragleave', () => {
                item.style.borderTop = '';
                item.style.borderBottom = '';
              });

              item.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                item.style.borderTop = '';
                item.style.borderBottom = '';

                const draggedSource = e.dataTransfer.getData('text/plain');
                if (!draggedSource || draggedSource === nodeSource) return;

                const rect = item.getBoundingClientRect();
                const relativeY = e.clientY - rect.top;
                const position = relativeY < rect.height / 2 ? 'before' : 'after';

                // Find parent of the target node in tree
                const parentNode = findParentNodeInTree(tree, node.id);
                if (parentNode) {
                  const parentSource = convertNodeIdToSource(parentNode.id, currentFile);
                  socket.send(JSON.stringify({
                    type: 'reorder',
                    file: currentFile,
                    targetId: draggedSource,
                    parentId: parentSource,
                    siblingId: nodeSource,
                    position: position
                  }));
                }
              });

              // 3. Editable: Double-click to edit name text
              item.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                
                const currentVal = node.text || node.name;
                const input = document.createElement('input');
                input.type = 'text';
                input.value = currentVal;
                input.style.width = '100%';
                input.style.background = 'var(--bg-base)';
                input.style.border = '1px solid var(--accent-color)';
                input.style.color = 'var(--text-primary)';
                input.style.borderRadius = '4px';
                input.style.padding = '2px 4px';
                input.style.fontSize = '12px';
                input.style.outline = 'none';
                
                const nameContainer = item.querySelector('.layer-name');
                const originalHTML = nameContainer.innerHTML;
                nameContainer.innerHTML = '';
                nameContainer.appendChild(input);
                input.focus();
                input.select();
                
                let finished = false;
                const finishEdit = () => {
                  if (finished) return;
                  finished = true;
                  const newVal = input.value.trim();
                  if (newVal && newVal !== currentVal) {
                    const parsed = parseSource(nodeSource);
                    if (parsed && socket && socket.readyState === WebSocket.OPEN) {
                      socket.send(JSON.stringify({
                        type: 'edit',
                        file: parsed.file,
                        line: parsed.line,
                        column: parsed.column,
                        change: {
                          type: 'text',
                          property: 'text',
                          value: newVal
                        }
                      }));
                    }
                  } else {
                    nameContainer.innerHTML = originalHTML;
                  }
                };
                
                input.addEventListener('keydown', (ev) => {
                  if (ev.key === 'Enter') {
                    finishEdit();
                  } else if (ev.key === 'Escape') {
                    finished = true;
                    nameContainer.innerHTML = originalHTML;
                  }
                });
                
                input.addEventListener('blur', finishEdit);
              });

              list.appendChild(item);
              
              if (node.children) {
                node.children.forEach(child => renderNode(child, depth + 1));
              }
            }

            tree.forEach(node => renderNode(node, 0));
            
            // If an element is already selected, highlight it in the newly rendered tree
            if (selectedElement) {
              highlightActiveLayerItem(selectedElement.source);
            }
          }

          // Initial load
          connectWebSocket();
        </script>
      </body>
    </html>
  `;
}
