import { useState } from 'react';

interface BenchResult { name: string; ops: number; ms: number; opsPerSec: number; status: 'pass' | 'fail' | 'idle'; }

function timeIt(fn: () => void, iterations = 1000): number {
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  return performance.now() - t0;
}

// ── Micro benchmarks (pure JS, no package import needed) ─────────────────────

function benchSceneGraphBuild(n: number): number {
  const nodes = Array.from({ length: n }, (_, i) => ({
    id: `node-${i}`,
    rect: { left: i * 2, top: i * 2, right: i * 2 + 50, bottom: i * 2 + 50, width: 50, height: 50 },
    children: [],
  }));
  const index = new Map<string, (typeof nodes)[0]>();
  return timeIt(() => {
    index.clear();
    for (const node of nodes) index.set(node.id, node);
  }, 100);
}

function benchMapLookup(n: number): number {
  const map = new Map<string, number>();
  for (let i = 0; i < n; i++) map.set(`key-${i}`, i);
  return timeIt(() => {
    for (let i = 0; i < n; i++) map.get(`key-${i}`);
  }, 500);
}

function benchTailwindParse(className: string): number {
  return timeIt(() => className.trim().split(/\s+/).filter(Boolean), 10_000);
}

function benchLwwCheck(n: number): number {
  const applied = new Map<string, number>();
  for (let i = 0; i < n; i++) applied.set(`node::prop-${i}`, 1000);
  return timeIt(() => {
    for (let i = 0; i < n; i++) {
      const last = applied.get(`node::prop-${i}`);
      const _ = !last || 2000 >= last;
    }
  }, 500);
}

function benchStringConcat(n: number): number {
  const parts = Array.from({ length: n }, (_, i) => `class-${i}`);
  return timeIt(() => parts.join(' '), 10_000);
}

const BENCHMARKS: { name: string; label: string; run: () => number; iterations: number; threshold: number }[] = [
  {
    name: 'sg-build-1k',
    label: 'SceneGraph build (1 000 nodes) × 100',
    run: () => benchSceneGraphBuild(1000),
    iterations: 100,
    threshold: 500,
  },
  {
    name: 'map-lookup-1k',
    label: 'Map lookup (1 000 keys) × 500',
    run: () => benchMapLookup(1000),
    iterations: 500,
    threshold: 100,
  },
  {
    name: 'tailwind-parse',
    label: 'Tailwind className parse × 10 000',
    run: () => benchTailwindParse('flex items-center p-4 bg-slate-800 text-white rounded-xl border shadow-lg'),
    iterations: 10_000,
    threshold: 50,
  },
  {
    name: 'lww-check-1k',
    label: 'LWW canApply (1 000 props) × 500',
    run: () => benchLwwCheck(1000),
    iterations: 500,
    threshold: 200,
  },
  {
    name: 'str-concat-100',
    label: 'className join (100 tokens) × 10 000',
    run: () => benchStringConcat(100),
    iterations: 10_000,
    threshold: 100,
  },
];

export function PerfBenchPanel() {
  const [results, setResults] = useState<BenchResult[]>(
    BENCHMARKS.map(b => ({ name: b.name, ops: 0, ms: 0, opsPerSec: 0, status: 'idle' }))
  );
  const [running, setRunning] = useState(false);

  async function runAll() {
    setRunning(true);
    const next: BenchResult[] = [];
    for (const bench of BENCHMARKS) {
      // Allow UI to update
      await new Promise<void>((res) => setTimeout(res, 10));
      const ms = bench.run();
      const opsPerSec = Math.round(bench.iterations / (ms / 1000));
      next.push({
        name: bench.name,
        ops: bench.iterations,
        ms: Math.round(ms * 10) / 10,
        opsPerSec,
        status: ms < bench.threshold ? 'pass' : 'fail',
      });
      setResults([...next, ...BENCHMARKS.slice(next.length).map(b => ({ name: b.name, ops: 0, ms: 0, opsPerSec: 0, status: 'idle' as const }))]);
    }
    setRunning(false);
  }

  async function runSingle(benchIdx: number) {
    setRunning(true);
    const bench = BENCHMARKS[benchIdx];
    await new Promise<void>((res) => setTimeout(res, 10));
    const ms = bench.run();
    const opsPerSec = Math.round(bench.iterations / (ms / 1000));
    setResults((prev) => {
      const next = [...prev];
      next[benchIdx] = { name: bench.name, ops: bench.iterations, ms: Math.round(ms * 10) / 10, opsPerSec, status: ms < bench.threshold ? 'pass' : 'fail' };
      return next;
    });
    setRunning(false);
  }

  const allDone = results.every(r => r.status !== 'idle');
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;

  return (
    <div>
      <div className="card">
        <div className="card__title">🚀 Performance Benchmarks</div>
        <div className="card__sub">Pure-JS micro-benchmarks for Glide's hot paths — SceneGraph, LWW, Tailwind parsing</div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <button id="bench-run-all" className="btn btn--primary" onClick={runAll} disabled={running}>
            {running ? '⏳ Running…' : '▶ Run all benchmarks'}
          </button>
          {allDone && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className={`badge ${failed > 0 ? 'badge--fail' : 'badge--pass'}`}>
                {passed}/{BENCHMARKS.length} PASS
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {BENCHMARKS.map((bench, i) => {
            const result = results[i];
            return (
              <div key={bench.name} style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto auto',
                alignItems: 'center',
                gap: 16,
                padding: '12px 16px',
                background: 'var(--bg-elevated)',
                border: `1px solid ${result.status === 'pass' ? 'rgba(52,211,153,0.15)' : result.status === 'fail' ? 'rgba(248,113,113,0.15)' : 'var(--border)'}`,
                borderRadius: 8,
              }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {bench.label}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    threshold &lt; {bench.threshold}ms
                  </div>
                </div>

                <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                  {result.status !== 'idle' ? (
                    <span style={{ color: result.status === 'pass' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {result.ms}ms
                    </span>
                  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </div>

                <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
                  {result.opsPerSec > 0 ? `${(result.opsPerSec / 1000).toFixed(0)}K ops/s` : ''}
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className={`badge badge--${result.status}`}>{result.status}</span>
                  <button
                    className="btn btn--secondary"
                    style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                    disabled={running}
                    onClick={() => runSingle(i)}
                  >
                    ▶
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card__title">📊 Performance Targets</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginTop: 4 }}>
          {[
            { label: 'SceneGraph build (1k)', target: '< 200ms', desc: 'Index construction per full rebuild' },
            { label: 'hitTest per point', target: '< 0.5ms', desc: 'Single pointer event lookup' },
            { label: 'patchMany (500 nodes)', target: '< 5ms', desc: 'Drag update batch' },
            { label: 'Tailwind parse', target: '< 0.01ms', desc: 'Per-character event' },
            { label: 'LWW canApply (1k props)', target: '< 200ms', desc: 'Full conflict scan' },
            { label: 'WS round-trip', target: '< 50ms', desc: 'Edit → ack on localhost' },
          ].map(({ label, target, desc }) => (
            <div key={label} style={{ padding: '12px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 500, marginBottom: 4 }}>{target}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
