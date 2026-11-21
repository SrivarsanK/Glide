/**
 * `glide mcp`: an MCP server over stdio for coding agents. Each JSON-RPC line is forwarded to the running
 * Glide server (found through its run file); without one, the tools are still listed so agents can start.
 * `glide mcp install` adds Glide to this project's `.mcp.json` for Claude Code.
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

async function forward(message: unknown): Promise<unknown> {
  let run: { url: string; token: string } | null = null;
  try { run = JSON.parse(fs.readFileSync(runFile, 'utf8')); } catch {}
  if (run) {
    try {
      const response = await fetch(run.url, { method: 'POST', body: JSON.stringify(message),
        headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${run.token}` } });
      if (response.status === 202) return null;
      if (response.ok) return await response.json();
    } catch {}
  }
  // A stale run file (Glide stopped without cleaning up) is treated like no Glide at all.
  const offline = (item: unknown) => offlineMcpReply(item, packageInfo.version, project);
  return Array.isArray(message) ? message.map(offline).filter(Boolean) : offline(message);
}

function install() {
  const file = path.join(project, '.mcp.json');
  let config: any = {};
  if (fs.existsSync(file)) {
    try { config = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {
      console.error(`${file} is not valid JSON, so it was left unchanged. Fix it and run this again.`);
      process.exit(1);
    }
  }
  // Native Windows runs npx through cmd.
  const command = process.platform === 'win32' ? { command: 'cmd', args: ['/c', 'npx', '-y', '@srivarsank/glide', 'mcp'] }
    : { command: 'npx', args: ['-y', '@srivarsank/glide', 'mcp'] };
  config.mcpServers = { ...config.mcpServers, glide: command };
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
  console.log(`Added Glide to ${file}. Restart Claude Code in this project, then run /mcp to check it is connected.`);
}

if (args[1] === 'install') {
  if (args.includes('--agent') && args[args.indexOf('--agent') + 1] !== 'claude') {
    console.error('Only Claude Code (--agent claude) is set up automatically for now. Other agents can run `npx -y @srivarsank/glide mcp` as a stdio server.');
    process.exit(1);
  }
  install();
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
