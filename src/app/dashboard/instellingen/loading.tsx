export default function InstellingenLoading() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '4rem 2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ width: 180, height: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }} />
      </div>

      {/* Form skeleton */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '2rem' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ marginBottom: '1.5rem' }}>
            <div style={{ width: 120, height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 8 }} />
            <div style={{ height: 40, background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
