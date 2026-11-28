/**
 * `glide mcp`: an MCP server over stdio for coding agents. Each JSON-RPC line is forwarded to the running
 * Glide server (found through its run file); without one, the tools are still listed so agents can start.
 * `glide mcp install [--agent claude|cursor|vscode|all]` adds Glide to this project's agent config.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { offlineMcpReply } from '@srivarsank/core';
import packageInfo from '../../../package.json' with { type: 'json' };

const TLS_ERROR_CODES = new Set([
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
]);

/** Distinguish TLS certificate verification failures from stale-run-file connection errors (e.g. ECONNREFUSED). */
export function isTlsCertificateError(error: unknown): boolean {
  const cause = (error as any)?.cause;
  const code = String(cause?.code ?? (error as any)?.code ?? '');
  if (!code) return false;
  if (TLS_ERROR_CODES.has(code)) return true;
  return /CERT|TLS|SSL/i.test(code);
}

/** Parse `glide mcp` flags regardless of order (`glide mcp --project dir install` or `glide mcp install --project dir`). */
export function parseMcpArgs(args: string[], cwd = process.cwd()): {
  project: string;
  subcommand: string | undefined;
  agent: string;
  error?: string;
} {
  let projectArg: string | undefined;
  let agent = 'claude';
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--project') {
      const next = args[i + 1];
      if (!next || next.startsWith('-')) return { project: path.resolve(cwd), subcommand: undefined, agent, error: 'Missing path after --project.' };
      projectArg = next;
      i++;
      continue;
    }
    if (arg === '--agent') {
      const next = args[i + 1];
      if (!next || next.startsWith('-')) return { project: path.resolve(cwd), subcommand: undefined, agent, error: 'Missing agent name after --agent.' };
      agent = next;
      i++;
      continue;
    }
    if (!arg.startsWith('-')) positionals.push(arg);
  }
  const subcommand = positionals[0] === 'mcp' ? positionals[1] : positionals[0];
  return { project: path.resolve(cwd, projectArg ?? '.'), subcommand, agent };
}

/** A JSON-RPC error for each request in `message`; notifications get no reply. */
function refusal(message: unknown, text: string): unknown {
  const one = (item: any) => item && item.id !== undefined ? { jsonrpc: '2.0', id: item.id, error: { code: -32000, message: text } } : null;
  return Array.isArray(message) ? message.map(one).filter(Boolean) : one(message);
}

export async function forwardMcp(
  message: unknown,
  project: string,
  fetchImpl: typeof fetch = fetch
): Promise<unknown> {
  const runFile = path.join(project, 'node_modules', '.cache', 'glide', 'mcp.json');
  let run: { url: string; token: string } | null = null;
  try { run = JSON.parse(fs.readFileSync(runFile, 'utf8')); } catch {}
  if (run) {
    let response: Response | undefined;
    try {
      response = await fetchImpl(run.url, { method: 'POST', body: JSON.stringify(message),
        headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${run.token}` } });
    } catch (err) {
      // Only report an untrusted HTTPS certificate when TLS verification failed; stale ECONNREFUSED falls through to offline mode.
      if (run.url.startsWith('https:') && isTlsCertificateError(err)) {
        return refusal(message, 'Glide runs over HTTPS with a certificate Node does not trust. Start the agent with NODE_EXTRA_CA_CERTS set to the dev certificate.');
      }
    }
    if (response?.status === 202) return null;
    if (response?.ok) { try { return await response.json(); } catch {} }
    // Something else on that port answers 404; Glide itself refused anything else.
    else if (response && response.status !== 404) return refusal(message, `Glide refused the request (HTTP ${response.status}). Restart Glide, then the agent.`);
  }
  // A stale run file (Glide stopped without cleaning up) is treated like no Glide at all.
  const offline = (item: unknown) => offlineMcpReply(item, packageInfo.version, project);
  return Array.isArray(message) ? message.map(offline).filter(Boolean) : offline(message);
}

/** Project-level MCP configs: each agent reads its own file and key. */
const CONFIGS: Record<string, { file: string; key: string; entry: (command: string, args: string[]) => object }> = {
  claude: { file: '.mcp.json', key: 'mcpServers', entry: (command, args) => ({ command, args }) },
  cursor: { file: '.cursor/mcp.json', key: 'mcpServers', entry: (command, args) => ({ command, args }) },
  vscode: { file: '.vscode/mcp.json', key: 'servers', entry: (command, args) => ({ type: 'stdio', command, args }) },
};

export function installMcpConfig(project: string, agent: string): boolean {
  const { file: relative, key, entry } = CONFIGS[agent];
  const file = path.join(project, relative);
  let config: any = {};
  if (fs.existsSync(file)) {
    try { config = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {
      console.error(`${file} is not valid JSON (comments are not supported here), so it was left unchanged. Add Glide by hand: npx -y @srivarsank/glide mcp`);
      return false;
    }
    // `[]` or `null` parse, but the servers would be dropped when written back.
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      console.error(`${file} does not hold a JSON object, so it was left unchanged. Fix it and run this again.`);
      return false;
    }
    if (config[key] !== undefined && (typeof config[key] !== 'object' || config[key] === null || Array.isArray(config[key]))) {
      console.error(`${file} has a non-object "${key}" field, so it was left unchanged. Fix it and run this again.`);
      return false;
    }
  }
  // Native Windows runs npx through cmd.
  const [command, ...rest] = process.platform === 'win32' ? ['cmd', '/c', 'npx', '-y', '@srivarsank/glide', 'mcp'] : ['npx', '-y', '@srivarsank/glide', 'mcp'];
  config[key] = { ...config[key], glide: entry(command, rest) };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
  console.log(`Added Glide to ${file}.`);
  return true;
}

/** Serialize JSON-RPC stdio line handling so concurrent piped messages never reorder or race. */
export function serveMcpStdio(
  project: string,
  input: NodeJS.ReadableStream = process.stdin,
  output: Pick<NodeJS.WritableStream, 'write'> = process.stdout,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  return new Promise(resolve => {
    const lines = readline.createInterface({ input });
    let pending: Promise<void> = Promise.resolve();
    const processLine = async (line: string) => {
      if (!line.trim()) return;
      let message: unknown;
      try { message = JSON.parse(line); } catch {
        output.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n');
        return;
      }
      const reply = await forwardMcp(message, project, fetchImpl);
      if (reply !== null && !(Array.isArray(reply) && !reply.length)) output.write(JSON.stringify(reply) + '\n');
    };
    lines.on('line', line => {
      pending = pending.then(() => processLine(line)).catch(err => {
        console.error('[Glide MCP] Failed handling message:', err);
      });
    });
    lines.on('close', () => {
      void pending.finally(resolve);
    });
  });
}

export async function runMcpCli(args: string[] = process.argv.slice(2), cwd = process.cwd()): Promise<void> {
  const parsed = parseMcpArgs(args, cwd);
  if (parsed.error) {
    console.error(parsed.error);
    process.exit(1);
    return;
  }
  if (parsed.subcommand === 'install') {
    const agents = parsed.agent === 'all' ? Object.keys(CONFIGS) : [parsed.agent];
    if (!agents.every(agent => agent in CONFIGS)) {
      // Codex keeps its servers in a user-level config, so it is added with its own command.
      console.error(`Unknown agent "${parsed.agent}". Use claude, cursor, vscode or all. For Codex, run \`codex mcp add glide -- npx -y @srivarsank/glide mcp\`. Other agents can run \`npx -y @srivarsank/glide mcp\` as a stdio server.`);
      process.exit(1);
      return;
    }
    const ok = agents.map(agent => installMcpConfig(parsed.project, agent)).every(Boolean);
    console.log('Restart the agent in this project so it picks up the Glide MCP server.');
    if (!ok) process.exit(1);
    return;
  }
  await serveMcpStdio(parsed.project);
}
