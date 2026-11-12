/**
 * Framework and styling auto-detection.
 * Moved from src/meta.ts, extended with styling detection per spec.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { FrameworkId, MetaFrameworkId, ProjectMeta } from './types.js';

export function detectProjectMeta(projectRoot: string): ProjectMeta {
  let pkg: any = {};
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    } catch {}
  }

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  let framework: FrameworkId = 'unknown';
  let metaFramework: MetaFrameworkId = 'none';

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
