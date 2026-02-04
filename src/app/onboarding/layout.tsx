import { ReactNode } from 'react'

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#0f1117',
    }}>
      {children}
    </div>
  )
}
