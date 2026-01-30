export default function BTWLoading() {
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '4rem 2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ width: 200, height: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 8, marginBottom: 8 }} />
        <div style={{ width: 140, height: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }} />
      </div>

      {/* Quarter selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ width: 60, height: 36, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }} />
        ))}
      </div>

      {/* VAT table skeleton */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '1.5rem' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ height: 44, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.5rem' }}>
            <div style={{ width: 200, height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
            <div style={{ width: 100, height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
