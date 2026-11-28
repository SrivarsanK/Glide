import { afterEach, describe, expect, test } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PassThrough } from 'node:stream';
import { isDirectExecution, getSkillsSourceDir } from '../../packages/cli/src/index.js';
import { forwardMcp, installMcpConfig, isTlsCertificateError, parseMcpArgs, serveMcpStdio } from '../../packages/cli/src/mcp.js';
import { isStandaloneSkillCommand, parseValidPort, resolveCliPorts } from '../../packages/cli/src/start.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function tempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-cli-test-'));
  roots.push(dir);
  return dir;
}

describe('CLI entry, ESM installer, MCP bridge, and startup validation', () => {
  test('importing cli/src/index does not execute server startup and installer avoids __dirname', () => {
    expect(isDirectExecution(import.meta.url, undefined)).toBe(false);
    expect(fs.existsSync(path.join(getSkillsSourceDir(), 'glide', 'SKILL.md'))).toBe(true);
    const installerSrc = fs.readFileSync(path.resolve('packages/cli/src/installer.ts'), 'utf8');
    expect(installerSrc).not.toContain('__dirname');
  });

  test('parseMcpArgs handles --project before or after install and validates missing flag values', () => {
    const base = tempProject();
    const before = parseMcpArgs(['mcp', '--project', 'sub', 'install', '--agent', 'cursor'], base);
    expect(before).toEqual({ project: path.resolve(base, 'sub'), subcommand: 'install', agent: 'cursor' });
    const after = parseMcpArgs(['mcp', 'install', '--project', 'sub'], base);
    expect(after).toEqual({ project: path.resolve(base, 'sub'), subcommand: 'install', agent: 'claude' });
    expect(parseMcpArgs(['mcp', '--project'], base).error).toMatch(/Missing path/);
    expect(parseMcpArgs(['mcp', 'install', '--agent'], base).error).toMatch(/Missing agent/);
  });

  test('forwardMcp falls back to offline mode on stale HTTPS ECONNREFUSED and only reports TLS on cert errors', async () => {
    const project = tempProject();
    const runFile = path.join(project, 'node_modules', '.cache', 'glide', 'mcp.json');
    fs.mkdirSync(path.dirname(runFile), { recursive: true });
    fs.writeFileSync(runFile, JSON.stringify({ url: 'https://127.0.0.1:59999/__glide/mcp', token: 'tok' }));

    const connRefusedErr = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
    });
    expect(isTlsCertificateError(connRefusedErr)).toBe(false);
    const offlineReply: any = await forwardMcp(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      project,
      (async () => { throw connRefusedErr; }) as any
    );
    expect(offlineReply.result?.tools?.length).toBeGreaterThan(0);

    const tlsErr = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('self signed cert'), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' }),
    });
    expect(isTlsCertificateError(tlsErr)).toBe(true);
    const tlsReply: any = await forwardMcp(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      project,
      (async () => { throw tlsErr; }) as any
    );
    expect(tlsReply.error?.message).toMatch(/NODE_EXTRA_CA_CERTS/);
  });

  test('installMcpConfig refuses non-object mcpServers/servers fields without overwriting the file', () => {
    const project = tempProject();
    const mcpFile = path.join(project, '.mcp.json');
    const badContent = JSON.stringify({ mcpServers: ['bad'] }, null, 2);
    fs.writeFileSync(mcpFile, badContent);
    expect(installMcpConfig(project, 'claude')).toBe(false);
    expect(fs.readFileSync(mcpFile, 'utf8')).toBe(badContent);

    fs.writeFileSync(mcpFile, JSON.stringify({ mcpServers: { other: { command: 'x' } } }, null, 2));
    expect(installMcpConfig(project, 'claude')).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(mcpFile, 'utf8'));
    expect(parsed.mcpServers.other).toEqual({ command: 'x' });
    expect(parsed.mcpServers.glide).toBeDefined();
  });

  test('serveMcpStdio serializes concurrent piped JSON-RPC lines in request order', async () => {
    const project = tempProject();
    const runFile = path.join(project, 'node_modules', '.cache', 'glide', 'mcp.json');
    fs.mkdirSync(path.dirname(runFile), { recursive: true });
    fs.writeFileSync(runFile, JSON.stringify({ url: 'http://127.0.0.1:1/__glide/mcp', token: 'tok' }));

    const input = new PassThrough();
    const written: string[] = [];
    const output = { write: (chunk: string) => { written.push(chunk); return true; } };
    let inFlight = 0;
    let maxInFlight = 0;
    const fakeFetch = (async (_url: string, init: any) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const req = JSON.parse(init.body);
      // Make request 1 slower than request 2 to prove strict serialization.
      await new Promise(resolve => setTimeout(resolve, req.id === 1 ? 40 : 5));
      inFlight--;
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: req.id, result: { ok: req.id } }), { status: 200 });
    }) as any;

    const done = serveMcpStdio(project, input, output as any, fakeFetch);
    input.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) + '\n');
    input.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' }) + '\n');
    input.end();
    await done;

    expect(maxInFlight).toBe(1);
    expect(written.map(line => JSON.parse(line).id)).toEqual([1, 2]);
  });

  test('start helpers recognize -i/--init and reject invalid or self-proxying ports', () => {
    expect(isStandaloneSkillCommand(['node', 'glide', '-i'])).toBe(true);
    expect(isStandaloneSkillCommand(['node', 'glide', '--init'])).toBe(true);
    expect(isStandaloneSkillCommand(['node', 'glide', 'install-skills'])).toBe(true);
    expect(isStandaloneSkillCommand(['node', 'glide', '5173'])).toBe(false);

    expect(parseValidPort('5173', 'port')).toBe(5173);
    expect(() => parseValidPort('0', 'port')).toThrow(/between 1 and 65535/);
    expect(() => parseValidPort('70000', 'port')).toThrow(/between 1 and 65535/);
    expect(() => parseValidPort('-5', 'port')).toThrow(/integer/);
    expect(() => parseValidPort('abc', 'port')).toThrow(/integer/);

    const defaults = { port: 7777, targetPort: 5173 };
    expect(resolveCliPorts(['node', 'glide', '4321'], {}, defaults)).toEqual({ port: 7777, targetPort: 4321, explicitTargetPort: true });
    expect(() => resolveCliPorts(['node', 'glide', '7777'], {}, defaults)).toThrow(/cannot equal editor port/);
    expect(() => resolveCliPorts(['node', 'glide', '0'], {}, defaults)).toThrow(/between 1 and 65535/);
    expect(() => resolveCliPorts(['node', 'glide'], { PORT: '99999' }, defaults)).toThrow(/between 1 and 65535/);
  });
});
