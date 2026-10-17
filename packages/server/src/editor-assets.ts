import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const resolveAsset = createRequire(import.meta.url).resolve;
const assets: Record<string, { module: string; contentType: string }> = {
  '/__glide_assets__/lucide.js': { module: 'lucide/dist/umd/lucide.min.js', contentType: 'text/javascript; charset=utf-8' },
  ...Object.fromEntries([300, 400, 500, 600, 700].map(weight => [
    `/__glide_assets__/inter-${weight}.woff2`,
    { module: `@fontsource/inter/files/inter-latin-${weight}-normal.woff2`, contentType: 'font/woff2' },
  ])),
};

/** Exact allowlist: editor assets never resolve a user-controlled filesystem path. */
export function getEditorAsset(pathname: string) {
  const asset = Object.hasOwn(assets, pathname) ? assets[pathname] : undefined;
  return asset ? { body: readFileSync(resolveAsset(asset.module)), contentType: asset.contentType } : null;
}
