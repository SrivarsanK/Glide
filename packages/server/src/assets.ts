import * as fs from 'fs';
import * as path from 'path';
import { ProjectPaths } from './project-paths.js';

export function saveUploadedAsset(
  projectRoot: string,
  sourcePath: string,
  fileName: string
): string {
  if (!fileName || fileName === '.' || fileName === '..' || /[\\/:<>"|?*\0]/.test(fileName) || /[. ]$/.test(fileName)) {
    throw new Error('INVALID_PATH: Asset names must be plain filenames.');
  }
  const paths = new ProjectPaths(projectRoot);
  const assetsDir = paths.resolve('public/assets', false);

  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const destPath = paths.resolve(path.join(assetsDir, fileName), false);
  // Never follow or overwrite an existing asset (including a hard link).
  fs.copyFileSync(sourcePath, destPath, fs.constants.COPYFILE_EXCL);

  // Return the relative web URL for preview rendering
  return `/assets/${fileName}`;
}
