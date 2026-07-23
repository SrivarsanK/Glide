import { describe, expect, test, beforeEach } from 'vitest';
import { HistoryStore } from '../../packages/server/src/history-manager.js';

describe('HistoryStore Undo/Redo System', () => {
  let store: HistoryStore;

  beforeEach(() => {
    store = new HistoryStore();
  });

  test('should record changes and support undo/redo', () => {
    store.push({
      description: 'First edit',
      diffs: [{ file: 'src/App.tsx', before: 'Initial content', after: 'First edit' }]
    });

    const state1 = store.getState();
    expect(state1.stack.length).toBe(1);
    expect(state1.currentIndex).toBe(0);

    // Perform Undo
    const undoneDiffs = store.undo();
    expect(undoneDiffs).not.toBeNull();
    expect(undoneDiffs![0].file).toBe('src/App.tsx');
    expect(undoneDiffs![0].before).toBe('Initial content');
    expect(store.getState().currentIndex).toBe(-1);

    // Perform Redo
    const redoneDiffs = store.redo();
    expect(redoneDiffs).not.toBeNull();
    expect(redoneDiffs![0].file).toBe('src/App.tsx');
    expect(redoneDiffs![0].after).toBe('First edit');
    expect(store.getState().currentIndex).toBe(0);
  });

  test('should clear redo stack when recording a new change', () => {
    store.push({
      description: 'First edit',
      diffs: [{ file: 'src/App.tsx', before: 'Initial content', after: 'First edit' }]
    });
    store.undo();
    expect(store.getState().currentIndex).toBe(-1);

    store.push({
      description: 'New branch edit',
      diffs: [{ file: 'src/App.tsx', before: 'Initial content', after: 'New branch edit' }]
    });
    expect(store.getState().stack.length).toBe(1);
    expect(store.getState().currentIndex).toBe(0);
  });

  test('should support sequential undos and redos', () => {
    store.push({
      description: 'V1',
      diffs: [{ file: 'src/App.tsx', before: 'Initial content', after: 'V1' }]
    });
    store.push({
      description: 'V2',
      diffs: [{ file: 'src/App.tsx', before: 'V1', after: 'V2' }]
    });
    store.push({
      description: 'V3',
      diffs: [{ file: 'src/App.tsx', before: 'V2', after: 'V3' }]
    });

    expect(store.getState().stack.length).toBe(3);

    const diff1 = store.undo();
    expect(diff1![0].before).toBe('V2');

    const diff2 = store.undo();
    expect(diff2![0].before).toBe('V1');

    const redo1 = store.redo();
    expect(redo1![0].after).toBe('V2');

    const redo2 = store.redo();
    expect(redo2![0].after).toBe('V3');
  });
});
