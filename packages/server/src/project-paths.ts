import * as fs from 'node:fs';
import * as path from 'node:path';

const writable = new Set(['.tsx', '.jsx', '.ts', '.js', '.vue', '.svelte', '.astro', '.html', '.css']);

export class ProjectPaths {
  readonly root: string;
  constructor(root: string) { this.root = fs.realpathSync(root); }

  private check(candidate: string): void {
    const relative = path.relative(this.root, candidate);
    if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
      throw new Error('INVALID_PATH: The path is outside the project.');
    }
    if (relative.split(path.sep).some(part => ['.git', 'node_modules'].includes(part.toLowerCase()))) {
      throw new Error('INVALID_PATH: This directory is outside the editing scope.');
    }
  }

  resolve(target: string, mustExist = true): string {
    if (typeof target !== 'string' || !target || target.includes('\0') || /[<>"|?*]/.test(target)) {
      throw new Error('INVALID_PATH: The path is invalid.');
    }
    const normalized = target.replace(/\\/g, '/');
    if (normalized.startsWith('//') || (process.platform !== 'win32' && /^[a-zA-Z]:/.test(normalized))
      || normalized.replace(/^[a-zA-Z]:/, '').includes(':')
      || normalized.split('/').some(part => part !== '.' && part !== '..' && /[. ]$/.test(part))) {
      throw new Error('INVALID_PATH: Alternate path forms are not supported.');
    }
    const absolute = path.resolve(this.root, normalized);
    this.check(absolute);
    if (absolute === this.root) return this.root;
    let parent = path.dirname(absolute);
    while (!fs.existsSync(parent)) {
      if (fs.lstatSync(parent, { throwIfNoEntry: false })?.isSymbolicLink()) {
        throw new Error('INVALID_PATH: A parent link has no valid target.');
      }
      if (mustExist) throw new Error('INVALID_PATH: The parent directory does not exist.');
      parent = path.dirname(parent);
    }
    const canonicalParent = fs.realpathSync(parent);
    this.check(canonicalParent);
    if (!fs.existsSync(absolute)) {
      if (fs.lstatSync(absolute, { throwIfNoEntry: false })?.isSymbolicLink()) {
        throw new Error('INVALID_PATH: The link has no valid target.');
      }
      if (mustExist) throw new Error('INVALID_PATH: The file does not exist.');
      return path.resolve(canonicalParent, path.relative(parent, absolute));
    }
    const canonical = fs.realpathSync(absolute);
    this.check(canonical);
    return canonical;
  }

  sourceFile(target: string): string {
    const canonical = this.resolve(target);
    const stat = fs.statSync(canonical);
    if (!stat.isFile() || !writable.has(path.extname(canonical).toLowerCase()) || stat.nlink > 1) {
      throw new Error('UNSUPPORTED_OPERATION: This file type or hard link is not writable.');
    }
    return canonical;
  }

  contains(target: string): boolean {
    try { this.resolve(target, false); return true; } catch { return false; }
  }

  metadataFile(target: string): string {
    const canonical = this.resolve(target, false);
    if (!['glide-components.json', 'glide-positions.json'].includes(path.basename(canonical))) {
      throw new Error('INVALID_PATH: This is not a Glide metadata file.');
    }
    if (fs.existsSync(canonical)) {
      const stat = fs.statSync(canonical);
      if (!stat.isFile() || stat.nlink > 1) throw new Error('INVALID_PATH: Metadata must be a regular unshared file.');
    }
    return canonical;
  }
}
