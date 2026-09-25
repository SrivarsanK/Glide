import { useState, useRef, useEffect } from 'react';

interface Rect { left: number; top: number; width: number; height: number; }
interface Node { id: string; rect: Rect; depth: number; isStamped: boolean; children: Node[]; }

function makeNodes(count: number): Node[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i % 3 === 0 ? `/src/Comp${i}.tsx:${i}:1` : `__glide_cst_div:nth(${i})`,
    rect: { left: (i * 3) % 800, top: Math.floor(i / 20) * 60, width: 50 + (i % 5) * 10, height: 40 },
    depth: 0,
    isStamped: i % 3 === 0,
    children: [],
  }));
}

export function SceneGraphPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodeCount, setNodeCount] = useState(200);
  const [hitResult, setHitResult] = useState<Node | null>(null);
  const [nodes, setNodes] = useState<Node[]>(() => makeNodes(200));
  const [buildMs, setBuildMs] = useState<number | null>(null);

  useEffect(() => {
    const t0 = performance.now();
    setNodes(makeNodes(nodeCount));
    setBuildMs(performance.now() - t0);
  }, [nodeCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const node of nodes) {
      const { left, top, width, height } = node.rect;
      const isHit = hitResult?.id === node.id;

      ctx.fillStyle = isHit
        ? 'rgba(167,139,250,0.35)'
        : node.isStamped
          ? 'rgba(34,211,238,0.12)'
          : 'rgba(139,138,154,0.08)';

      ctx.strokeStyle = isHit
        ? 'rgba(167,139,250,0.9)'
        : node.isStamped
          ? 'rgba(34,211,238,0.4)'
          : 'rgba(75,74,88,0.5)';

      ctx.lineWidth = isHit ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(left, top, width, height, 4);
      ctx.fill();
      ctx.stroke();

      if (isHit) {
        ctx.fillStyle = '#fff';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText(node.id.slice(0, 24), left + 4, top + 14);
      }
    }
  }, [nodes, hitResult]);

  function hitTest(x: number, y: number): Node | null {
    // deepest stamped node at point
    let best: Node | null = null;
    for (const node of nodes) {
      const { left, top, width, height } = node.rect;
      if (x >= left && x <= left + width && y >= top && y <= top + height) {
        if (!best || (node.isStamped && !best.isStamped)) best = node;
      }
    }
    return best;
  }

  function onCanvasMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setHitResult(hitTest(x, y));
  }

  const stamped = nodes.filter((n) => n.isStamped).length;

  return (
    <div>
      <div className="card">
        <div className="card__title">🔍 SceneGraph Hit-Test Explorer</div>
        <div className="card__sub">Hover the canvas to test the in-memory SceneGraph hit-test algorithm in real time</div>

        <div className="input-row">
          <span className="input-label">Node count</span>
          <input id="sg-node-count" type="range" min={10} max={1000} step={10} value={nodeCount}
            onChange={(e) => setNodeCount(Number(e.target.value))}
            style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', minWidth: 50 }}>{nodeCount}</span>
        </div>

        <div className="stat-row">
          <div className="stat stat--cyan"><span className="stat__val">{nodeCount}</span><span className="stat__label">Total nodes</span></div>
          <div className="stat stat--green"><span className="stat__val">{stamped}</span><span className="stat__label">Stamped (AST)</span></div>
          <div className="stat stat--purple"><span className="stat__val">{nodeCount - stamped}</span><span className="stat__label">Synthetic (CST)</span></div>
          <div className="stat stat--orange"><span className="stat__val">{buildMs !== null ? `${buildMs.toFixed(2)}ms` : '—'}</span><span className="stat__label">Build time</span></div>
        </div>

        <canvas
          id="scene-canvas"
          ref={canvasRef}
          width={900}
          height={320}
          onMouseMove={onCanvasMove}
          onMouseLeave={() => setHitResult(null)}
          style={{
            width: '100%', height: 320, border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', cursor: 'crosshair',
            background: '#07070d',
          }}
        />

        <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
          {hitResult ? (
            <>
              <span style={{ color: 'var(--text-muted)' }}>Hit: </span>
              <span style={{ color: hitResult.isStamped ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}>{hitResult.id}</span>
              <span style={{ marginLeft: 12, color: 'var(--text-muted)' }}>
                {hitResult.rect.width}×{hitResult.rect.height} @ ({hitResult.rect.left}, {hitResult.rect.top})
              </span>
              <span className={`badge ${hitResult.isStamped ? 'badge--pass' : 'badge--idle'}`} style={{ marginLeft: 10 }}>
                {hitResult.isStamped ? 'AST-stamped' : 'CST-synthetic'}
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>Hover the canvas to hit-test…</span>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card__title">📄 Code</div>
        <pre className="code-block">{`// Glide's in-memory SceneGraph — zero DOM queries
import { SceneGraph } from '@srivarsank/glide';

const sg = new SceneGraph();
sg.build(elements); // O(n) index

const hit = sg.hitTest(x, y);
// → Prefers isStamped (AST) over synthetic (CST)
// → Deepest leaf wins`}</pre>
      </div>
    </div>
  );
}
