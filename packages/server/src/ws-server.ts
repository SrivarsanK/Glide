import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server, request as httpRequest, type ClientRequest, type IncomingMessage, type ServerResponse } from 'http';
import type { Duplex } from 'stream';
import { Server as TlsServer } from 'node:tls';
import * as fs from 'fs';
import { randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import { getEditorHTML } from '@srivarsank/overlay';
import { buildComponentTree, buildBridgeScript, GlideConfig, DEFAULT_CONFIG, resolveComponentDefinition, loadTailwindTheme, listRoutes, isIgnoredWatchPath } from '@srivarsank/core';
import * as path from 'path';
import chokidar, { type FSWatcher } from 'chokidar';
import { parseJSXElements, inspectJSXProps, listWorkspaceObjects, forwardsClassName, activeVariants } from '@srivarsank/ast-writer';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { HistoryStore } from './history-manager.js';
import { MutationService, contentDigest, type MutationOperation } from './mutation-service.js';
import { handleMcp } from './mcp.js';
import { ProjectPaths } from './project-paths.js';
import { trustedRequest, validateMessage } from './session-security.js';
import { finalizeEditorChanges } from './editor-git.js';
import { getEditorAsset } from './editor-assets.js';
import { maintainRegistryFile } from './registry-file.js';
import type { MutationScope } from '@srivarsank/core';

const execFileAsync = promisify(execFile);

function findProjectEntryFile(projectDir: string): string | null {
  try {
    const regPath = path.join(projectDir, 'glide-components.json');
    if (fs.existsSync(regPath)) {
      const reg = JSON.parse(fs.readFileSync(regPath, 'utf-8'));
      if (reg && reg.buckets && reg.buckets.length > 0 && reg.buckets[0].file) {
        if (fs.existsSync(reg.buckets[0].file)) {
          return reg.buckets[0].file;
        }
      }
    }
  } catch {}

  const candidates = [
    'src/App.tsx',
    'src/App.jsx',
    'src/App.vue',
    'src/App.svelte',
    'src/routes/+page.svelte',
    'src/pages/index.astro',
    'src/main.tsx',
    'src/main.jsx',
    'src/index.tsx',
    'src/index.jsx',
    'index.html'
  ];

  for (const rel of candidates) {
    const full = path.resolve(projectDir, rel);
    if (fs.existsSync(full)) {
      return full;
    }
  }

  return null;
}

// ── Glide Bridge Script (injected into proxied HTML) ──────────────────────
// Self-contained IIFE with full CST detection. Injected into user's app HTML
// by the proxy route so no Vite plugin install is required.
export function buildGlideBridgeInlineScript(cfg: GlideConfig): string {
  const sourceAttr = cfg.sourceAttribute || 'data-gl-source';
  const hoverAttr = cfg.hoverAttribute || 'data-glide-hover';
  const selectedAttr = cfg.selectedAttribute || 'data-glide-selected';
  const snapThreshold = typeof cfg.snapThresholdPx === 'number' ? cfg.snapThresholdPx : DEFAULT_CONFIG.snapThresholdPx;
  const script = buildBridgeScript(sourceAttr, hoverAttr, selectedAttr, snapThreshold).replace(/<\/script>/gi, '<\\/script>');
  return `<script data-glide-bridge="1">${script}<\/script>`;
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
  bridgeScript: string,
  useFallback = false
): void {
  const hostname = useFallback ? '127.0.0.1' : 'localhost';
  const options = {
    hostname,
    port: targetPort,
    path: proxyPath,
    method: req.method || 'GET',
    headers: {
      ...req.headers,
      host: `${hostname}:${targetPort}`,
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
      proxyRes.on('error', () => { if (!res.writableEnded) res.destroy(); });
      proxyRes.on('aborted', () => { if (!res.writableEnded) res.destroy(); });
      proxyRes.on('end', () => {
        if (res.headersSent || res.writableEnded || res.destroyed) return;
        let html = Buffer.concat(chunks).toString('utf-8');
        // Replace absolute target server URLs with proxy base
        const absTargetPattern = new RegExp(`http://(?:localhost|127\\.0\\.0\\.1):${targetPort}/`, 'g');
        html = html.replace(absTargetPattern, '/__glide_proxy__/');

        // Fix relative asset paths → prefix with proxy base (without double-prefixing)
        html = html
          .replace(/(src|href|action)="(?!\/\/|\/__glide_proxy__\/)\//g, '$1="/__glide_proxy__/')
          .replace(/(src|href|action)='(?!\/\/|\/__glide_proxy__\/)\//g, "$1='/__glide_proxy__/");
        // Rewrite Vite/Astro HMR WebSocket to point at actual dev server port, preserving quote style
        html = html.replace(
          /new WebSocket\((['"])ws:\/\/(?:localhost|127\.0\.0\.1):\d+/g,
          `new WebSocket($1ws://localhost:${targetPort}`
        );
        // Inject bridge before </head> (or at top of <body> as fallback)
        // Replacer functions insert the script literally; a replacement string would expand `$&` and `$'`.
        if (html.includes('</head>')) {
          html = html.replace('</head>', () => bridgeScript + '</head>');
        } else if (html.includes('<body')) {
          html = html.replace(/<body([^>]*)>/, (_tag, attributes) => `<body${attributes}>${bridgeScript}`);
        } else {
          html = bridgeScript + html;
        }
        outHeaders['content-type'] = 'text/html; charset=utf-8';
        res.writeHead(proxyRes.statusCode || 200, outHeaders);
        res.end(html, 'utf-8');
      });
    } else {
      proxyRes.on('error', () => { if (!res.writableEnded) res.destroy(); });
      proxyRes.on('aborted', () => { if (!res.writableEnded) res.destroy(); });
      res.writeHead(proxyRes.statusCode || 200, outHeaders);
      proxyRes.pipe(res);
    }
  });

  res.on('close', () => {
    if (!res.writableEnded) proxyReq.destroy();
  });

  proxyReq.on('error', (err: any) => {
    if (res.headersSent || res.writableEnded || res.destroyed) {
      res.destroy();
      return;
    }
    const bodyless = !req.method || ['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
    if (!useFallback && bodyless && (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND')) {
      console.log(`[Glide Proxy] Retrying connection to dev server via 127.0.0.1:${targetPort}...`);
      return proxyToDevServer(targetPort, proxyPath, req, res, bridgeScript, true);
    }
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('[Glide Proxy] Could not reach dev server: ' + err.message
      + '\n\nStart the dev server of your app. If it uses a different port, type its address (for example http://localhost:4321) in the URL field of the editor and press Enter.');
  });

  if (req.readable) req.pipe(proxyReq); else proxyReq.end();
}

function parsePathname(rawUrl: string | undefined): string | null {
  const url = rawUrl || '/';
  if (!url.startsWith('/') || url.startsWith('//')) return null;
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return null;
  }
}

function stripProxyPrefix(rawUrl: string, pathname: string): string {
  if (pathname !== '/__glide_proxy__' && !pathname.startsWith('/__glide_proxy__/')) return rawUrl;
  const sliced = rawUrl.slice('/__glide_proxy__'.length);
  if (!sliced) return '/';
  return sliced.startsWith('/') ? sliced : `/${sliced}`;
}

/**
 * Glide's own socket is the editor's: path `/` with no subprotocol. Vite's HMR
 * client also connects to the page's host (the editor port) at its HMR base,
 * asking for the `vite-hmr` or `vite-ping` subprotocol, so those and sockets on
 * any other path belong to the dev server.
 */
export function isDevServerUpgrade(req: IncomingMessage): boolean {
  const pathname = parsePathname(req.url);
  if (pathname === null) return false;
  if (pathname !== '/') return true;
  const protocols = String(req.headers['sec-websocket-protocol'] || '').split(',').map(p => p.trim());
  return protocols.includes('vite-hmr') || protocols.includes('vite-ping');
}

function rawResponseHead(statusLine: string, rawHeaders: string[]): string {
  const lines = [statusLine];
  for (let i = 0; i < rawHeaders.length; i += 2) lines.push(`${rawHeaders[i]}: ${rawHeaders[i + 1]}`);
  return lines.join('\r\n') + '\r\n\r\n';
}

/**
 * Proxy a WebSocket upgrade to the user's dev server and pipe both sockets
 * together. Without this the HMR socket reaches Glide's server, which drops it,
 * and Vite's client reloads the preview every time it reconnects.
 */
function proxyUpgradeToDevServer(
  targetPort: number,
  proxyPath: string,
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  openSockets: Set<Duplex>
): void {
  let proxyReq: ClientRequest | undefined;
  let upstream: Duplex | undefined;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    openSockets.delete(socket);
    proxyReq?.destroy();
    upstream?.destroy();
    socket.destroy();
  };
  openSockets.add(socket);
  socket.on('error', close);
  socket.on('close', close);

  const connect = (hostname: string) => {
    if (closed) return;
    proxyReq = httpRequest({
      hostname,
      port: targetPort,
      path: proxyPath,
      method: 'GET',
      headers: { ...req.headers, host: `${hostname}:${targetPort}` },
    });
    proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
      if (closed) { proxySocket.destroy(); return; }
      upstream = proxySocket;
      proxySocket.on('error', close);
      proxySocket.on('close', close);
      socket.write(rawResponseHead('HTTP/1.1 101 Switching Protocols', proxyRes.rawHeaders));
      if (proxyHead.length) socket.write(proxyHead);
      if (head.length) proxySocket.write(head);
      proxySocket.pipe(socket).pipe(proxySocket);
    });
    // The dev server refused the upgrade (bad token, unknown path): relay its answer
    // with explicit Content-Length (never forward Transfer-Encoding: chunked over de-chunked bytes).
    proxyReq.on('response', (proxyRes) => {
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      const maxRefusalBytes = 256 * 1024;
      proxyRes.on('error', close);
      proxyRes.on('aborted', close);
      proxyRes.on('data', (chunk: Buffer) => {
        if (totalBytes < maxRefusalBytes) {
          const remaining = maxRefusalBytes - totalBytes;
          chunks.push(chunk.length > remaining ? chunk.subarray(0, remaining) : chunk);
          totalBytes += chunk.length;
        }
      });
      proxyRes.on('end', () => {
        if (closed || socket.destroyed) return;
        const body = Buffer.concat(chunks);
        const filteredHeaders: string[] = [];
        for (let i = 0; i < proxyRes.rawHeaders.length; i += 2) {
          const name = proxyRes.rawHeaders[i];
          if (['transfer-encoding', 'content-length', 'connection'].includes(name.toLowerCase())) continue;
          filteredHeaders.push(name, proxyRes.rawHeaders[i + 1]);
        }
        filteredHeaders.push('Content-Length', String(body.length), 'Connection', 'close');
        socket.write(rawResponseHead(`HTTP/1.1 ${proxyRes.statusCode || 502} ${proxyRes.statusMessage || ''}`, filteredHeaders));
        if (body.length) socket.write(body);
        socket.end();
      });
    });
    proxyReq.on('error', (err: any) => {
      if (!closed && hostname === 'localhost' && (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND')) connect('127.0.0.1');
      else close();
    });
    proxyReq.end();
  };
  connect('localhost');
}

/**
 * Walk up from a file path to find the nearest directory containing a .git folder.
 * Throws if no Git repository exists for the project instead of falling back to process.cwd().
 */
function findGitRoot(startPath: string): string {
  let dir = fs.statSync(startPath).isDirectory() ? startPath : path.dirname(startPath);
  const root = path.parse(dir).root;
  while (true) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    if (dir === root) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('GIT_NOT_FOUND: No Git repository found for this project.');
}

function positiveCoord(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 1;
}



export interface EditChange extends MutationScope {
  type: 'style' | 'class' | 'text' | 'multi-class' | 'position' | 'layout' | 'group' | 'ungroup';
  layoutPosition?: string;
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

/** `127.0.0.1:5173` or `[::1]:5173`: a loopback address written as an IP, not as a name. */
function loopbackLiteral(host: string | undefined): boolean {
  return /^(127\.0\.0\.1|\[::1\]):\d+$/.test(host || '');
}

function normalizePathKey(filePath: string): string {
  let resolved = path.resolve(filePath);
  try { resolved = fs.realpathSync.native(resolved); } catch {}
  return resolved.replace(/\\/g, '/').toLowerCase();
}

/**
 * The editor saves text on every keystroke. Keystrokes in one word of one element share a key, so
 * history merges them into one undo step; the first letter of the next word starts a new step.
 */
export function typingStep(operations: MutationOperation[]): { squashKey?: string } {
  const [op] = operations;
  if (operations.length !== 1 || op.change?.type !== 'text' || typeof op.change.value !== 'string') return {};
  const words = op.change.value.trimEnd().split(/\s+/).length;
  return { squashKey: `text:${op.filePath}:${op.line}:${op.column}:${words}` };
}

export { isIgnoredWatchPath };

export class GlideServer {
  private sessionToken = randomBytes(32).toString('hex');
  private authenticated = new WeakSet<WebSocket>();
  /** Agents reach Glide over MCP with this token, written to a run file only the user can read. */
  private mcpToken = randomBytes(32).toString('hex');
  private editors = new Set<WebSocket>();
  private agentQueries = new Map<number, (result: any) => void>();
  private agentQuerySequence = 0;
  private wss: WebSocketServer | null = null;
  private server: Server | null = null;
  private port: number;
  private targetPort: number;
  private config: GlideConfig;
  private editCallbacks: EditCallback[] = [];
  private projectPaths: ProjectPaths;
  private mutations: MutationService;
  private history = new HistoryStore();
  private notifiedTransactions = new Set<string>();
  private fileGenerations = new Map<string, number>();
  private watcher: FSWatcher | null = null;
  private lastSelfWrites = new Map<string, string>();
  private proxiedSockets = new Set<Duplex>();
  /** Set by attach(): a dev server that serves Glide alongside the app, with no proxy. */
  private hosted: { httpServer: Server; onUpgrade?: (req: IncomingMessage, socket: Duplex, head: Buffer) => void; onListening?: () => void } | null = null;
  private requestHandler: ((req: IncomingMessage, res: ServerResponse, next?: () => void) => void) | null = null;
  private stopRegistry: (() => Promise<void>) | null = null;

  public recordSelfWrite(filePath: string, digest?: string) {
    const normPath = normalizePathKey(filePath);
    const recorded = digest ?? (fs.existsSync(filePath) ? contentDigest(fs.readFileSync(filePath, 'utf8')) : undefined);
    if (recorded !== undefined) this.lastSelfWrites.set(normPath, recorded);
    this.fileGenerations.set(normPath, (this.fileGenerations.get(normPath) || 0) + 1);
  }

  public broadcast(msg: string | object) {
    if (!this.wss || !this.wss.clients) return;
    const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN && this.authenticated.has(client)) {
        client.send(data);
      }
    }
  }

  constructor(port = 7777, targetPort = 5173, config: GlideConfig = DEFAULT_CONFIG, projectRoot = process.cwd()) {
    this.projectPaths = new ProjectPaths(projectRoot);
    this.mutations = new MutationService(this.projectPaths.root, {
      onPersist: (diffs, operations) => {
        if (!diffs.length) return;
        // Record precomputed digests synchronously before pushing history so no disk re-read can throw after commit.
        for (const diff of diffs) this.recordSelfWrite(diff.file, contentDigest(diff.after));
        this.history.push({ description: 'Apply source changes', diffs, ...typingStep(operations) });
      },
      onRestore: diffs => {
        for (const diff of diffs) this.recordSelfWrite(diff.file, contentDigest(diff.after));
      },
    });
    this.port = port;
    this.targetPort = targetPort;
    this.config = {
      ...config,
      port,
      targetPort
    };
  }

  /**
   * Serve Glide from an existing dev server instead of its own port: the editor at
   * /__glide/, its assets, and the editor socket at /__glide/ws. The dev server keeps
   * serving the app, so the preview loads it directly and its HMR socket is untouched.
   * Returns middleware for every other request to fall through.
   */
  public async attach(httpServer: Server): Promise<(req: IncomingMessage, res: ServerResponse, next: () => void) => void> {
    this.hosted = { httpServer };
    if (httpServer.listening) {
      this.writeMcpRunFile();
    } else {
      const onListening = () => { this.writeMcpRunFile(); };
      this.hosted.onListening = onListening;
      httpServer.once('listening', onListening);
    }
    try {
      await this.start();
    } catch (error) {
      if (this.hosted?.onListening) httpServer.off('listening', this.hosted.onListening);
      if (this.hosted?.onUpgrade) httpServer.off('upgrade', this.hosted.onUpgrade);
      this.hosted = null;
      throw error;
    }
    // The glide command writes the component registry itself; attached, nothing else would.
    this.stopRegistry = maintainRegistryFile(this.projectPaths.root, () => {});
    return (req, res, next) => this.requestHandler ? this.requestHandler(req, res, next) : next();
  }

  /**
   * Without remoteAccess, the editor answers only on the loopback IP (127.0.0.1 or [::1])
   * and the preview loads the app from "localhost" in both hosted and standalone modes.
   * The two are different origins, so scripts in the app cannot read the editor page or
   * its session token. A remoteAccess configuration names its own hosts and keeps one origin.
   */
  private isolated(): boolean {
    return !this.config.remoteAccess;
  }

  private mcpRunFile(): string {
    return path.join(this.projectPaths.root, 'node_modules', '.cache', 'glide', 'mcp.json');
  }

  /** Tells `glide mcp` where this server listens; readable only by the user, because it holds the token. */
  private writeMcpRunFile(): void {
    try {
      const file = this.mcpRunFile();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      // The address the server listens on: a dev server bound to `localhost` may listen on IPv6 only.
      const address = (this.hosted?.httpServer ?? this.server)?.address();
      const ip = address && typeof address === 'object' && !['::', '0.0.0.0'].includes(address.address) ? address.address : '127.0.0.1';
      const host = ip.includes(':') ? `[${ip}]` : ip;
      // An attached HTTPS dev server (a TLS server) answers https only.
      const scheme = this.hosted?.httpServer instanceof TlsServer ? 'https' : 'http';
      fs.writeFileSync(file, JSON.stringify({ url: `${scheme}://${host}:${this.servedPort()}/__glide/mcp`, token: this.mcpToken, pid: process.pid }), { mode: 0o600 });
    } catch (error) {
      console.warn('[Glide] Could not write the MCP run file:', error);
    }
  }

  /** The editor answers questions about the live page; the newest open editor is asked. */
  private askEditor(query: string): Promise<any> {
    const editor = [...this.editors].pop();
    if (!editor) return Promise.reject(new Error('NO_EDITOR: Open the Glide editor so the agent can see the live page.'));
    const id = ++this.agentQuerySequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.agentQueries.delete(id); reject(new Error('NO_EDITOR: The Glide editor did not answer.')); }, 5000);
      this.agentQueries.set(id, result => { clearTimeout(timer); resolve(result); });
      editor.send(JSON.stringify({ type: 'agent-query', id, query }));
    });
  }

  private async handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const send = (status: number, body?: unknown) => {
      res.writeHead(status, body === undefined ? {} : { 'Content-Type': 'application/json' });
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };
    // Agents are not browsers: any page that sends an Origin is refused, whatever its host.
    if (req.headers.origin !== undefined) return send(403, { error: 'Browser requests are not accepted.' });
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405); }
    const auth = Buffer.from(String(req.headers.authorization ?? ''));
    const expected = Buffer.from(`Bearer ${this.mcpToken}`);
    if (auth.length !== expected.length || !timingSafeEqual(auth, expected)) return send(401, { error: 'Missing or wrong MCP token. Use `glide mcp`.' });
    // Bytes first, decoded once: a character split across two chunks stays one character.
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += (chunk as Buffer).length;
      if (size > 1024 * 1024) return send(413);
      chunks.push(chunk as Buffer);
    }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
    // Presence: open editors show which tool the agent runs, and on which element.
    for (const item of (Array.isArray(body) ? body : [body]) as any[]) {
      if (item?.method === 'tools/call' && typeof item.params?.name === 'string') {
        this.broadcast({ type: 'agent-activity', tool: item.params.name, source: typeof item.params.arguments?.source === 'string' ? item.params.arguments.source : null });
      }
    }
    const reply = await handleMcp(body, { paths: this.projectPaths, mutations: this.mutations,
      entryFile: () => findProjectEntryFile(this.projectPaths.root), askEditor: query => this.askEditor(query),
      // The write is recorded as Glide's own, so the watcher stays quiet; tell open editors here instead.
      committed: file => { this.announceDrift(file); this.broadcast({ type: 'HISTORY_UPDATE', ...this.history.getState() }); } });
    if (reply === null) return send(202);
    send(200, reply);
  }

  /** A source file changed: bump its generation and send open editors the new elements, tree and digest. */
  private announceDrift(filePath: string): void {
    const normPath = normalizePathKey(filePath);
    // Clear stale self-write digest so a subsequent external revert back to that revision is never suppressed.
    this.lastSelfWrites.delete(normPath);
    this.fileGenerations.set(normPath, (this.fileGenerations.get(normPath) || 0) + 1);
    console.log(`[Glide] File drift detected on ${normPath}, bumping generation counter to ${this.fileGenerations.get(normPath)}`);

    // Bidirectional sync: parse JSX elements on drift and broadcast scene_update to overlay
    try {
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        if (['.tsx', '.jsx', '.js', '.ts'].includes(ext)) {
          const code = fs.readFileSync(filePath, 'utf-8');
          const elements = parseJSXElements(code, filePath);
          this.broadcast({
            type: 'scene_update',
            file: filePath,
            elements,
            generation: this.fileGenerations.get(normPath) || 0
          });

          // Proactively update component tree if valid
          try {
            const tree = buildComponentTree(code, filePath);
            this.broadcast({
              type: 'tree',
              file: filePath,
              tree,
              workspaceObjects: listWorkspaceObjects(code, filePath),
              digest: contentDigest(code),
              generation: this.fileGenerations.get(normPath) || 0
            });
          } catch {}
        }
      }
    } catch (err) {
      console.warn('[Glide] Failed to parse JSX elements on external drift:', err);
    }
  }

  private servedPort(): number {
    const address = (this.hosted?.httpServer ?? this.server)?.address();
    return address && typeof address === 'object' ? address.port : this.port;
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.history.setLimit(this.config.historyLimit);

        const stripCorsHeaders = (res: ServerResponse) => {
          res.removeHeader('Access-Control-Allow-Origin');
          res.removeHeader('Access-Control-Allow-Credentials');
          res.removeHeader('Access-Control-Allow-Headers');
          res.removeHeader('Access-Control-Allow-Methods');
          res.removeHeader('Access-Control-Expose-Headers');
        };
        const redirectAppToLocalhost = (req: IncomingMessage, res: ServerResponse, rawUrl: string, port: number) => {
          const scheme = (req.socket as { encrypted?: boolean }).encrypted ? 'https' : 'http';
          const safeUrl = rawUrl.startsWith('/') && !rawUrl.startsWith('//') ? rawUrl : '/';
          stripCorsHeaders(res);
          res.writeHead(302, { Location: `${scheme}://localhost:${port}${safeUrl}`, 'Cache-Control': 'no-store' });
          res.end();
        };

        this.requestHandler = (req, res, next) => {
          const url = req.url || '/';
          const pathname = parsePathname(url);
          if (pathname === null) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Bad Request');
            return;
          }
          const port = this.servedPort();
          // Attached, Glide answers only its own paths; the dev server handles the rest —
          // except on the loopback-IP editor origin, where app routes redirect to "localhost"
          // so app scripts can never execute inside the editor's origin and read sessionToken.
          if (this.hosted && next && !pathname.startsWith('/__glide/') && pathname !== '/__glide'
            && !pathname.startsWith('/__glide_assets__/')) {
            if (this.isolated() && loopbackLiteral(req.headers.host)) {
              redirectAppToLocalhost(req, res, url, port);
              return;
            }
            next();
            return;
          }
          if (this.hosted) {
            // Never inherit host dev-server CORS headers (Vite 8 runs corsMiddleware before
            // configureServer hooks) on Glide's editor, MCP, or asset routes.
            stripCorsHeaders(res);
          }
          // The MCP route checks for itself: no Origin (so no browser) and the run file's token. The bridge
          // uses the run file's loopback address, which a remoteAccess host list may not include.
          if (pathname === '/__glide/mcp') {
            this.handleMcpRequest(req, res).catch(error => {
              // An aborted upload leaves nothing to answer; anything else gets a 500 instead of a crash.
              if (!res.headersSent && !res.destroyed) { res.writeHead(500); res.end(); }
              if (!req.destroyed) console.warn('[Glide] MCP request failed:', error);
            });
            return;
          }
          if (!trustedRequest(req, port, this.config.remoteAccess)) {
            res.writeHead(403);
            res.end('Request origin or host is not allowed.');
            return;
          }
          if (pathname.startsWith('/__glide_assets__/')) {
            try {
              const asset = getEditorAsset(pathname);
              res.writeHead(asset ? 200 : 404, {
                'Content-Type': asset?.contentType || 'text/plain',
                'X-Content-Type-Options': 'nosniff',
              });
              res.end(asset?.body || 'Editor asset not found.');
            } catch {
              res.writeHead(500);
              res.end('Editor asset is missing. Reinstall Glide.');
            }
            return;
          }

          // ── Editor shell: '/' on Glide's own server, '/__glide/' when attached ──
          const shell = this.hosted ? ['/__glide', '/__glide/', '/__glide/index.html'] : ['/', '/index.html'];
          if (shell.includes(pathname)) {
            if (this.isolated() && !loopbackLiteral(req.headers.host)) {
              // Asked for by name ("localhost"): send the browser to the address this connection arrived on.
              const local = (req.socket.localAddress || '127.0.0.1').replace(/^::ffff:/, '');
              const address = local.includes(':') ? '[::1]' : '127.0.0.1';
              const scheme = (req.socket as { encrypted?: boolean }).encrypted ? 'https' : 'http';
              const targetPath = this.hosted ? '/__glide/' : '/';
              res.writeHead(302, { Location: `${scheme}://${address}:${port}${targetPath}`, 'Cache-Control': 'no-store' });
              res.end();
              return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'SAMEORIGIN', 'Cache-Control': 'no-store',
              'Cross-Origin-Resource-Policy': 'same-origin' });
            res.end(getEditorHTML(this.config, this.sessionToken, { hosted: !!this.hosted }));
            return;
          }
          if (this.hosted) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found.');
            return;
          }

          // Standalone mode: never serve proxied app content on the loopback-IP editor origin.
          if (this.isolated() && loopbackLiteral(req.headers.host)) {
            redirectAppToLocalhost(req, res, url, port);
            return;
          }

          // ── Proxy route: forward to user's dev server + inject bridge for HTML ──
          if (pathname === '/__glide_proxy__' || pathname.startsWith('/__glide_proxy__/')) {
            const proxyPath = stripProxyPrefix(url, pathname);
            const bridgeScript = buildGlideBridgeInlineScript(this.config);
            proxyToDevServer(this.targetPort, proxyPath, req, res, bridgeScript);
            return;
          }

          // ── Universal pass-through for all other assets/modules/APIs ─────
          // Any other URL requested by the browser/iframe (e.g. /_astro/..., /@id/..., /src/..., /api/...)
          // is forwarded directly to the dev server without bridge injection.
          proxyToDevServer(this.targetPort, url, req, res, '');
        };
        if (!this.hosted) this.server = createServer((req, res) => this.requestHandler!(req, res));


        // Start file watcher for drift detection
        const srcPath = this.projectPaths.root;
        this.watcher = chokidar.watch(srcPath, {
          persistent: true,
          followSymlinks: false,
          backend: 'auto',
          ignored: (filePath: string) => isIgnoredWatchPath(srcPath, filePath),
        });
        this.watcher.on('change', (filePath: string) => {
          const normPath = normalizePathKey(filePath);
          const lastWrite = this.lastSelfWrites.get(normPath);
          if (lastWrite) {
            try {
              if (fs.existsSync(filePath) && contentDigest(fs.readFileSync(filePath, 'utf8')) === lastWrite) {
                console.log(`[Glide] Ignoring self-write change event on ${normPath}`);
                return;
              }
            } catch {
              // File may be transiently locked (EBUSY/EPERM) or deleted between event and read.
              return;
            }
          }
          this.announceDrift(filePath);
        });
        this.watcher.on('error', (err: any) => {
          console.error('[Glide Watcher] Watcher error:', err);
        });

        if (this.hosted) {
          // Share the dev server: take upgrades on /__glide/ws only, leaving its HMR socket alone.
          const wss = this.wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
          this.hosted.onUpgrade = (req, socket, head) => {
            const pathname = parsePathname(req.url);
            if (pathname === null) { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); return; }
            if (pathname !== '/__glide/ws') return;
            if (!trustedRequest(req, this.servedPort(), this.config.remoteAccess)) { socket.destroy(); return; }
            // The app's origin ("localhost") gets no editor socket, even with a token.
            if (this.isolated() && !loopbackLiteral(req.headers.host)) { socket.destroy(); return; }
            wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
          };
          this.hosted.httpServer.on('upgrade', this.hosted.onUpgrade);
        } else {
          this.wss = new WebSocketServer({
            noServer: true, maxPayload: 256 * 1024,
            verifyClient: (info: { req: IncomingMessage }) => trustedRequest(info.req, this.servedPort(), this.config.remoteAccess),
          });
          // ── WebSocket routing: the editor's socket, or the dev server's (HMR) ──
          this.server!.on('upgrade', (req, socket, head) => {
            const pathname = parsePathname(req.url);
            if (pathname === null) {
              socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
              return;
            }
            if (!isDevServerUpgrade(req)) {
              // The app's origin ("localhost") gets no editor socket, even with a token.
              if (this.isolated() && !loopbackLiteral(req.headers.host)) { socket.destroy(); return; }
              this.wss?.handleUpgrade(req, socket, head, ws => this.wss?.emit('connection', ws, req));
              return;
            }
            if (!trustedRequest(req, this.servedPort(), this.config.remoteAccess)) {
              socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
              return;
            }
            const url = req.url || '/';
            const proxyPath = stripProxyPrefix(url, pathname);
            proxyUpgradeToDevServer(this.targetPort, proxyPath, req, socket, head, this.proxiedSockets);
          });
        }

        this.wss.on('connection', (ws: WebSocket) => {
          ws.on('error', (err) => {
            console.error('[Glide WS] Client connection error:', err);
          });
          const timer = setTimeout(() => { if (!this.authenticated.has(ws)) ws.close(1008, 'Session handshake required.'); }, 5000);
          timer.unref();
          ws.on('close', () => clearTimeout(timer));


          ws.on('message', async (data: string) => {
            try {
              const message = JSON.parse(data);
              validateMessage(message);
              if (!this.authenticated.has(ws)) {
                const token = typeof message.token === 'string' ? Buffer.from(message.token) : Buffer.alloc(0);
                const expected = Buffer.from(this.sessionToken);
                if (message.type !== 'hello' || token.length !== expected.length || !timingSafeEqual(token, expected)) {
                  ws.send(JSON.stringify({ type: 'status', success: false, error: 'UNAUTHORIZED: Session handshake required.' }));
                  ws.close(1008, 'Session handshake required.');
                  return;
                }
                this.authenticated.add(ws);
                this.editors.add(ws);
                ws.on('close', () => this.editors.delete(ws));
                clearTimeout(timer);
                // The editor writes inline styles by default when the project cannot render a Tailwind class.
                ws.send(JSON.stringify({ type: 'authenticated', success: true, tailwind: loadTailwindTheme(this.projectPaths.root).version !== null }));
                return;
              }

              if (['edit', 'batch-edit', 'insert', 'reorder', 'reparent', 'group', 'ungroup', 'arrange'].includes(message.type)) {
                await this.handleSourceMutation(ws, message);
                return;
              }

              if (message.type === 'agent-query-result') {
                this.agentQueries.get(message.id)?.(message.result);
                this.agentQueries.delete(message.id);
                return;
              }

              if (message.type === 'list-routes') {
                ws.send(JSON.stringify({ type: 'routes', routes: listRoutes(this.projectPaths.root) }));
                return;
              }

              if (message.type === 'get-tree') {
                const requestedFile = message.file;
                let file: string | null = null;
                try { file = this.projectPaths.sourceFile(requestedFile || findProjectEntryFile(this.projectPaths.root)!); } catch {}
                if (file) {
                  const code = fs.readFileSync(file, 'utf-8');
                  const tree = buildComponentTree(code, file);
                  const normPath = normalizePathKey(file);
                  ws.send(JSON.stringify({
                    type: 'tree',
                    file,
                    requestedFile,
                    tree,
                    workspaceObjects: /\.[jt]sx?$/.test(file) ? listWorkspaceObjects(code, file) : [],
                    digest: contentDigest(code),
                    generation: this.fileGenerations.get(normPath) || 0
                  }));
                } else {
                  ws.send(JSON.stringify({
                    type: 'tree',
                    file: requestedFile || null,
                    tree: null,
                    error: `Invalid or unaccessible file: ${requestedFile}`
                  }));
                }
                return;
              }

              if (message.type === 'inspect-props') {
                try {
                  const file = this.projectPaths.sourceFile(message.file);
                  if (!/\.[jt]sx?$/.test(file)) throw new Error('UNSUPPORTED_ADAPTER: Property editing currently requires JSX or TSX.');
                  const code = fs.readFileSync(file, 'utf8');
                  if (!message.expectedDigest || contentDigest(code) !== message.expectedDigest) throw new Error('STALE_DIGEST: Reload the source tree and select the authored layer again.');
                  ws.send(JSON.stringify({ type: 'source-props', requestId: message.requestId, file: message.file,
                    line: message.line, column: message.column, digest: contentDigest(code), success: true,
                    ...inspectJSXProps(code, message.line, message.column) }));
                } catch (error: any) {
                  ws.send(JSON.stringify({ type: 'source-props', requestId: message.requestId, success: false, error: error.message }));
                }
                return;
              }

              // levels[0] is the selected element; each later level is where the component around it is used.
              if (message.type === 'inspect-scopes') {
                try {
                  const levels: any[] = Array.isArray(message.levels) ? message.levels.slice(0, 8) : [];
                  if (levels.length < 2 || levels.some(level => typeof level?.file !== 'string'
                    || !Number.isInteger(level.line) || !Number.isInteger(level.column))) {
                    throw new Error('INVALID_MESSAGE: Edit scopes need the element and at least one component usage.');
                  }
                  const codes = new Map<string, string>();
                  const read = (requested: string) => {
                    if (!codes.has(requested)) {
                      const file = this.projectPaths.sourceFile(requested);
                      if (!/\.[jt]sx?$/.test(file)) throw new Error('UNSUPPORTED_ADAPTER: Edit scopes currently require JSX or TSX.');
                      codes.set(requested, fs.readFileSync(file, 'utf8'));
                    }
                    return codes.get(requested)!;
                  };
                  // A usage edit reaches the element only if every level below it passes className on.
                  const forwards = levels.slice(0, -1).map(level => forwardsClassName(read(level.file), level.line, level.column));
                  const props = levels[1].props && typeof levels[1].props === 'object' ? levels[1].props : {};
                  const variants = activeVariants(read(levels[0].file), levels[0].line, levels[0].column, props);
                  levels.forEach(level => read(level.file));
                  ws.send(JSON.stringify({ type: 'edit-scopes', requestId: message.requestId, success: true, forwards, variants,
                    files: [...codes].map(([file, code]) => ({ file, digest: contentDigest(code) })) }));
                } catch (error: any) {
                  ws.send(JSON.stringify({ type: 'edit-scopes', requestId: message.requestId, success: false, error: error.message }));
                }
                return;
              }

              if (message.type === 'resolve_component') {
                let { file, componentName, openInEditor: shouldOpen } = message;
                if (!componentName) {
                  ws.send(JSON.stringify({
                    type: 'resolved_component',
                    success: false,
                    componentName: '',
                    error: 'componentName is required'
                  }));
                  return;
                }
                if (!file) {
                  file = findProjectEntryFile(this.projectPaths.root);
                }
                let targetFile: string | null = null;
                if (typeof file === 'string' && file) {
                  try { targetFile = this.projectPaths.resolve(file); } catch { targetFile = null; }
                }

                if (targetFile) {
                  try {
                    const def = resolveComponentDefinition({
                      filepath: targetFile,
                      componentName,
                      projectRoot: this.projectPaths.root
                    });

                    if (def) {
                      let safeDefFile: string;
                      try {
                        safeDefFile = this.projectPaths.resolve(def.file);
                      } catch {
                        ws.send(JSON.stringify({
                          type: 'resolved_component',
                          success: false,
                          componentName,
                          error: `Resolved definition for <${componentName}> is outside the project`
                        }));
                        return;
                      }
                      const defLine = positiveCoord(def.line);
                      const defColumn = positiveCoord(def.column);
                      let opened = false;
                      if (shouldOpen) {
                        try {
                          await execFileAsync('code', ['-g', `${safeDefFile}:${defLine}:${defColumn}`], { timeout: 3000 });
                          opened = true;
                        } catch {
                          try {
                            await execFileAsync('cursor', ['-g', `${safeDefFile}:${defLine}:${defColumn}`], { timeout: 3000 });
                            opened = true;
                          } catch {}
                        }
                      }

                      ws.send(JSON.stringify({
                        type: 'resolved_component',
                        success: true,
                        componentName,
                        file: safeDefFile,
                        line: defLine,
                        column: defColumn,
                        isLocal: def.isLocal,
                        exportType: def.exportType,
                        opened
                      }));
                    } else {
                      ws.send(JSON.stringify({
                        type: 'resolved_component',
                        success: false,
                        componentName,
                        error: `Could not resolve definition for component <${componentName}>`
                      }));
                    }
                  } catch (err: any) {
                    ws.send(JSON.stringify({
                      type: 'resolved_component',
                      success: false,
                      componentName,
                      error: err.message
                    }));
                  }
                } else {
                  // Fallback without targetFile: try resolving in default entry file inside this.projectPaths.root
                  try {
                    const candidateEntry = findProjectEntryFile(this.projectPaths.root) || path.join(this.projectPaths.root, 'src', 'App.tsx');
                    const safeEntry = this.projectPaths.resolve(candidateEntry);
                    const def = resolveComponentDefinition({
                      filepath: safeEntry,
                      componentName,
                      projectRoot: this.projectPaths.root
                    });
                    if (def) {
                      const safeDefFile = this.projectPaths.resolve(def.file);
                      ws.send(JSON.stringify({
                        type: 'resolved_component',
                        success: true,
                        componentName,
                        file: safeDefFile,
                        line: positiveCoord(def.line),
                        column: positiveCoord(def.column),
                        isLocal: def.isLocal,
                        exportType: def.exportType,
                        opened: false
                      }));
                      return;
                    }
                  } catch {}

                  ws.send(JSON.stringify({
                    type: 'resolved_component',
                    success: false,
                    componentName,
                    error: `File not found or unsafe: ${file}`
                  }));
                }
                return;
              }

              if (message.type === 'open_component') {
                const { file, line, column } = message;
                let targetFile: string | null = null;
                if (typeof file === 'string' && file) {
                  try { targetFile = this.projectPaths.resolve(file); } catch { targetFile = null; }
                }

                if (targetFile) {
                  const safeLine = positiveCoord(line);
                  const safeColumn = positiveCoord(column);
                  let opened = false;
                  try {
                    await execFileAsync('code', ['-g', `${targetFile}:${safeLine}:${safeColumn}`], { timeout: 3000 });
                    opened = true;
                  } catch {
                    try {
                      await execFileAsync('cursor', ['-g', `${targetFile}:${safeLine}:${safeColumn}`], { timeout: 3000 });
                      opened = true;
                    } catch {}
                  }

                  ws.send(JSON.stringify({
                    type: 'open_component_status',
                    success: true,
                    file: targetFile,
                    line: safeLine,
                    column: safeColumn,
                    opened
                  }));
                } else {
                  ws.send(JSON.stringify({
                    type: 'open_component_status',
                    success: false,
                    error: `File not found or unsafe path: ${file}`
                  }));
                }
                return;
              }

              if (message.type === 'git-branch-create') {
                const { branchName, projectDir } = message;
                if (!branchName || typeof branchName !== 'string' || !/^[a-zA-Z0-9_/-]+$/.test(branchName)) {
                  ws.send(JSON.stringify({
                    type: 'git-status',
                    success: false,
                    error: 'Invalid branch name format',
                    action: 'create'
                  }));
                  return;
                }
                try {
                  const startDir = typeof projectDir === 'string' && projectDir
                    ? this.projectPaths.resolve(projectDir)
                    : this.projectPaths.root;
                  const cwd = findGitRoot(startDir);
                  console.log(`[Glide] Creating and checking out git branch: ${branchName} in ${cwd}`);
                  await execFileAsync('git', ['checkout', '-b', branchName], { cwd });
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
                const { commitMessage } = message;
                if (!commitMessage || typeof commitMessage !== 'string') {
                  ws.send(JSON.stringify({
                    type: 'git-status',
                    success: false,
                    error: 'Invalid commit message',
                    action: 'finalize'
                  }));
                  return;
                }
                console.log(`[Glide] Finalizing git branch with commit: "${commitMessage}" in ${this.projectPaths.root}`);
                try {
                  const state = this.history.getState();
                  finalizeEditorChanges(this.projectPaths.root,
                    state.stack.slice(0, state.currentIndex + 1).flatMap(entry => entry.diffs), commitMessage);
                  this.history.clear();
                  ws.send(JSON.stringify({ type: 'HISTORY_UPDATE', ...this.history.getState() }));
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

              // The address field of the editor names the dev server. Only the port can change:
              // the proxy always connects to this machine.
              if (message.type === 'set-target-port') {
                const port = message.port;
                const valid = !this.hosted && Number.isInteger(port) && port >= 1 && port <= 65535 && port !== this.servedPort();
                if (valid) {
                  this.targetPort = port;
                  this.config = { ...this.config, targetPort: port };
                  console.log(`[Glide] Preview now shows the dev server on port ${port}`);
                }
                ws.send(JSON.stringify({ type: 'target-port', success: valid, port: this.targetPort,
                  ...(valid ? {} : { error: 'INVALID_OPERATION: Give a port from 1 to 65535 that is not the editor port.' }) }));
                return;
              }

              if (['undo', 'UNDO', 'redo', 'REDO', 'JUMP_TO_HISTORY'].includes(message.type)) {
                const transactionId = message.transactionId || randomUUID();
                if (message.type === 'JUMP_TO_HISTORY' && !Number.isInteger(message.index)) {
                  ws.send(JSON.stringify({
                    type: 'status',
                    action: message.index,
                    transactionId,
                    success: false,
                    error: 'INVALID_HISTORY: JUMP_TO_HISTORY requires an integer index.',
                  }));
                  return;
                }
                const action = message.type === 'JUMP_TO_HISTORY' ? message.index : message.type.toLowerCase();
                try {
                  const result = await this.mutations.restoreHistory(
                    transactionId, this.history, action
                  );
                  if (result.success) {
                    ws.send(JSON.stringify({ type: 'HISTORY_UPDATE', ...this.history.getState() }));
                  }
                  ws.send(JSON.stringify({ type: 'status', action, ...result }));
                } catch (err: any) {
                  ws.send(JSON.stringify({ type: 'status', action, transactionId, success: false, error: err.message }));
                }
                return;
              }

              if (message.type === 'GET_HISTORY') {
                ws.send(JSON.stringify({
                  type: 'HISTORY_UPDATE',
                  ...this.history.getState()
                }));
                return;
              }

              ws.send(JSON.stringify({
                type: 'status',
                success: false,
                error: `Unsupported message type: ${message.type}`,
              }));
            } catch (err: any) {
              console.error('[Glide] WebSocket handler error:', err);
              ws.send(
                JSON.stringify({
                  type: 'status',
                  success: false,
                  // Only a parse failure is malformed JSON; other failures keep their own reason.
                  error: err instanceof SyntaxError ? `Malformed JSON: ${err.message}` : String(err?.message ?? err),
                })
              );
            }
          });
        });

        let settled = false;
        const cleanupFailedStart = async (err: unknown) => {
          if (settled) return;
          settled = true;
          this.requestHandler = null;
          if (this.watcher) {
            const w = this.watcher;
            this.watcher = null;
            try { await w.close(); } catch {}
          }
          if (this.wss) {
            const wss = this.wss;
            this.wss = null;
            await new Promise<void>(done => wss.close(() => done()));
          }
          this.server = null;
          reject(err);
        };

        this.wss.on('error', (err) => {
          void cleanupFailedStart(err);
        });

        if (this.hosted) {
          settled = true;
          resolve();
          return;
        }
        this.server!.on('error', (err) => {
          console.error('[Glide HTTP] Server error:', err);
          // A listen failure such as EADDRINUSE; close watcher and WS server before rejecting.
          void cleanupFailedStart(err);
        });

        this.server!.listen(this.port, this.config.remoteAccess?.bindAddress ?? '127.0.0.1', () => {
          settled = true;
          this.writeMcpRunFile();
          resolve();
        });
      } catch (err) {
        this.requestHandler = null;
        if (this.watcher) { const w = this.watcher; this.watcher = null; void w.close().catch(() => {}); }
        if (this.wss) { const wss = this.wss; this.wss = null; try { wss.close(); } catch {} }
        this.server = null;
        reject(err);
      }
    });
  }

  public async stop(): Promise<void> {
    this.requestHandler = null;
    try { fs.rmSync(this.mcpRunFile(), { force: true }); } catch {}
    // An attached dev server belongs to its owner; only stop listening for Glide's events on it.
    if (this.hosted?.onUpgrade) this.hosted.httpServer.off('upgrade', this.hosted.onUpgrade);
    if (this.hosted?.onListening) this.hosted.httpServer.off('listening', this.hosted.onListening);
    this.hosted = null;
    if (this.stopRegistry) {
      try { await this.stopRegistry(); } catch (err) { console.error('[Glide] Error closing registry watcher:', err); }
      this.stopRegistry = null;
    }
    if (this.watcher) {
      try {
        await this.watcher.close();
      } catch (err) {
        console.error('[Glide Watcher] Error closing watcher:', err);
      }
      this.watcher = null;
    }
    // Proxied dev server sockets would keep the HTTP server from closing.
    for (const socket of this.proxiedSockets) socket.destroy();
    this.proxiedSockets.clear();
    return new Promise((resolve, reject) => {
      if (this.wss) {
        if (this.wss.clients) {
          for (const client of this.wss.clients) {
            try {
              client.terminate();
            } catch {}
          }
        }
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
      const server = this.server;
      server.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.server = null;
          resolve();
        }
      });
      server.closeAllConnections?.();
    } else {
      resolve();
    }
  }


  private async handleSourceMutation(ws: WebSocket, message: any): Promise<void> {
    const transactionId = message.batchId || message.transactionId;
    let edits: any[];
    if (message.type === 'batch-edit') {
      if (!Array.isArray(message.edits) || !message.edits.length) {
        ws.send(JSON.stringify({ type: 'status', action: message.type, transactionId, success: false, error: 'Empty or invalid batch-edit payload' }));
        return;
      }
      edits = message.edits;
    } else if (message.type === 'edit') {
      edits = [message];
    } else {
      const target = message.type === 'insert' ? message.parentId
        : message.type === 'group' ? message.selectedIds?.[0]
        : message.sourceId || message.targetId || message.groupId;
      const local = typeof target === 'string' && target.match(/^line:(\d+):col:(\d+)(?::([a-fA-F0-9]+))?$/);
      const match = local || (typeof target === 'string' && target.match(/^.*?:(\d+):(\d+)(?::([a-fA-F0-9]+))?$/));
      edits = [{ ...message, line: match ? Number(match[1]) : 0, column: match ? Number(match[2]) + (local ? 1 : 0) : 0,
        hash: match ? match[3] : undefined, change: { ...message, source: target, parentId: message.newParentId || message.parentId, sources: message.selectedIds } }];
    }
    const operations: MutationOperation[] = edits.map((item, index) => ({
      operationId: item?.operationId || `${transactionId}:${index}`, filePath: item?.file,
      expectedDigest: item?.expectedDigest, line: item?.line, column: item?.column,
      hash: item?.hash, breakpoint: item?.breakpoint, pseudoState: item?.pseudoState,
      authoringRepresentation: item?.authoringRepresentation,
      change: { ...item?.change, breakpoint: item?.breakpoint ?? item?.change?.breakpoint,
        pseudoState: item?.pseudoState ?? item?.change?.pseudoState,
        authoringRepresentation: item?.authoringRepresentation ?? item?.change?.authoringRepresentation },
    }));
    const result = await this.mutations.execute(transactionId, operations);
    if (result.success && !this.notifiedTransactions.has(transactionId)) {
      this.notifiedTransactions.add(transactionId);
      if (this.notifiedTransactions.size > 200) this.notifiedTransactions.delete(this.notifiedTransactions.values().next().value!);
      for (const op of operations) for (const callback of this.editCallbacks) {
        // Observers run after persistence and cannot turn a committed result into a failure.
        try { await callback(op.filePath, op.line, op.column, op.change as EditChange, op.hash); }
        catch (error) { console.warn('[Glide] Post-commit observer failed:', error); }
      }
    }
    ws.send(JSON.stringify({ type: 'status', action: message.type, ...result,
      count: result.success ? result.operationResults.length : 0 }));
    if (result.success) ws.send(JSON.stringify({ type: 'HISTORY_UPDATE', ...this.history.getState() }));
  }

  /** Observe persisted edits. Callbacks must not perform source writes. */
  public onEdit(callback: EditCallback): void {
    this.editCallbacks.push(callback);
  }
}
