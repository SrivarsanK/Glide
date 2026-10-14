import { afterEach, expect, test } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ProjectPaths } from '../../packages/server/src/project-paths.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-path-'));
  roots.push(root);
  const project = path.join(root, 'project');
  const outside = path.join(root, 'project-other');
  fs.mkdirSync(project); fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'App.tsx'), 'export const A = <div />;');
  return { root, project, outside, paths: new ProjectPaths(project) };
}

test('rejects traversal, sibling prefixes, alternate paths, and unsupported extensions', () => {
  const f = fixture();
  expect(f.paths.resolve('.')).toBe(fs.realpathSync(f.project));
  for (const target of ['../project-other/App.tsx', '../project-other', 'App.tsx:secret', 'App.tsx.', '\\\\server\\file']) {
    expect(() => f.paths.resolve(target)).toThrow('INVALID_PATH');
  }
  fs.writeFileSync(path.join(f.project, 'secret.txt'), 'private');
  expect(() => f.paths.sourceFile('secret.txt')).toThrow('UNSUPPORTED_OPERATION');
});

test('rejects a directory junction that leaves the project', () => {
  const f = fixture();
  fs.symlinkSync(f.outside, path.join(f.project, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  expect(() => f.paths.sourceFile('escape/App.tsx')).toThrow('INVALID_PATH');
  expect(() => f.paths.resolve('escape/new.tsx', false)).toThrow('INVALID_PATH');
});

test('canonicalizes internal directory aliases, including paths to new metadata', () => {
  const f = fixture();
  const source = path.join(f.project, 'src');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'App.tsx'), '<div />');
  fs.symlinkSync(source, path.join(f.project, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
  expect(f.paths.sourceFile('alias/App.tsx')).toBe(fs.realpathSync(path.join(source, 'App.tsx')));
  expect(f.paths.metadataFile('alias/glide-positions.json')).toBe(path.join(fs.realpathSync(source), 'glide-positions.json'));
});

test.each(['.git', 'node_modules'])('rejects protected %s directories and aliases to them', directory => {
  const f = fixture();
  const protectedDir = path.join(f.project, directory);
  fs.mkdirSync(protectedDir);
  fs.writeFileSync(path.join(protectedDir, 'App.tsx'), '<div />');
  fs.symlinkSync(protectedDir, path.join(f.project, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
  expect(() => f.paths.sourceFile(`${directory}/App.tsx`)).toThrow('INVALID_PATH');
  expect(() => f.paths.sourceFile('alias/App.tsx')).toThrow('INVALID_PATH');
});

test('rejects shared hard links for source and metadata writes', () => {
  const f = fixture();
  fs.linkSync(path.join(f.outside, 'App.tsx'), path.join(f.project, 'App.tsx'));
  fs.linkSync(path.join(f.outside, 'App.tsx'), path.join(f.project, 'glide-components.json'));
  expect(() => f.paths.sourceFile('App.tsx')).toThrow('UNSUPPORTED_OPERATION');
  expect(() => f.paths.metadataFile('glide-components.json')).toThrow('INVALID_PATH');
  expect(fs.readFileSync(path.join(f.outside, 'App.tsx'), 'utf8')).toBe('export const A = <div />;');
});

test('rejects metadata behind escaping and dangling directory links', () => {
  const f = fixture();
  const link = path.join(f.project, 'escape');
  fs.symlinkSync(f.outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  expect(() => f.paths.metadataFile('escape/glide-positions.json')).toThrow('INVALID_PATH');
  fs.unlinkSync(path.join(f.outside, 'App.tsx'));
  fs.rmdirSync(f.outside);
  expect(() => f.paths.resolve('escape/new/file.tsx', false)).toThrow('INVALID_PATH');
});
