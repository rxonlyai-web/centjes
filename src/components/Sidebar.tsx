'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TrendingUp, Receipt, FileText, Settings, LogOut, Menu, X, Calculator } from 'lucide-react'
import styles from './Sidebar.module.css'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import LogoWhite from '@/assets/Logo white.svg'

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: TrendingUp },
    { name: 'Transacties', href: '/dashboard/transacties', icon: Receipt },
    { name: 'BTW', href: '/dashboard/btw', icon: Calculator },
    { name: 'Facturen', href: '/dashboard/facturen', icon: FileText },
    { name: 'Instellingen', href: '/dashboard/instellingen', icon: Settings },
  ]

  const handleLinkClick = () => {
    setIsMobileOpen(false)
  }

  return (
    <>
      {/* Hamburger button (mobile only) */}
      <button 
        className={styles.hamburger}
        onClick={() => setIsMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={24} />
      </button>

      {/* Overlay (mobile only) */}
      <div 
        className={`${styles.overlay} ${isMobileOpen ? styles.open : ''}`}
        onClick={() => setIsMobileOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isMobileOpen ? styles.open : ''}`}>
        <div className={styles.header}>
          <Link href="/dashboard" className={styles.logo}>
            <img 
              src={LogoWhite.src} 
              alt="Centjes Logo" 
              style={{ height: '48px', width: 'auto' }}
            />
            <span>Centjes</span>
          </Link>
          <button 
            className={styles.closeButton}
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            
            if (item.disabled) {
              return (
                <div
                  key={item.href}
                  className={`${styles.link} ${styles.disabled}`}
                  aria-disabled="true"
                >
                  <Icon size={20} />
                  <span>{item.name}</span>
                  <span className={styles.badge}>Working on it</span>
                </div>
              )
            }
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.link} ${isActive ? styles.active : ''}`}
                onClick={handleLinkClick}
              >
                <Icon size={20} />
                <span>{item.name}</span>
                {item.badge && item.badge > 0 && (
                  <span className={styles.notificationBadge}>{item.badge}</span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className={styles.footer}>
          <button onClick={handleSignOut} className={styles.link} style={{ width: '100%' }}>
            <LogOut size={20} />
            <span>Uitloggen</span>
          </button>
        </div>
      </aside>
    </>
  )
}
