import { GlideServer, ProjectPaths } from '@srivarsank/server';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfigFromDisk, buildRegistry, watchRegistry } from '@srivarsank/core';
import { promptOrInstallSkills, installSkills, detectAIEnvironments, getSkillsSourceDir } from './installer.js';

export { promptOrInstallSkills, installSkills, detectAIEnvironments, getSkillsSourceDir };

// Handle standalone skill install command
if (process.argv.includes('--install-skills') || process.argv.includes('install-skills') || process.argv.includes('init')) {
  await promptOrInstallSkills(process.cwd(), process.argv);
  process.exit(0);
}

// Check or install skills on server startup
await promptOrInstallSkills(process.cwd(), process.argv);

const config = await loadConfigFromDisk(process.cwd());

// Precedence: CLI arg (numeric only) > env var > config file > default (5173)
// Note: argv[2] is often "dev" (subcommand) — ignore non-numeric values
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : config.port;
const portArgument = process.argv.slice(2).find(arg => /^\d+$/.test(arg));
const _argvPort = portArgument ? parseInt(portArgument, 10) : NaN;
const targetPort = !isNaN(_argvPort) ? _argvPort : config.targetPort;

// Keep the object and the args in sync so GlideServer and getEditorHTML(config) see the real target
config.port = port;
config.targetPort = targetPort;

const server = new GlideServer(port, targetPort, config);

// ── Component Registry ────────────────────────────────────────────────────────

const projectPaths = new ProjectPaths(process.cwd());
const registryFile = path.join(projectPaths.root, 'glide-components.json');

function writeRegistryToDisk(): void {
  try {
    const registry = buildRegistry({ projectRoot: process.cwd() });
    fs.writeFileSync(projectPaths.metadataFile(registryFile), JSON.stringify(registry, null, 2), 'utf-8');
    console.log(`[Glide] Component registry → ${path.basename(registryFile)} (${registry.buckets.length} buckets)`);
  } catch (e) {
    console.warn('[Glide] Registry build failed:', e);
  }
}

// Initial write on startup
writeRegistryToDisk();

// Watch for source file changes and rebuild incrementally
watchRegistry(process.cwd(), (registry) => {
  try {
    fs.writeFileSync(projectPaths.metadataFile(registryFile), JSON.stringify(registry, null, 2), 'utf-8');
    console.log(`[Glide] Registry updated → ${registry.buckets.length} buckets`);
  } catch (e) {
    console.warn('[Glide] Registry write failed:', e);
  }
});

// ─────────────────────────────────────────────────────────────────────────────

server.start().then(() => {
  console.log(`[Glide] Visual design workspace server listening on ws://localhost:${port}`);
}).catch((err: any) => {
  console.error(`[Glide] Server failed to start:`, err);
  process.exit(1);
});
