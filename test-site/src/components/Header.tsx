export function Header() {
  return (
    <header style={{
      padding: '0',
      borderBottom: '1px solid var(--border)',
      background: 'rgba(10,10,15,0.85)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: '#fff',
          }}>G</div>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            Glide Test Lab
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            @srivarsank/glide
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a
            href="https://github.com/SrivarsanK/Glide"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--secondary"
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            GitHub ↗
          </a>
          <a
            href="https://www.npmjs.com/package/@srivarsank/glide"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--primary"
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            npm
          </a>
        </div>
      </div>
    </header>
  );
}
