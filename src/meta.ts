import * as fs from 'fs';
import * as path from 'path';

export interface ProjectMeta {
  framework: 'react' | 'vue' | 'svelte' | 'astro' | 'unknown';
  metaFramework: 'next' | 'nuxt' | 'astro' | 'none';
  srcDir: string;
}

export function detectProjectMeta(projectRoot: string): ProjectMeta {
  let pkg: any = {};
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    } catch {}
  }

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  let framework: ProjectMeta['framework'] = 'unknown';
  let metaFramework: ProjectMeta['metaFramework'] = 'none';

  if (deps['next'] || deps['react']) {
    framework = 'react';
    if (deps['next']) metaFramework = 'next';
  } else if (deps['nuxt'] || deps['vue']) {
    framework = 'vue';
    if (deps['nuxt']) metaFramework = 'nuxt';
  } else if (deps['astro']) {
    framework = 'astro';
    metaFramework = 'astro';
  } else if (deps['svelte'] || deps['@sveltejs/kit']) {
    framework = 'svelte';
  }

  let srcDir = projectRoot;
  const potentialSrc = path.join(projectRoot, 'src');
  if (fs.existsSync(potentialSrc)) {
    srcDir = potentialSrc;
  }

  return { framework, metaFramework, srcDir };
}

export function generateVSCodeConfig(projectRoot: string): void {
  const vscodeDir = path.join(projectRoot, '.vscode');
  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true });
  }

  const settingsPath = path.join(vscodeDir, 'settings.json');
  const config = {
    "glide.enabled": true,
    "glide.editor.port": 4321,
    "glide.stampOnSave": true
  };

  fs.writeFileSync(settingsPath, JSON.stringify(config, null, 2), 'utf-8');
}
