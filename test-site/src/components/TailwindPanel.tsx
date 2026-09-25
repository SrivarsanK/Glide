import { useState } from 'react';

// Pure client-side Tailwind class rewriting — same logic as Glide's ast-writer
function parseTailwindClasses(className: string): string[] {
  return className.trim().split(/\s+/).filter(Boolean);
}

const PREFIX_MAP: Record<string, RegExp> = {
  bg: /^bg-/,
  text: /^text-(?!left|right|center|justify|opacity|ellipsis|clip|nowrap|wrap|balance|pretty|decoration)/,
  p: /^p-|^px-|^py-|^pt-|^pr-|^pb-|^pl-/,
  m: /^m-|^mx-|^my-|^mt-|^mr-|^mb-|^ml-/,
  w: /^w-/,
  h: /^h-/,
  rounded: /^rounded/,
  border: /^border-/,
  font: /^font-/,
  opacity: /^opacity-/,
  shadow: /^shadow/,
};

function updateTailwindClasses(
  current: string,
  prefix: keyof typeof PREFIX_MAP,
  newToken: string
): string {
  const regex = PREFIX_MAP[prefix];
  if (!regex) return current + ' ' + newToken;
  const existing = parseTailwindClasses(current);
  const filtered = existing.filter((c) => !regex.test(c));
  return [...filtered, newToken].join(' ');
}

const SAMPLE = 'flex items-center justify-between p-4 bg-slate-800 text-white rounded-xl border-slate-700 shadow-lg font-medium';

const PRESETS: [string, string, string][] = [
  ['bg', 'bg-violet-600', 'Background'],
  ['bg', 'bg-emerald-500', 'Background'],
  ['text', 'text-yellow-300', 'Text color'],
  ['p', 'p-8', 'Padding'],
  ['rounded', 'rounded-full', 'Border radius'],
  ['shadow', 'shadow-2xl shadow-violet-900/50', 'Shadow'],
  ['font', 'font-bold', 'Font weight'],
  ['opacity', 'opacity-80', 'Opacity'],
];

export function TailwindPanel() {
  const [className, setClassName] = useState(SAMPLE);
  const [history, setHistory] = useState<string[]>([SAMPLE]);
  const [prefix, setPrefix] = useState<keyof typeof PREFIX_MAP>('bg');
  const [token, setToken] = useState('bg-indigo-600');

  function apply(pfx: keyof typeof PREFIX_MAP, tok: string) {
    const next = updateTailwindClasses(className, pfx, tok);
    setClassName(next);
    setHistory((h) => [...h.slice(-10), next]);
  }

  function applyCustom() {
    apply(prefix, token);
  }

  function reset() {
    setClassName(SAMPLE);
    setHistory([SAMPLE]);
  }

  const classes = parseTailwindClasses(className);

  return (
    <div>
      <div className="card">
        <div className="card__title">🎨 Tailwind Class Rewriter</div>
        <div className="card__sub">Surgical prefix-isolated token replacement — same algorithm as Glide's AST write-back</div>

        {/* Live preview */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500,
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
          }}>Live Preview</div>
          <div style={{
            padding: 24, background: 'var(--bg-elevated)', borderRadius: 12, minHeight: 80,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              padding: '12px 24px',
              background: className.includes('bg-violet') ? 'rgb(124,58,237)'
                : className.includes('bg-emerald') ? 'rgb(16,185,129)'
                : className.includes('bg-indigo') ? 'rgb(99,102,241)'
                : className.includes('bg-rose') ? 'rgb(244,63,94)'
                : 'rgb(30,41,59)',
              color: className.includes('text-yellow') ? 'rgb(253,224,71)' : '#fff',
              borderRadius: className.includes('rounded-full') ? 9999 : className.includes('rounded-xl') ? 12 : 6,
              fontWeight: className.includes('font-bold') ? 700 : 500,
              opacity: className.includes('opacity-80') ? 0.8 : 1,
              boxShadow: className.includes('shadow-2xl') ? '0 25px 50px -12px rgba(139,92,246,0.5)' : '0 4px 12px rgba(0,0,0,0.3)',
              fontSize: '0.9rem',
              transition: 'all 0.2s ease',
            }}>
              Glide component preview
            </div>
          </div>
        </div>

        {/* Preset buttons */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Quick presets
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PRESETS.map(([pfx, tok, label]) => (
              <button
                key={tok}
                className="btn btn--secondary"
                onClick={() => apply(pfx as keyof typeof PREFIX_MAP, tok)}
                style={{ fontSize: '0.78rem', padding: '5px 12px' }}
              >
                {label}: <code style={{ color: 'var(--accent-cyan)', marginLeft: 4, fontSize: '0.75rem' }}>{tok.split(' ')[0]}</code>
              </button>
            ))}
            <button className="btn btn--danger" onClick={reset} style={{ fontSize: '0.78rem', padding: '5px 12px' }}>Reset</button>
          </div>
        </div>

        {/* Custom input */}
        <div className="input-row">
          <span className="input-label">Prefix</span>
          <select id="tw-prefix" className="input" value={prefix}
            onChange={(e) => setPrefix(e.target.value as keyof typeof PREFIX_MAP)} style={{ maxWidth: 120 }}>
            {Object.keys(PREFIX_MAP).map((k) => <option key={k}>{k}</option>)}
          </select>
          <input id="tw-token" className="input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="e.g. bg-rose-500" />
          <button id="tw-apply" className="btn btn--primary" onClick={applyCustom} style={{ whiteSpace: 'nowrap' }}>Apply</button>
        </div>

        {/* Token chips */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
          {classes.map((c) => (
            <code key={c} style={{
              padding: '2px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 4, fontSize: '0.78rem', color: 'var(--text-code)', fontFamily: 'var(--font-mono)',
            }}>{c}</code>
          ))}
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          className=&quot;{className}&quot;
        </div>
      </div>

      <div className="card">
        <div className="card__title">⏮ Rewrite History</div>
        <div style={{ maxHeight: 160, overflowY: 'auto' }}>
          {[...history].reverse().map((h, i) => (
            <div key={i} style={{
              padding: '6px 10px', marginBottom: 4,
              background: i === 0 ? 'rgba(167,139,250,0.08)' : 'var(--bg-elevated)',
              border: `1px solid ${i === 0 ? 'rgba(167,139,250,0.2)' : 'var(--border)'}`,
              borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: '0.73rem',
              color: i === 0 ? 'var(--accent-purple)' : 'var(--text-secondary)',
            }}>
              {i === 0 ? '▶ ' : `${i}. `}{h}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card__title">📄 Code</div>
        <pre className="code-block">{`import { updateTailwindClasses, parseTailwindClasses } from '@srivarsank/glide';

const before = 'flex items-center p-4 bg-slate-800 text-white rounded-xl';

// Surgical: only replaces bg-* tokens, keeps everything else
const after = updateTailwindClasses(before, { bg: 'bg-violet-600' });
// → 'flex items-center p-4 bg-violet-600 text-white rounded-xl'

const tokens = parseTailwindClasses(after);
// → ['flex', 'items-center', 'p-4', 'bg-violet-600', 'text-white', 'rounded-xl']`}</pre>
      </div>
    </div>
  );
}
