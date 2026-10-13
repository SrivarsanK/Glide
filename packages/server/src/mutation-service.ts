import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { transformJSXBatch } from '@srivarsank/ast-writer';
import { parse } from '@babel/parser';
import type { HistoryStore } from './history-manager.js';

export function contentDigest(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export interface MutationOperation {
  operationId: string;
  filePath: string;
  expectedDigest: string;
  line: number;
  column: number;
  hash?: string;
  change: { type: string; property?: string; value?: any; breakpoint?: string; pseudoState?: string };
}

export interface MutationResult {
  transactionId: string;
  success: boolean;
  changedFiles: { path: string; newDigest: string; revisionId: string }[];
  operationResults: { operationId: string; ok: boolean; error?: string }[];
  selectionRemaps: { oldSourceId: string; newCoordinates: { line: number; column: number } }[];
  error?: string;
}

interface BufferState {
  file: string;
  before: string;
  after: string;
  mode: number;
  temporary?: string;
}

/** Apply edits in memory before any file write. */
export class MutationService {
  private queue: Promise<unknown> = Promise.resolve();
  private completed = new Map<string, { signature: string; result: MutationResult }>();
  readonly projectRoot: string;

  constructor(projectRoot: string, private readonly options: {
    rename?: typeof fs.renameSync;
    onPersist?: (diffs: { file: string; before: string; after: string }[]) => void;
  } = {}) {
    this.projectRoot = fs.realpathSync(projectRoot);
  }

  execute(transactionId: string, operations: MutationOperation[]): Promise<MutationResult> {
    const run = this.queue.then(() => this.apply(transactionId, operations));
    this.queue = run.catch(() => undefined);
    return run;
  }

  restoreHistory(transactionId: string, history: HistoryStore, action: 'undo' | 'redo' | number): Promise<MutationResult> {
    const run = this.queue.then(() => {
      const state = history.getState();
      const target = typeof action === 'number' ? action : action === 'undo' ? state.currentIndex - 1 : state.currentIndex + 1;
      const plan = history.prepareRestore(target);
      const operations = plan.writes.map((diff, index): MutationOperation => ({
        operationId: `${transactionId}:${index}`, filePath: diff.file, expectedDigest: contentDigest(diff.before),
        line: 1, column: 1, change: { type: 'restore' },
      }));
      return this.apply(transactionId, operations, { contents: plan.writes.map(diff => diff.after), confirm: plan.confirm });
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private resolveFile(file: string): string {
    if (typeof file !== 'string' || file.includes('\0')) throw new Error('INVALID_PATH: File path is invalid.');
    const resolved = fs.realpathSync(path.resolve(this.projectRoot, file));
    const relative = path.relative(this.projectRoot, resolved);
    if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
      throw new Error('INVALID_PATH: File is outside the project.');
    }
    if (!/\.(tsx|jsx|ts|js)$/.test(resolved)) {
      throw new Error('UNSUPPORTED_OPERATION: This adapter does not support transactions.');
    }
    return resolved;
  }

  private apply(transactionId: string, operations: MutationOperation[], restoration?: {
    contents: string[]; confirm: () => void;
  }): MutationResult {
    const failure = (error: string): MutationResult => ({
      transactionId, success: false, error, changedFiles: [], selectionRemaps: [],
      operationResults: operations.map(op => ({ operationId: op.operationId, ok: false, error })),
    });
    const buffers = new Map<string, BufferState>();
    const written: BufferState[] = [];
    const rename = this.options.rename ?? fs.renameSync;
    try {
      if (!transactionId || !operations.length) throw new Error('INVALID_TRANSACTION: A transaction needs an ID and operations.');
      const signature = contentDigest(JSON.stringify(operations));
      const previous = this.completed.get(transactionId);
      if (previous) {
        if (previous.signature !== signature) throw new Error('TRANSACTION_CONFLICT: This ID belongs to another request.');
        return previous.result;
      }
      const ids = new Set<string>();
      const targets = operations.map(op => {
        if (!op.operationId || ids.has(op.operationId)) throw new Error('INVALID_OPERATION: Operation IDs must be unique.');
        ids.add(op.operationId);
        if (!Number.isInteger(op.line) || op.line < 1 || !Number.isInteger(op.column) || op.column < 1) {
          throw new Error('INVALID_TARGET: Source coordinates are missing.');
        }
        const file = this.resolveFile(op.filePath);
        let buffer = buffers.get(file);
        if (!buffer) {
          const before = fs.readFileSync(file, 'utf8');
          buffer = { file, before, after: before, mode: fs.statSync(file).mode };
          buffers.set(file, buffer);
        }
        if (contentDigest(buffer.before) !== op.expectedDigest) {
          throw new Error(`STALE_DIGEST: File changed before operation ${op.operationId}.`);
        }
        return buffer;
      });
      const selectionRemaps: MutationResult['selectionRemaps'] = [];
      for (const buffer of buffers.values()) {
        if (restoration) {
          buffer.after = restoration.contents[targets.indexOf(buffer)];
          parse(buffer.after, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
          continue;
        }
        const edits = operations.filter((_, index) => targets[index] === buffer);
        const transformed = transformJSXBatch(buffer.before, edits);
        buffer.after = transformed.code;
        selectionRemaps.push(...transformed.remaps.map(remap => ({
          oldSourceId: `${buffer.file.replace(/\\/g, '/')}:${remap.oldLine}:${remap.oldColumn}`,
          newCoordinates: remap.newCoordinates,
        })));
      }
      for (const buffer of buffers.values()) {
        if (buffer.after !== buffer.before) {
          buffer.temporary = path.join(path.dirname(buffer.file), `.glide-${randomUUID()}.tmp`);
          fs.writeFileSync(buffer.temporary, buffer.after, { encoding: 'utf8', flag: 'wx', mode: buffer.mode });
        }
      }
      const check = (buffer: BufferState) => {
        if (this.resolveFile(buffer.file) !== buffer.file || fs.readFileSync(buffer.file, 'utf8') !== buffer.before) {
          throw new Error('STALE_DIGEST: File changed before persistence.');
        }
      };
      for (const buffer of buffers.values()) check(buffer);
      for (const buffer of buffers.values()) {
        if (!buffer.temporary) continue;
        check(buffer);
        rename(buffer.temporary, buffer.file);
        buffer.temporary = undefined;
        written.push(buffer);
      }
      if (restoration) restoration.confirm();
      else this.options.onPersist?.(written.map(({ file, before, after }) => ({ file, before, after })));
      const result: MutationResult = {
        transactionId, success: true,
        changedFiles: written.map(buffer => ({ path: buffer.file, newDigest: contentDigest(buffer.after), revisionId: randomUUID() })),
        operationResults: operations.map(op => ({ operationId: op.operationId, ok: true })),
        selectionRemaps,
      };
      this.completed.set(transactionId, { signature, result });
      return result;
    } catch (error) {
      let reason = error instanceof Error ? error.message : String(error);
      for (const buffer of written.reverse()) {
        try {
          if (fs.readFileSync(buffer.file, 'utf8') !== buffer.after) {
            throw new Error('RECOVERY_CONFLICT: An external edit prevents rollback.');
          }
          const recovery = path.join(path.dirname(buffer.file), `.glide-${randomUUID()}.tmp`);
          fs.writeFileSync(recovery, buffer.before, { encoding: 'utf8', flag: 'wx', mode: buffer.mode });
          fs.renameSync(recovery, buffer.file);
        } catch (rollbackError) {
          reason += ` ${String(rollbackError)}`;
        }
      }
      return failure(reason);
    } finally {
      for (const buffer of buffers.values()) {
        if (buffer.temporary && fs.existsSync(buffer.temporary)) fs.unlinkSync(buffer.temporary);
      }
    }
  }
}
