'use client'

import { useState, useEffect } from 'react'
import { Mail, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { getGmailConnection, connectGmailAccount, disconnectGmailAccount } from '@/app/dashboard/instellingen/gmail-actions'
import type { GmailConnection } from '@/app/dashboard/instellingen/gmail-actions'
import styles from './GmailIntegration.module.css'

export default function GmailIntegration() {
  const [connection, setConnection] = useState<GmailConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [emailInput, setEmailInput] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadConnection()
  }, [])

  async function loadConnection() {
    try {
      setLoading(true)
      const data = await getGmailConnection()
      setConnection(data)
    } catch (err) {
      console.error('Error loading Gmail connection:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleConnect() {
    if (!emailInput.trim()) {
      setError('Voer een Gmail adres in')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      setSuccess('')
      
      const result = await connectGmailAccount(emailInput.trim().toLowerCase())
      
      if (result.success) {
        setSuccess(result.message || 'Gmail gekoppeld!')
        setEmailInput('')
        await loadConnection()
      } else {
        setError(result.message || 'Er ging iets mis')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Weet je zeker dat je je Gmail wilt ontkoppelen? Je ontvangt dan geen automatische uitgaven meer.')) {
      return
    }

    try {
      setSubmitting(true)
      setError('')
      setSuccess('')
      
      await disconnectGmailAccount()
      setSuccess('Gmail ontkoppeld')
      await loadConnection()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Loader2 className={styles.spinner} />
          <p>Laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Mail size={24} />
        <h2>Gmail Integratie</h2>
      </div>

      <p className={styles.description}>
        Koppel je Gmail account om automatisch inkomende uitgaven (facturen) te ontvangen en te verwerken.
      </p>

      {error && (
        <div className={styles.alert} data-type="error">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className={styles.alert} data-type="success">
          <CheckCircle size={20} />
          <span>{success}</span>
        </div>
      )}

      {connection ? (
        <div className={styles.connected}>
          <div className={styles.status}>
            <CheckCircle size={20} className={styles.iconSuccess} />
            <div>
              <p className={styles.statusLabel}>Gekoppeld</p>
              <p className={styles.email}>{connection.gmail_address}</p>
            </div>
          </div>

          <button
            onClick={handleDisconnect}
            disabled={submitting}
            className={styles.buttonSecondary}
          >
            {submitting ? 'Ontkoppelen...' : 'Ontkoppelen'}
          </button>

          <div className={styles.instructions}>
            <h3>Hoe werkt het?</h3>
            <ol>
              <li>Ontvang uitgaven (facturen) op <strong>{connection.gmail_address}</strong></li>
              <li>Uitgaven worden automatisch gedetecteerd</li>
              <li>Je beoordeelt ze in het notificatie centrum</li>
            </ol>
          </div>
        </div>
      ) : (
        <div className={styles.disconnected}>
          <div className={styles.inputGroup}>
            <input
              type="email"
              placeholder="jouw@gmail.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              disabled={submitting}
              className={styles.input}
            />
            <button
              onClick={handleConnect}
              disabled={submitting || !emailInput.trim()}
              className={styles.buttonPrimary}
            >
              {submitting ? 'Koppelen...' : 'Koppel Gmail'}
            </button>
          </div>

          <div className={styles.instructions}>
            <h3>Wat gebeurt er na koppelen?</h3>
            <ol>
              <li>Je Gmail adres wordt opgeslagen</li>
              <li>Inkomende uitgaven (PDF facturen) worden automatisch gedetecteerd</li>
              <li>Je ontvangt notificaties voor nieuwe uitgaven</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
