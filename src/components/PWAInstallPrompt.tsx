'use client'

import { useState, useEffect, useRef } from 'react'
import { isNativeApp } from '@/utils/capacitor'
import styles from './PWAInstallPrompt.module.css'

const DISMISS_KEY = 'pwa-prompt-dismissed'
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstallPrompt() {
  const [show, setShow] = useState(false)
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (isNativeApp()) return
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const dismissedAt = localStorage.getItem(DISMISS_KEY)
    if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DURATION) return

    function handlePrompt(e: Event) {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setShow(true)
    }

    window.addEventListener('beforeinstallprompt', handlePrompt)
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt)
  }, [])

  async function handleInstall() {
    const prompt = deferredPrompt.current
    if (!prompt) return

    await prompt.prompt()
    const { outcome } = await prompt.userChoice

    if (outcome === 'accepted') {
      setShow(false)
    }
    deferredPrompt.current = null
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setShow(false)
  }

  if (!show) return null

  return (
    <div className={styles.banner}>
      <p className={styles.text}>
        Installeer Centjes als app voor snelle toegang.
      </p>
      <div className={styles.actions}>
        <button className={styles.install} onClick={handleInstall}>
          Installeren
        </button>
        <button className={styles.dismiss} onClick={dismiss} aria-label="Sluiten">
          ✕
        </button>
      </div>
    </div>
  )
}
