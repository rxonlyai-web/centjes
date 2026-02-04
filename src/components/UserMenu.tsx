'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Settings, LogOut } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import styles from './UserMenu.module.css'

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [initials, setInitials] = useState('?')
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setUserEmail(user.email)
        setInitials(user.email.substring(0, 2).toUpperCase())
      }
    }
    loadUser()
  }, [])

  // Close on outside click (desktop)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [isOpen])

  // Prevent body scroll when bottom sheet is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [isOpen])

  async function handleSignOut() {
    await supabase.auth.signOut()
    setIsOpen(false)
    router.push('/login')
  }

  return (
    <div className={styles.container} ref={menuRef}>
      <button
        className={styles.avatar}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Gebruikersmenu"
        aria-expanded={isOpen}
      >
        {initials}
      </button>

      {/* Backdrop (mobile only) */}
      {isOpen && (
        <div className={styles.backdrop} onClick={() => setIsOpen(false)} />
      )}

      {/* Menu content — dropdown on desktop, bottom sheet on mobile */}
      {isOpen && (
        <div className={styles.menu}>
          <div className={styles.handle} />
          {userEmail && (
            <div className={styles.userInfo}>
              <span className={styles.email}>{userEmail}</span>
            </div>
          )}
          <nav className={styles.menuNav}>
            <Link
              href="/dashboard/instellingen"
              className={styles.menuItem}
              onClick={() => setIsOpen(false)}
            >
              <Settings size={20} />
              <span>Instellingen</span>
            </Link>
            <button className={styles.menuItem} onClick={handleSignOut}>
              <LogOut size={20} />
              <span>Uitloggen</span>
            </button>
          </nav>
        </div>
      )}
    </div>
  )
}
