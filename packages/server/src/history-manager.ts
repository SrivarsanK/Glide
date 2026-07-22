import * as crypto from 'crypto';
import { HistoryEntry, FileDiff } from '@srivarsank/core';

export class HistoryStore {
  private maxHistory = 100;
  private stack: HistoryEntry[] = [];
  private currentIndex = -1;

  public setLimit(limit: number): void {
    this.maxHistory = Math.min(Math.max(limit, 1), 1000);
  }

  public push(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): void {
    this.stack = this.stack.slice(0, this.currentIndex + 1);
    const now = Date.now();

    if (entry.squashKey && this.stack.length > 0) {
      const last = this.stack[this.stack.length - 1];
      const windowMs = entry.squashWindowMs ?? 2000;
      if (last.squashKey === entry.squashKey && now - last.timestamp < windowMs) {
        last.description = entry.description;
        last.timestamp = now;
        for (const newDiff of entry.diffs) {
          const existing = last.diffs.find(d => d.file === newDiff.file);
          if (existing) {
            existing.after = newDiff.after;
          } else {
            last.diffs.push(newDiff);
          }
        }
        this.currentIndex = this.stack.length - 1;
        return;
      }
    }

    const full: HistoryEntry = {
      id: crypto.randomUUID(),
      timestamp: now,
      ...entry
    };

    this.stack.push(full);
    this.currentIndex = this.stack.length - 1;

    if (this.stack.length > this.maxHistory) {
      this.stack.shift();
      this.currentIndex = this.stack.length - 1;
    }
  }

  public undo(): FileDiff[] | null {
    if (this.currentIndex < 0) return null;
    const entry = this.stack[this.currentIndex];
    this.currentIndex -= 1;
    return entry.diffs;
  }

  public redo(): FileDiff[] | null {
    if (this.currentIndex >= this.stack.length - 1) return null;
    this.currentIndex += 1;
    const entry = this.stack[this.currentIndex];
    return entry.diffs;
  }

  public jumpTo(targetIndex: number): { file: string; content: string }[] {
    if (targetIndex < -1 || targetIndex >= this.stack.length) return [];
    const writes: { file: string; content: string }[] = [];

    if (targetIndex > this.currentIndex) {
      for (let i = this.currentIndex + 1; i <= targetIndex; i++) {
        for (const diff of this.stack[i].diffs) {
          writes.push({ file: diff.file, content: diff.after });
        }
      }
    } else if (targetIndex < this.currentIndex) {
      for (let i = this.currentIndex; i > targetIndex; i--) {
        for (const diff of this.stack[i].diffs) {
          writes.push({ file: diff.file, content: diff.before });
        }
      }
    }

    this.currentIndex = targetIndex;
    return writes;
  }

  public getState(): { stack: HistoryEntry[]; currentIndex: number } {
    return { stack: [...this.stack], currentIndex: this.currentIndex };
  }

  public clear(): void {
    this.stack = [];
    this.currentIndex = -1;
  }
}

const defaultStore = new HistoryStore();

export function setHistoryLimit(limit: number): void {
  defaultStore.setLimit(limit);
}

export function pushHistory(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): void {
  defaultStore.push(entry);
}

export function undo(): FileDiff[] | null {
  return defaultStore.undo();
}

export function redo(): FileDiff[] | null {
  return defaultStore.redo();
}

export function jumpTo(targetIndex: number): { file: string; content: string }[] {
  return defaultStore.jumpTo(targetIndex);
}

export function getHistoryState(): { stack: HistoryEntry[]; currentIndex: number } {
  return defaultStore.getState();
}

export function clearHistory(): void {
  defaultStore.clear();
}
