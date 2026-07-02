import { describe, expect, test, vi, beforeEach } from 'vitest';
import { HistoryManager } from '../history.js';

describe('HistoryManager Undo/Redo System', () => {
  let history: HistoryManager;
  let fileRegistry: Record<string, string>;
  let mockWriteFile: any;

  beforeEach(() => {
    history = new HistoryManager();
    fileRegistry = {
      'src/App.tsx': 'Initial content',
    };
    mockWriteFile = vi.fn((path: string, content: string) => {
      fileRegistry[path] = content;
    });
  });

  test('should record changes and support undo/redo', () => {
    history.recordChange('src/App.tsx', 'Initial content', 'First edit');
    expect(history.getUndoStackSize()).toBe(1);
    expect(history.getRedoStackSize()).toBe(0);

    // Perform Undo
    const undonePath = history.undo(mockWriteFile);
    expect(undonePath).toBe('src/App.tsx');
    expect(fileRegistry['src/App.tsx']).toBe('Initial content');
    expect(history.getUndoStackSize()).toBe(0);
    expect(history.getRedoStackSize()).toBe(1);

    // Perform Redo
    const redonePath = history.redo(mockWriteFile);
    expect(redonePath).toBe('src/App.tsx');
    expect(fileRegistry['src/App.tsx']).toBe('First edit');
    expect(history.getUndoStackSize()).toBe(1);
    expect(history.getRedoStackSize()).toBe(0);
  });

  test('should clear redo stack when recording a new change', () => {
    history.recordChange('src/App.tsx', 'Initial content', 'First edit');
    history.undo(mockWriteFile);
    expect(history.getRedoStackSize()).toBe(1);

    history.recordChange('src/App.tsx', 'Initial content', 'New branch edit');
    expect(history.getRedoStackSize()).toBe(0);
  });

  test('should support sequential undos and redos', () => {
    history.recordChange('src/App.tsx', 'Initial content', 'V1');
    history.recordChange('src/App.tsx', 'V1', 'V2');
    history.recordChange('src/App.tsx', 'V2', 'V3');

    expect(history.getUndoStackSize()).toBe(3);

    history.undo(mockWriteFile);
    expect(fileRegistry['src/App.tsx']).toBe('V2');

    history.undo(mockWriteFile);
    expect(fileRegistry['src/App.tsx']).toBe('V1');

    history.redo(mockWriteFile);
    expect(fileRegistry['src/App.tsx']).toBe('V2');

    history.redo(mockWriteFile);
    expect(fileRegistry['src/App.tsx']).toBe('V3');
  });
});
