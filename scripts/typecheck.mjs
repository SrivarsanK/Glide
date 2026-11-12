import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const compiler = require.resolve('typescript/bin/tsc');
const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const projects = [];

// Match the npm workspace patterns declared by this repository.
for (const pattern of manifest.workspaces) {
  if (!pattern.endsWith('/*') || pattern.slice(0, -2).includes('*')) {
    throw new Error(`Unsupported workspace pattern: ${pattern}`);
  }
  const directory = path.join(root, pattern.slice(0, -2));
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const project = path.join(directory, entry.name);
    if (entry.isDirectory() && existsSync(path.join(project, 'package.json'))) {
      projects.push(project);
    }
  }
}
projects.push(root);

// Build first: internal package imports resolve through their generated declarations.
for (const project of projects) {
  const config = path.join(project, 'tsconfig.json');
  console.log(`Typechecking ${path.relative(root, project) || 'root'}...`);
  const result = spawnSync(process.execPath, [compiler, '-p', config, '--noEmit',
    '--noUnusedLocals', '--noUnusedParameters'], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
