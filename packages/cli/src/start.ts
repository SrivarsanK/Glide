import { GlideServer, maintainRegistryFile } from '@srivarsank/server';
import { connect } from 'node:net';
import { loadConfigFromDisk } from '@srivarsank/core';
import { promptOrInstallSkills, installSkills, detectAIEnvironments, getSkillsSourceDir } from './installer.js';

export { promptOrInstallSkills, installSkills, detectAIEnvironments, getSkillsSourceDir };

export const STANDALONE_SKILL_FLAGS = ['--install-skills', '-i', 'install-skills', 'init', '--init'] as const;

export function isStandaloneSkillCommand(argv: string[]): boolean {
  return STANDALONE_SKILL_FLAGS.some(flag => argv.includes(flag));
}

export function parseValidPort(raw: string | number, label: string): number {
  const str = String(raw).trim();
  if (!/^\d+$/.test(str)) {
    throw new Error(`Invalid ${label} "${raw}". Port must be an integer between 1 and 65535.`);
  }
  const value = Number(str);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`Invalid ${label} "${raw}". Port must be between 1 and 65535.`);
  }
  return value;
}

export function resolveCliPorts(
  argv: string[],
  env: NodeJS.ProcessEnv,
  config: { port: number; targetPort: number }
): { port: number; targetPort: number; explicitTargetPort: boolean } {
  const port = env.PORT !== undefined && env.PORT !== ''
    ? parseValidPort(env.PORT, 'PORT')
    : parseValidPort(config.port, 'config port');
  const portArgument = argv.slice(2).find(arg => /^-?\d+$/.test(arg));
  const explicitTargetPort = portArgument !== undefined;
  const targetPort = explicitTargetPort
    ? parseValidPort(portArgument, 'target port')
    : parseValidPort(config.targetPort, 'config targetPort');
  if (explicitTargetPort && targetPort === port) {
    throw new Error(`Target port (${targetPort}) cannot equal editor port (${port}).`);
  }
  return { port, targetPort, explicitTargetPort };
}

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

export async function startCli(
  argv: string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd()
): Promise<void> {
  // Handle standalone skill install command (including -i and --init)
  if (isStandaloneSkillCommand(argv)) {
    await promptOrInstallSkills(cwd, argv);
    return;
  }

  // Check or install skills on server startup
  await promptOrInstallSkills(cwd, argv);

  const config = await loadConfigFromDisk(cwd);
  let resolved: { port: number; targetPort: number; explicitTargetPort: boolean };
  try {
    resolved = resolveCliPorts(argv, env, config);
  } catch (err: any) {
    console.error(`[Glide] ${err?.message ?? err}`);
    process.exit(1);
    return;
  }

  const { port, explicitTargetPort } = resolved;
  let { targetPort } = resolved;

  // No port given: use the configured port if a server answers there (and isn't our own port), else probe common ports.
  if (!explicitTargetPort && (targetPort === port || !(await listening(targetPort)))) {
    for (const candidate of [5173, 4321, 3000, 5174, 4173, 8080, 3001, 8000]) {
      if (candidate !== port && candidate !== targetPort && await listening(candidate)) {
        console.log(`[Glide] No dev server on port ${targetPort}; using the one on port ${candidate}.`);
        targetPort = candidate;
        break;
      }
    }
  }

  if (targetPort === port) {
    console.error(`[Glide] Target dev-server port (${targetPort}) cannot equal editor port (${port}). Pass a different target port or set PORT.`);
    process.exit(1);
    return;
  }

  // Keep the object and the args in sync so GlideServer and getEditorHTML(config) see the real target
  config.port = port;
  config.targetPort = targetPort;

  const server = new GlideServer(port, targetPort, config, cwd);
  let stopRegistry: (() => Promise<void>) | null = null;
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[Glide] Received ${signal}; shutting down...`);
    void (async () => {
      try { await stopRegistry?.(); } catch {}
      try { await server.stop(); } catch {}
      process.exit(0);
    })();
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await server.start();
    // Write glide-components.json and watch source files only after server startup succeeds.
    stopRegistry = maintainRegistryFile(cwd);
    console.log(`[Glide] Visual design workspace server listening on ws://localhost:${port}`);
    console.log(`[Glide] Editor: http://localhost:${port}  (preview of the dev server on port ${targetPort})`);
  } catch (err: any) {
    console.error(`[Glide] Server failed to start:`, err);
    process.exit(1);
  }
}
