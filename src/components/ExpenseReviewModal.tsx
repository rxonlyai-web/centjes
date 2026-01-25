'use client'

import { useState, useEffect } from 'react'
import { X, FileText, Check, XCircle, Loader2, AlertCircle } from 'lucide-react'
import { getPendingExpense, runExpenseOCR, approveExpense, rejectExpense, type PendingExpense } from '@/app/dashboard/uitgaven/actions'
import styles from './ExpenseReviewModal.module.css'

interface ExpenseReviewModalProps {
  expenseId: string
  onClose: () => void
  onApproved?: () => void
  onRejected?: () => void
}

export default function ExpenseReviewModal({ 
  expenseId, 
  onClose, 
  onApproved, 
  onRejected 
}: ExpenseReviewModalProps) {
  const [expense, setExpense] = useState<PendingExpense | null>(null)
  const [loading, setLoading] = useState(true)
  const [ocrRunning, setOcrRunning] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadExpense()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseId])

  async function loadExpense() {
    try {
      setLoading(true)
      const data = await getPendingExpense(expenseId)
      if (data) {
        setExpense(data)
      } else {
        setError('Uitgave niet gevonden')
      }
    } catch (err) {
      setError('Fout bij laden van uitgave')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove() {
    if (!expense) return

    try {
      setProcessing(true)
      setError('')

      // Run OCR if not done yet
      if (expense.ocr_status === 'pending') {
        setOcrRunning(true)
        const ocrResult = await runExpenseOCR(expenseId)
        setOcrRunning(false)

        if (!ocrResult.success) {
          setError(ocrResult.error || 'OCR mislukt')
          return
        }

        // Reload expense with OCR data
        await loadExpense()
      }

      // Approve expense
      const result = await approveExpense(expenseId)

      if (result.success) {
        onApproved?.()
        onClose()
      } else {
        setError(result.error || 'Goedkeuren mislukt')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis')
    } finally {
      setProcessing(false)
      setOcrRunning(false)
    }
  }

  async function handleReject() {
    if (!confirm('Weet je zeker dat je deze uitgave wilt afwijzen?')) {
      return
    }

    try {
      setProcessing(true)
      setError('')

      const result = await rejectExpense(expenseId, 'Handmatig afgewezen')

      if (result.success) {
        onRejected?.()
        onClose()
      } else {
        setError(result.error || 'Afwijzen mislukt')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <div className={styles.loading}>
            <Loader2 className={styles.spinner} />
            <p>Laden...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!expense) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <div className={styles.error}>
            <AlertCircle size={48} />
            <p>{error || 'Uitgave niet gevonden'}</p>
            <button onClick={onClose} className={styles.buttonSecondary}>
              Sluiten
            </button>
          </div>
        </div>
      </div>
    )
  }

  const hasOcrData = expense.ocr_status === 'completed'

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <FileText size={24} />
            <h2>Uitgave Beoordelen</h2>
          </div>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* PDF Viewer */}
          <div className={styles.pdfSection}>
            <h3>Factuur</h3>
            <div className={styles.pdfViewer}>
              <iframe
                src={expense.pdf_url}
                title="Factuur PDF"
                className={styles.pdfFrame}
              />
            </div>
            <div className={styles.pdfInfo}>
              <span>{expense.pdf_filename}</span>
              <span>{(expense.pdf_size_bytes / 1024).toFixed(1)} KB</span>
            </div>
          </div>

          {/* Expense Data */}
          <div className={styles.dataSection}>
            <h3>Gegevens</h3>

            {error && (
              <div className={styles.alert} data-type="error">
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            {ocrRunning && (
              <div className={styles.alert} data-type="info">
                <Loader2 className={styles.spinner} size={20} />
                <span>Factuur wordt uitgelezen...</span>
              </div>
            )}

            <div className={styles.dataGrid}>
              <div className={styles.dataRow}>
                <label>Van</label>
                <div className={styles.value}>
                  {hasOcrData && expense.vendor_name ? expense.vendor_name : expense.sender_email}
                </div>
              </div>

              <div className={styles.dataRow}>
                <label>Onderwerp</label>
                <div className={styles.value}>{expense.subject}</div>
              </div>

              <div className={styles.dataRow}>
                <label>Ontvangen</label>
                <div className={styles.value}>
                  {new Date(expense.received_at).toLocaleDateString('nl-NL', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </div>
              </div>

              {hasOcrData && (
                <>
                  {expense.invoice_number && (
                    <div className={styles.dataRow}>
                      <label>Factuurnummer</label>
                      <div className={styles.value}>{expense.invoice_number}</div>
                    </div>
                  )}

                  {expense.invoice_date && (
                    <div className={styles.dataRow}>
                      <label>Factuurdatum</label>
                      <div className={styles.value}>
                        {new Date(expense.invoice_date).toLocaleDateString('nl-NL')}
                      </div>
                    </div>
                  )}

                  <div className={styles.dataRow}>
                    <label>Subtotaal</label>
                    <div className={styles.value}>€{expense.subtotal?.toFixed(2) || '0.00'}</div>
                  </div>

                  <div className={styles.dataRow}>
                    <label>BTW ({expense.vat_rate}%)</label>
                    <div className={styles.value}>€{expense.vat_amount?.toFixed(2) || '0.00'}</div>
                  </div>

                  <div className={styles.dataRow}>
                    <label>Totaal</label>
                    <div className={`${styles.value} ${styles.total}`}>
                      €{expense.total_amount?.toFixed(2) || '0.00'}
                    </div>
                  </div>

                  {expense.category && (
                    <div className={styles.dataRow}>
                      <label>Categorie</label>
                      <div className={styles.value}>{expense.category}</div>
                    </div>
                  )}

                  {expense.description && (
                    <div className={styles.dataRow}>
                      <label>Omschrijving</label>
                      <div className={styles.value}>{expense.description}</div>
                    </div>
                  )}
                </>
              )}

              {!hasOcrData && !ocrRunning && (
                <div className={styles.ocrNote}>
                  <AlertCircle size={16} />
                  <span>Factuurgegevens worden uitgelezen bij goedkeuren</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button
            onClick={handleReject}
            disabled={processing}
            className={styles.buttonReject}
          >
            <XCircle size={20} />
            Afwijzen
          </button>
          <button
            onClick={handleApprove}
            disabled={processing || ocrRunning}
            className={styles.buttonApprove}
          >
            {processing || ocrRunning ? (
              <>
                <Loader2 className={styles.spinner} size={20} />
                {ocrRunning ? 'Uitlezen...' : 'Verwerken...'}
              </>
            ) : (
              <>
                <Check size={20} />
                Goedkeuren
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
