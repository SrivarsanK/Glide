#!/usr/bin/env node
import packageInfo from '../../../package.json' with { type: 'json' };
const VERSION = packageInfo.version;

export { promptOrInstallSkills, installSkills, detectAIEnvironments, getSkillsSourceDir } from './installer.js';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Glide ${VERSION} — Code-native visual editor

Usage: glide [dev] [target-port] [options]
       glide init | install-skills

Options:
  -h, --help        Show this help and exit
  -v, --version     Show the package version and exit
  --no-skills      Skip installing AI agent skills
  --yes, -y        Accept skill installation

PORT sets the editor port. Project settings are read from glide.config.json.`);
} else if (args.includes('--version') || args.includes('-v')) {
  console.log(VERSION);
} else {
  await import('./start.js');
}
