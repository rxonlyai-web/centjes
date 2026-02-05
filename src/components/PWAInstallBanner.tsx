'use client'

import { useState, useEffect } from 'react'
import { isNativeApp } from '@/utils/capacitor'
import styles from './PWAInstallBanner.module.css'

const DISMISS_KEY = 'pwa-install-dismissed'
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days

export default function PWAInstallBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const isCapacitor = isNativeApp()

    if (!isIOS || isStandalone || isCapacitor) return

    const dismissedAt = localStorage.getItem(DISMISS_KEY)
    if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DURATION) return

    setShow(true)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setShow(false)
  }

  if (!show) return null

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <p className={styles.text}>
          Installeer Centjes op je beginscherm: tik op{' '}
          <span className={styles.shareIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </span>
          {' '}en kies <strong>&quot;Zet op beginscherm&quot;</strong>
        </p>
      </div>
      <button className={styles.dismiss} onClick={dismiss} aria-label="Sluiten">
        ✕
      </button>
    </div>
  )
}
