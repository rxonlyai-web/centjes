'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, Receipt, Camera, FileText, MoreHorizontal, Inbox, Calculator, Calendar, Settings } from 'lucide-react'
import styles from './BottomNavigation.module.css'

interface BottomNavigationProps {
  onCameraClick: () => void
  onNavigate?: () => void
}

export default function BottomNavigation({ onCameraClick, onNavigate }: BottomNavigationProps) {
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Transacties', href: '/dashboard/transacties', icon: Receipt },
    { name: 'Camera', href: '#', icon: Camera, isCamera: true },
    { name: 'Facturen', href: '/dashboard/facturen', icon: FileText },
    { name: 'Meer', href: '#', icon: MoreHorizontal, isMore: true },
  ]

  const moreItems = [
    { name: 'Uitgaven', href: '/dashboard/uitgaven', icon: Inbox },
    { name: 'BTW', href: '/dashboard/btw', icon: Calculator },
    { name: 'Belastingen', href: '/dashboard/belastingen', icon: Calendar },
    { name: 'Instellingen', href: '/dashboard/instellingen', icon: Settings },
  ]

  // Check if current page is in "more" items
  const isMoreActive = moreItems.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))

  return (
    <>
      {/* More bottom sheet */}
      {showMore && (
        <div className={styles.moreBackdrop} onClick={() => setShowMore(false)} />
      )}
      {showMore && (
        <div className={styles.moreSheet}>
          <div className={styles.moreHandle} />
          <nav className={styles.moreNav}>
            {moreItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.moreItem} ${isActive ? styles.moreItemActive : ''}`}
                  onClick={() => {
                    setShowMore(false)
                    onNavigate?.()
                  }}
                >
                  <Icon size={22} />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      )}

      <nav className={styles.bottomNav}>
        {navItems.map((item) => {
          const Icon = item.icon

          if (item.isCamera) {
            return (
              <button
                key={item.name}
                onClick={onCameraClick}
                className={styles.cameraButton}
                aria-label="Scan bon"
              >
                <Icon size={28} />
              </button>
            )
          }

          if (item.isMore) {
            return (
              <button
                key={item.name}
                onClick={() => setShowMore(!showMore)}
                className={`${styles.navItem} ${isMoreActive || showMore ? styles.active : ''}`}
                aria-label="Meer opties"
              >
                <Icon size={24} />
                <span className={styles.label}>{item.name}</span>
              </button>
            )
          }

          const isActive = item.href !== '#' && pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                setShowMore(false)
                onNavigate?.()
              }}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <Icon size={24} />
              <span className={styles.label}>{item.name}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
