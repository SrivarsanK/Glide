import { atom } from 'jotai';
import type { HistoryEntry, StagedPatch } from '@srivarsank/core';

export const historyStackAtom = atom<HistoryEntry[]>([]);
export const historyCurrentIndexAtom = atom<number>(-1);
export const historyPanelVisibleAtom = atom<boolean>(false);

export const stagedPatchesAtom = atom<Map<string, StagedPatch[]>>(new Map());
export const stagingModeAtom = atom<boolean>(true);
export const previewModeAtom = atom<'after' | 'before'>('after');

export const stagedCountAtom = atom((get) => {
  const patches = get(stagedPatchesAtom);
  let count = 0;
  patches.forEach((arr) => {
    count += arr.length;
  });
  return count;
});

