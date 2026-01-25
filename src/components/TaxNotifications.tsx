'use client'

import { useState, useEffect } from 'react'
import { Bell, X, FileText, Euro } from 'lucide-react'
import { getTaxDeadlines, type TaxDeadline } from '@/app/dashboard/belastingen/actions'
import { getPendingExpenses, type PendingExpense } from '@/app/dashboard/uitgaven/actions'
import ExpenseReviewModal from './ExpenseReviewModal'
import styles from './TaxNotifications.module.css'

export default function TaxNotifications() {
  const [isOpen, setIsOpen] = useState(false)
  const [deadlines, setDeadlines] = useState<TaxDeadline[]>([])
  const [expenses, setExpenses] = useState<PendingExpense[]>([])
  const [loading, setLoading] = useState(false)
  const [expensesLoading, setExpensesLoading] = useState(false)
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      if (deadlines.length === 0) {
        loadDeadlines()
      }
      if (expenses.length === 0) {
        loadExpenses()
      }
    }
  }, [isOpen, deadlines.length, expenses.length])

  async function loadDeadlines() {
    setLoading(true)
    try {
      const currentYear = new Date().getFullYear()
      const data = await getTaxDeadlines(currentYear)
      setDeadlines(data)
    } catch (error) {
      console.error('Failed to load tax deadlines:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadExpenses() {
    setExpensesLoading(true)
    try {
      const data = await getPendingExpenses()
      setExpenses(data)
    } catch (error) {
      console.error('Failed to load pending expenses:', error)
    } finally {
      setExpensesLoading(false)
    }
  }

  const upcomingCount = deadlines.filter(d => !d.acknowledged && d.status !== 'overdue').length
  const pendingExpensesCount = expenses.length
  const totalCount = upcomingCount + pendingExpensesCount

  return (
    <div className={styles.container}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={styles.bellButton}
        title="Belastingdeadlines"
      >
        <Bell size={20} />
        {totalCount > 0 && (
          <span className={styles.badge}>{totalCount}</span>
        )}
      </button>

      {isOpen && (
        <>
          <div className={styles.overlay} onClick={() => setIsOpen(false)} />
          <div className={styles.dropdown}>
            <div className={styles.header}>
              <h3>Notificaties</h3>
              <button onClick={() => setIsOpen(false)} className={styles.closeButton}>
                <X size={20} />
              </button>
            </div>

            <div className={styles.content}>
              {/* Pending Expenses Section */}
              {pendingExpensesCount > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <FileText size={16} />
                    <h4>Te Beoordelen Uitgaven ({pendingExpensesCount})</h4>
                  </div>
                  {expensesLoading ? (
                    <div className={styles.loading}>Laden...</div>
                  ) : (
                    <div className={styles.expensesList}>
                      {expenses.map((expense) => {
                        // Truncate subject if too long
                        const subject = expense.subject.length > 50 
                          ? expense.subject.substring(0, 50) + '...' 
                          : expense.subject

                        return (
                        <a
                          key={expense.id}
                          href={`#expense-${expense.id}`}
                          className={styles.expenseCard}
                          onClick={(e) => {
                            e.preventDefault()
                            setSelectedExpenseId(expense.id)
                            setIsOpen(false)
                          }}
                        >
                          <div className={styles.expenseHeader}>
                            <span className={styles.vendor}>
                              {expense.vendor_name || expense.sender_email}
                            </span>
                            <span className={styles.amount}>
                              {expense.total_amount 
                                ? `€${expense.total_amount.toFixed(2)}`
                                : <Euro size={14} />}
                            </span>
                          </div>
                          <p className={styles.expenseSubject}>{subject}</p>
                          <p className={styles.expenseDate}>
                            {new Date(expense.received_at).toLocaleDateString('nl-NL', {
                              day: 'numeric',
                              month: 'short'
                            })}
                          </p>
                        </a>
                      )})}
                    </div>
                  )}
                </div>
              )}

              {/* Tax Deadlines Section */}
              {upcomingCount > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <Bell size={16} />
                    <h4>Belastingdeadlines ({upcomingCount})</h4>
                  </div>
                  {loading ? (
                    <div className={styles.loading}>Laden...</div>
                  ) : (
                    <div className={styles.deadlinesList}>
                      {deadlines
                        .filter(d => !d.acknowledged && d.status !== 'overdue')
                        .map((deadline) => (
                        <div 
                          key={deadline.id} 
                          className={styles.deadline}
                        >
                          <div className={styles.deadlineHeader}>
                            <h4>{deadline.display_name}</h4>
                            <span className={deadline.days_until < 30 ? styles.urgent : styles.normal}>
                              {deadline.days_until < 0 ? 'Verlopen' : `Over ${deadline.days_until} dagen`}
                            </span>
                          </div>
                          <p className={styles.deadlineDate}>
                            {new Date(deadline.deadline_date).toLocaleDateString('nl-NL', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Empty State */}
              {totalCount === 0 && !loading && !expensesLoading && (
                <div className={styles.empty}>Geen notificaties</div>
              )}
            </div>

            <div className={styles.footer}>
              <a 
                href="https://www.belastingdienst.nl" 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.link}
              >
                Naar Belastingdienst →
              </a>
            </div>
          </div>
        </>
      )}

      {/* Expense Review Modal */}
      {selectedExpenseId && (
        <ExpenseReviewModal
          expenseId={selectedExpenseId}
          onClose={() => setSelectedExpenseId(null)}
          onApproved={() => {
            setSelectedExpenseId(null)
            loadExpenses() // Refresh list
          }}
          onRejected={() => {
            setSelectedExpenseId(null)
            loadExpenses() // Refresh list
          }}
        />
      )}
    </div>
  )
}
