'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, Receipt, Camera, FileText, Calculator } from 'lucide-react'
import styles from './BottomNavigation.module.css'

interface BottomNavigationProps {
  onCameraClick: () => void
  onNavigate?: () => void
}

export default function BottomNavigation({ onCameraClick, onNavigate }: BottomNavigationProps) {
  const pathname = usePathname()

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Transacties', href: '/dashboard/transacties', icon: Receipt },
    { name: 'Camera', href: '#', icon: Camera, isCamera: true },
    { name: 'Facturen', href: '/dashboard/facturen', icon: FileText },
    { name: 'BTW', href: '/dashboard/btw', icon: Calculator },
  ]

  return (
    <nav className={styles.bottomNav}>
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = item.href !== '#' && pathname === item.href

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

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`${styles.navItem} ${isActive ? styles.active : ''}`}
          >
            <Icon size={24} />
            <span className={styles.label}>{item.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
