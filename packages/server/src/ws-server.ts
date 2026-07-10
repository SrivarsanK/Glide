import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server, request as httpRequest } from 'http';
import * as fs from 'fs';
import { getEditorHTML } from '@srivarsank/overlay';
import { buildComponentTree, GlideConfig, DEFAULT_CONFIG } from '@srivarsank/core';
import * as path from 'path';
import chokidar from 'chokidar';
import { reorderJSXElement, insertJSXElement, groupJSXElements, ungroupJSXElement, arrangeJSXElement } from '@srivarsank/ast-writer';
import { exec } from 'child_process';
import { promisify } from 'util';
import { HistoryManager } from './undo-manager.js';
import {
  pushHistory,
  undo,
  redo,
  jumpTo,
  getHistoryState,
  clearHistory,
  setHistoryLimit
} from './history-manager.js';


const execAsync = promisify(exec);

// ── Glide Bridge Script (injected into proxied HTML) ──────────────────────
// Self-contained IIFE with full CST detection. Injected into user's app HTML
// by the proxy route so no Vite plugin install is required.
function buildGlideBridgeInlineScript(cfg: GlideConfig): string {
  const sourceAttr = cfg.sourceAttribute || 'data-gl-source';
  const hoverAttr  = cfg.hoverAttribute  || 'data-glide-hover';
  const selectedAttr = cfg.selectedAttribute || 'data-glide-selected';
  const snap = cfg.snapThresholdPx ?? 5;
  // Inline the bridge via the vite-plugin's buildBridgeScript equivalent,
  // but using plain string template to avoid any import dependency.
  return `<script data-glide-bridge="1">
(function() {
  if (window === window.top) return;
  if (window.__glide_initialized__) return;
  window.__glide_initialized__ = true;

  // Inject highlight styles
  var style = document.createElement('style');
  style.id = '__glide_styles__';
  style.textContent = [
    '[${hoverAttr}]{outline:2px solid rgba(56,189,248,0.6)!important;outline-offset:1px;}',
    '[${selectedAttr}]{outline:2px solid #38bdf8!important;outline-offset:2px;}',
    'html,body{overflow:auto!important;height:auto!important;}'
  ].join(' ');
  document.head.appendChild(style);

  // ── CST: CSS Selector Tree ──────────────────────────────────────────────
  function getCSSPath(el) {
    if (!el || el === document.documentElement) return 'html';
    if (el === document.body) return 'body';
    if (el.id && /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(el.id)) return '#' + el.id;
    var tag = el.tagName.toLowerCase();
    var parent = el.parentNode;
    if (!parent) return tag;
    var classes = [];
    for (var i = 0; i < el.classList.length; i++) {
      var c = el.classList[i];
      if (c.indexOf('__glide') === 0) continue;
      try { classes.push('.' + CSS.escape(c)); } catch(e) { classes.push('.' + c); }
    }
    var classSel = tag + classes.join('');
    try {
      if (classes.length > 0 && parent.querySelectorAll(classSel).length === 1)
        return getCSSPath(parent) + ' > ' + classSel;
    } catch(e) {}
    var siblings = parent.children;
    var idx = 1;
    for (var j = 0; j < siblings.length; j++) {
      if (siblings[j] === el) break;
      if (siblings[j].tagName === el.tagName) idx++;
    }
    return getCSSPath(parent) + ' > ' + tag + ':nth-of-type(' + idx + ')';
  }

  function getElId(el) {
    var src = el.getAttribute && el.getAttribute('${sourceAttr}');
    return src || ('__glide_cst_' + getCSSPath(el));
  }

  function resolveElementAtPoint(x, y) {
    var direct = document.elementFromPoint(x, y);
    if (!direct || direct === document.body || direct === document.documentElement) return null;
    var src = direct.closest && direct.closest('[${sourceAttr}]');
    if (src) return src;
    var cur = direct;
    while (cur && cur !== document.body) {
      if (cur.nodeType === 1) { var r = cur.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return cur; }
      cur = cur.parentNode;
    }
    return direct;
  }

  function sendMsgForAny(type, el, isShift) {
    if (!el) return;
    var src = getElId(el);
    var r = el.getBoundingClientRect();
    var cs = window.getComputedStyle(el);
    var styles = {
      tagName: el.tagName.toLowerCase(), display: cs.display,
      flexDirection: cs.flexDirection, justifyContent: cs.justifyContent,
      alignItems: cs.alignItems, flexWrap: cs.flexWrap, gap: cs.gap,
      marginTop: cs.marginTop, marginBottom: cs.marginBottom,
      marginLeft: cs.marginLeft, marginRight: cs.marginRight,
      paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight,
      fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing,
      textAlign: cs.textAlign, color: cs.color,
      backgroundColor: cs.backgroundColor, background: cs.background,
      backgroundImage: cs.backgroundImage, opacity: cs.opacity,
      borderColor: cs.borderColor, borderWidth: cs.borderWidth,
      borderRadius: cs.borderRadius, boxShadow: cs.boxShadow,
      transform: cs.transform, width: cs.width, height: cs.height,
      position: cs.position, top: cs.top, left: cs.left,
      flex: cs.flex, flexGrow: cs.flexGrow, alignSelf: cs.alignSelf
    };
    window.parent.postMessage({ type: type, source: src,
      tagName: el.tagName.toLowerCase(), classNames: el.className,
      isShift: !!isShift, rect: { left: r.left, top: r.top, width: r.width, height: r.height } }, '*');
    window.parent.postMessage({ type: 'glide:overlay', source: src, isShift: !!isShift,
      rect: { x: r.left, y: r.top, width: r.width, height: r.height },
      isHover: type === 'glide:element-hovered', computedStyles: styles,
      textContent: (function() {
        if (el.children && el.children.length > 0) return undefined;
        var t = ''; el.childNodes.forEach(function(n) { if (n.nodeType === 3) t += n.textContent; }); return t.trim();
      })()
    }, '*');
  }

  var hovered = null, selected = null;

  // ── DOM tree serializer ─────────────────────────────────────────────────
  // Builds a lightweight node tree from live DOM for the Layers panel.
  // Skips script/style/noscript/template and Glide-injected nodes.
  var SKIP_TAGS = { SCRIPT:1, STYLE:1, NOSCRIPT:1, TEMPLATE:1, META:1, LINK:1, TITLE:1 };
  var MAX_DEPTH = 12;
  function serializeDOMNode(el, depth) {
    if (!el || el.nodeType !== 1) return null;
    if (SKIP_TAGS[el.tagName]) return null;
    if (el.hasAttribute('data-glide-bridge')) return null;
    if (el.id === '__glide_styles__') return null;
    var id = getElId(el);
    var tag = el.tagName.toLowerCase();
    var cls = (el.className && typeof el.className === 'string') ? el.className.replace(/\s*(__glide\S*)\s*/g,'').trim() : '';
    // Gather direct text content (leaf only)
    var text = '';
    if (!el.children || el.children.length === 0) {
      el.childNodes.forEach(function(n) { if (n.nodeType === 3) text += n.textContent; });
      text = text.trim().slice(0, 40);
    }
    var children = [];
    if (depth < MAX_DEPTH && el.children) {
      for (var i = 0; i < el.children.length; i++) {
        var child = serializeDOMNode(el.children[i], depth + 1);
        if (child) children.push(child);
      }
    }
    return { id: id, name: tag, className: cls, text: text || undefined, children: children };
  }

  function sendDOMTree() {
    var body = document.body;
    if (!body) return;
    var tree = [];
    for (var i = 0; i < body.children.length; i++) {
      var node = serializeDOMNode(body.children[i], 0);
      if (node) tree.push(node);
    }
    window.parent.postMessage({ type: 'glide:dom-tree', tree: tree }, '*');
  }

  // Send ready + tree once DOM is available
  function initBridge() {
    window.parent.postMessage({ type: 'glide:ready', source: '__glide_cst_body' }, '*');
    sendDOMTree();
    // Re-send tree on dynamic mutations (throttled)
    if (window.MutationObserver) {
      var mutTimer = null;
      var obs = new MutationObserver(function() {
        clearTimeout(mutTimer);
        mutTimer = setTimeout(sendDOMTree, 400);
      });
      obs.observe(document.body, { childList: true, subtree: true, attributes: false });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBridge);
  } else {
    initBridge();
  }

  // Parent can also request a fresh tree at any time (e.g. after iframe reload)
  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;
    if (e.data.type === 'glide:request-dom-tree') { sendDOMTree(); }
    if (e.data.type === 'glide:select-element-by-id') {
      var id = e.data.id;
      var target = null;
      // Try CSS selector path first
      var cstPrefix = '__glide_cst_';
      if (id && id.startsWith(cstPrefix)) {
        var selector = id.slice(cstPrefix.length);
        try { target = document.querySelector(selector); } catch(e2) {}
      } else if (id) {
        // Try data-gl-source attr match
        try { target = document.querySelector('[${sourceAttr}="' + id.replace(/"/g,'\\"') + '"]'); } catch(e2) {}
      }
      if (target) {
        var old2 = document.querySelectorAll('[${selectedAttr}]');
        for (var k = 0; k < old2.length; k++) old2[k].removeAttribute('${selectedAttr}');
        selected = target;
        target.setAttribute('${selectedAttr}', '');
        sendMsgForAny('glide:element-selected', target, !!(e.data.isShift));
      }
    }
    if (e.data.type === 'glide:hover-element-by-id') {
      var hid = e.data.id;
      var htarget = null;
      var cstPfx = '__glide_cst_';
      if (hid && hid.startsWith(cstPfx)) {
        try { htarget = document.querySelector(hid.slice(cstPfx.length)); } catch(e3) {}
      }
      if (htarget) {
        if (hovered && hovered !== htarget) hovered.removeAttribute('${hoverAttr}');
        hovered = htarget;
        htarget.setAttribute('${hoverAttr}', '');
        sendMsgForAny('glide:element-hovered', htarget);
      }
    }
    if (e.data.type === 'glide:hover-element-exit') {
      if (hovered) { hovered.removeAttribute('${hoverAttr}'); hovered = null; }
    }
  });

  document.addEventListener('pointermove', function(e) {
    var el = resolveElementAtPoint(e.clientX, e.clientY);
    if (el && (el === document.body || el === document.documentElement)) el = null;
    if (el) {
      if (hovered !== el) {
        if (hovered) hovered.removeAttribute('${hoverAttr}');
        hovered = el;
        el.setAttribute('${hoverAttr}', '');
        sendMsgForAny('glide:element-hovered', el);
      }
    } else if (hovered) {
      hovered.removeAttribute('${hoverAttr}');
      hovered = null;
      window.parent.postMessage({ type: 'glide:element-hover-exit' }, '*');
    }
  }, true);

  document.addEventListener('pointerdown', function(e) {
    if (e.target.contentEditable === 'true' || e.target.closest('[contenteditable="true"]')) return;
    var el = resolveElementAtPoint(e.clientX, e.clientY);
    if (el && (el === document.body || el === document.documentElement)) el = null;
    if (!el) return;
    var isShift = e.shiftKey || e.ctrlKey || e.metaKey;
    var old = document.querySelectorAll('[${selectedAttr}]');
    if (!isShift) { for (var i = 0; i < old.length; i++) old[i].removeAttribute('${selectedAttr}'); }
    selected = el;
    el.setAttribute('${selectedAttr}', '');
    sendMsgForAny('glide:element-selected', el, isShift);
    e.preventDefault();
    e.stopPropagation();
  }, true);

  document.addEventListener('click', function(e) {
    var el = resolveElementAtPoint(e.clientX, e.clientY);
    if (el && el !== document.body && el !== document.documentElement) {
      e.preventDefault(); e.stopPropagation();
    } else {
      selected = null;
      window.parent.postMessage({ type: 'glide:clear-selection' }, '*');
    }
  }, true);

  document.addEventListener('contextmenu', function(e) {
    var el = resolveElementAtPoint(e.clientX, e.clientY);
    if (el && el !== document.body && el !== document.documentElement) {
      e.preventDefault();
      window.parent.postMessage({ type: 'glide:contextmenu', source: getElId(el), clientX: e.clientX, clientY: e.clientY }, '*');
    }
  }, true);

})();
<\/script>`
    .replace(/\$\{hoverAttr\}/g, hoverAttr)
    .replace(/\$\{selectedAttr\}/g, selectedAttr)
    .replace(/\$\{sourceAttr\}/g, sourceAttr);
}

/**
 * Proxy a request from the Glide editor to the user's dev server.
 * For HTML responses, inject the Glide bridge script before </head>.
 * For all other assets, pipe through unchanged.
 */
function proxyToDevServer(
  targetPort: number,
  proxyPath: string,
  req: any,
  res: any,
  bridgeScript: string
): void {
  const options = {
    hostname: '127.0.0.1',
    port: targetPort,
    path: proxyPath,
    method: req.method || 'GET',
    headers: {
      ...req.headers,
      host: `localhost:${targetPort}`,
    },
  };
  // Remove encoding so we get raw bytes (easier to inject text)
  delete options.headers['accept-encoding'];

  const proxyReq = httpRequest(options, (proxyRes) => {
    const contentType = proxyRes.headers['content-type'] || '';
    const isHTML = contentType.includes('text/html');

    // Strip framing headers so the iframe can load us
    const outHeaders: Record<string, any> = {};
    for (const [k, v] of Object.entries(proxyRes.headers)) {
      const lk = k.toLowerCase();
      if (lk === 'x-frame-options') continue;
      if (lk === 'content-security-policy' || lk === 'content-security-policy-report-only') {
        // strip frame-ancestors directive
        const filtered = String(v).split(';')
          .map(d => d.trim())
          .filter(d => !d.toLowerCase().startsWith('frame-ancestors'))
          .join('; ');
        outHeaders[k] = filtered;
        continue;
      }
      if (lk === 'content-length' && isHTML) continue; // we'll change length
      outHeaders[k] = v;
    }

    if (isHTML) {
      // Buffer HTML so we can inject
      const chunks: Buffer[] = [];
      proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
      proxyRes.on('end', () => {
        let html = Buffer.concat(chunks).toString('utf-8');
        // Fix relative asset paths → prefix with proxy base
        html = html
          .replace(/(src|href|action)="(?!\/\/)\//g, '$1="/__glide_proxy__/')
          .replace(/(src|href|action)='\/(?!\/)/g, "$1='/__glide_proxy__/");
        // Rewrite Vite HMR WebSocket to point at actual dev server port
        html = html.replace(
          /new WebSocket\(['"]ws:\/\/localhost:\d+/g,
          `new WebSocket('ws://localhost:${targetPort}`
        );
        // Inject bridge before </head> (or at top of <body> as fallback)
        if (html.includes('</head>')) {
          html = html.replace('</head>', bridgeScript + '</head>');
        } else if (html.includes('<body')) {
          html = html.replace(/<body([^>]*)>/, `<body$1>${bridgeScript}`);
        } else {
          html = bridgeScript + html;
        }
        outHeaders['content-type'] = 'text/html; charset=utf-8';
        res.writeHead(proxyRes.statusCode || 200, outHeaders);
        res.end(html, 'utf-8');
      });
    } else {
      res.writeHead(proxyRes.statusCode || 200, outHeaders);
      proxyRes.pipe(res);
    }
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('[Glide Proxy] Could not reach dev server: ' + err.message);
  });

  if (req.readable) req.pipe(proxyReq); else proxyReq.end();
}

/**
 * Walk up from a file path to find the nearest directory containing a .git folder.
 * Returns the directory if found, otherwise falls back to process.cwd().
 */
function findGitRoot(startPath: string): string {
  let dir = fs.statSync(startPath).isDirectory() ? startPath : path.dirname(startPath);
  const root = path.parse(dir).root;
  while (dir !== root) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

// Tracks the git root of the user's target project (populated on first file operation)
let activeProjectGitRoot: string = process.cwd();


export interface EditChange {
  type: 'style' | 'class' | 'text' | 'multi-class' | 'position' | 'group' | 'ungroup';
  property?: string;
  value?: any;
  sources?: string[];
  source?: string;
}

export interface EditMessage {
  type: 'edit';
  file: string;
  line: number;
  column: number;
  change: EditChange;
}

export type EditCallback = (
  file: string,
  line: number,
  column: number,
  change: EditChange,
  hash?: string
) => void | Promise<void>;

function normalizePathKey(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, '/').toLowerCase();
}

export class GlideServer {
  private wss: WebSocketServer | null = null;
  private server: Server | null = null;
  private port: number;
  private targetPort: number;
  private config: GlideConfig;
  private editCallbacks: EditCallback[] = [];
  private fileGenerations = new Map<string, number>();
  private watcher: any = null;
  private history = new HistoryManager();
  private lastSelfWrites = new Map<string, number>();

  public recordSelfWrite(filePath: string) {
    const normPath = normalizePathKey(filePath);
    this.lastSelfWrites.set(normPath, Date.now());
    this.fileGenerations.set(normPath, (this.fileGenerations.get(normPath) || 0) + 1);
  }

  constructor(port = 7777, targetPort = 5173, config: GlideConfig = DEFAULT_CONFIG) {
    this.port = port;
    this.targetPort = targetPort;
    this.config = {
      ...config,
      port,
      targetPort
    };
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        clearHistory();
        setHistoryLimit(this.config.historyLimit);

        this.server = createServer((req, res) => {
          const url = req.url || '/';

          // ── Proxy route: forward to user's dev server + inject bridge ──
          if (url.startsWith('/__glide_proxy__')) {
            // Strip the proxy prefix to get the actual path
            const proxyPath = url.slice('/__glide_proxy__'.length) || '/';
            const bridgeScript = buildGlideBridgeInlineScript(this.config);
            proxyToDevServer(this.targetPort, proxyPath, req, res, bridgeScript);
            return;
          }

          // ── Editor shell ────────────────────────────────────────────────
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(getEditorHTML(this.config));
        });


        // Start file watcher for drift detection
        const srcPath = fs.existsSync(path.resolve(process.cwd(), 'src'))
          ? path.resolve(process.cwd(), 'src')
          : process.cwd();
        this.watcher = chokidar.watch(srcPath, {
          persistent: true,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/build/**',
            '**/.next/**',
            '**/.svelte-kit/**',
            '**/.nuxt/**'
          ]
        });
        this.watcher.on('change', (filePath: string) => {
          const normPath = normalizePathKey(filePath);
          const lastWrite = this.lastSelfWrites.get(normPath) || 0;
          if (Date.now() - lastWrite < this.config.selfWriteDebounceMs) {
            console.log(`[Glide] Ignoring self-write change event on ${normPath}`);
            return;
          }
          this.fileGenerations.set(normPath, (this.fileGenerations.get(normPath) || 0) + 1);
          console.log(`[Glide] File drift detected on ${normPath}, bumping generation counter to ${this.fileGenerations.get(normPath)}`);
        });

        this.wss = new WebSocketServer({ server: this.server });

        this.wss.on('connection', (ws: WebSocket) => {
          ws.on('message', async (data: string) => {
            try {
              const message = JSON.parse(data);

              if (message.type === 'get-tree') {
                const { file } = message;
                if (fs.existsSync(file)) {
                  // Track the user's project git root for git commands
                  try { activeProjectGitRoot = findGitRoot(file); } catch {}
                  const code = fs.readFileSync(file, 'utf-8');
                  const tree = buildComponentTree(code, file);
                  const normPath = normalizePathKey(file);
                  ws.send(JSON.stringify({
                    type: 'tree',
                    file,
                    tree,
                    generation: this.fileGenerations.get(normPath) || 0
                  }));
                } else {
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: false,
                    error: `File not found: ${file}`
                  }));
                }
                return;
              }


              if (message.type === 'insert') {
                const { file, parentId, elementType } = message;
                if (fs.existsSync(file)) {
                  try {
                    const code = fs.readFileSync(file, 'utf-8');
                    const updated = insertJSXElement(code, parentId, elementType);
                    this.recordSelfWrite(file);
                    fs.writeFileSync(file, updated, 'utf-8');
                    pushHistory({
                      description: `Inserted ${elementType} in ${path.basename(file)}`,
                      diffs: [{ file: path.resolve(file), before: code, after: updated }]
                    });
                    ws.send(JSON.stringify({
                      type: 'HISTORY_UPDATE',
                      ...getHistoryState()
                    }));
                    // Automatically send updated tree back
                    const tree = buildComponentTree(updated, file);
                    ws.send(JSON.stringify({
                      type: 'tree',
                      file,
                      tree,
                      generation: this.fileGenerations.get(normalizePathKey(file)) || 0
                    }));
                  } catch (err: any) {
                    ws.send(JSON.stringify({
                      type: 'status',
                      success: false,
                      error: err.message
                    }));
                  }
                } else {
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: false,
                    error: `File not found: ${file}`
                  }));
                }
                return;
              }

              if (message.type === 'reorder') {
                const { file, targetId, parentId, siblingId, position } = message;
                if (fs.existsSync(file)) {
                  try {
                    const code = fs.readFileSync(file, 'utf-8');
                    const updated = reorderJSXElement(code, targetId, parentId, siblingId, position);
                    this.recordSelfWrite(file);
                    fs.writeFileSync(file, updated, 'utf-8');
                    pushHistory({
                      description: `Reordered elements in ${path.basename(file)}`,
                      diffs: [{ file: path.resolve(file), before: code, after: updated }]
                    });
                    ws.send(JSON.stringify({
                      type: 'HISTORY_UPDATE',
                      ...getHistoryState()
                    }));
                    ws.send(JSON.stringify({
                      type: 'status',
                      success: true
                    }));
                  } catch (err: any) {
                    ws.send(JSON.stringify({
                      type: 'status',
                      success: false,
                      error: err.message
                    }));
                  }
                } else {
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: false,
                    error: `File not found: ${file}`
                  }));
                }
                return;
              }

              if (message.type === 'group') {
                const { file, selectedIds } = message;
                if (fs.existsSync(file)) {
                  try {
                    const code = fs.readFileSync(file, 'utf-8');
                    const updated = groupJSXElements(code, selectedIds);
                    this.recordSelfWrite(file);
                    fs.writeFileSync(file, updated, 'utf-8');
                    pushHistory({
                      description: `Grouped elements in ${path.basename(file)}`,
                      diffs: [{ file: path.resolve(file), before: code, after: updated }]
                    });
                    ws.send(JSON.stringify({
                      type: 'HISTORY_UPDATE',
                      ...getHistoryState()
                    }));
                    const tree = buildComponentTree(updated, file);
                    ws.send(JSON.stringify({
                      type: 'tree',
                      file,
                      tree,
                      generation: this.fileGenerations.get(normalizePathKey(file)) || 0
                    }));
                  } catch (err: any) {
                    ws.send(JSON.stringify({
                      type: 'status',
                      success: false,
                      error: err.message
                    }));
                  }
                } else {
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: false,
                    error: `File not found: ${file}`
                  }));
                }
                return;
              }

              if (message.type === 'ungroup') {
                const { file, groupId } = message;
                if (fs.existsSync(file)) {
                  try {
                    const code = fs.readFileSync(file, 'utf-8');
                    const updated = ungroupJSXElement(code, groupId);
                    this.recordSelfWrite(file);
                    fs.writeFileSync(file, updated, 'utf-8');
                    pushHistory({
                      description: `Ungrouped element in ${path.basename(file)}`,
                      diffs: [{ file: path.resolve(file), before: code, after: updated }]
                    });
                    ws.send(JSON.stringify({
                      type: 'HISTORY_UPDATE',
                      ...getHistoryState()
                    }));
                    const tree = buildComponentTree(updated, file);
                    ws.send(JSON.stringify({
                      type: 'tree',
                      file,
                      tree,
                      generation: this.fileGenerations.get(normalizePathKey(file)) || 0
                    }));
                  } catch (err: any) {
                    ws.send(JSON.stringify({
                      type: 'status',
                      success: false,
                      error: err.message
                    }));
                  }
                } else {
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: false,
                    error: `File not found: ${file}`
                  }));
                }
                return;
              }

              if (message.type === 'arrange') {
                const { file, targetId, action } = message;
                if (fs.existsSync(file)) {
                  try {
                    const code = fs.readFileSync(file, 'utf-8');
                    const updated = arrangeJSXElement(code, targetId, action);
                    this.recordSelfWrite(file);
                    fs.writeFileSync(file, updated, 'utf-8');
                    pushHistory({
                      description: `Arranged element in ${path.basename(file)}`,
                      diffs: [{ file: path.resolve(file), before: code, after: updated }]
                    });
                    ws.send(JSON.stringify({
                      type: 'HISTORY_UPDATE',
                      ...getHistoryState()
                    }));
                    const tree = buildComponentTree(updated, file);
                    ws.send(JSON.stringify({
                      type: 'tree',
                      file,
                      tree,
                      generation: this.fileGenerations.get(normalizePathKey(file)) || 0
                    }));
                  } catch (err: any) {
                    ws.send(JSON.stringify({
                      type: 'status',
                      success: false,
                      error: err.message
                    }));
                  }
                } else {
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: false,
                    error: `File not found: ${file}`
                  }));
                }
                return;
              }


              if (message.type === 'git-branch-create') {
                const { branchName, projectDir } = message;
                // Use projectDir sent from client, or fall back to the tracked git root
                const cwd = projectDir
                  ? findGitRoot(projectDir)
                  : activeProjectGitRoot;
                console.log(`[Glide] Creating and checking out git branch: ${branchName} in ${cwd}`);
                try {
                  await execAsync(`git checkout -b ${branchName}`, { cwd });
                  ws.send(JSON.stringify({
                    type: 'git-status',
                    success: true,
                    branch: branchName,
                    action: 'create'
                  }));
                } catch (err: any) {
                  console.error(`[Glide] Failed to create git branch ${branchName}:`, err.message);
                  ws.send(JSON.stringify({
                    type: 'git-status',
                    success: false,
                    error: err.message,
                    action: 'create'
                  }));
                }
                return;
              }

              if (message.type === 'git-branch-finalize') {
                const { commitMessage, projectDir } = message;
                const cwd = projectDir
                  ? findGitRoot(projectDir)
                  : activeProjectGitRoot;
                console.log(`[Glide] Finalizing git branch with commit: "${commitMessage}" in ${cwd}`);
                try {
                  // Run git add and git commit as separate commands to avoid && issues on Windows
                  await execAsync(`git add -A`, { cwd });
                  await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { cwd });
                  ws.send(JSON.stringify({
                    type: 'git-status',
                    success: true,
                    action: 'finalize'
                  }));
                } catch (err: any) {
                  console.error(`[Glide] Failed to finalize git branch:`, err.message);
                  ws.send(JSON.stringify({
                    type: 'git-status',
                    success: false,
                    error: err.message,
                    action: 'finalize'
                  }));
                }
                return;
              }

              if (message.type === 'undo' || message.type === 'UNDO') {
                console.log('[Glide] Undo request received');
                try {
                  const diffs = undo();
                  if (diffs && diffs.length > 0) {
                    for (const diff of diffs) {
                      this.recordSelfWrite(diff.file);
                      fs.writeFileSync(diff.file, diff.before, 'utf-8');
                      // Only push updated tree for code files
                      if (!diff.file.endsWith('.json')) {
                        const updatedCode = fs.readFileSync(diff.file, 'utf-8');
                        const tree = buildComponentTree(updatedCode, diff.file);
                        ws.send(JSON.stringify({
                          type: 'tree',
                          file: diff.file,
                          tree,
                          generation: this.fileGenerations.get(normalizePathKey(diff.file)) || 0
                        }));
                      }
                    }
                  }
                  ws.send(JSON.stringify({
                    type: 'HISTORY_UPDATE',
                    ...getHistoryState()
                  }));
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: true,
                    message: 'Undo successful',
                    action: 'undo'
                  }));
                  ws.send(JSON.stringify({ type: 'ACK', success: true }));
                } catch (err: any) {
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: false,
                    error: err.message
                  }));
                }
                return;
              }

              if (message.type === 'redo' || message.type === 'REDO') {
                console.log('[Glide] Redo request received');
                try {
                  const diffs = redo();
                  if (diffs && diffs.length > 0) {
                    for (const diff of diffs) {
                      this.recordSelfWrite(diff.file);
                      fs.writeFileSync(diff.file, diff.after, 'utf-8');
                      // Only push updated tree for code files
                      if (!diff.file.endsWith('.json')) {
                        const updatedCode = fs.readFileSync(diff.file, 'utf-8');
                        const tree = buildComponentTree(updatedCode, diff.file);
                        ws.send(JSON.stringify({
                          type: 'tree',
                          file: diff.file,
                          tree,
                          generation: this.fileGenerations.get(normalizePathKey(diff.file)) || 0
                        }));
                      }
                    }
                  }
                  ws.send(JSON.stringify({
                    type: 'HISTORY_UPDATE',
                    ...getHistoryState()
                  }));
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: true,
                    message: 'Redo successful',
                    action: 'redo'
                  }));
                  ws.send(JSON.stringify({ type: 'ACK', success: true }));
                } catch (err: any) {
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: false,
                    error: err.message
                  }));
                }
                return;
              }

              if (message.type === 'JUMP_TO_HISTORY') {
                console.log('[Glide] Jump to history index:', message.index);
                try {
                  const writes = jumpTo(message.index);
                  for (const w of writes) {
                    this.recordSelfWrite(w.file);
                    fs.writeFileSync(w.file, w.content, 'utf-8');
                    // Only push updated tree for code files
                    if (!w.file.endsWith('.json')) {
                      const tree = buildComponentTree(w.content, w.file);
                      ws.send(JSON.stringify({
                        type: 'tree',
                        file: w.file,
                        tree,
                        generation: this.fileGenerations.get(normalizePathKey(w.file)) || 0
                      }));
                    }
                  }
                  ws.send(JSON.stringify({
                    type: 'HISTORY_UPDATE',
                    ...getHistoryState()
                  }));
                  ws.send(JSON.stringify({ type: 'ACK', success: true }));
                } catch (err: any) {
                  ws.send(JSON.stringify({
                    type: 'status',
                    success: false,
                    error: err.message
                  }));
                }
                return;
              }

              if (message.type === 'GET_HISTORY') {
                ws.send(JSON.stringify({
                  type: 'HISTORY_UPDATE',
                  ...getHistoryState()
                }));
                return;
              }


              if (message.type === 'edit') {
                const { file, line, column, change, hash, generation } = message as any;
                console.log(`[Glide] Edit request: ${change?.type} at ${file}:${line}:${column} (hash: ${hash}, gen: ${generation})`);

                // Validate parameters
                if (!file || typeof line !== 'number' || typeof column !== 'number' || !change) {
                  ws.send(
                    JSON.stringify({
                      type: 'status',
                      success: false,
                      error: 'Invalid edit payload',
                    })
                  );
                  return;
                }

                // Invalidate on drift check — skip for position edits
                // (they write to glide-positions.json, not source files)
                if (change.type !== 'position') {
                  const normPath = normalizePathKey(file);
                  const currentGen = this.fileGenerations.get(normPath) || 0;
                  if (generation !== undefined && generation !== currentGen) {
                    ws.send(
                      JSON.stringify({
                        type: 'status',
                        success: false,
                        error: `STALE_GENERATION: File has drifted since selection (expected generation ${generation}, current is ${currentGen})`,
                      })
                    );
                    return;
                  }
                }

                // Call registered edit callbacks
                for (const callback of this.editCallbacks) {
                  try {
                    await callback(file, line, column, change, hash);
                  } catch (err: any) {
                    console.error(`[Glide] Edit handler error:`, err.message);
                    ws.send(
                      JSON.stringify({
                        type: 'status',
                        success: false,
                        error: err.message,
                      })
                    );
                    return;
                  }
                }

                // Only bump generation for edits that modify the source file.
                // Position edits write to glide-positions.json, NOT the source file.
                if (change.type !== 'position') {
                  this.recordSelfWrite(file);
                }

                ws.send(
                  JSON.stringify({
                    type: 'status',
                    success: true,
                  })
                );

                ws.send(JSON.stringify({
                  type: 'HISTORY_UPDATE',
                  ...getHistoryState()
                }));
              } else {
                ws.send(
                  JSON.stringify({
                    type: 'status',
                    success: false,
                    error: `Unsupported message type: ${message.type}`,
                  })
                );
              }
            } catch (err: any) {
              ws.send(
                JSON.stringify({
                  type: 'status',
                  success: false,
                  error: `Malformed JSON: ${err.message}`,
                })
              );
            }
          });
        });

        this.wss.on('error', (err) => {
          reject(err);
        });

        this.server.listen(this.port, () => {
          resolve();
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.wss) {
        this.wss.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          this.wss = null;
          this.closeHttpServer(resolve, reject);
        });
      } else {
        this.closeHttpServer(resolve, reject);
      }
    });
  }

  private closeHttpServer(resolve: () => void, reject: (err: Error) => void) {
    if (this.server) {
      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.server = null;
          resolve();
        }
      });
    } else {
      resolve();
    }
  }

  public onEdit(callback: EditCallback): void {
    this.editCallbacks.push(callback);
  }
}
