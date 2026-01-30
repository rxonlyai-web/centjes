'use client'

/**
 * Transacties Page - Full transaction management with financial overview
 * 
 * Features:
 * - Financial KPI totals (inkomsten, uitgaven, resultaat - all excl. VAT)
 * - Month filter to view transactions for specific periods
 * - List all transactions with filtering (Alles / Inkomsten / Uitgaven)
 * - Click transaction to open in edit mode
 * - Create new transactions via "Nieuwe Transactie" button
 * - Edit and delete existing transactions
 * 
 * Note: KPI totals show all transactions for the selected period (year + month),
 * regardless of the active tab filter. The tab only affects which rows are visible in the list.
 */

import { useState, useEffect, useCallback } from 'react'
import { useActiveYear } from '@/contexts/YearContext'
import styles from './transacties.module.css'
import Drawer from '@/components/Drawer'
import TransactionForm from '@/components/TransactionForm'
import TransactionDetailsPanel from '@/components/TransactionDetailsPanel'
import TransactionFilter from '@/components/dashboard/TransactionFilter'
import TransactionList from '@/components/dashboard/TransactionList'
import KPIBadge from '@/components/dashboard/KPIBadge'
import MonthSelector from '@/components/dashboard/MonthSelector'
import { getTransactionsWithTotals } from '../actions'

type FilterType = 'ALLES' | 'INKOMSTEN' | 'UITGAVEN'
type PanelType = 'none' | 'new' | 'details'

interface Transaction {
  id: string
  datum: string
  omschrijving: string
  bedrag: number
  type_transactie: 'INKOMSTEN' | 'UITGAVEN'
  categorie: string
  btw_tarief: number
  vat_treatment?: 'domestic' | 'foreign_service_reverse_charge'
  bon_url?: string
}

export default function TransactiesPage() {
  const { activeYear } = useActiveYear()
  
  const [panelType, setPanelType] = useState<PanelType>('none')
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALLES')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Financial totals (VAT-excluded)
  const [totals, setTotals] = useState({
    inkomsten: 0,
    uitgaven: 0,
    resultaat: 0
  })
  
  // Month filter state
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)

  // Pagination state
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Set default month based on active year
  useEffect(() => {
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1 // 1-12
    
    if (activeYear === currentYear) {
      setSelectedMonth(currentMonth)
    } else {
      setSelectedMonth(null) // "Alle maanden"
    }
  }, [activeYear])

  const loadTransactions = useCallback(async () => {
    setIsLoading(true)
    setPage(0)
    try {
      const data = await getTransactionsWithTotals(activeYear, selectedMonth, 0)
      setTransactions(data.transactions as Transaction[])
      setTotals(data.totals)
      setHasMore(data.hasMore)
    } catch (error) {
      console.error('Failed to load transactions:', error)
    } finally {
      setIsLoading(false)
    }
  }, [activeYear, selectedMonth])

  const loadMore = useCallback(async () => {
    const nextPage = page + 1
    setIsLoadingMore(true)
    try {
      const data = await getTransactionsWithTotals(activeYear, selectedMonth, nextPage)
      setTransactions(prev => [...prev, ...(data.transactions as Transaction[])])
      setHasMore(data.hasMore)
      setPage(nextPage)
    } catch (error) {
      console.error('Failed to load more transactions:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }, [activeYear, selectedMonth, page])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  // Tab filter only affects the transaction list, not the totals
  const filteredTransactions = transactions.filter((transaction) => {
    if (activeFilter === 'ALLES') return true
    return transaction.type_transactie === activeFilter
  })

  const handleTransactionSuccess = async () => {
    setPanelType('none')
    setSelectedTransactionId(null)
    await loadTransactions() // Reload transactions and totals after adding/editing/deleting
  }

  // Handler for clicking "Nieuwe Transactie" button
  const handleNewTransaction = () => {
    setPanelType('new')
    setSelectedTransactionId(null)
  }

  // Handler for clicking an existing transaction
  const handleTransactionClick = (transaction: Transaction) => {
    setPanelType('details')
    setSelectedTransactionId(transaction.id)
  }

  // Handler for closing any panel
  const handleClosePanel = () => {
    setPanelType('none')
    setSelectedTransactionId(null)
  }

  // Determine KPI badge type for resultaat
  const getResultaatType = () => {
    if (totals.resultaat > 0) return 'profit'
    if (totals.resultaat < 0) return 'loss'
    return 'neutral'
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Transacties</h1>
        <button 
          className={styles.button}
          onClick={handleNewTransaction}
        >
          Nieuwe Transactie
        </button>
      </header>

      {/* KPI Section: Financial totals and month filter */}
      <div className={styles.kpiSection}>
        <div className={styles.kpiBadges}>
          <KPIBadge 
            label="Inkomsten (excl. btw)"
            amount={totals.inkomsten}
            type="income"
          />
          <KPIBadge 
            label="Uitgaven (excl. btw)"
            amount={totals.uitgaven}
            type="expense"
          />
          <KPIBadge 
            label="Resultaat"
            amount={totals.resultaat}
            type={getResultaatType()}
          />
        </div>
        <MonthSelector 
          value={selectedMonth}
          onChange={setSelectedMonth}
        />
      </div>

      <TransactionFilter 
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />
      
      <main className={styles.main}>
        {isLoading ? (
          <div className={styles.emptyState}>
            <p>Laden...</p>
          </div>
        ) : (
          <>
            <TransactionList
              transactions={filteredTransactions}
              onTransactionClick={handleTransactionClick}
            />
            {hasMore && (
              <div className={styles.loadMoreContainer}>
                <button
                  className={styles.loadMoreButton}
                  onClick={loadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? 'Laden...' : 'Meer laden'}
                </button>
              </div>
            )}
          </>
        )}
      </main>


      {/* New Transaction Drawer */}
      <Drawer 
        isOpen={panelType === 'new'} 
        onClose={handleClosePanel}
        title="Nieuwe Transactie"
      >
        <TransactionForm 
          mode="create"
          onSuccess={handleTransactionSuccess} 
        />
      </Drawer>

      {/* Transaction Details Drawer */}
      <Drawer 
        isOpen={panelType === 'details'} 
        onClose={handleClosePanel}
        title="Transactie details"
      >
        {selectedTransactionId && (
          <TransactionDetailsPanel
            transactionId={selectedTransactionId}
            onClose={handleClosePanel}
            onSuccess={handleTransactionSuccess}
          />
        )}
      </Drawer>
    </div>
  )
}
