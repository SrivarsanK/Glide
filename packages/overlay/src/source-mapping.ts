export interface SourceReference {
  file: string;
  line: number;
  column: number;
  hash: string | null;
}

export interface SelectionRemap {
  oldSourceId: string;
  oldHash: string;
  newHash: string;
  newCoordinates: { line: number; column: number };
}

/** Self-contained so the same typed implementation can run in the served shell. */
export function createSourceMapping() {
  function parse(source: unknown, currentFile?: string | null): SourceReference | null {
    if (typeof source !== 'string') return null;
    const local = source.match(/^line:([0-9]+):col:([0-9]+)(?::([a-fA-F0-9]+))?$/);
    // Non-greedy filename also handles hashes consisting entirely of digits.
    const full = local ? null : source.match(/^(.*?):([0-9]+):([0-9]+)(?::([a-fA-F0-9]+))?$/);
    const file = local ? currentFile : full?.[1];
    const parts = local || full?.slice(1);
    if (!file || !parts) return null;
    const line = Number(parts[1]);
    const column = Number(parts[2]) + (local ? 1 : 0);
    if (!Number.isSafeInteger(line) || line < 1 || !Number.isSafeInteger(column) || column < 1) return null;
    return { file: file.split(String.fromCharCode(92)).join('/'), line, column, hash: parts[3] || null };
  }

  function remap(source: string, remaps: SelectionRemap[], currentFile?: string | null): string {
    const target = parse(source, currentFile);
    if (!target) return source;
    const id = `${target.file}:${target.line}:${target.column}`;
    const match = remaps.find(item => item.oldSourceId === id && (!target.hash || target.hash === item.oldHash));
    if (!match) return source;
    return `${target.file}:${match.newCoordinates.line}:${match.newCoordinates.column}:${match.newHash}`;
  }

  return { parse, remap };
}
