import * as crypto from 'crypto';
import { HistoryEntry, FileDiff } from '@glide-dev/core';

// --- State (module-level, in-memory only) ---

let MAX_HISTORY = 100;   // configurable via glide.config.ts historyLimit

let stack: HistoryEntry[] = [];
let currentIndex: number = -1;   // points to the currently applied entry
                                 // -1 means no history yet (initial state)

// --- Public API ---

export function setHistoryLimit(limit: number): void {
  MAX_HISTORY = Math.min(Math.max(limit, 1), 1000);
}

/**
 * Call this AFTER a successful fs.writeFileSync in the AST writer.
 * Records what changed and updates the stack.
 */
export function pushHistory(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): void {
  // Discard everything after currentIndex (new action kills future states)
  stack = stack.slice(0, currentIndex + 1);

  // Build full entry
  const full: HistoryEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...entry
  };

  stack.push(full);
  currentIndex = stack.length - 1;

  // Enforce cap — drop oldest entry when over limit
  if (stack.length > MAX_HISTORY) {
    stack.shift();
    currentIndex = stack.length - 1;
  }
}

/**
 * Undo: move currentIndex backward by 1.
 * Applies the `before` content of the current entry.
 * Returns the list of files written so the WebSocket handler can ACK.
 */
export function undo(): FileDiff[] | null {
  if (currentIndex < 0) return null;   // nothing to undo

  const entry = stack[currentIndex];
  currentIndex -= 1;
  return entry.diffs;   // caller writes entry.diffs[i].before to disk
}

/**
 * Redo: move currentIndex forward by 1.
 * Applies the `after` content of the next entry.
 * Returns the list of files written so the WebSocket handler can ACK.
 */
export function redo(): FileDiff[] | null {
  if (currentIndex >= stack.length - 1) return null;   // nothing to redo

  currentIndex += 1;
  const entry = stack[currentIndex];
  return entry.diffs;   // caller writes entry.diffs[i].after to disk
}

/**
 * Jump to any arbitrary index in the stack.
 * Used by the history panel when the developer clicks a past state.
 * Applies `after` for all entries up to targetIndex,
 * applies `before` for all entries after targetIndex.
 *
 * Returns: { file, content }[] — all files to write in this jump.
 */
export function jumpTo(targetIndex: number): { file: string; content: string }[] {
  if (targetIndex < -1 || targetIndex >= stack.length) return [];

  const writes: { file: string; content: string }[] = [];

  if (targetIndex > currentIndex) {
    // Moving forward — apply `after` for each entry between current+1 and target
    for (let i = currentIndex + 1; i <= targetIndex; i++) {
      for (const diff of stack[i].diffs) {
        writes.push({ file: diff.file, content: diff.after });
      }
    }
  } else if (targetIndex < currentIndex) {
    // Moving backward — apply `before` for each entry between current and target+1
    for (let i = currentIndex; i > targetIndex; i--) {
      for (const diff of stack[i].diffs) {
        writes.push({ file: diff.file, content: diff.before });
      }
    }
  }

  currentIndex = targetIndex;
  return writes;
}

/**
 * Returns the full stack and current index for the overlay UI.
 * Called when the overlay connects or requests a refresh.
 */
export function getHistoryState(): { stack: HistoryEntry[]; currentIndex: number } {
  return { stack: [...stack], currentIndex };
}

/**
 * Clears all history. Called on server restart only.
 * The overlay should never call this.
 */
export function clearHistory(): void {
  stack = [];
  currentIndex = -1;
}
