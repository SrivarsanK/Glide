export interface HistoryState {
  filepath: string;
  beforeContent: string;
  afterContent: string;
}

export class HistoryManager {
  private undoStack: HistoryState[] = [];
  private redoStack: HistoryState[] = [];

  public recordChange(filepath: string, beforeContent: string, afterContent: string): void {
    // Avoid recording no-op edits
    if (beforeContent === afterContent) return;

    this.undoStack.push({ filepath, beforeContent, afterContent });
    this.redoStack = []; // Clear redo history on new actions
  }

  public undo(writeFile: (path: string, content: string) => void): string | null {
    const state = this.undoStack.pop();
    if (!state) return null;

    writeFile(state.filepath, state.beforeContent);
    this.redoStack.push(state);
    return state.filepath;
  }

  public redo(writeFile: (path: string, content: string) => void): string | null {
    const state = this.redoStack.pop();
    if (!state) return null;

    writeFile(state.filepath, state.afterContent);
    this.undoStack.push(state);
    return state.filepath;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  public getUndoStackSize(): number {
    return this.undoStack.length;
  }

  public getRedoStackSize(): number {
    return this.redoStack.length;
  }
}
