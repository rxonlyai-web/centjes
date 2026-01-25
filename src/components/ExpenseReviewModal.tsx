'use client'

import { useState, useEffect } from 'react'
import { X, FileText, Check, XCircle, Loader2, AlertCircle, ExternalLink } from 'lucide-react'
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

  // Form state
  const [date, setDate] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [vatRate, setVatRate] = useState('21')
  const [category, setCategory] = useState('')

  useEffect(() => {
    loadExpense()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseId])

  useEffect(() => {
    if (expense) {
      // Pre-fill form with expense data
      setDate(expense.invoice_date || new Date(expense.received_at).toISOString().split('T')[0])
      setAmount(expense.total_amount?.toString() || '')
      setDescription(expense.description || expense.subject)
      setVatRate(expense.vat_rate?.toString() || '21')
      setCategory(expense.category || '')
    }
  }, [expense])

  async function loadExpense() {
    try {
      setLoading(true)
      const data = await getPendingExpense(expenseId)
      if (data) {
        setExpense(data)
        
        // Auto-run OCR if not done yet
        if (data.ocr_status === 'pending') {
          setOcrRunning(true)
          const ocrResult = await runExpenseOCR(expenseId)
          setOcrRunning(false)
          
          if (ocrResult.success) {
            // Reload expense with OCR data
            const updatedData = await getPendingExpense(expenseId)
            if (updatedData) {
              setExpense(updatedData)
            }
          }
        }
      } else {
        setError('Uitgave niet gevonden')
      }
    } catch (err) {
      setError('Fout bij laden van uitgave')
      console.error(err)
    } finally {
      setLoading(false)
      setOcrRunning(false)
    }
  }

  async function handleApprove() {
    if (!expense) return

    // Validate form
    if (!date || !amount || !description) {
      setError('Vul alle verplichte velden in')
      return
    }

    try {
      setProcessing(true)
      setError('')

      // Calculate amounts
      const totalAmount = parseFloat(amount)
      const vatRateNum = parseFloat(vatRate)
      const subtotal = totalAmount / (1 + vatRateNum / 100)
      const vatAmount = totalAmount - subtotal

      // Approve expense with form data
      const result = await approveExpense(expenseId, {
        invoiceDate: date,
        totalAmount,
        subtotal,
        vatRate: vatRateNum,
        vatAmount,
        description,
        category: category || 'Other',
        vendorName: expense.vendor_name || getSenderEmail()
      })

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

  function getSenderEmail(): string {
    if (!expense) return 'Onbekend'
    return typeof expense.sender_email === 'string' ? expense.sender_email : 'Onbekend'
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
          <div className={styles.formSection}>
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

            {!hasOcrData && !ocrRunning && (
              <div className={styles.alert} data-type="info">
                <AlertCircle size={16} />
                <span>Factuurgegevens worden uitgelezen bij goedkeuren</span>
              </div>
            )}

            {/* Form */}
            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label>Van</label>
                <input
                  type="text"
                  value={expense.vendor_name || getSenderEmail()}
                  disabled
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Datum *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Bedrag (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Omschrijving *</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Bijv. Lunch met klant"
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>BTW Tarief</label>
                <select
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  className={styles.select}
                >
                  <option value="0">0% (Geen BTW)</option>
                  <option value="9">9% (Laag tarief)</option>
                  <option value="21">21% (Hoog tarief)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Categorie</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={styles.select}
                >
                  <option value="">Selecteer een categorie</option>
                  <option value="Office Supplies">Kantoorbenodigdheden</option>
                  <option value="Software">Software</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Travel">Reiskosten</option>
                  <option value="Meals">Maaltijden</option>
                  <option value="Utilities">Nutsvoorzieningen</option>
                  <option value="Other">Overig</option>
                </select>
              </div>

              {/* PDF Link */}
              <div className={styles.pdfLink}>
                <FileText size={16} />
                <a 
                  href={expense.pdf_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={styles.link}
                >
                  Bekijk PDF ({expense.pdf_filename})
                  <ExternalLink size={14} />
                </a>
              </div>
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
