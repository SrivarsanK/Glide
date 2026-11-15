import { GlideServer, maintainRegistryFile } from '@srivarsank/server';
import { connect } from 'node:net';
import { loadConfigFromDisk } from '@srivarsank/core';
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
let targetPort = !isNaN(_argvPort) ? _argvPort : config.targetPort;

/** Whether something listens on a local port. */
function listening(candidate: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = connect({ port: candidate, host: 'localhost' });
    const done = (result: boolean) => { socket.destroy(); resolve(result); };
    socket.setTimeout(400, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

// No port given: use the configured port if a server answers there, else the first common
// dev-server port that answers (Vite 5173, Astro 4321, Next/CRA 3000, ...).
if (isNaN(_argvPort) && !(await listening(targetPort))) {
  for (const candidate of [5173, 4321, 3000, 5174, 4173, 8080, 3001, 8000]) {
    if (candidate !== port && candidate !== targetPort && await listening(candidate)) {
      console.log(`[Glide] No dev server on port ${targetPort}; using the one on port ${candidate}.`);
      targetPort = candidate;
      break;
    }
  }
}

// Keep the object and the args in sync so GlideServer and getEditorHTML(config) see the real target
config.port = port;
config.targetPort = targetPort;

const server = new GlideServer(port, targetPort, config);

// Write glide-components.json and keep it current while source files change.
maintainRegistryFile(process.cwd());

server.start().then(() => {
  console.log(`[Glide] Visual design workspace server listening on ws://localhost:${port}`);
  console.log(`[Glide] Editor: http://localhost:${port}  (preview of the dev server on port ${targetPort})`);
}).catch((err: any) => {
  console.error(`[Glide] Server failed to start:`, err);
  process.exit(1);
});
