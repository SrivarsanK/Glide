import { build } from 'esbuild';
import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

// Clean dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

const externals = [
  '@babel/core',
  '@babel/generator',
  '@babel/parser',
  '@babel/traverse',
  '@babel/types',

  '@vue/compiler-sfc',
  'chokidar',
  'html-dom-parser',
  'picocolors',
  'recast',
  'svelte',
  'ws',
  'postcss',
  'vite',
  'fs',
  'path',
  'http',
  'child_process',
  'events',
  'util',
  'url',
  'module',
  'os'
];

const esmBanner = `
import { createRequire as __createRequire } from 'module';
import { fileURLToPath as __fileURLToPath } from 'url';
import { dirname as __dirnameFunc } from 'path';
const require = __createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __dirnameFunc(__filename);
`;

// ── Pre-build all internal packages (dependency order) ───────────────────────
// esbuild bundles @srivarsank/* from packages/*/dist/
// Those dist/ dirs must exist before esbuild runs, so compile all packages with tsc first.
// A level only imports packages from earlier levels (checked against the source imports,
// which list more than the package.json files do), so each level compiles in parallel.

const buildLevels = [
  ['core', 'babel-plugin'],
  ['ast-writer', 'adapters/vue', 'adapters/svelte', 'adapters/astro', 'overlay'],
  ['server'],
  ['vite-plugin'],
];
const internalPackages = buildLevels.flat();

const require = createRequire(import.meta.url);
const tscBin = require.resolve('typescript/bin/tsc');

// Runs a Node CLI directly: npx adds about a second to every call on Windows.
function runNode(bin, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...args], { cwd, stdio: 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${path.basename(bin)} ${args.join(' ')} exited with ${code}`)));
  });
}

// ── Resolve @srivarsank/* from this checkout ─────────────────────────────────
// Through node_modules, a git worktree (which has none of its own) would reach the
// main checkout's links and silently build main's packages. So esbuild gets an alias
// and TypeScript a paths mapping, both pointing at this checkout's packages/*.

const workspacePackages = new Map(internalPackages.map(pkg => {
  const pkgDir = path.join(projectRoot, 'packages', pkg);
  const manifest = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  return [manifest.name, { main: path.join(pkgDir, manifest.main), types: path.join(pkgDir, manifest.types) }];
}));

// An alias, unlike a path returned by a plugin, still reads each package.json "type".
const workspaceAlias = Object.fromEntries([...workspacePackages].map(([name, pkg]) => [name, pkg.main]));

// Plugins see imports before the alias does: let known names through, refuse the rest.
const workspaceGuardPlugin = {
  name: 'workspace-guard',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^@srivarsank\// }, args => {
      if (workspacePackages.has(args.path)) return undefined;
      return { errors: [{ text: `${args.path} is not in internalPackages, so it cannot be bundled from this checkout` }] };
    });
  },
};

// tsc and dts-bundle-generator read a generated tsconfig beside the real one, so the
// rest of it (relative paths, @types lookup) resolves exactly as before.
const workspacePaths = Object.fromEntries([...workspacePackages].map(([name, pkg]) => [name, [pkg.types]]));
const workspaceTsconfigs = new Set();

function workspaceTsconfig(projectDir) {
  const file = path.join(projectDir, 'tsconfig.workspace.json');
  fs.writeFileSync(file, JSON.stringify({ extends: './tsconfig.json', compilerOptions: { paths: workspacePaths } }, null, 2));
  workspaceTsconfigs.add(file);
  return file;
}

async function runBuild() {
  for (const level of buildLevels) {
    await Promise.all(level.map(pkg => {
      const pkgDir = path.join(projectRoot, 'packages', pkg);
      if (!fs.existsSync(path.join(pkgDir, 'tsconfig.json'))) {
        console.log(`Skipping ${pkg} (no tsconfig.json)`);
        return;
      }
      console.log(`Building packages/${pkg} with tsc...`);
      // tsc does not remove output for deleted source files.
      fs.rmSync(path.join(pkgDir, 'dist'), { recursive: true, force: true });
      return runNode(tscBin, ['-p', workspaceTsconfig(pkgDir)], pkgDir);
    }));
  }

  console.log('Bundling ESM Javascript files with esbuild...');

  // 1. Library entry point
  await build({
    entryPoints: [path.join(projectRoot, 'src/index.ts')],
    outfile: path.join(distDir, 'index.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    banner: {
      js: esmBanner,
    },
    external: externals,
    alias: workspaceAlias,
    plugins: [workspaceGuardPlugin],
  });

  // 2. CLI entry point
  await build({
    entryPoints: [path.join(projectRoot, 'packages/cli/src/index.ts')],
    outfile: path.join(distDir, 'cli.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    banner: {
      js: esmBanner,
    },
    external: externals,
    alias: workspaceAlias,
    plugins: [workspaceGuardPlugin],
  });

  // Strip shebang from the bundled code and prepend a single shebang at the top
  const cliPath = path.join(distDir, 'cli.js');
  let cliContent = fs.readFileSync(cliPath, 'utf8');
  cliContent = cliContent.split('\n').filter(line => !line.trim().startsWith('#!/usr/bin/env node')).join('\n');
  fs.writeFileSync(cliPath, `#!/usr/bin/env node\n${cliContent}`, 'utf8');

  // 3. Vite plugin entry point
  await build({
    entryPoints: [path.join(projectRoot, 'packages/vite-plugin/src/index.ts')],
    outfile: path.join(distDir, 'vite-plugin.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    banner: {
      js: esmBanner,
    },
    external: externals,
    alias: workspaceAlias,
    plugins: [workspaceGuardPlugin],
  });

  // 4. Babel plugin entry point
  await build({
    entryPoints: [path.join(projectRoot, 'packages/babel-plugin/src/index.ts')],
    outfile: path.join(distDir, 'babel-plugin.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    banner: {
      js: esmBanner,
    },
    external: externals,
    alias: workspaceAlias,
    plugins: [workspaceGuardPlugin],
  });

  // dts-bundle-generator spent ~15s walking @babel/types, which no public type uses. npm run typecheck
  // compiles these bundles, as dts-bundle-generator's own output check did.
  console.log('Bundling typings with rollup-plugin-dts...');
  // Glide's own packages are inlined; libraries and Node built-ins stay imports.
  const external = id => !id.startsWith('.') && !path.isAbsolute(id) && !workspacePackages.has(id);
  await Promise.all([
    ['dist/index.d.ts', 'src/index.ts', projectRoot],
    ['dist/cli.d.ts', 'packages/cli/src/index.ts', path.join(projectRoot, 'packages/cli')],
    ['dist/vite-plugin.d.ts', 'packages/vite-plugin/src/index.ts', path.join(projectRoot, 'packages/vite-plugin')],
    ['dist/babel-plugin.d.ts', 'packages/babel-plugin/src/index.ts', path.join(projectRoot, 'packages/babel-plugin')],
  ].map(async ([out, entry, project]) => {
    const bundle = await rollup({ input: path.join(projectRoot, entry), external,
      plugins: [dts({ tsconfig: workspaceTsconfig(project), respectExternal: true })] });
    await bundle.write({ file: path.join(projectRoot, out), format: 'es' });
    await bundle.close();
  }));

  // 5. Package skills and synchronize to .agents/skills/
  console.log('Packaging AI agent skills...');
  const skillsSrcDir = path.join(projectRoot, 'skills');
  const distSkillsDir = path.join(distDir, 'skills');
  const agentSkillsDir = path.join(projectRoot, '.agents', 'skills');

  if (fs.existsSync(skillsSrcDir)) {
    fs.cpSync(skillsSrcDir, distSkillsDir, { recursive: true });
    console.log('Copied skills to dist/skills/');

    // Keep workspace .agents/skills in sync
    for (const skill of ['glide', 'glide-component-segregator', 'glide-setup']) {
      const src = path.join(skillsSrcDir, skill);
      const dst = path.join(agentSkillsDir, skill);
      if (fs.existsSync(src)) {
        fs.mkdirSync(dst, { recursive: true });
        fs.cpSync(src, dst, { recursive: true });
      }
    }
    console.log('Synchronized skills to .agents/skills/');
  }

  console.log('Build completed successfully!');
}

runBuild()
  .finally(() => {
    for (const file of workspaceTsconfigs) fs.rmSync(file, { force: true });
  })
  .catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
  });
