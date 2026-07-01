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
            background: #ffffff;
            border-radius: 8px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            position: relative;
            transition: width 0.3s, height 0.3s;
          }
          iframe {
            width: 100%;
            height: 100%;
            border: none;
            border-radius: 8px;
            background: #ffffff;
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
          });

          function updatePropertiesPanel(data) {
            // Parse classes to prefill inputs
            const source = data.source;
            const parts = source.split(':');
            
            // Temporary simple presets
            document.getElementById('prop-width').value = data.rect.width + 'px';
            document.getElementById('prop-height').value = data.rect.height + 'px';
          }

          function updateLayersPanel(data) {
            const list = document.getElementById('layers-list');
            list.innerHTML = '';

            const parts = data.source.split('/');
            const fileName = parts[parts.length - 1].split(':')[0];

            const item = document.createElement('div');
            item.className = 'layer-item active';
            item.innerHTML = \`
              <div class="layer-name">
                <span class="layer-tag">Component</span>
                \${fileName}
              </div>
            \`;
            list.appendChild(item);
          }

          // Initial load
          connectWebSocket();
        </script>
      </body>
    </html>
  `;
}
