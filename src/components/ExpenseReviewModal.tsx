'use client'

import { useState, useEffect } from 'react'
import { X, FileText, Check, XCircle, Loader2, AlertCircle, ExternalLink } from 'lucide-react'
import { getPendingExpense, runExpenseOCR, approveExpense, rejectExpense, type PendingExpense } from '@/app/dashboard/uitgaven/actions'
import styles from './ExpenseReviewModal.module.css'

// Map OCR English categories to DB values
const CATEGORY_MAP: Record<string, string> = {
  'Software': 'Kantoor',
  'Office Supplies': 'Kantoor',
  'Services': 'Inkoop',
  'Marketing': 'Overig',
  'Travel': 'Reiskosten',
  'Meals': 'Overig',
  'Utilities': 'Overig',
  'Other': 'Overig',
}

function mapCategory(category: string | null): string {
  if (!category) return ''
  if (['Inkoop', 'Sales', 'Reiskosten', 'Kantoor', 'Overig'].includes(category)) return category
  return CATEGORY_MAP[category] || 'Overig'
}

function isImageFile(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop()
  return ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'].includes(ext || '')
}

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
      setCategory(mapCategory(expense.category))
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
          await runExpenseOCR(expenseId)
          setOcrRunning(false)

          // Always reload to get OCR data or failure status
          const updatedData = await getPendingExpense(expenseId)
          if (updatedData) {
            setExpense(updatedData)
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
    const missing: string[] = []
    if (!date) missing.push('Datum')
    if (!amount) missing.push('Bedrag')
    if (!description) missing.push('Omschrijving')
    if (missing.length > 0) {
      setError(`Vul de volgende velden in: ${missing.join(', ')}`)
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
        category: category || 'Overig',
        vendorName: expense.vendor_name || getSenderEmail()
      })

      console.log('[ExpenseReviewModal] Approve result:', result)

      if (result.success) {
        onApproved?.()
        onClose()
      } else {
        console.error('[ExpenseReviewModal] Approve failed:', result.error)
        setError(result.error || 'Goedkeuren mislukt')
      }
    } catch (err) {
      console.error('[ExpenseReviewModal] Approve exception:', err)
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
          {/* PDF Preview */}
          <div className={styles.previewSection}>
            {isImageFile(expense.pdf_filename) ? (
              <img
                src={expense.pdf_url}
                alt="Factuur preview"
                className={styles.previewImage}
              />
            ) : (
              <iframe
                src={expense.pdf_url}
                title="Factuur preview"
                className={styles.previewIframe}
              />
            )}
            <a
              href={expense.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.previewLink}
            >
              <ExternalLink size={14} />
              Open in nieuw tabblad
            </a>
          </div>

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

            {expense.ocr_status === 'failed' && (
              <div className={styles.alert} data-type="error">
                <AlertCircle size={20} />
                <span>
                  Automatisch uitlezen mislukt{expense.ocr_error ? `: ${expense.ocr_error}` : ''}.
                  Vul de gegevens handmatig in.
                </span>
              </div>
            )}

            {!hasOcrData && expense.ocr_status !== 'failed' && !ocrRunning && (
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
                <label>
                  Bedrag ({expense?.currency || '€'}) *
                  {expense?.currency && expense.currency !== 'EUR' && expense.total_amount_eur && (
                    <span style={{ fontSize: '0.85em', color: '#666', marginLeft: '8px' }}>
                      ≈ €{expense.total_amount_eur.toFixed(2)}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className={styles.input}
                  required
                />
                {expense?.currency && expense.currency !== 'EUR' && expense.exchange_rate && (
                  <small style={{ color: '#666', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                    Wisselkoers: 1 {expense.currency} = €{expense.exchange_rate.toFixed(4)}
                  </small>
                )}
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
                  <option value="Inkoop">Inkoop</option>
                  <option value="Sales">Sales</option>
                  <option value="Reiskosten">Reiskosten</option>
                  <option value="Kantoor">Kantoor</option>
                  <option value="Overig">Overig</option>
                </select>
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
