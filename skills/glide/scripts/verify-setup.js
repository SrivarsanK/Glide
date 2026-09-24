#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';

const projectRoot = process.cwd();
const pkgJsonPath = path.join(projectRoot, 'package.json');

console.log(`[Glide Setup Verifier] Checking project at: ${projectRoot}`);

if (!fs.existsSync(pkgJsonPath)) {
  console.error('❌ No package.json found. Run inside a frontend project root.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

// Check Vite
if (deps['vite']) {
  console.log('✅ Vite detected:', deps['vite']);
} else {
  console.warn('⚠️ Vite not found in package.json. Glide is optimized for Vite projects.');
}

// Check Glide
if (deps['@srivarsank/glide']) {
  console.log('✅ @srivarsank/glide detected:', deps['@srivarsank/glide']);
} else {
  console.log('ℹ️ @srivarsank/glide not yet in package.json. (Can also run via npx @srivarsank/glide)');
}

// Check Vite config for plugin
const configCandidates = [
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mjs',
  'astro.config.mjs',
];

let pluginFound = false;
for (const cand of configCandidates) {
  const p = path.join(projectRoot, cand);
  if (fs.existsSync(p)) {
    const content = fs.readFileSync(p, 'utf-8');
    if (content.includes('glideSourceStamping')) {
      console.log(`✅ glideSourceStamping plugin configured in ${cand}`);
      pluginFound = true;
    } else {
      console.warn(`⚠️ ${cand} found, but glideSourceStamping plugin is not yet registered.`);
    }
  }
}

if (!pluginFound) {
  console.log('💡 To configure, add to your vite.config.ts:');
  console.log('   import { glideSourceStamping } from \'@srivarsank/glide/vite-plugin\';');
  console.log('   plugins: [..., glideSourceStamping()]');
}

// Check skills
const skillPath = path.join(projectRoot, '.agents', 'skills', 'glide', 'SKILL.md');
if (fs.existsSync(skillPath)) {
  console.log('✅ Glide AI Agent Skill installed in .agents/skills/glide/');
} else {
  console.log('💡 AI skills not installed. Run: npx @srivarsank/glide --install-skills');
}

console.log('[Glide Setup Verifier] Check complete.');
