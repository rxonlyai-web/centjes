export default function BelastingenLoading() {
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '4rem 2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ width: 240, height: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 8, marginBottom: 8 }} />
        <div style={{ width: 180, height: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }} />
      </div>

      {/* Deadline cards */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ width: 200, height: 16, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 8 }} />
            <div style={{ width: 120, height: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 4 }} />
          </div>
          <div style={{ width: 80, height: 32, background: 'rgba(255,255,255,0.06)', borderRadius: 16 }} />
        </div>
      ))}
    </div>
  )
}
