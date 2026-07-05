import React from 'react';
import { useAtom } from 'jotai';
import { historyPanelVisibleAtom } from '../store/scene.js';

interface ClockIconProps {
  size?: number;
}

function ClockIcon({ size = 16 }: ClockIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function Toolbar() {
  const [historyPanelVisible, setHistoryPanelVisible] = useAtom(historyPanelVisibleAtom);

  return (
    <button
      onClick={() => setHistoryPanelVisible(!historyPanelVisible)}
      title="History (Ctrl+Alt+H)"
      className={historyPanelVisible ? 'active' : ''}
    >
      <ClockIcon size={16} />
    </button>
  );
}
