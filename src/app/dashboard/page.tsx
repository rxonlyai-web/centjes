'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Inbox, FileText, AlertTriangle, Check } from 'lucide-react'
import { useActiveYear } from '@/contexts/YearContext'
import { getIBSummary, type IBSummary } from './ib/actions'
import { getDashboardActionItems, acknowledgeDeadline, type DashboardActionItems } from './actions'
import KPICards from './ib/components/KPICards'
import CategoryTable from './ib/components/CategoryTable'
import CostClassificationTable from './ib/components/CostClassificationTable'
import Drawer from '@/components/Drawer'
import TransactionForm from '@/components/TransactionForm'
import styles from './ib/ib.module.css'
import dashStyles from './dashboard.module.css'

const MonthlyChart = dynamic(() => import('./ib/components/MonthlyChart'), {
  ssr: false,
  loading: () => <div style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)' }}>Grafiek laden...</div>
})

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 12) return 'Goedemorgen'
  if (hour >= 12 && hour < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

export default function DashboardPage() {
  const { activeYear } = useActiveYear()

  const [summary, setSummary] = useState<IBSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [actionItems, setActionItems] = useState<DashboardActionItems | null>(null)
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

  const loadActionItems = useCallback(async () => {
    try {
      const items = await getDashboardActionItems()
      setActionItems(items)
    } catch (error) {
      console.error('Failed to load action items:', error)
    }
  }, [])

  useEffect(() => {
    loadIBSummary()
    loadActionItems()
  }, [loadIBSummary, loadActionItems])

  const handleTransactionSuccess = async () => {
    setIsDrawerOpen(false)
    await loadIBSummary()
    await loadActionItems()
  }

  async function handleAcknowledgeDeadline(deadlineId: string) {
    try {
      await acknowledgeDeadline(deadlineId)
      await loadActionItems()
    } catch (error) {
      console.error('Failed to acknowledge deadline:', error)
    }
  }

  const hasActionItems = actionItems && (
    actionItems.pendingExpenses > 0 ||
    actionItems.draftInvoices > 0 ||
    actionItems.overdueDeadlines.length > 0
  )

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div>
            <h1 className={styles.title}>
              {getGreeting()}{actionItems?.companyName ? `, ${actionItems.companyName}` : ''}
            </h1>
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

      {/* Action Items */}
      {hasActionItems && (
        <section className={dashStyles.actionItems}>
          {actionItems!.pendingExpenses > 0 && (
            <Link href="/dashboard/uitgaven" className={dashStyles.actionCard}>
              <Inbox size={20} className={dashStyles.actionIcon} />
              <div className={dashStyles.actionText}>
                <span className={dashStyles.actionCount}>{actionItems!.pendingExpenses}</span>
                <span className={dashStyles.actionLabel}>
                  {actionItems!.pendingExpenses === 1 ? 'uitgave te beoordelen' : 'uitgaven te beoordelen'}
                </span>
              </div>
            </Link>
          )}

          {actionItems!.draftInvoices > 0 && (
            <Link href="/dashboard/facturen" className={dashStyles.actionCard}>
              <FileText size={20} className={dashStyles.actionIcon} />
              <div className={dashStyles.actionText}>
                <span className={dashStyles.actionCount}>{actionItems!.draftInvoices}</span>
                <span className={dashStyles.actionLabel}>
                  {actionItems!.draftInvoices === 1 ? 'conceptfactuur' : 'conceptfacturen'}
                </span>
              </div>
            </Link>
          )}

          {actionItems!.overdueDeadlines.map(deadline => (
            <div key={deadline.id} className={dashStyles.actionCard}>
              <AlertTriangle size={20} className={dashStyles.actionIconWarning} />
              <div className={dashStyles.actionText}>
                <span className={dashStyles.actionLabel}>
                  {deadline.display_name} — {deadline.days_overdue} {deadline.days_overdue === 1 ? 'dag' : 'dagen'} te laat
                </span>
              </div>
              <button
                onClick={() => handleAcknowledgeDeadline(deadline.id)}
                className={dashStyles.actionDoneBtn}
                type="button"
                title="Markeer als afgehandeld"
              >
                <Check size={16} />
              </button>
            </div>
          ))}
        </section>
      )}

      {isLoading ? (
        <div className={styles.loading}>
          <p>Laden...</p>
        </div>
      ) : summary ? (
        <>
          <KPICards data={summary.totals} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Omzet & Kosten per maand</h2>
            <div className={styles.chartSection}>
              <MonthlyChart data={summary.monthly} />
            </div>
          </section>

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

          <section className={styles.section}>
            <CostClassificationTable data={summary.classification} />
          </section>
        </>
      ) : (
        <div className={styles.emptyState}>
          <p>Geen gegevens beschikbaar voor {activeYear}</p>
        </div>
      )}

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
