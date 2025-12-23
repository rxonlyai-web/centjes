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
import TransactionFilter from '@/components/dashboard/TransactionFilter'
import TransactionList from '@/components/dashboard/TransactionList'
import KPIBadge from '@/components/dashboard/KPIBadge'
import MonthSelector from '@/components/dashboard/MonthSelector'
import { getTransactionsWithTotals } from '../actions'

type FilterType = 'ALLES' | 'INKOMSTEN' | 'UITGAVEN'

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
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
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
  
  // Edit mode state
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')

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
    try {
      const data = await getTransactionsWithTotals(activeYear, selectedMonth)
      setTransactions(data.transactions as Transaction[])
      setTotals(data.totals)
    } catch (error) {
      console.error('Failed to load transactions:', error)
    } finally {
      setIsLoading(false)
    }
  }, [activeYear, selectedMonth])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  // Tab filter only affects the transaction list, not the totals
  const filteredTransactions = transactions.filter((transaction) => {
    if (activeFilter === 'ALLES') return true
    return transaction.type_transactie === activeFilter
  })

  const handleTransactionSuccess = async () => {
    setIsDrawerOpen(false)
    await loadTransactions() // Reload transactions and totals after adding/editing/deleting
  }

  // Handler for clicking "Nieuwe Transactie" button
  const handleNewTransaction = () => {
    setSelectedTransaction(null)
    setDrawerMode('create')
    setIsDrawerOpen(true)
  }

  // Handler for clicking an existing transaction
  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setDrawerMode('edit')
    setIsDrawerOpen(true)
  }

  // Prepare initial values for edit mode
  const initialValues = selectedTransaction ? {
    type_transactie: selectedTransaction.type_transactie,
    datum: selectedTransaction.datum,
    bedrag: selectedTransaction.bedrag,
    omschrijving: selectedTransaction.omschrijving,
    btw_tarief: selectedTransaction.btw_tarief,
    categorie: selectedTransaction.categorie,
    vat_treatment: selectedTransaction.vat_treatment,
    bon_url: selectedTransaction.bon_url
  } : undefined

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
          <TransactionList 
            transactions={filteredTransactions}
            onTransactionClick={handleTransactionClick}
          />
        )}
      </main>

      <Drawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)}
        title={drawerMode === 'create' ? 'Nieuwe Transactie' : 'Transactie bewerken'}
      >
        <TransactionForm 
          mode={drawerMode}
          transactionId={selectedTransaction?.id}
          initialValues={initialValues}
          onSuccess={handleTransactionSuccess} 
        />
      </Drawer>
    </div>
  )
}
