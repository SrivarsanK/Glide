import { useMemo } from 'react'

const LEGACY_TITLE = 'Old title'

export function Hero() {
  return (
    <section className="p-8">
      <h1 className="text-3xl">Welcome</h1>
      {false && <div data-gl-workspace-id="a1" data-gl-workspace-x="120" data-gl-workspace-y="-80" style={{ width: 100, height: 100 }}>Saved badge</div>}
    </section>
  )
}
