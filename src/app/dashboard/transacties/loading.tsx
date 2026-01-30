export default function TransactiesLoading() {
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '4rem 2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div style={{ width: 180, height: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }} />
        <div style={{ width: 160, height: 40, background: 'rgba(255,255,255,0.06)', borderRadius: 20 }} />
      </div>

      {/* KPI badges */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ flex: 1, height: 60, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }} />
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 80, height: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 16 }} />
        ))}
      </div>

      {/* Transaction rows */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{ height: 56, background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 1rem', gap: '1rem' }}>
          <div style={{ width: 80, height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
          <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }} />
          <div style={{ width: 80, height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
        </div>
      ))}
    </div>
  )
}
