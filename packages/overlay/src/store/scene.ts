import { atom } from 'jotai';
import type { HistoryEntry } from '@srivarsank/core';

export const historyStackAtom = atom<HistoryEntry[]>([]);
export const historyCurrentIndexAtom = atom<number>(-1);
export const historyPanelVisibleAtom = atom<boolean>(false);
