'use client'

import { useState } from 'react'
import { X, Send, Check, AlertTriangle } from 'lucide-react'
import { sendInvoiceByEmail } from '@/app/dashboard/facturen/email-actions'
import styles from './SendInvoiceModal.module.css'

interface SendInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  invoiceId: string
  invoiceNumber: string
  clientName: string
  clientEmail: string | null
  totalAmount: number
  companyEmail: string | null
  onSent?: () => void
}

export default function SendInvoiceModal({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  clientName,
  clientEmail,
  totalAmount,
  companyEmail,
  onSent,
}: SendInvoiceModalProps) {
  const [email, setEmail] = useState(clientEmail || '')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const formattedAmount = new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(totalAmount)

  async function handleSend() {
    if (!email.trim()) {
      setError('Vul een e-mailadres in')
      return
    }

    setSending(true)
    setError('')

    try {
      await sendInvoiceByEmail(invoiceId, email.trim(), message.trim() || undefined)
      setSent(true)
      setTimeout(() => {
        onSent?.()
        onClose()
        setSent(false)
        setMessage('')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Kon factuur niet verzenden')
      setSending(false)
    }
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Factuur verzenden</h2>
          <button onClick={onClose} className={styles.closeBtn} type="button">
            <X size={20} />
          </button>
        </div>

        {sent ? (
          <div className={styles.successState}>
            <div className={styles.successIcon}>
              <Check size={32} />
            </div>
            <p className={styles.successText}>Factuur verzonden!</p>
          </div>
        ) : (
          <>
            <div className={styles.summary}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Factuur</span>
                <span className={styles.summaryValue}>{invoiceNumber}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Klant</span>
                <span className={styles.summaryValue}>{clientName || '—'}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Bedrag</span>
                <span className={styles.summaryValue}>{formattedAmount}</span>
              </div>
            </div>

            {!companyEmail && (
              <div className={styles.warning}>
                <AlertTriangle size={16} />
                <span>Stel eerst je e-mailadres in bij Instellingen zodat klanten kunnen antwoorden.</span>
              </div>
            )}

            {error && (
              <div className={styles.error}>
                {error}
              </div>
            )}

            <div className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="send-email" className={styles.label}>
                  Verzenden naar
                </label>
                <input
                  id="send-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                  placeholder="klant@bedrijf.nl"
                  autoComplete="email"
                  disabled={sending}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="send-message" className={styles.label}>
                  Persoonlijk bericht (optioneel)
                </label>
                <textarea
                  id="send-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={styles.textarea}
                  placeholder="Bijv. Hierbij de factuur voor onze werkzaamheden."
                  rows={3}
                  disabled={sending}
                />
              </div>
            </div>

            <div className={styles.actions}>
              <button
                onClick={handleSend}
                className={styles.sendBtn}
                disabled={sending || !email.trim()}
                type="button"
              >
                <Send size={18} />
                {sending ? 'Verzenden...' : 'Verstuur factuur'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
