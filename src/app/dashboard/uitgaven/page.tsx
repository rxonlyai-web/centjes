'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { FileText, Euro, Camera, Loader2 } from 'lucide-react'
import { getPendingExpenses, type PendingExpense } from './actions'
import ExpenseReviewModal from '@/components/ExpenseReviewModal'
import styles from './uitgaven.module.css'

function UitgavenContent() {
  const searchParams = useSearchParams()
  const reviewId = searchParams.get('review')

  const [expenses, setExpenses] = useState<PendingExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(reviewId)

  useEffect(() => {
    loadExpenses()
  }, [])

  useEffect(() => {
    // Handle ?review= query param
    if (reviewId) {
      setSelectedExpenseId(reviewId)
    }
  }, [reviewId])

  async function loadExpenses() {
    try {
      setLoading(true)
      const data = await getPendingExpenses()
      setExpenses(data)
    } catch (error) {
      console.error('Failed to load expenses:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleExpenseClick(expenseId: string) {
    setSelectedExpenseId(expenseId)
  }

  function handleModalClose() {
    setSelectedExpenseId(null)
    // Remove query param from URL without navigation
    window.history.replaceState({}, '', '/dashboard/uitgaven')
  }

  function handleExpenseProcessed() {
    handleModalClose()
    loadExpenses()
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Loader2 className={styles.spinner} size={32} />
          <p>Laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Te Beoordelen Uitgaven</h1>
        <p className={styles.subtitle}>
          Bekijk en keur uitgaven goed die via e-mail of camera zijn ontvangen
        </p>
      </div>

      {expenses.length === 0 ? (
        <div className={styles.emptyState}>
          <Camera size={48} />
          <h2>Geen uitgaven te beoordelen</h2>
          <p>
            Scan een bon met de camera of stuur een factuur naar je inbox om te beginnen.
          </p>
        </div>
      ) : (
        <div className={styles.expensesList}>
          {expenses.map((expense) => {
            const subject = expense.subject.length > 60
              ? expense.subject.substring(0, 60) + '...'
              : expense.subject

            return (
              <button
                key={expense.id}
                className={styles.expenseCard}
                onClick={() => handleExpenseClick(expense.id)}
              >
                <div className={styles.expenseIcon}>
                  <FileText size={24} />
                </div>
                <div className={styles.expenseDetails}>
                  <div className={styles.expenseHeader}>
                    <span className={styles.vendor}>
                      {expense.vendor_name || (typeof expense.sender_email === 'string' ? expense.sender_email : 'Onbekend')}
                    </span>
                    <span className={styles.amount}>
                      {expense.total_amount ? (
                        `€${expense.total_amount.toFixed(2)}`
                      ) : (
                        <Euro size={16} />
                      )}
                    </span>
                  </div>
                  <p className={styles.expenseSubject}>{subject}</p>
                  <div className={styles.expenseMeta}>
                    <span className={styles.expenseDate}>
                      {new Date(expense.received_at).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                    {expense.ocr_status === 'pending' && (
                      <span className={styles.ocrBadge}>OCR wachtend</span>
                    )}
                    {expense.ocr_status === 'completed' && (
                      <span className={styles.ocrBadgeComplete}>Uitgelezen</span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selectedExpenseId && (
        <ExpenseReviewModal
          expenseId={selectedExpenseId}
          onClose={handleModalClose}
          onApproved={handleExpenseProcessed}
          onRejected={handleExpenseProcessed}
        />
      )}
    </div>
  )
}

export default function UitgavenPage() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.loading}>
          <Loader2 className={styles.spinner} size={32} />
          <p>Laden...</p>
        </div>
      </div>
    }>
      <UitgavenContent />
    </Suspense>
  )
}
