import * as fs from 'fs';
import * as path from 'path';

export function saveUploadedAsset(
  projectRoot: string,
  sourcePath: string,
  fileName: string
): string {
  const assetsDir = path.join(projectRoot, 'public', 'assets');
  
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const destPath = path.join(assetsDir, fileName);
  fs.copyFileSync(sourcePath, destPath);

  // Return the relative web URL for preview rendering
  return `/assets/${fileName}`;
}
