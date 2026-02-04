'use client'

/**
 * Dashboard Layout Client
 *
 * Wraps all dashboard pages with:
 * - YearProvider: Global year context for year-based filtering
 * - Sidebar: Main navigation (desktop)
 * - BottomNavigation: Mobile navigation
 * - Top bar: Year selector + UserMenu avatar
 */

import { ReactNode, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import BottomNavigation from '@/components/BottomNavigation'
import CameraCapture from '@/components/CameraCapture'
import YearSelector from '@/components/YearSelector'
import UserMenu from '@/components/UserMenu'
import PWAInstallBanner from '@/components/PWAInstallBanner'
import PWAInstallPrompt from '@/components/PWAInstallPrompt'
import { YearProvider } from '@/contexts/YearContext'
import styles from './DashboardLayoutClient.module.css'

export default function DashboardLayoutClient({ children }: { children: ReactNode }) {
  const [showCamera, setShowCamera] = useState(false)

  return (
    <YearProvider>
      <div className={styles.wrapper}>
        <Sidebar />
        <div className={styles.content}>
          <div className={styles.topBar}>
            <div className={styles.topBarLeft}>
              <YearSelector />
            </div>
            <div className={styles.topBarRight}>
              <UserMenu />
            </div>
          </div>
          <PWAInstallBanner />
          <PWAInstallPrompt />
          <div className={styles.mainContent}>
            {children}
          </div>
        </div>
        <BottomNavigation onCameraClick={() => setShowCamera(true)} onNavigate={() => setShowCamera(false)} />
        {showCamera && <CameraCapture onClose={() => setShowCamera(false)} />}
      </div>
    </YearProvider>
  )
}
