import { afterEach, expect, test } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { finalizeEditorChanges } from '../../packages/server/src/editor-git.js';
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-git-')); roots.push(root);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  git('init'); git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'Test'); git('config', 'core.autocrlf', 'false');
  const write = (file: string, value: string) => fs.writeFileSync(path.join(root, file), value);
  write('App.tsx', 'before'); write('Other.tsx', 'other'); git('add', '.'); git('commit', '-m', 'initial');
  return { root, git, write, diffs: [{ file: 'App.tsx', before: 'before', after: 'after' }] };
}
test('finalizes owned files while preserving unrelated staged and unstaged content', () => {
  const f = fixture(); f.write('App.tsx', 'after'); f.write('Other.tsx', 'staged'); f.git('add', 'Other.tsx'); f.write('Other.tsx', 'unstaged');
  finalizeEditorChanges(f.root, f.diffs, 'editor change');
  expect(f.git('show', 'HEAD:App.tsx')).toBe('after');
  expect(f.git('show', 'HEAD:Other.tsx')).toBe('other');
  expect(f.git('show', ':Other.tsx')).toBe('staged');
  expect(fs.readFileSync(path.join(f.root, 'Other.tsx'), 'utf8')).toBe('unstaged');
});
test.each(['staged', 'external', 'preexisting'])('refuses %s changes in an owned file without changing the index or HEAD', kind => {
  const f = fixture(); f.write('App.tsx', 'after');
  if (kind === 'staged') f.git('add', 'App.tsx');
  if (kind === 'external') f.write('App.tsx', 'outside');
  if (kind === 'preexisting') f.diffs[0].before = 'uncommitted work';
  const head = f.git('rev-parse', 'HEAD'), index = f.git('show', ':App.tsx');
  expect(() => finalizeEditorChanges(f.root, f.diffs, 'bad')).toThrow('GIT_CONFLICT');
  expect(f.git('rev-parse', 'HEAD')).toBe(head); expect(f.git('show', ':App.tsx')).toBe(index);
});
