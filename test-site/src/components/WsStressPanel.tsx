import { useState, useRef, useCallback } from 'react';

interface LogEntry { text: string; kind: 'ok' | 'err' | 'info' | 'warn' | 'dim'; }
interface Stats { sent: number; accepted: number; rejected: number; errors: number; latencyMs: number; }

const GLIDE_WS = 'ws://localhost:7891';

export function WsStressPanel() {
  const [wsUrl, setWsUrl] = useState(GLIDE_WS);
  const [concurrency, setConcurrency] = useState(10);
  const [editCount, setEditCount] = useState(50);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<Stats>({ sent: 0, accepted: 0, rejected: 0, errors: 0, latencyMs: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([
    { text: '// Ready. Start a Glide server first: npx glide', kind: 'dim' },
    { text: '// Then run any stress test below.', kind: 'dim' },
  ]);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((text: string, kind: LogEntry['kind'] = 'info') => {
    setLogs((prev) => {
      const next = [...prev, { text, kind }].slice(-100);
      setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 0);
      return next;
    });
  }, []);

  async function openWs(): Promise<WebSocket> {
    return new Promise((res, rej) => {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => res(ws);
      ws.onerror = () => rej(new Error(`Cannot connect to ${wsUrl}`));
      setTimeout(() => rej(new Error('WS connection timeout (3s)')), 3000);
    });
  }

  async function runConcurrentClients() {
    setRunning(true);
    setProgress(0);
    const newStats: Stats = { sent: 0, accepted: 0, rejected: 0, errors: 0, latencyMs: 0 };
    addLog(`⚡ Spawning ${concurrency} concurrent clients, ${editCount} edits each…`, 'info');
    const t0 = performance.now();

    const results = await Promise.allSettled(
      Array.from({ length: concurrency }, async (_, i) => {
        let ws: WebSocket;
        try {
          ws = await openWs();
        } catch (e: any) {
          addLog(`✗ Client-${i}: ${e.message}`, 'err');
          return;
        }

        for (let j = 0; j < editCount; j++) {
          const msg = JSON.stringify({
            type: 'edit',
            file: 'src/App.tsx',
            line: (i * editCount + j) % 200 + 1,
            column: 1,
            timestamp: Date.now() + j,
            change: { type: 'class', property: 'className', value: `tw-client${i}-edit${j}` },
          });

          await new Promise<void>((res2) => {
            ws.send(msg);
            newStats.sent++;

            ws.addEventListener('message', (e) => {
              const resp = JSON.parse(e.data);
              if (resp.type === 'status') {
                if (resp.success) newStats.accepted++;
                else if (resp.error?.includes('STALE')) newStats.rejected++;
                else newStats.errors++;
                res2();
              }
            }, { once: true });
          });

          setProgress(Math.round(((i * editCount + j + 1) / (concurrency * editCount)) * 100));
        }

        ws!.close();
      })
    );

    const elapsed = performance.now() - t0;
    newStats.latencyMs = Math.round(elapsed);
    setStats({ ...newStats });

    const failures = results.filter((r) => r.status === 'rejected').length;
    addLog(`✓ Done in ${elapsed.toFixed(0)}ms — ${newStats.accepted} accepted, ${newStats.rejected} stale, ${newStats.errors + failures} errors`, 'ok');
    setProgress(100);
    setRunning(false);
  }

  async function runBurstTest() {
    setRunning(true);
    setProgress(0);
    addLog(`🔥 Burst test: ${editCount} sequential edits on 1 connection…`, 'warn');

    let ws: WebSocket;
    try {
      ws = await openWs();
    } catch (e: any) {
      addLog(`✗ ${e.message}`, 'err');
      setRunning(false);
      return;
    }

    const t0 = performance.now();
    let accepted = 0, rejected = 0;

    for (let i = 0; i < editCount; i++) {
      const ts = i % 3 === 0 ? i * 10 : (editCount - i) * 10; // scrambled timestamps
      await new Promise<void>((res2) => {
        ws.send(JSON.stringify({
          type: 'edit',
          file: 'src/App.tsx',
          line: 5,
          column: 2,
          timestamp: ts,
          change: { type: 'style', value: { width: `${i * 2}px` } },
        }));
        ws.addEventListener('message', (e) => {
          const resp = JSON.parse(e.data);
          if (resp.type === 'status') {
            if (resp.success) accepted++;
            else rejected++;
            res2();
          }
        }, { once: true });
      });
      setProgress(Math.round(((i + 1) / editCount) * 100));
    }

    const elapsed = performance.now() - t0;
    setStats((s) => ({ ...s, sent: editCount, accepted, rejected, latencyMs: Math.round(elapsed) }));
    addLog(`✓ Burst: ${accepted} accepted, ${rejected} stale (LWW), ${elapsed.toFixed(0)}ms total`, 'ok');
    ws.close();
    setRunning(false);
  }

  return (
    <div>
      <div className="card">
        <div className="card__title">⚡ WebSocket Stress Test</div>
        <div className="card__sub">Connect to a running Glide server and hammer it with real WS messages</div>

        <div className="input-row">
          <span className="input-label">WS URL</span>
          <input id="ws-url" className="input" value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} placeholder="ws://localhost:7891" />
        </div>
        <div className="input-row">
          <span className="input-label">Clients</span>
          <input id="ws-concurrency" type="number" className="input" value={concurrency} min={1} max={100}
            onChange={(e) => setConcurrency(Number(e.target.value))} style={{ maxWidth: 120 }} />
          <span className="input-label" style={{ marginLeft: 12 }}>Edits/client</span>
          <input id="ws-edit-count" type="number" className="input" value={editCount} min={1} max={1000}
            onChange={(e) => setEditCount(Number(e.target.value))} style={{ maxWidth: 120 }} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button id="btn-concurrent" className="btn btn--primary" onClick={runConcurrentClients} disabled={running}>
            {running ? '⏳ Running…' : '⚡ Concurrent clients'}
          </button>
          <button id="btn-burst" className="btn btn--secondary" onClick={runBurstTest} disabled={running}>
            🔥 Burst (1 client, LWW flood)
          </button>
        </div>

        <div className="progress">
          <div className="progress__fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="stat-row">
          <div className="stat stat--cyan"><span className="stat__val">{stats.sent}</span><span className="stat__label">Sent</span></div>
          <div className="stat stat--green"><span className="stat__val">{stats.accepted}</span><span className="stat__label">Accepted</span></div>
          <div className="stat stat--orange"><span className="stat__val">{stats.rejected}</span><span className="stat__label">Stale (LWW)</span></div>
          <div className="stat stat--red"><span className="stat__val">{stats.errors}</span><span className="stat__label">Errors</span></div>
          <div className="stat stat--purple"><span className="stat__val">{stats.latencyMs}ms</span><span className="stat__label">Total time</span></div>
        </div>
      </div>

      <div className="card">
        <div className="card__title">📋 Event Log</div>
        <div className="log" ref={logRef}>
          {logs.map((l, i) => (
            <span key={i} className={`log__line log__line--${l.kind}`}>{l.text}</span>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card__title">📄 Usage</div>
        <pre className="code-block">{`// 1. Start a Glide server (from your project dir):
npx glide

// 2. Or programmatically:
import { GlideServer } from '@srivarsank/glide';
const server = new GlideServer(7891);
server.onEdit((file, line, col, change) => {
  console.log('Edit:', file, line, col, change);
});
await server.start();`}</pre>
      </div>
    </div>
  );
}
