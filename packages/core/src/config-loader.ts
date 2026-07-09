import * as fs from 'fs';
import * as path from 'path';
import { createJiti } from 'jiti';
import { resolveConfig, GlideConfig, DEFAULT_CONFIG, DeepPartial } from './config.js';

export async function loadConfigFromDisk(projectRoot: string): Promise<GlideConfig> {
  // JSON: read directly, no transpilation needed
  const jsonPath = path.join(projectRoot, 'glide.config.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as DeepPartial<GlideConfig>;
      return resolveConfig(raw);
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  // TS/JS/MJS: jiti transpiles + imports on the fly (TypeScript works with no build step)
  const jiti = createJiti(projectRoot, { interopDefault: true });
  for (const file of ['glide.config.ts', 'glide.config.js', 'glide.config.mjs']) {
    const p = path.join(projectRoot, file);
    if (fs.existsSync(p)) {
      try {
        const mod = await jiti.import<DeepPartial<GlideConfig>>(p, { default: true });
        return resolveConfig(mod);
      } catch {
        return DEFAULT_CONFIG;
      }
    }
  }

  return DEFAULT_CONFIG;
}
