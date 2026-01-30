export default function DashboardLoading() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '4rem 2rem' }}>
      {/* Header skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div>
          <div style={{ width: 320, height: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 8, marginBottom: 8 }} />
          <div style={{ width: 160, height: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }} />
        </div>
        <div style={{ width: 140, height: 40, background: 'rgba(255,255,255,0.06)', borderRadius: 20 }} />
      </div>

      {/* KPI cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '2rem 1.5rem' }}>
            <div style={{ width: 120, height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 12 }} />
            <div style={{ width: 160, height: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 6 }} />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '2rem', height: 400, marginBottom: '3rem' }}>
        <div style={{ width: 200, height: 24, background: 'rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: '1.5rem' }} />
      </div>
    </div>
  )
}
