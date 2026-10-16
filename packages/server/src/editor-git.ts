import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ProjectPaths } from './project-paths.js';

/** Finalize only complete editor-owned changes in previously clean tracked files. */
export function finalizeEditorChanges(projectRoot: string, diffs: { file: string; before: string; after: string }[], message: string): string {
  const paths = new ProjectPaths(projectRoot);
  const git = (args: string[]) => execFileSync('git', args, { cwd: paths.root, encoding: 'utf8', windowsHide: true });
  const root = fs.realpathSync.native(git(['rev-parse', '--show-toplevel']).trim());
  const owned = new Map<string, { before: string; after: string }>();
  for (const diff of diffs) {
    const file = paths.sourceFile(diff.file);
    const prior = owned.get(file);
    if (prior && prior.after !== diff.before) throw new Error('GIT_CONFLICT: History includes external edits; commit these changes manually.');
    owned.set(file, { before: prior?.before ?? diff.before, after: diff.after });
  }
  const files: string[] = [];
  for (const [file, diff] of owned) {
    if (diff.before === diff.after) continue;
    const relative = path.relative(root, fs.realpathSync.native(file)).replace(/\\/g, '/');
    if (relative.startsWith('../') || path.isAbsolute(relative)) throw new Error('GIT_CONFLICT: Source is outside the repository.');
    if (fs.readFileSync(file, 'utf8') !== diff.after) throw new Error('GIT_CONFLICT: An editor-owned file has newer external changes.');
    let head: string, staged: string;
    try { head = git(['show', `HEAD:${relative}`]); staged = git(['show', `:${relative}`]); }
    catch { throw new Error('GIT_CONFLICT: Only previously tracked, clean files can be finalized automatically.'); }
    if (head !== diff.before || staged !== diff.before) throw new Error('GIT_CONFLICT: Preserve existing work in this file by committing manually.');
    files.push(relative);
  }
  if (!files.length) throw new Error('GIT_CONFLICT: No editor-owned changes to commit.');
  // --only commits these working-tree paths and preserves unrelated index entries.
  git(['commit', '--only', '-m', message, '--', ...files]);
  return git(['rev-parse', 'HEAD']).trim();
}
