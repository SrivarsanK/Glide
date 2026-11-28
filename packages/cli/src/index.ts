#!/usr/bin/env node
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import packageInfo from '../../../package.json' with { type: 'json' };
const VERSION = packageInfo.version;

export { promptOrInstallSkills, installSkills, detectAIEnvironments, getSkillsSourceDir } from './installer.js';
export type { AIEnvironmentInfo, InstallOptions, InstallResult } from './installer.js';

export function isDirectExecution(metaUrl: string, argv1 = process.argv[1]): boolean {
  if (!argv1) return false;
  try {
    const a = fs.realpathSync(fileURLToPath(metaUrl));
    const b = fs.realpathSync(argv1);
    return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
  } catch {
    return false;
  }
}

export async function runCli(args: string[] = process.argv.slice(2)): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Glide ${VERSION} — Code-native visual editor

Usage: glide [target-port]            Start the editor for the dev server on that port.
                                      With no port, Glide looks for the dev server.
       glide install-skills [options] Copy the Glide skills for AI coding agents into this project.
       glide mcp                      Run Glide's MCP server over stdio, for coding agents.
       glide mcp install [--agent a]  Add Glide to this project's agent config (claude, cursor, vscode, all).

Options:
  -h, --help        Show this help and exit
  -v, --version     Show the package version and exit
  --agent <name>    With install-skills: agents (.agents/skills), claude (.claude/skills) or all.
                    Default: .agents/skills, and .claude/skills when the project uses Claude Code.
  --no-skills       Do not print the skills tip at start

PORT sets the editor port. Project settings are read from glide.config.json.`);
  } else if (args.includes('--version') || args.includes('-v')) {
    console.log(VERSION);
  } else if (args[0] === 'mcp') {
    const { runMcpCli } = await import('./mcp.js');
    await runMcpCli(args);
  } else {
    const { startCli } = await import('./start.js');
    await startCli(['node', 'glide', ...args]);
  }
}

if (isDirectExecution(import.meta.url)) {
  void runCli();
}
