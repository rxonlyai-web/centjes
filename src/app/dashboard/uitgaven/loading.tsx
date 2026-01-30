export default function UitgavenLoading() {
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '4rem 2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div style={{ width: 160, height: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }} />
        <div style={{ width: 140, height: 40, background: 'rgba(255,255,255,0.06)', borderRadius: 20 }} />
      </div>

      {/* Expense cards */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ width: 200, height: 16, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 8 }} />
            <div style={{ width: 140, height: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ width: 60, height: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 16 }} />
            <div style={{ width: 60, height: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 16 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
