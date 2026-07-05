import React from 'react';
import { useAtom } from 'jotai';
import { historyStackAtom, historyCurrentIndexAtom, historyPanelVisibleAtom } from '../store/scene.js';

export function HistoryPanel() {
  const [stack] = useAtom(historyStackAtom);
  const [currentIndex] = useAtom(historyCurrentIndexAtom);
  const [visible, setVisible] = useAtom(historyPanelVisibleAtom);

  if (!visible) return null;

  const handleRowClick = (index: number) => {
    // Sends JUMP_TO_HISTORY via WebSocket
    window.dispatchEvent(new CustomEvent('glide-jump-history', { detail: { index } }));
  };

  const getRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'just now';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="history-panel" style={{ width: '260px', position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 1000, background: '#2c2c2c', borderRight: '1px solid #333' }}>
      <div className="history-header" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333' }}>
        <button onClick={() => setVisible(false)} style={{ background: 'transparent', border: 'none', color: '#b3b3b3', cursor: 'pointer' }}>← back</button>
        <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '12px' }}>HISTORY</span>
        <button disabled style={{ background: 'transparent', border: 'none', color: '#666', fontSize: '11px', cursor: 'not-allowed' }}>clear</button>
      </div>
      <div className="history-body" style={{ overflowY: 'auto', height: 'calc(100% - 40px)' }}>
        {stack.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#b3b3b3', fontSize: '12px', lineHeight: '1.5' }}>
            No edits yet.<br />Make a change on the canvas to start building history.
          </div>
        ) : (
          <div className="history-list">
            <div
              className={`history-row ${currentIndex === -1 ? 'current' : ''}`}
              onClick={() => handleRowClick(-1)}
              style={{
                padding: '8px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderLeft: currentIndex === -1 ? '2px solid #0d99ff' : '2px solid transparent',
                background: currentIndex === -1 ? 'rgba(13, 153, 255, 0.1)' : 'transparent',
                color: currentIndex === -1 ? '#fff' : '#b3b3b3'
              }}
            >
              <span style={{ color: '#0d99ff' }}>●</span>
              <span style={{ fontSize: '11px' }}>[initial state]</span>
            </div>
            {stack.map((entry, index) => {
              const isCurrent = index === currentIndex;
              const isPast = index < currentIndex;
              const isFuture = index > currentIndex;
              return (
                <div
                  key={entry.id}
                  className={`history-row ${isCurrent ? 'current' : ''}`}
                  onClick={() => handleRowClick(index)}
                  style={{
                    padding: '8px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderLeft: isCurrent ? '2px solid #0d99ff' : '2px solid transparent',
                    background: isCurrent ? 'rgba(13, 153, 255, 0.1)' : 'transparent',
                    opacity: isFuture ? 0.4 : 1,
                    color: isCurrent ? '#fff' : '#b3b3b3'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: isCurrent ? '#0d99ff' : '#888' }}>{isPast || isCurrent ? '●' : '○'}</span>
                    <span style={{ fontSize: '11px', fontStyle: isFuture ? 'italic' : 'normal' }}>{entry.description}</span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#666' }}>{getRelativeTime(entry.timestamp)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
