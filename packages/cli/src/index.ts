#!/usr/bin/env node
import packageInfo from '../../../package.json' with { type: 'json' };
const VERSION = packageInfo.version;

export { promptOrInstallSkills, installSkills, detectAIEnvironments, getSkillsSourceDir } from './installer.js';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Glide ${VERSION} — Code-native visual editor

Usage: glide [target-port]            Start the editor for the dev server on that port.
                                      With no port, Glide looks for the dev server.
       glide install-skills [options] Copy the Glide skills for AI coding agents into this project.

Options:
  -h, --help        Show this help and exit
  -v, --version     Show the package version and exit
  --agent <name>    With install-skills: agents (.agents/skills), claude (.claude/skills) or all.
                    Default: .agents/skills, and .claude/skills when the project uses Claude Code.
  --no-skills       Do not print the skills tip at start

PORT sets the editor port. Project settings are read from glide.config.json.`);
} else if (args.includes('--version') || args.includes('-v')) {
  console.log(VERSION);
} else {
  await import('./start.js');
}
