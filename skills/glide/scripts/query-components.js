#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';

const projectRoot = process.cwd();
const registryPath = path.join(projectRoot, 'glide-components.json');

if (!fs.existsSync(registryPath)) {
  console.error(`[Glide] No glide-components.json found at ${registryPath}`);
  console.error(`[Glide] Start Glide first with: npx @srivarsank/glide <port>`);
  process.exit(1);
}

const raw = fs.readFileSync(registryPath, 'utf-8');
const registry = JSON.parse(raw);

const args = process.argv.slice(2);

if (args.includes('--list') || args.length === 0) {
  console.log(`[Glide Registry] Total buckets: ${registry.buckets.length} (${registry.framework})`);
  for (const bucket of registry.buckets) {
    const rootEl = bucket.elements.find(e => e.isRoot);
    const rootTag = rootEl ? `<${rootEl.tagName}>` : 'unknown';
    console.log(`  • ${bucket.name.padEnd(20)} ${rootTag.padEnd(10)} ${path.relative(projectRoot, bucket.file)}:${bucket.line}`);
  }
  process.exit(0);
}

const nameIndex = args.indexOf('--name');
if (nameIndex !== -1 && args[nameIndex + 1]) {
  const targetName = args[nameIndex + 1].toLowerCase();
  const bucket = registry.buckets.find(b => b.name.toLowerCase() === targetName);
  if (!bucket) {
    console.error(`[Glide] Component bucket "${args[nameIndex + 1]}" not found.`);
    process.exit(1);
  }
  console.log(JSON.stringify(bucket, null, 2));
  process.exit(0);
}

const targetIndex = args.indexOf('--target');
if (targetIndex !== -1 && args[targetIndex + 1]) {
  const targetId = args[targetIndex + 1];
  for (const bucket of registry.buckets) {
    const el = bucket.elements.find(e => e.id === targetId);
    if (el) {
      console.log(JSON.stringify({ bucket: bucket.name, file: bucket.file, element: el }, null, 2));
      process.exit(0);
    }
  }
  console.error(`[Glide] Target element "${targetId}" not found in any bucket.`);
  process.exit(1);
}
