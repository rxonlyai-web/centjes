'use client'

/**
 * Dashboard Layout Client
 * 
 * Wraps all dashboard pages with:
 * - YearProvider: Global year context for year-based filtering
 * - Sidebar: Main navigation
 * - Top bar: Contains global year selector
 */

import { ReactNode } from 'react'
import Sidebar from '@/components/Sidebar'
import YearSelector from '@/components/YearSelector'
import TaxNotifications from '@/components/TaxNotifications'
import { YearProvider } from '@/contexts/YearContext'
import styles from './DashboardLayoutClient.module.css'

export default function DashboardLayoutClient({ children }: { children: ReactNode }) {
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
            </div>
          </div>
          <div className={styles.mainContent}>
            {children}
          </div>
        </div>
      </div>
    </YearProvider>
  )
}
