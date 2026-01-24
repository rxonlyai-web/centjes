'use client'

/**
 * Invoice Detail Page with Edit Functionality
 * 
 * Shows full invoice details with inline editing capabilities
 */

import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft, Download, Edit2, Save, X, Plus, Trash2 } from 'lucide-react'
import { getInvoiceById, updateInvoiceStatus, updateInvoice, generateInvoicePDF, type InvoiceWithItems } from '../actions'
import styles from './page.module.css'

interface EditableItem {
  id?: string
  description: string
  quantity: number
  unit_price: number
  total_price: number
}

export default function InvoiceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const invoiceId = params.id as string
  
  const [invoice, setInvoice] = useState<InvoiceWithItems | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [downloadingPDF, setDownloadingPDF] = useState(false)
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editedClientName, setEditedClientName] = useState('')
  const [editedClientEmail, setEditedClientEmail] = useState('')
  const [editedClientAddress, setEditedClientAddress] = useState('')
  const [editedNotes, setEditedNotes] = useState('')
  const [editedItems, setEditedItems] = useState<EditableItem[]>([])

  useEffect(() => {
    loadInvoice()
  }, [invoiceId])

  // Auto-enter edit mode if edit=true in URL
  useEffect(() => {
    if (searchParams.get('edit') === 'true' && invoice && !loading) {
      setIsEditing(true)
      // Remove the query param from URL
      const url = new URL(window.location.href)
      url.searchParams.delete('edit')
      window.history.replaceState({}, '', url.pathname)
    }
  }, [searchParams, invoice, loading])

  async function loadInvoice() {
    try {
      setLoading(true)
      setError('')
      const data = await getInvoiceById(invoiceId)
      if (!data) {
        setError('Factuur niet gevonden')
      } else {
        setInvoice(data)
        // Initialize edit state
        setEditedClientName(data.client_name)
        setEditedClientEmail(data.client_email || '')
        setEditedClientAddress(data.client_address || '')
        setEditedNotes(data.notes || '')
        setEditedItems(data.items.map(item => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        })))
      }
    } catch (err) {
      console.error('Error loading invoice:', err)
      setError('Kon factuur niet laden')
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(newStatus: 'draft' | 'sent' | 'paid') {
    if (!invoice) return
    
    try {
      setUpdatingStatus(true)
      await updateInvoiceStatus(invoice.id, newStatus)
      setInvoice({ ...invoice, status: newStatus })
    } catch (err) {
      console.error('Error updating status:', err)
      alert('Kon status niet wijzigen')
    } finally {
      setUpdatingStatus(false)
    }
  }

  function startEditing() {
    setIsEditing(true)
  }

  function cancelEditing() {
    if (!invoice) return
    // Reset to original values
    setEditedClientName(invoice.client_name)
    setEditedClientEmail(invoice.client_email || '')
    setEditedClientAddress(invoice.client_address || '')
    setEditedNotes(invoice.notes || '')
    setEditedItems(invoice.items.map(item => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price
    })))
    setIsEditing(false)
  }

  async function saveChanges() {
    if (!invoice) return

    try {
      setIsSaving(true)
      
      await updateInvoice(invoice.id, {
        client_name: editedClientName,
        client_email: editedClientEmail || undefined,
        client_address: editedClientAddress || undefined,
        notes: editedNotes || undefined,
        items: editedItems
      })

      // Reload invoice
      await loadInvoice()
      setIsEditing(false)
    } catch (err) {
      console.error('Error saving invoice:', err)
      alert('Kon factuur niet opslaan')
    } finally {
      setIsSaving(false)
    }
  }

  function updateItemField(index: number, field: keyof EditableItem, value: string | number) {
    const newItems = [...editedItems]
    newItems[index] = { ...newItems[index], [field]: value }
    
    // Recalculate total_price if quantity or unit_price changed
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price
    }
    
    setEditedItems(newItems)
  }

  function addNewItem() {
    setEditedItems([...editedItems, {
      description: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0
    }])
  }

  function removeItem(index: number) {
    setEditedItems(editedItems.filter((_, i) => i !== index))
  }

  function calculateTotals() {
    const subtotal = editedItems.reduce((sum, item) => sum + item.total_price, 0)
    const vat = subtotal * 0.21
    const total = subtotal + vat
    return { subtotal, vat, total }
  }

  async function handleDownloadPDF() {
    if (!invoice) return

    try {
      setDownloadingPDF(true)
      const pdfDataUrl = await generateInvoicePDF(invoice.id)
      
      // Create download link
      const link = document.createElement('a')
      link.href = pdfDataUrl
      link.download = `Factuur-${invoice.invoice_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Error downloading PDF:', err)
      alert('Kon PDF niet genereren. Probeer het later opnieuw.')
    } finally {
      setDownloadingPDF(false)
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

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleDateString('nl-NL', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    })
  }

  function formatAmount(amount: number) {
    return `€${amount.toFixed(2)}`
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Factuur laden...</p>
        </div>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Fout</h2>
          <p>{error || 'Factuur niet gevonden'}</p>
          <button onClick={() => router.push('/dashboard/facturen')} className={styles.backButton}>
            <ArrowLeft size={20} />
            Terug naar overzicht
          </button>
        </div>
      </div>
    )
  }

  const totals = isEditing ? calculateTotals() : {
    subtotal: invoice.subtotal,
    vat: invoice.vat_amount,
    total: invoice.total_amount
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => router.push('/dashboard/facturen')} className={styles.backButton}>
          <ArrowLeft size={20} />
          Terug
        </button>
        
        <div className={styles.headerActions}>
          {!isEditing ? (
            <>
              <button onClick={startEditing} className={styles.editButton}>
                <Edit2 size={20} />
                Bewerken
              </button>
              
              <select
                value={invoice.status}
                onChange={(e) => handleStatusChange(e.target.value as 'draft' | 'sent' | 'paid')}
                disabled={updatingStatus}
                className={`${styles.statusSelect} ${getStatusBadgeClass(invoice.status)}`}
              >
                <option value="draft">Concept</option>
                <option value="sent">Verzonden</option>
                <option value="paid">Betaald</option>
              </select>
              
              <button 
                className={styles.downloadButton} 
                onClick={handleDownloadPDF}
                disabled={downloadingPDF}
              >
                <Download size={20} />
                {downloadingPDF ? 'Genereren...' : 'Download PDF'}
              </button>
            </>
          ) : (
            <>
              <button onClick={cancelEditing} className={styles.cancelButton} disabled={isSaving}>
                <X size={20} />
                Annuleren
              </button>
              <button onClick={saveChanges} className={styles.saveButton} disabled={isSaving}>
                <Save size={20} />
                {isSaving ? 'Opslaan...' : 'Opslaan'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Invoice */}
      <div className={styles.invoice}>
        {/* Invoice Header */}
        <div className={styles.invoiceHeader}>
          <div>
            <h1 className={styles.invoiceTitle}>FACTUUR</h1>
            <p className={styles.invoiceNumber}>{invoice.invoice_number}</p>
          </div>
        </div>

        {/* Parties */}
        <div className={styles.parties}>
          <div className={styles.party}>
            <h3 className={styles.partyTitle}>Van</h3>
            {invoice.company_settings ? (
              <>
                <p className={styles.partyName}>{invoice.company_settings.company_name}</p>
                {invoice.company_settings.address_line1 && (
                  <p className={styles.partyDetail}>{invoice.company_settings.address_line1}</p>
                )}
                {invoice.company_settings.address_line2 && (
                  <p className={styles.partyDetail}>{invoice.company_settings.address_line2}</p>
                )}
                {(invoice.company_settings.postal_code || invoice.company_settings.city) && (
                  <p className={styles.partyDetail}>
                    {invoice.company_settings.postal_code} {invoice.company_settings.city}
                  </p>
                )}
                {invoice.company_settings.kvk_number && (
                  <p className={styles.partyDetail}>KVK: {invoice.company_settings.kvk_number}</p>
                )}
                {invoice.company_settings.btw_number && (
                  <p className={styles.partyDetail}>BTW: {invoice.company_settings.btw_number}</p>
                )}
                {invoice.company_settings.email && (
                  <p className={styles.partyDetail}>{invoice.company_settings.email}</p>
                )}
                {invoice.company_settings.phone && (
                  <p className={styles.partyDetail}>{invoice.company_settings.phone}</p>
                )}
              </>
            ) : (
              <p className={styles.partyDetail}>Bedrijfsgegevens niet ingevuld. Ga naar Instellingen.</p>
            )}
          </div>
          
          <div className={styles.party}>
            <h3 className={styles.partyTitle}>Aan</h3>
            {isEditing ? (
              <div className={styles.editFields}>
                <input
                  type="text"
                  value={editedClientName}
                  onChange={(e) => setEditedClientName(e.target.value)}
                  placeholder="Klantnaam"
                  className={styles.editInput}
                />
                <input
                  type="email"
                  value={editedClientEmail}
                  onChange={(e) => setEditedClientEmail(e.target.value)}
                  placeholder="E-mail (optioneel)"
                  className={styles.editInput}
                />
                <textarea
                  value={editedClientAddress}
                  onChange={(e) => setEditedClientAddress(e.target.value)}
                  placeholder="Adres (optioneel)"
                  className={styles.editTextarea}
                  rows={3}
                />
              </div>
            ) : (
              <>
                <p className={styles.partyName}>{invoice.client_name}</p>
                {invoice.client_email && (
                  <p className={styles.partyDetail}>{invoice.client_email}</p>
                )}
                {invoice.client_address && (
                  <p className={styles.partyDetail}>{invoice.client_address}</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className={styles.dates}>
          <div className={styles.dateItem}>
            <span className={styles.dateLabel}>Factuurdatum:</span>
            <span className={styles.dateValue}>{formatDate(invoice.invoice_date)}</span>
          </div>
          {invoice.due_date && (
            <div className={styles.dateItem}>
              <span className={styles.dateLabel}>Vervaldatum:</span>
              <span className={styles.dateValue}>{formatDate(invoice.due_date)}</span>
            </div>
          )}
          {invoice.payment_terms && (
            <div className={styles.dateItem}>
              <span className={styles.dateLabel}>Betalingsvoorwaarden:</span>
              <span className={styles.dateValue}>{invoice.payment_terms}</span>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className={styles.itemsSection}>
          <table className={styles.itemsTable}>
            <thead>
              <tr>
                <th>Omschrijving</th>
                <th>Aantal</th>
                <th>Prijs</th>
                <th>Totaal</th>
                {isEditing && <th></th>}
              </tr>
            </thead>
            <tbody>
              {isEditing ? (
                editedItems.map((item, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItemField(index, 'description', e.target.value)}
                        className={styles.itemInput}
                        placeholder="Omschrijving"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItemField(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className={styles.itemInputSmall}
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updateItemField(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        className={styles.itemInputSmall}
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td>{formatAmount(item.total_price)}</td>
                    <td>
                      <button
                        onClick={() => removeItem(index)}
                        className={styles.removeItemButton}
                        title="Verwijderen"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.description}</td>
                    <td>{item.quantity}</td>
                    <td>{formatAmount(item.unit_price)}</td>
                    <td>{formatAmount(item.total_price)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          {isEditing && (
            <button onClick={addNewItem} className={styles.addItemButton}>
              <Plus size={20} />
              Regel toevoegen
            </button>
          )}
        </div>

        {/* Totals */}
        <div className={styles.totals}>
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Subtotaal:</span>
            <span className={styles.totalValue}>{formatAmount(totals.subtotal)}</span>
          </div>
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>BTW (21%):</span>
            <span className={styles.totalValue}>{formatAmount(totals.vat)}</span>
          </div>
          <div className={styles.totalRowFinal}>
            <span className={styles.totalLabel}>Totaal:</span>
            <span className={styles.totalValue}>{formatAmount(totals.total)}</span>
          </div>
        </div>

        {/* Notes */}
        <div className={styles.notes}>
          <h3 className={styles.notesTitle}>Opmerkingen</h3>
          {isEditing ? (
            <textarea
              value={editedNotes}
              onChange={(e) => setEditedNotes(e.target.value)}
              placeholder="Voeg opmerkingen toe..."
              className={styles.editTextarea}
              rows={4}
            />
          ) : (
            invoice.notes ? (
              <p className={styles.notesText}>{invoice.notes}</p>
            ) : (
              <p className={styles.noNotes}>Geen opmerkingen</p>
            )
          )}
        </div>
      </div>
    </div>
  )
}
