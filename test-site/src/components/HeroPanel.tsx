export function HeroPanel() {
  return (
    <section style={{ paddingTop: 48, paddingBottom: 8, textAlign: 'center', position: 'relative' }}>
      {/* Glow orbs */}
      <div style={{
        position: 'absolute', top: 0, left: '30%', width: 400, height: 400,
        background: 'radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 0, right: '25%', width: 300, height: 300,
        background: 'radial-gradient(circle, rgba(34,211,238,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
          background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)',
          borderRadius: 99, fontSize: '0.75rem', color: 'var(--accent-purple)',
          fontWeight: 500, marginBottom: 20, letterSpacing: '0.04em',
        }}>
          ✦ INTERACTIVE STRESS-TEST SUITE
        </div>

        <h1 style={{ marginBottom: 16, background: 'linear-gradient(135deg, var(--text-primary) 40%, var(--accent-purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Glide Package Test Lab
        </h1>

        <p style={{ maxWidth: 560, margin: '0 auto 32px', fontSize: '1.05rem', lineHeight: 1.7 }}>
          Real-time stress testing for <code style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontSize: '0.9em' }}>@srivarsank/glide</code> — 
          WebSocket performance, LWW conflict resolution, SceneGraph hit-testing, and AST write-back.
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          {[
            { label: 'Version', val: '1.1.1', color: 'var(--accent-purple)' },
            { label: 'License', val: 'Apache-2.0', color: 'var(--accent-cyan)' },
            { label: 'Frameworks', val: 'React · Vue · Svelte · Astro', color: 'var(--accent-green)' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{
              padding: '6px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 8, fontSize: '0.8rem',
            }}>
              <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>{label}:</span>
              <span style={{ color, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
