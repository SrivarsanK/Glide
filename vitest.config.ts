import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const packages = ['core', 'ast-writer', 'server', 'overlay', 'babel-plugin', 'vite-plugin',
  'adapters/react', 'adapters/vue', 'adapters/svelte', 'adapters/astro', 'adapters/html'];

export default defineConfig({
  // Workspace tests must exercise current source, not a previous dist build.
  resolve: {
    alias: packages.map(directory => ({
      find: JSON.parse(readFileSync(new URL(`./packages/${directory}/package.json`, import.meta.url), 'utf8')).name,
      replacement: fileURLToPath(new URL(`./packages/${directory}/src/index.ts`, import.meta.url)),
    })),
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
