import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { buildComponentTree, detectProjectMeta, listRoutes, loadTailwindTheme, MCP_TOOLS, MCP_INSTRUCTIONS, MCP_PROTOCOLS } from '@srivarsank/core';
import type { ComponentTreeNode } from '@srivarsank/core';
import { contentDigest, type MutationService } from './mutation-service.js';
import type { ProjectPaths } from './project-paths.js';

/** What the MCP tools need from the running Glide server. */
export interface McpContext {
  paths: ProjectPaths;
  mutations: MutationService;
  entryFile(): string | null;
  /** Asks the open editor a question; rejects when no editor is connected. */
  askEditor(query: string): Promise<any>;
  /** Called after an edit is saved, so an open editor can reload what changed. */
  committed?(file: string): void;
}


/** The installed Glide version, from the nearest Glide package.json (the layout differs between the workspace and npm). */
function glideVersion(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 6; depth++, dir = path.dirname(dir)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      if (pkg.name === '@srivarsank/glide' || pkg.name === '@srivarsank/server') return String(pkg.version);
    } catch {}
  }
  return '0.0.0';
}
type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: any };

/** One JSON-RPC message or batch in, the response out (null when only notifications came in). */
export async function handleMcp(body: unknown, ctx: McpContext): Promise<unknown> {
  if (Array.isArray(body)) {
    const replies = (await Promise.all(body.map(item => answer(item, ctx)))).filter(reply => reply !== null);
    return replies.length ? replies : null;
  }
  return answer(body, ctx);
}

async function answer(message: unknown, ctx: McpContext): Promise<unknown> {
  const rpc = (message && typeof message === 'object' ? message : {}) as Rpc;
  if (rpc.id === undefined || rpc.id === null) return null; // a notification needs no reply
  const reply = (result: unknown) => ({ jsonrpc: '2.0', id: rpc.id, result });
  const fail = (code: number, text: string) => ({ jsonrpc: '2.0', id: rpc.id, error: { code, message: text } });
  switch (rpc.method) {
    case 'initialize': {
      const asked = rpc.params?.protocolVersion;
      return reply({ protocolVersion: MCP_PROTOCOLS.includes(asked) ? asked : MCP_PROTOCOLS[0], capabilities: { tools: {} },
        serverInfo: { name: 'glide', version: glideVersion() }, instructions: MCP_INSTRUCTIONS });
    }
    case 'ping': return reply({});
    case 'tools/list': return reply({ tools: MCP_TOOLS });
    case 'tools/call': {
      try {
        const data = await callTool(String(rpc.params?.name), rpc.params?.arguments ?? {}, ctx);
        return reply({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
      } catch (error: any) {
        // Tool errors go back to the agent as results it can read and act on.
        return reply({ content: [{ type: 'text', text: String(error?.message ?? error) }], isError: true });
      }
    }
    default: return fail(-32601, `Method not found: ${rpc.method}`);
  }
}

/** `file:line:column` (columns from one) or the editor's `line:L:col:C` form. */
export function parseReference(reference: unknown): { file: string; line: number; column: number } {
  const match = typeof reference === 'string' && reference.match(/^(.*):(\d+):(\d+)(?::[a-fA-F0-9]+)?$/);
  if (!match || !match[1]) throw new Error('INVALID_TARGET: Pass a source reference such as src/App.tsx:12:5.');
  return { file: match[1], line: Number(match[2]), column: Number(match[3]) };
}

async function callTool(name: string, args: any, ctx: McpContext): Promise<unknown> {
  const root = ctx.paths.root;
  const relative = (file: string) => path.relative(root, file).split(path.sep).join('/');
  const read = (file: string) => { const full = ctx.paths.sourceFile(file); return { full, code: fs.readFileSync(full, 'utf8') }; };
  switch (name) {
    case 'get_project_info': {
      const meta = detectProjectMeta(root);
      const entry = ctx.entryFile();
      return { framework: meta.framework, metaFramework: meta.metaFramework, tailwind: loadTailwindTheme(root).version,
        entryFile: entry ? relative(entry) : null, routes: listRoutes(root) };
    }
    case 'get_selection': return ctx.askEditor('selection');
    case 'get_tree': {
      const { full, code } = read(String(args.file ?? ''));
      const file = relative(full);
      // The tree names JSX elements by `line:L:col:C`; agents get references they can pass back.
      const visit = (node: ComponentTreeNode): unknown => {
        const local = node.id.match(/^line:(\d+):col:(\d+)/);
        return { name: node.name, source: local ? `${file}:${local[1]}:${Number(local[2]) + 1}` : node.id,
          ...(node.className ? { className: node.className } : {}), ...(node.text ? { text: node.text } : {}),
          ...(node.children.length ? { children: node.children.map(visit) } : {}) };
      };
      return { file, digest: contentDigest(code), elements: buildComponentTree(code, full).map(visit) };
    }
    case 'get_source': {
      const ref = parseReference(args.source);
      const { full, code } = read(ref.file);
      let element: t.JSXElement | undefined;
      if (/\.[jt]sx?$/.test(full)) {
        t.traverseFast(parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] }), node => {
          if (!element && t.isJSXElement(node) && node.loc?.start.line === ref.line && node.loc.start.column + 1 === ref.column) element = node;
        });
        if (!element) throw new Error(`INVALID_TARGET: No element starts at ${ref.line}:${ref.column} in ${relative(full)}.`);
      }
      // shortcut: templates (Vue, Svelte, Astro, HTML) get the lines from the element on, until template parsing is shared here.
      const text = element ? code.slice(element.start!, element.end!) : code.split('\n').slice(ref.line - 1, ref.line + 19).join('\n');
      return { source: `${relative(full)}:${ref.line}:${ref.column}`, digest: contentDigest(code), code: text,
        ...(element ? {} : { excerpt: { fromLine: ref.line, toLine: ref.line + text.split('\n').length - 1 } }) };
    }
    case 'update_styles': case 'set_text': case 'delete_element': {
      const ref = parseReference(args.source);
      const { full, code } = read(ref.file);
      const theme = loadTailwindTheme(root);
      if (name === 'set_text' && typeof args.text !== 'string') throw new Error('INVALID_OPERATION: text is a string; pass "" to empty the element.');
      const change = name === 'set_text' ? { type: 'text', value: args.text }
        : name === 'delete_element' ? { type: 'delete' }
        : { type: 'multi-class', value: args.styles ?? {}, breakpoint: args.breakpoint || undefined, pseudoState: args.state || undefined,
          // The project's own format: Tailwind classes when it has a Tailwind theme, inline styles otherwise.
          authoringRepresentation: theme.version !== null ? 'tailwind' : 'inline' };
      if (name === 'update_styles' && (typeof args.styles !== 'object' || Array.isArray(args.styles) || !args.styles)) throw new Error('INVALID_OPERATION: styles is an object of CSS properties.');
      const result = await ctx.mutations.execute(`mcp-${Date.now()}-${Math.random().toString(36).slice(2)}`, [{
        operationId: 'mcp', filePath: relative(full), expectedDigest: typeof args.expectedDigest === 'string' ? args.expectedDigest : contentDigest(code),
        line: ref.line, column: ref.column, change: change as any }]);
      if (!result.success) {
        const hint = /STALE/.test(result.error ?? '') ? ' Read the element again with get_source and retry.' : '';
        throw new Error((result.error ?? 'The edit was refused.') + hint);
      }
      ctx.committed?.(full);
      // Line numbers after the element may have moved; get_tree or get_source gives the new references.
      return { ok: true, digest: result.changedFiles[0]?.newDigest };
    }
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
