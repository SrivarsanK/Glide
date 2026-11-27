import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const tsPkgPath = require.resolve('typescript/package.json');
const tsPkg = JSON.parse(readFileSync(tsPkgPath, 'utf8'));
const compiler = path.resolve(path.dirname(tsPkgPath), tsPkg.bin.tsc);
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

// The bundled typings are what consumers compile against. skipLibCheck stays off: with it on,
// TypeScript checks no .d.ts file at all.
const typings = ['index', 'cli', 'vite-plugin', 'babel-plugin'].map(name => path.join(root, 'dist', `${name}.d.ts`));
console.log('Typechecking dist typings...');
const typingsResult = spawnSync(process.execPath, [compiler, '--noEmit', '--strict', '--skipLibCheck', 'false',
  '--ignoreConfig', '--module', 'nodenext', '--moduleResolution', 'nodenext', '--target', 'es2022', '--types', 'node', ...typings], {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true,
});
if (typingsResult.error) throw typingsResult.error;
if (typingsResult.status !== 0) process.exit(typingsResult.status ?? 1);
