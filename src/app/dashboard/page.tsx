'use client'

/**
 * Main Dashboard Page - Income Tax Overview
 * 
 * This is the primary dashboard showing the annual income tax (IB) overview.
 * Previously, this content was at /dashboard/ib, but has been moved here to be
 * the main landing page for authenticated users.
 * 
 * Features:
 * - KPI cards (revenue, expenses, profit)
 * - Monthly chart showing revenue vs expenses
 * - Category breakdowns
 * - Cost classification by deductibility
 * - Quick action to create new transactions
 * 
 * Uses global activeYear from YearContext - automatically updates when year changes.
 * Shares transaction creation mechanism with /dashboard/transacties.
 */

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useActiveYear } from '@/contexts/YearContext'
import { getIBSummary, type IBSummary } from './ib/actions'
import KPICards from './ib/components/KPICards'
import CategoryTable from './ib/components/CategoryTable'
import CostClassificationTable from './ib/components/CostClassificationTable'
import Drawer from '@/components/Drawer'
import TransactionForm from '@/components/TransactionForm'
import styles from './ib/ib.module.css'

const MonthlyChart = dynamic(() => import('./ib/components/MonthlyChart'), {
  ssr: false,
  loading: () => <div style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)' }}>Grafiek laden...</div>
})

export default function DashboardPage() {
  // Get active year from global context
  const { activeYear } = useActiveYear()
  
  const [summary, setSummary] = useState<IBSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Transaction drawer state (shared mechanism with Transacties page)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const loadIBSummary = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getIBSummary(activeYear)
      setSummary(data)
    } catch (error) {
      console.error('Failed to load IB summary:', error)
    } finally {
      setIsLoading(false)
    }
  }, [activeYear])

  useEffect(() => {
    loadIBSummary()
  }, [loadIBSummary])

  // Handle transaction creation success
  const handleTransactionSuccess = async () => {
    setIsDrawerOpen(false)
    await loadIBSummary() // Reload dashboard data after creating transaction
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div>
            <h1 className={styles.title}>Jaaroverzicht Inkomstenbelasting</h1>
            <p className={styles.subtitle}>Fiscaal jaar {activeYear}</p>
          </div>
          <button 
            className={styles.primaryButton}
            onClick={() => setIsDrawerOpen(true)}
          >
            Nieuwe transactie
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className={styles.loading}>
          <p>Laden...</p>
        </div>
      ) : summary ? (
        <>
          {/* KPI Cards */}
          <KPICards data={summary.totals} />

          {/* Monthly Chart */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Omzet & Kosten per maand</h2>
            <div className={styles.chartSection}>
              <MonthlyChart data={summary.monthly} />
            </div>
          </section>

          {/* Category Tables */}
          <section className={styles.section}>
            <div className={styles.tablesGrid}>
              <CategoryTable 
                title="Omzet per categorie"
                data={summary.categories.revenue}
              />
              <CategoryTable 
                title="Kosten per categorie"
                data={summary.categories.expenses}
              />
            </div>
          </section>

          {/* Cost Classification */}
          <section className={styles.section}>
            <CostClassificationTable data={summary.classification} />
          </section>
        </>
      ) : (
        <div className={styles.emptyState}>
          <p>Geen gegevens beschikbaar voor {activeYear}</p>
        </div>
      )}

      {/* Transaction creation drawer - reuses same components as Transacties page */}
      <Drawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)}
        title="Nieuwe transactie"
      >
        <TransactionForm 
          mode="create"
          onSuccess={handleTransactionSuccess} 
        />
      </Drawer>
    </div>
  )
}
