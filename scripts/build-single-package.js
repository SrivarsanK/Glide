import { build } from 'esbuild';
import { execSync } from 'child_process';
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

  '@chenglou/pretext',
  '@vue/compiler-sfc',
  'chokidar',
  'html-dom-parser',
  'html-react-parser',
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

async function runBuild() {
  console.log('Building packages/core with tsc...');
  execSync('npx tsc', { cwd: path.join(projectRoot, 'packages/core'), stdio: 'inherit' });

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
  });

  console.log('Bundling typings with dts-bundle-generator...');
  
  execSync('npx dts-bundle-generator -o dist/index.d.ts src/index.ts', { stdio: 'inherit' });
  execSync('npx dts-bundle-generator -o dist/cli.d.ts packages/cli/src/index.ts', { stdio: 'inherit' });
  execSync('npx dts-bundle-generator -o dist/vite-plugin.d.ts packages/vite-plugin/src/index.ts', { stdio: 'inherit' });
  execSync('npx dts-bundle-generator -o dist/babel-plugin.d.ts packages/babel-plugin/src/index.ts', { stdio: 'inherit' });

  console.log('Build completed successfully!');
}

runBuild().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
