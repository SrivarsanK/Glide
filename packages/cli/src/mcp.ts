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

const args = process.argv.slice(2);
const flag = args.indexOf('--project');
const project = path.resolve(flag >= 0 && args[flag + 1] ? args[flag + 1] : process.cwd());
const runFile = path.join(project, 'node_modules', '.cache', 'glide', 'mcp.json');

/** A JSON-RPC error for each request in `message`; notifications get no reply. */
function refusal(message: unknown, text: string): unknown {
  const one = (item: any) => item && item.id !== undefined ? { jsonrpc: '2.0', id: item.id, error: { code: -32000, message: text } } : null;
  return Array.isArray(message) ? message.map(one).filter(Boolean) : one(message);
}

async function forward(message: unknown): Promise<unknown> {
  let run: { url: string; token: string } | null = null;
  try { run = JSON.parse(fs.readFileSync(runFile, 'utf8')); } catch {}
  if (run) {
    let response: Response | undefined;
    try {
      response = await fetch(run.url, { method: 'POST', body: JSON.stringify(message),
        headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${run.token}` } });
    } catch {
      // Glide is running, but Node does not trust the HTTPS dev server's certificate.
      if (run.url.startsWith('https:')) return refusal(message, 'Glide runs over HTTPS with a certificate Node does not trust. Start the agent with NODE_EXTRA_CA_CERTS set to the dev certificate.');
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

function install(agent: string) {
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
  }
  // Native Windows runs npx through cmd.
  const [command, ...rest] = process.platform === 'win32' ? ['cmd', '/c', 'npx', '-y', '@srivarsank/glide', 'mcp'] : ['npx', '-y', '@srivarsank/glide', 'mcp'];
  config[key] = { ...config[key], glide: entry(command, rest) };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
  console.log(`Added Glide to ${file}.`);
  return true;
}

if (args[1] === 'install') {
  const asked = args.includes('--agent') ? args[args.indexOf('--agent') + 1] : 'claude';
  const agents = asked === 'all' ? Object.keys(CONFIGS) : [asked];
  if (!agents.every(agent => agent in CONFIGS)) {
    console.error(`Unknown agent "${asked}". Use claude, cursor, vscode or all. Other agents can run \`npx -y @srivarsank/glide mcp\` as a stdio server.`);
    process.exit(1);
  }
  const ok = agents.map(install).every(Boolean);
  console.log('Restart the agent in this project so it picks up the Glide MCP server.');
  if (!ok) process.exit(1);
} else {
  const lines = readline.createInterface({ input: process.stdin });
  lines.on('line', async line => {
    if (!line.trim()) return;
    let message: unknown;
    try { message = JSON.parse(line); } catch {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n');
      return;
    }
    const reply = await forward(message);
    if (reply !== null && !(Array.isArray(reply) && !reply.length)) process.stdout.write(JSON.stringify(reply) + '\n');
  });
}
