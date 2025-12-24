'use client'

/**
 * TransactionDetailsPanel - View and edit existing transactions
 * 
 * Modes:
 * - 'view': Read-only display (default)
 * - 'edit': Editable form
 * - 'deleting': Delete confirmation
 * 
 * Features:
 * - View mode shows all transaction details
 * - Displays attached documents with view button
 * - Edit mode reuses form fields
 * - Delete requires confirmation
 */

import { useState, useEffect } from 'react'
import { getTransaction, updateTransaction, deleteTransaction, getTransactionDocuments, getDocumentSignedUrl } from '@/app/dashboard/actions'
import { FileText, Edit2, Trash2, Save, X, Loader2 } from 'lucide-react'
import styles from './TransactionDetailsPanel.module.css'

interface TransactionDetailsPanelProps {
  transactionId: string
  onClose: () => void
  onSuccess: () => void
}

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

interface Document {
  id: string
  storage_path: string
  original_filename: string
  mime_type: string
  size_bytes: number | null
}

type PanelMode = 'view' | 'edit' | 'deleting'

export default function TransactionDetailsPanel({
  transactionId,
  onClose,
  onSuccess
}: TransactionDetailsPanelProps) {
  const [mode, setMode] = useState<PanelMode>('view')
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit mode form state
  const [type, setType] = useState<'INKOMSTEN' | 'UITGAVEN'>('UITGAVEN')
  const [datum, setDatum] = useState('')
  const [bedrag, setBedrag] = useState('')
  const [omschrijving, setOmschrijving] = useState('')
  const [vatTreatment, setVatTreatment] = useState<'domestic' | 'foreign_service_reverse_charge'>('domestic')
  const [btwTarief, setBtwTarief] = useState('21')
  const [categorie, setCategorie] = useState('')

  // Load transaction data
  useEffect(() => {
    async function loadTransaction() {
      setIsLoading(true)
      try {
        console.log('[TransactionDetailsPanel] Loading transaction:', transactionId)
        
        // Fetch transaction using server action
        const data = await getTransaction(transactionId)
        
        if (!data) {
          throw new Error('Transaction not found')
        }
        
        console.log('[TransactionDetailsPanel] Transaction loaded:', data)
        setTransaction(data)
        
        // Initialize form state
        setType(data.type_transactie)
        setDatum(data.datum.split('T')[0])
        setBedrag(data.bedrag.toString())
        setOmschrijving(data.omschrijving)
        setVatTreatment(data.vat_treatment || 'domestic')
        setBtwTarief(data.btw_tarief.toString())
        setCategorie(data.categorie)

        // Load documents
        console.log('[TransactionDetailsPanel] Loading documents for transaction:', transactionId)
        const docs = await getTransactionDocuments(transactionId)
        console.log('[TransactionDetailsPanel] Documents loaded:', docs)
        setDocuments(docs as Document[])
      } catch (err) {
        console.error('[TransactionDetailsPanel] Failed to load transaction:', err)
        setError('Kon transactie niet laden')
      } finally {
        setIsLoading(false)
      }
    }

    loadTransaction()
  }, [transactionId])

  async function handleViewDocument(storagePath: string) {
    const signedUrl = await getDocumentSignedUrl(storagePath)
    if (signedUrl) {
      window.open(signedUrl, '_blank')
    }
  }

  function handleEdit() {
    setMode('edit')
    setError(null)
  }

  function handleCancelEdit() {
    if (!transaction) return
    
    // Revert to original values
    setType(transaction.type_transactie)
    setDatum(transaction.datum.split('T')[0])
    setBedrag(transaction.bedrag.toString())
    setOmschrijving(transaction.omschrijving)
    setVatTreatment(transaction.vat_treatment || 'domestic')
    setBtwTarief(transaction.btw_tarief.toString())
    setCategorie(transaction.categorie)
    
    setMode('view')
    setError(null)
  }

  async function handleSave() {
    setIsSaving(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.set('type_transactie', type)
      formData.set('datum', datum)
      formData.set('bedrag', bedrag)
      formData.set('omschrijving', omschrijving)
      formData.set('vat_treatment', vatTreatment)
      formData.set('btw_tarief', btwTarief)
      formData.set('categorie', categorie)

      await updateTransaction(transactionId, formData)
      
      // Update local state
      if (transaction) {
        setTransaction({
          ...transaction,
          type_transactie: type,
          datum: new Date(datum).toISOString(),
          bedrag: parseFloat(bedrag),
          omschrijving,
          vat_treatment: vatTreatment,
          btw_tarief: parseInt(btwTarief),
          categorie
        })
      }

      setMode('view')
      onSuccess()
    } catch (err) {
      console.error('Failed to save:', err)
      setError(err instanceof Error ? err.message : 'Kon wijzigingen niet opslaan')
    } finally {
      setIsSaving(false)
    }
  }

  function handleDeleteClick() {
    setMode('deleting')
    setError(null)
  }

  function handleCancelDelete() {
    setMode('view')
  }

  async function handleConfirmDelete() {
    setIsSaving(true)
    setError(null)

    try {
      await deleteTransaction(transactionId)
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Failed to delete:', err)
      setError(err instanceof Error ? err.message : 'Kon transactie niet verwijderen')
      setMode('view')
    } finally {
      setIsSaving(false)
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <Loader2 size={32} className={styles.spinner} />
        <p>Laden...</p>
      </div>
    )
  }

  if (!transaction) {
    return (
      <div className={styles.error}>
        <p>Transactie niet gevonden</p>
      </div>
    )
  }

  // Delete confirmation mode
  if (mode === 'deleting') {
    return (
      <div className={styles.container}>
        <div className={styles.deleteConfirmation}>
          <div className={styles.deleteIcon}>
            <Trash2 size={48} />
          </div>
          <h3 className={styles.deleteTitle}>Transactie verwijderen?</h3>
          <p className={styles.deleteMessage}>
            Deze actie kan niet ongedaan worden gemaakt.
          </p>
          <div className={styles.deleteActions}>
            <button
              onClick={handleConfirmDelete}
              className={styles.confirmDeleteButton}
              disabled={isSaving}
            >
              {isSaving ? 'Verwijderen...' : 'Bevestig verwijderen'}
            </button>
            <button
              onClick={handleCancelDelete}
              className={styles.cancelButton}
              disabled={isSaving}
            >
              Annuleren
            </button>
          </div>
        </div>
      </div>
    )
  }

  // View mode
  if (mode === 'view') {
    return (
      <div className={styles.container}>
        {error && (
          <div className={styles.errorBanner}>
            {error}
          </div>
        )}

        <div className={styles.viewMode}>
          <div className={styles.field}>
            <span className={styles.label}>Type</span>
            <span className={`${styles.value} ${styles.typeBadge} ${transaction.type_transactie === 'INKOMSTEN' ? styles.income : styles.expense}`}>
              {transaction.type_transactie === 'INKOMSTEN' ? 'Inkomsten' : 'Uitgaven'}
            </span>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Datum</span>
            <span className={styles.value}>{formatDate(transaction.datum)}</span>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Bedrag</span>
            <span className={styles.value}>{formatCurrency(transaction.bedrag)}</span>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Omschrijving</span>
            <span className={styles.value}>{transaction.omschrijving}</span>
          </div>

          {transaction.type_transactie === 'UITGAVEN' && (
            <div className={styles.field}>
              <span className={styles.label}>BTW-type</span>
              <span className={styles.value}>
                {transaction.vat_treatment === 'foreign_service_reverse_charge' ? (
                  <span className={styles.badge}>BTW verlegd – diensten uit het buitenland</span>
                ) : (
                  'Normale Nederlandse btw'
                )}
              </span>
            </div>
          )}

          {transaction.vat_treatment === 'domestic' && (
            <div className={styles.field}>
              <span className={styles.label}>BTW-tarief</span>
              <span className={styles.value}>{transaction.btw_tarief}%</span>
            </div>
          )}

          <div className={styles.field}>
            <span className={styles.label}>Categorie</span>
            <span className={styles.value}>{transaction.categorie}</span>
          </div>

          {/* Documents section - always shown */}
          <div className={styles.field}>
            <span className={styles.label}>Bijlagen</span>
            {documents.length > 0 ? (
              <div className={styles.documentList}>
                {documents.map((doc) => (
                  <div key={doc.id} className={styles.documentItem}>
                    <FileText size={16} />
                    <span className={styles.documentName}>{doc.original_filename}</span>
                    <button
                      onClick={() => handleViewDocument(doc.storage_path)}
                      className={styles.viewDocButton}
                    >
                      Bekijken
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <span className={styles.value} style={{ color: 'var(--gray-500)', fontStyle: 'italic' }}>
                Geen documenten gekoppeld
              </span>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          <button onClick={handleEdit} className={styles.editButton}>
            <Edit2 size={16} />
            Bewerken
          </button>
          <button onClick={handleDeleteClick} className={styles.deleteButton}>
            <Trash2 size={16} />
            Verwijderen
          </button>
        </div>
      </div>
    )
  }

  // Edit mode
  return (
    <div className={styles.container}>
      {error && (
        <div className={styles.errorBanner}>
          {error}
        </div>
      )}

      <div className={styles.editMode}>
        <div className={styles.toggleContainer}>
          <button
            type="button"
            className={`${styles.toggleButton} ${type === 'INKOMSTEN' ? `${styles.active} ${styles.income}` : ''}`}
            onClick={() => setType('INKOMSTEN')}
          >
            Inkomsten
          </button>
          <button
            type="button"
            className={`${styles.toggleButton} ${type === 'UITGAVEN' ? `${styles.active} ${styles.expense}` : ''}`}
            onClick={() => setType('UITGAVEN')}
          >
            Uitgaven
          </button>
        </div>

        <div className={styles.formField}>
          <label htmlFor="datum" className={styles.formLabel}>Datum</label>
          <input
            type="date"
            id="datum"
            className={styles.input}
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
          />
        </div>

        <div className={styles.formField}>
          <label htmlFor="bedrag" className={styles.formLabel}>Bedrag (€)</label>
          <input
            type="number"
            id="bedrag"
            step="0.01"
            min="0.01"
            className={styles.input}
            value={bedrag}
            onChange={(e) => setBedrag(e.target.value)}
          />
        </div>

        <div className={styles.formField}>
          <label htmlFor="omschrijving" className={styles.formLabel}>Omschrijving</label>
          <input
            type="text"
            id="omschrijving"
            className={styles.input}
            value={omschrijving}
            onChange={(e) => setOmschrijving(e.target.value)}
          />
        </div>

        {type === 'UITGAVEN' && (
          <div className={styles.formField}>
            <label htmlFor="vat_treatment" className={styles.formLabel}>BTW-type</label>
            <select
              id="vat_treatment"
              className={styles.select}
              value={vatTreatment}
              onChange={(e) => setVatTreatment(e.target.value as 'domestic' | 'foreign_service_reverse_charge')}
            >
              <option value="domestic">Normale Nederlandse btw</option>
              <option value="foreign_service_reverse_charge">BTW verlegd – diensten uit het buitenland</option>
            </select>
          </div>
        )}

        {vatTreatment === 'domestic' && (
          <div className={styles.formField}>
            <label htmlFor="btw_tarief" className={styles.formLabel}>BTW-tarief</label>
            <select
              id="btw_tarief"
              className={styles.select}
              value={btwTarief}
              onChange={(e) => setBtwTarief(e.target.value)}
            >
              <option value="21">21%</option>
              <option value="9">9%</option>
              <option value="0">0%</option>
            </select>
          </div>
        )}

        <div className={styles.formField}>
          <label htmlFor="categorie" className={styles.formLabel}>Categorie</label>
          <select
            id="categorie"
            className={styles.select}
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
          >
            <option value="Inkoop">Inkoop</option>
            <option value="Sales">Sales</option>
            <option value="Reiskosten">Reiskosten</option>
            <option value="Kantoor">Kantoor</option>
            <option value="Overig">Overig</option>
          </select>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          onClick={handleSave}
          className={styles.saveButton}
          disabled={isSaving}
        >
          <Save size={16} />
          {isSaving ? 'Opslaan...' : 'Opslaan'}
        </button>
        <button
          onClick={handleCancelEdit}
          className={styles.cancelButton}
          disabled={isSaving}
        >
          <X size={16} />
          Annuleren
        </button>
      </div>
    </div>
  )
}
