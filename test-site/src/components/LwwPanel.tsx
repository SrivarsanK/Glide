import { useState } from 'react';

interface AppliedOp { nodeId: string; prop: string; value: unknown; timestamp: number; }
interface PendingOp { opId: string; nodeId: string; prop: string; timestamp: number; }
interface QueueState { applied: Map<string, AppliedOp>; pending: Map<string, PendingOp>; }

function makeKey(nodeId: string, prop: string) { return `${nodeId}::${prop}`; }

function useQueue() {
  const [state, setState] = useState<QueueState>({ applied: new Map(), pending: new Map() });
  const [log, setLog] = useState<{ text: string; kind: 'ok' | 'err' | 'warn' | 'dim' }[]>([
    { text: '// LWW Queue simulator — no server needed', kind: 'dim' },
  ]);

  const addLog = (text: string, kind: 'ok' | 'err' | 'warn' | 'dim') => {
    setLog((prev) => [...prev.slice(-60), { text, kind }]);
  };

  function canApply(nodeId: string, prop: string, ts: number): boolean {
    const last = state.applied.get(makeKey(nodeId, prop));
    return !last || ts >= last.timestamp;
  }

  function recordApplied(nodeId: string, prop: string, value: unknown, ts: number) {
    const key = makeKey(nodeId, prop);
    if (!canApply(nodeId, prop, ts)) {
      addLog(`✗ STALE_PROPERTY_WRITE: ${prop}@${ts} < applied@${state.applied.get(key)!.timestamp}`, 'err');
      return false;
    }
    setState((prev) => {
      const next = { ...prev, applied: new Map(prev.applied) };
      next.applied.set(key, { nodeId, prop, value, timestamp: ts });
      return next;
    });
    addLog(`✓ Applied ${prop}="${value}" @ t=${ts}`, 'ok');
    return true;
  }

  function clear() {
    setState({ applied: new Map(), pending: new Map() });
    setLog([{ text: '// Cleared.', kind: 'dim' }]);
  }

  return { state, log, recordApplied, canApply, clear };
}

const PROPS = ['width', 'height', 'color', 'fontSize', 'opacity', 'padding', 'background'];
const NODE = 'src/App.tsx:10:5';

export function LwwPanel() {
  const { state, log, recordApplied, canApply, clear } = useQueue();
  const [prop, setProp] = useState('width');
  const [value, setValue] = useState('200px');
  const [ts, setTs] = useState(Date.now());

  function sendManual() {
    recordApplied(NODE, prop, value, ts);
    setTs(Date.now());
  }

  function runRace() {
    // Simulate two clients racing on the same property
    const t1 = Date.now();
    recordApplied(NODE, 'width', '100px', t1);
    // Client 2 with OLDER timestamp (stale)
    setTimeout(() => recordApplied(NODE, 'width', '50px', t1 - 500), 100);
    // Client 2 with NEWER timestamp (wins)
    setTimeout(() => recordApplied(NODE, 'width', '300px', t1 + 1000), 200);
  }

  function runIndependent() {
    const t = Date.now();
    PROPS.forEach((p, i) => {
      setTimeout(() => recordApplied(NODE, p, `${i * 10}px`, t - i * 100), i * 50);
    });
  }

  const appliedArr = Array.from(state.applied.values()).sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div>
      <div className="card">
        <div className="card__title">⚖️ LWW Delta Queue Simulator</div>
        <div className="card__sub">Simulate Glide's property-level Last-Writer-Wins conflict resolution — no server needed</div>

        <div className="grid-2">
          <div>
            <div className="input-row">
              <span className="input-label">Property</span>
              <select id="lww-prop" className="input" value={prop} onChange={(e) => setProp(e.target.value)} style={{ maxWidth: 160 }}>
                {PROPS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="input-row">
              <span className="input-label">Value</span>
              <input id="lww-value" className="input" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="input-row">
              <span className="input-label">Timestamp</span>
              <input id="lww-ts" type="number" className="input" value={ts} onChange={(e) => setTs(Number(e.target.value))} />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <button id="lww-send" className="btn btn--primary" onClick={sendManual}>Send write</button>
              <button id="lww-race" className="btn btn--secondary" onClick={runRace}>⚡ Race simulation</button>
              <button id="lww-independent" className="btn btn--secondary" onClick={runIndependent}>🎯 7 props parallel</button>
              <button id="lww-clear" className="btn btn--danger" onClick={clear}>Clear</button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>
              Applied ops ({appliedArr.length})
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {appliedArr.length === 0 ? (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>Empty — send a write</span>
              ) : appliedArr.map((op) => (
                <div key={makeKey(op.nodeId, op.prop)} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 10px', marginBottom: 4,
                  background: 'var(--bg-elevated)', borderRadius: 6,
                  fontSize: '0.78rem', fontFamily: 'var(--font-mono)',
                }}>
                  <span style={{ color: 'var(--accent-cyan)' }}>{op.prop}</span>
                  <span style={{ color: 'var(--text-primary)', margin: '0 8px' }}>{String(op.value)}</span>
                  <span style={{ color: 'var(--text-muted)' }}>t={op.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__title">📋 LWW Event Log</div>
        <div className="log">
          {log.map((l, i) => (
            <span key={i} className={`log__line log__line--${l.kind}`}>{l.text}{'\n'}</span>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card__title">📄 How LWW works</div>
        <pre className="code-block">{`// PropertyDeltaQueue — per (nodeId, propKey) logical clock
import { PropertyDeltaQueue } from '@srivarsank/glide';

const q = new PropertyDeltaQueue();
q.recordApplied('node:10:5', 'width', '200px', 2000);

// Same property, stale timestamp → rejected
q.canApplyLWW('node:10:5', 'width', 1500); // false

// Different property → ALWAYS independent
q.canApplyLWW('node:10:5', 'color', 1500); // true ✓`}</pre>
      </div>
    </div>
  );
}
