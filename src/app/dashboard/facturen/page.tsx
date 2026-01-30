'use client'

/**
 * Invoices Overview Page
 * 
 * Shows all invoices with filtering, search, and status management
 */

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Search, Eye, Trash2, FileText, Bot, Edit3, X } from 'lucide-react'
import { getInvoices, updateInvoiceStatus, deleteInvoice, type Invoice } from './actions'
import styles from './page.module.css'

function FacturenPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent' | 'paid'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Load invoices
  useEffect(() => {
    loadInvoices()
    
    // Check if we just created an invoice
    if (searchParams.get('created')) {
      // Show success message or highlight the new invoice
      setTimeout(() => {
        // Remove the query param
        router.replace('/dashboard/facturen')
      }, 3000)
    }
  }, [statusFilter, searchQuery])

  async function loadInvoices() {
    try {
      setLoading(true)
      setError('')
      const data = await getInvoices({
        status: statusFilter,
        searchQuery: searchQuery || undefined
      })
      setInvoices(data)
    } catch (err) {
      console.error('Error loading invoices:', err)
      setError('Kon facturen niet laden')
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(invoiceId: string, newStatus: 'draft' | 'sent' | 'paid') {
    try {
      await updateInvoiceStatus(invoiceId, newStatus)
      // Reload invoices
      await loadInvoices()
    } catch (err) {
      console.error('Error updating status:', err)
      alert('Kon status niet wijzigen')
    }
  }

  async function handleDelete(invoiceId: string, invoiceNumber: string) {
    if (!confirm(`Weet je zeker dat je factuur ${invoiceNumber} wilt verwijderen?`)) {
      return
    }

    try {
      await deleteInvoice(invoiceId)
      // Reload invoices
      await loadInvoices()
    } catch (err) {
      console.error('Error deleting invoice:', err)
      alert('Kon factuur niet verwijderen')
    }
  }

  function getStatusBadgeClass(status: string) {
    switch (status) {
      case 'draft': return styles.statusDraft
      case 'sent': return styles.statusSent
      case 'paid': return styles.statusPaid
      default: return styles.statusDraft
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case 'draft': return 'Concept'
      case 'sent': return 'Verzonden'
      case 'paid': return 'Betaald'
      default: return status
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleDateString('nl-NL', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    })
  }

  function formatAmount(amount: number) {
    return `€${amount.toFixed(2)}`
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>Facturen</h1>
          <div className={styles.newInvoiceContainer}>
            <button
              onClick={() => setShowCreateModal(!showCreateModal)}
              className={styles.newInvoiceButton}
            >
              <Plus size={20} />
              Nieuwe factuur
            </button>
            
            {showCreateModal && (
              <div className={styles.dropdown}>
                <button
                  onClick={() => router.push('/dashboard/facturen/nieuw')}
                  className={styles.dropdownItem}
                >
                  <Bot size={18} />
                  AI Assistent
                </button>
                <button
                  onClick={() => router.push('/dashboard/facturen/handmatig')}
                  className={styles.dropdownItem}
                >
                  <Edit3 size={18} />
                  Handmatig invullen
                </button>
              </div>
            )}
          </div>
        </div>
        <p className={styles.subtitle}>
          Beheer al je facturen op één plek
        </p>
      </header>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.searchBox}>
          <Search size={20} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Zoek op factuurnummer, klantnaam of e-mail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className={styles.statusFilter}
        >
          <option value="all">Alle statussen</option>
          <option value="draft">Concept</option>
          <option value="sent">Verzonden</option>
          <option value="paid">Betaald</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className={styles.error}>
          <p>{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Facturen laden...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && invoices.length === 0 && !error && (
        <div className={styles.emptyState}>
          <FileText size={64} className={styles.emptyIcon} />
          <h2 className={styles.emptyTitle}>
            {searchQuery || statusFilter !== 'all' 
              ? 'Geen facturen gevonden' 
              : 'Nog geen facturen'}
          </h2>
          <p className={styles.emptyText}>
            {searchQuery || statusFilter !== 'all'
              ? 'Probeer een andere zoekopdracht of filter'
              : 'Klik op "Nieuwe factuur" om je eerste factuur aan te maken met de AI-assistent!'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <button
              onClick={() => router.push('/dashboard/facturen/nieuw')}
              className={styles.emptyButton}
            >
              <Plus size={20} />
              Nieuwe factuur
            </button>
          )}
        </div>
      )}

      {/* Table (desktop) */}
      {!loading && invoices.length > 0 && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Factuurnummer</th>
                <th>Klant</th>
                <th>E-mail</th>
                <th>Datum</th>
                <th>Bedrag</th>
                <th>Status</th>
                <th>Acties</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className={styles.invoiceNumber}>
                    {invoice.invoice_number}
                  </td>
                  <td>
                    <div className={styles.clientName}>{invoice.client_name}</div>
                  </td>
                  <td>
                    {invoice.client_email ? (
                      <div className={styles.clientEmail}>{invoice.client_email}</div>
                    ) : (
                      <span className={styles.noEmail}>-</span>
                    )}
                  </td>
                  <td>{formatDate(invoice.invoice_date)}</td>
                  <td className={styles.amount}>{formatAmount(invoice.total_amount)}</td>
                  <td>
                    <select
                      value={invoice.status}
                      onChange={(e) => handleStatusChange(invoice.id, e.target.value as any)}
                      className={`${styles.statusBadge} ${getStatusBadgeClass(invoice.status)}`}
                    >
                      <option value="draft">Concept</option>
                      <option value="sent">Verzonden</option>
                      <option value="paid">Betaald</option>
                    </select>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        onClick={() => router.push(`/dashboard/facturen/${invoice.id}`)}
                        className={styles.actionButton}
                        title="Bekijken"
                        type="button"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(invoice.id, invoice.invoice_number)}
                        className={`${styles.actionButton} ${styles.deleteButton}`}
                        title="Verwijderen"
                        type="button"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Card list (mobile) */}
      {!loading && invoices.length > 0 && (
        <div className={styles.cardList}>
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className={styles.card}
              onClick={() => router.push(`/dashboard/facturen/${invoice.id}`)}
            >
              <div className={styles.cardTop}>
                <div className={styles.cardClient}>
                  <span className={styles.cardClientName}>{invoice.client_name}</span>
                  <span className={styles.cardInvoiceNumber}>{invoice.invoice_number}</span>
                </div>
                <span className={styles.cardAmount}>{formatAmount(invoice.total_amount)}</span>
              </div>
              <div className={styles.cardBottom}>
                <span className={styles.cardDate}>{formatDate(invoice.invoice_date)}</span>
                <select
                  value={invoice.status}
                  onChange={(e) => {
                    e.stopPropagation()
                    handleStatusChange(invoice.id, e.target.value as any)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={`${styles.statusBadge} ${getStatusBadgeClass(invoice.status)}`}
                >
                  <option value="draft">Concept</option>
                  <option value="sent">Verzonden</option>
                  <option value="paid">Betaald</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FacturenPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FacturenPageContent />
    </Suspense>
  )
}
