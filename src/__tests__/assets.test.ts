import { afterEach, expect, test } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { saveUploadedAsset } from '../../packages/server/src/assets.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-assets-'));
  roots.push(root);
  const project = path.join(root, 'project');
  const source = path.join(root, 'photo.png');
  fs.mkdirSync(project);
  fs.writeFileSync(source, 'image bytes');
  return { root, project, source };
}

test('copies an asset into the project and preserves existing uploads', () => {
  const f = fixture();
  expect(saveUploadedAsset(f.project, f.source, 'logo.png')).toBe('/assets/logo.png');
  const destination = path.join(f.project, 'public/assets/logo.png');
  expect(fs.readFileSync(destination, 'utf8')).toBe('image bytes');
  fs.writeFileSync(f.source, 'new bytes');
  expect(() => saveUploadedAsset(f.project, f.source, 'logo.png')).toThrow();
  expect(fs.readFileSync(destination, 'utf8')).toBe('image bytes');
});

test('rejects filename traversal and a public directory linked outside the project', () => {
  const f = fixture();
  for (const name of ['../escape.tsx', '..\\escape.tsx', '/escape.tsx', 'logo.png:stream', 'logo.png.']) {
    expect(() => saveUploadedAsset(f.project, f.source, name)).toThrow('INVALID_PATH');
  }
  fs.symlinkSync(f.root, path.join(f.project, 'public'), process.platform === 'win32' ? 'junction' : 'dir');
  expect(() => saveUploadedAsset(f.project, f.source, 'logo.png')).toThrow('INVALID_PATH');
  expect(fs.existsSync(path.join(f.root, 'assets'))).toBe(false);
});
