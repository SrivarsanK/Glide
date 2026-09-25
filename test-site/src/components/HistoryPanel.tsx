import { useState } from 'react';

interface Diff { file: string; before: string; after: string; }
interface HistEntry { id: number; desc: string; timestamp: number; diffs: Diff[]; squashKey?: string; }

export function HistoryPanel() {
  const [stack, setStack] = useState<HistEntry[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [desc, setDesc] = useState('Change bg-color');
  const [squash, setSquash] = useState(false);
  const [squashKey, setSquashKey] = useState('node::background');
  const nextId = { current: 0 };

  function push() {
    const newEntry: HistEntry = {
      id: nextId.current++,
      desc,
      timestamp: Date.now(),
      diffs: [{ file: 'src/App.tsx', before: `v${cursor}`, after: `v${cursor + 1}` }],
      squashKey: squash ? squashKey : undefined,
    };

    // Squash logic — same key within 2s
    const newStack = stack.slice(0, cursor + 1);
    if (squash && squashKey && newStack.length > 0) {
      const last = newStack[newStack.length - 1];
      const windowMs = 2000;
      if (last.squashKey === squashKey && Date.now() - last.timestamp < windowMs) {
        last.desc = desc;
        last.timestamp = Date.now();
        last.diffs = [{ file: 'src/App.tsx', before: last.diffs[0].before, after: newEntry.diffs[0].after }];
        setStack([...newStack]);
        setCursor(newStack.length - 1);
        return;
      }
    }

    newStack.push(newEntry);
    setStack(newStack);
    setCursor(newStack.length - 1);
  }

  function undo() {
    if (cursor < 0) return;
    setCursor((c) => c - 1);
  }

  function redo() {
    if (cursor >= stack.length - 1) return;
    setCursor((c) => c + 1);
  }

  function jumpTo(idx: number) {
    if (idx < -1 || idx >= stack.length) return;
    setCursor(idx);
  }

  function clear() {
    setStack([]);
    setCursor(-1);
  }

  return (
    <div>
      <div className="card">
        <div className="card__title">⏳ History Manager</div>
        <div className="card__sub">Simulates Glide's HistoryStore — squash, undo, redo, jump-to</div>

        <div className="input-row">
          <span className="input-label">Description</span>
          <input id="hist-desc" className="input" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div className="input-row">
          <span className="input-label">Squash</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input id="hist-squash" type="checkbox" checked={squash} onChange={(e) => setSquash(e.target.checked)} />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Enable 2s squash window</span>
          </label>
        </div>
        {squash && (
          <div className="input-row">
            <span className="input-label">Squash key</span>
            <input id="hist-squash-key" className="input" value={squashKey} onChange={(e) => setSquashKey(e.target.value)} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button id="hist-push" className="btn btn--primary" onClick={push}>+ Push entry</button>
          <button id="hist-undo" className="btn btn--secondary" onClick={undo} disabled={cursor < 0}>↩ Undo</button>
          <button id="hist-redo" className="btn btn--secondary" onClick={redo} disabled={cursor >= stack.length - 1}>↪ Redo</button>
          <button id="hist-clear" className="btn btn--danger" onClick={clear}>Clear</button>
        </div>

        <div className="stat-row">
          <div className="stat stat--cyan"><span className="stat__val">{stack.length}</span><span className="stat__label">Stack size</span></div>
          <div className="stat stat--purple"><span className="stat__val">{cursor}</span><span className="stat__label">Cursor</span></div>
          <div className="stat stat--green"><span className="stat__val">{cursor >= 0 ? 'yes' : 'no'}</span><span className="stat__label">Can undo</span></div>
          <div className="stat stat--orange"><span className="stat__val">{cursor < stack.length - 1 ? 'yes' : 'no'}</span><span className="stat__label">Can redo</span></div>
        </div>
      </div>

      {stack.length > 0 && (
        <div className="card">
          <div className="card__title">📚 History Stack</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[...stack].reverse().map((entry, revIdx) => {
              const idx = stack.length - 1 - revIdx;
              const isCurrent = idx === cursor;
              return (
                <div
                  key={entry.id}
                  onClick={() => jumpTo(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                    background: isCurrent ? 'rgba(167,139,250,0.1)' : 'var(--bg-elevated)',
                    border: `1px solid ${isCurrent ? 'rgba(167,139,250,0.3)' : 'var(--border)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                    color: isCurrent ? 'var(--accent-purple)' : 'var(--text-muted)',
                    minWidth: 20,
                  }}>{idx}</span>
                  <span style={{ flex: 1, fontSize: '0.85rem', color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {entry.desc}
                  </span>
                  {entry.squashKey && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {entry.squashKey}
                    </span>
                  )}
                  {isCurrent && <span className="badge badge--pass">CURRENT</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card__title">📄 Code</div>
        <pre className="code-block">{`import { GlideServer, HistoryStore } from '@srivarsank/glide';

// HistoryStore with squash (drag events collapse to one entry)
const store = new HistoryStore();
store.setLimit(100);

store.push({
  description: 'Resize width',
  squashKey: 'node-x::width',    // same key within 2s = squash
  squashWindowMs: 2000,
  diffs: [{ file: 'App.tsx', before: '100px', after: '200px' }],
});

const diffs = store.undo();  // returns diffs to restore 'before'
store.redo();                // re-applies 'after'
store.jumpTo(3);             // jump to specific history index`}</pre>
      </div>
    </div>
  );
}
