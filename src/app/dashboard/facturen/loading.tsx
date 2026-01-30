export default function FacturenLoading() {
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '4rem 2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div style={{ width: 160, height: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }} />
        <div style={{ width: 160, height: 40, background: 'rgba(255,255,255,0.06)', borderRadius: 20 }} />
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ width: 70, height: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 16 }} />
        ))}
      </div>

      {/* Invoice rows */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ height: 72, background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 1rem', gap: '1rem' }}>
          <div style={{ width: 100, height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
          <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }} />
          <div style={{ width: 80, height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
          <div style={{ width: 60, height: 24, background: 'rgba(255,255,255,0.06)', borderRadius: 12 }} />
        </div>
      ))}
    </div>
  )
}
