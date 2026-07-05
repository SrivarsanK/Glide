import { atom } from 'jotai';
import type { HistoryEntry } from '@glide-dev/core';

export const historyStackAtom = atom<HistoryEntry[]>([]);
export const historyCurrentIndexAtom = atom<number>(-1);
export const historyPanelVisibleAtom = atom<boolean>(false);
