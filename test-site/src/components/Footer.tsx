export function Footer() {
  return (
    <footer style={{
      padding: '32px 0',
      borderTop: '1px solid var(--border)',
      textAlign: 'center',
    }}>
      <div className="container">
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 8 }}>
          <strong style={{ color: 'var(--text-secondary)' }}>Glide Test Lab</strong> — Interactive stress test suite for{' '}
          <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontSize: '0.8em' }}>@srivarsank/glide</code>
        </p>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Apache-2.0 · Built by{' '}
          <a href="https://github.com/SrivarsanK" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--accent-purple)', textDecoration: 'none' }}>
            SrivarsanK
          </a>
        </p>
      </div>
    </footer>
  );
}
