'use client'

/**
 * Dashboard Layout Client
 *
 * Wraps all dashboard pages with:
 * - YearProvider: Global year context for year-based filtering
 * - Sidebar: Main navigation (desktop)
 * - BottomNavigation: Mobile navigation
 * - Top bar: Contains global year selector
 */

import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import BottomNavigation from '@/components/BottomNavigation'
import CameraCapture from '@/components/CameraCapture'
import YearSelector from '@/components/YearSelector'
import TaxNotifications from '@/components/TaxNotifications'
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
            <div className={styles.topBarLeft}></div>
            <div className={styles.topBarRight}>
              <TaxNotifications />
              <YearSelector />
              <Link href="/dashboard/instellingen" className={styles.settingsButton} aria-label="Instellingen">
                <Settings size={20} />
              </Link>
            </div>
          </div>
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
