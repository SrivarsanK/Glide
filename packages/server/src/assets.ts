import * as fs from 'fs';
import * as path from 'path';
import { ProjectPaths } from './project-paths.js';

const ALLOWED_ASSET_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.bmp',
  '.mp4', '.webm', '.ogg', '.mp3', '.wav', '.m4a',
  '.woff', '.woff2', '.ttf', '.otf',
]);

export function saveUploadedAsset(
  projectRoot: string,
  sourcePath: string,
  fileName: string
): string {
  if (!fileName || fileName === '.' || fileName === '..' || /[\\/:<>"|?*\0]/.test(fileName) || /[. ]$/.test(fileName)) {
    throw new Error('INVALID_PATH: Asset names must be plain filenames.');
  }
  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_ASSET_EXTS.has(ext)) {
    throw new Error(`INVALID_ASSET: Unsupported asset file type "${ext || '(none)'}". Upload an image, media, or font asset.`);
  }
  const paths = new ProjectPaths(projectRoot);
  const assetsDir = paths.resolve('public/assets', false);

  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const destPath = paths.resolve(path.join(assetsDir, fileName), false);
  // Never follow or overwrite an existing asset (including a hard link).
  fs.copyFileSync(sourcePath, destPath, fs.constants.COPYFILE_EXCL);

  // Return the URL-encoded relative web URL for preview rendering
  return `/assets/${encodeURIComponent(fileName)}`;
}
