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
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 4px;
            transition: background 0.15s;
          }
          .layer-item:hover {
            background: var(--bg-element);
          }
          .layer-item.active {
            background: #0284c7;
            color: #ffffff;
          }
          .layer-name {
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .layer-tag {
            color: var(--accent-color);
            font-size: 11px;
            font-weight: 600;
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
        </style>
      </head>
      <body>
        <header>
          <div class="logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Glide <span>Canvas</span>
          </div>

          <div class="toolbar">
            <div class="toolbar-input-group">
              <label for="app-url">App Url</label>
              <input type="text" id="app-url" value="http://localhost:4321">
            </div>
            <button class="btn" id="btn-load">Connect App</button>
          </div>

          <div class="status-badge">
            <div class="status-dot" id="status-dot"></div>
            <span id="status-text">Disconnected</span>
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
          let selectedElement = null;          function connectWebSocket() {
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
                  renderLayersTree(message.tree);
                }
              } catch {}
            });
          }

          // Load Iframe Bridge Injection
          document.getElementById('btn-load').addEventListener('click', () => {
            const url = document.getElementById('app-url').value;
            const iframe = document.getElementById('app-iframe');
            iframe.src = url;
          });

          // Handle message communication from GlideBridge running inside iframe
          window.addEventListener('message', (event) => {
            const data = event.data;
            if (!data || typeof data !== 'object') return;

            if (data.type === 'glide:element-selected') {
              selectedElement = data;
              updatePropertiesPanel(data);
              updateLayersPanel(data);
            }

            if (data.type === 'glide:element-resized') {
              const { source, rect, delta } = data;
              const parts = source.split(':');
              if (parts.length >= 3 && socket && socket.readyState === WebSocket.OPEN) {
                const file = parts[0];
                const line = parseInt(parts[1], 10);
                const column = parseInt(parts[2], 10);

                socket.send(JSON.stringify({
                  type: 'edit',
                  file,
                  line,
                  column,
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
            const parts = source.split(':');

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
            const source = data.source;
            const parts = source.split(':');
            if (parts.length >= 3 && socket && socket.readyState === WebSocket.OPEN) {
              const file = parts[0];
              socket.send(JSON.stringify({
                type: 'get-tree',
                file
              }));
            }
          }

          function renderLayersTree(tree) {
            const list = document.getElementById('layers-list');
            list.innerHTML = '';
            
            function renderNode(node, depth) {
              const item = document.createElement('div');
              item.className = 'layer-item';
              if (selectedElement && selectedElement.source === node.id) {
                item.className += ' active';
              }
              item.style.paddingLeft = (12 + depth * 16) + 'px';
              item.innerHTML = \`
                <div class="layer-name">
                  <span class="layer-tag">\${node.name[0].toUpperCase() === node.name[0] ? 'Component' : 'HTML'}</span>
                  \${node.name}
                </div>
              \`;
              
              item.addEventListener('click', () => {
                const iframe = document.getElementById('app-iframe');
                if (iframe && iframe.contentWindow) {
                  iframe.contentWindow.postMessage({
                    type: 'glide:select-element-by-id',
                    id: node.id
                  }, '*');
                }
              });

              list.appendChild(item);
              
              if (node.children) {
                node.children.forEach(child => renderNode(child, depth + 1));
              }
            }

            tree.forEach(node => renderNode(node, 0));
          }

          // Initial load
          connectWebSocket();
        </script>
      </body>
    </html>
  `;
}
