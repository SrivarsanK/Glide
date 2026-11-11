import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildRegistry, watchRegistry, type ComponentRegistry } from '@srivarsank/core';
import { ProjectPaths } from './project-paths.js';

/**
 * Write glide-components.json in the project root and keep it current while
 * source files change. Returns a function that stops the watcher.
 */
export function maintainRegistryFile(projectRoot: string, log: (message: string) => void = console.log): () => Promise<void> {
  const paths = new ProjectPaths(projectRoot);
  const file = path.join(paths.root, 'glide-components.json');
  const write = (registry: ComponentRegistry, verb: string) => {
    try {
      fs.writeFileSync(paths.metadataFile(file), JSON.stringify(registry, null, 2), 'utf-8');
      log(`[Glide] Component registry ${verb} → ${path.basename(file)} (${registry.buckets.length} buckets)`);
    } catch (error) {
      console.warn('[Glide] Registry write failed:', error);
    }
  };
  try { write(buildRegistry({ projectRoot: paths.root }), 'written'); }
  catch (error) { console.warn('[Glide] Registry build failed:', error); }
  const watcher = watchRegistry(paths.root, registry => write(registry, 'updated'));
  return async () => { await watcher.close(); };
}
