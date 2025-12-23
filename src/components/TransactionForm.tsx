'use client'

/**
 * TransactionForm - Supports both creating and editing transactions
 * 
 * Features:
 * - Drag & drop invoice/receipt upload with automatic extraction
 * - Manual form entry with controlled inputs
 * - Edit mode with pre-filled values
 * 
 * Modes:
 * - 'create': Creates a new transaction (default)
 * - 'edit': Updates an existing transaction
 */

import { useState, useRef } from 'react'
import { createTransaction, updateTransaction, deleteTransaction, extractTransactionFromDocument } from '@/app/dashboard/actions'
import { Upload, FileText, X, Loader2 } from 'lucide-react'
import styles from './TransactionForm.module.css'

interface TransactionFormProps {
  onSuccess: () => void
  mode?: 'create' | 'edit'
  transactionId?: string
  initialValues?: {
    type_transactie: 'INKOMSTEN' | 'UITGAVEN'
    datum: string
    bedrag: number
    omschrijving: string
    btw_tarief: number
    categorie: string
    vat_treatment?: 'domestic' | 'foreign_service_reverse_charge'
    bon_url?: string
  }
}

export default function TransactionForm({ 
  onSuccess, 
  mode = 'create',
  transactionId,
  initialValues 
}: TransactionFormProps) {
  // Form field state (controlled inputs)
  const [type, setType] = useState<'INKOMSTEN' | 'UITGAVEN'>(
    initialValues?.type_transactie || 'UITGAVEN'
  )
  const [datum, setDatum] = useState(
    initialValues?.datum?.split('T')[0] || new Date().toISOString().split('T')[0]
  )
  const [bedrag, setBedrag] = useState(
    initialValues?.bedrag?.toString() || ''
  )
  const [omschrijving, setOmschrijving] = useState(
    initialValues?.omschrijving || ''
  )
  const [vatTreatment, setVatTreatment] = useState<'domestic' | 'foreign_service_reverse_charge'>(
    initialValues?.vat_treatment || 'domestic'
  )
  const [btwTarief, setBtwTarief] = useState(
    initialValues?.btw_tarief?.toString() || '21'
  )
  const [categorie, setCategorie] = useState(
    initialValues?.categorie || ''
  )

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(
    initialValues?.bon_url || null
  )
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  
  const formRef = useRef<HTMLFormElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle file extraction
  async function handleFileExtraction(file: File) {
    setIsExtracting(true)
    setError(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const result = await extractTransactionFromDocument(formData)
      
      // Prefill form fields with extracted data
      setType('UITGAVEN') // Always set to expenses for uploaded invoices
      
      if (result.extracted.date) {
        setDatum(result.extracted.date)
      }
      
      if (result.extracted.amount) {
        setBedrag(result.extracted.amount.toString())
      }
      
      if (result.extracted.description) {
        setOmschrijving(result.extracted.description)
      } else if (result.extracted.supplier_name) {
        setOmschrijving(result.extracted.supplier_name)
      }
      
      if (result.extracted.vat?.vat_treatment) {
        const treatment = result.extracted.vat.vat_treatment
        if (treatment === 'domestic' || treatment === 'foreign_service_reverse_charge') {
          setVatTreatment(treatment)
        }
      }
      
      if (result.extracted.vat?.vat_rate !== null && result.extracted.vat?.vat_rate !== undefined) {
        setBtwTarief(result.extracted.vat.vat_rate.toString())
      }
      
      if (result.extracted.category) {
        setCategorie(result.extracted.category)
      }
      
      // Store file info for submission
      setUploadedFilePath(result.storage_path)
      setUploadedFileName(file.name)
      
      // Set preview
      if (file.type.startsWith('image/')) {
        setReceiptPreview(result.public_url)
      } else {
        // For PDFs, just show filename
        setReceiptPreview(null)
      }
      
    } catch (err) {
      console.error('Extraction failed:', err)
      setError(err instanceof Error ? err.message : 'Kon factuur niet verwerken. Probeer het opnieuw of vul handmatig in.')
    } finally {
      setIsExtracting(false)
    }
  }

  // Drag and drop handlers
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileExtraction(file)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      handleFileExtraction(file)
    }
  }

  function handleDropzoneClick() {
    fileInputRef.current?.click()
  }

  function clearUploadedFile() {
    setUploadedFilePath(null)
    setUploadedFileName(null)
    setReceiptPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)
    
    // Append controlled field values
    formData.set('type_transactie', type)
    formData.set('datum', datum)
    formData.set('bedrag', bedrag)
    formData.set('omschrijving', omschrijving)
    formData.set('vat_treatment', vatTreatment)
    formData.set('btw_tarief', btwTarief)
    formData.set('categorie', categorie)
    
    // If file was uploaded and extracted, include the storage path
    if (uploadedFilePath) {
      formData.set('bon_url', uploadedFilePath)
    }
    
    try {
      if (mode === 'create') {
        await createTransaction(formData)
      } else if (mode === 'edit' && transactionId) {
        await updateTransaction(transactionId, formData)
      }
      
      // Reset form on success (only for create mode)
      if (mode === 'create') {
        setType('UITGAVEN')
        setDatum(new Date().toISOString().split('T')[0])
        setBedrag('')
        setOmschrijving('')
        setVatTreatment('domestic')
        setBtwTarief('21')
        setCategorie('')
        setReceiptPreview(null)
        setUploadedFilePath(null)
        setUploadedFileName(null)
      }
      
      // Close drawer and show success
      onSuccess()
    } catch (err) {
      console.error('Failed to save transaction', err)
      setError(err instanceof Error ? err.message : 'Er ging iets mis bij het opslaan van de transactie.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete() {
    if (!transactionId) return

    const confirmed = confirm('Weet je zeker dat je deze transactie wilt verwijderen?')
    if (!confirmed) return

    setIsLoading(true)
    setError(null)

    try {
      await deleteTransaction(transactionId)
      onSuccess()
    } catch (err) {
      console.error('Failed to delete transaction', err)
      setError(err instanceof Error ? err.message : 'Er ging iets mis bij het verwijderen van de transactie.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className={styles.form}>
      {error && (
        <div style={{ 
          padding: '12px', 
          backgroundColor: 'rgba(255, 59, 48, 0.1)', 
          border: '1px solid rgba(255, 59, 48, 0.3)',
          borderRadius: '8px',
          color: '#ff3b30',
          fontSize: '0.875rem',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      {/* Dropzone for invoice upload (only in create mode) */}
      {mode === 'create' && (
        <div className={styles.dropzoneWrapper}>
          <div
            className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''} ${isExtracting ? styles.dropzoneLoading : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleDropzoneClick}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/jpg"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            
            {isExtracting ? (
              <div className={styles.dropzoneContent}>
                <Loader2 size={32} className={styles.spinner} />
                <p className={styles.dropzoneTitle}>Factuur verwerken...</p>
                <p className={styles.dropzoneSubtitle}>Even geduld</p>
              </div>
            ) : uploadedFileName ? (
              <div className={styles.dropzoneContent}>
                <FileText size={32} />
                <p className={styles.dropzoneTitle}>{uploadedFileName}</p>
                <p className={styles.dropzoneSubtitle}>Gegevens ingevuld</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearUploadedFile()
                  }}
                  className={styles.clearButton}
                >
                  <X size={16} /> Verwijderen
                </button>
              </div>
            ) : (
              <div className={styles.dropzoneContent}>
                <Upload size={32} />
                <p className={styles.dropzoneTitle}>Sleep factuur hierheen</p>
                <p className={styles.dropzoneSubtitle}>of klik om te uploaden (PDF, PNG, JPG)</p>
              </div>
            )}
          </div>
          
          {receiptPreview && (
            <div className={styles.previewWrapper}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={receiptPreview} 
                alt="Receipt preview" 
                className={styles.previewImage}
              />
            </div>
          )}
        </div>
      )}

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

      <div className={styles.field}>
        <label htmlFor="datum" className={styles.label}>Datum</label>
        <input
          type="date"
          id="datum"
          name="datum"
          required
          className={styles.input}
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="bedrag" className={styles.label}>Bedrag (€)</label>
        <input
          type="number"
          id="bedrag"
          name="bedrag"
          step="0.01"
          min="0.01"
          required
          placeholder="0.00"
          className={styles.input}
          value={bedrag}
          onChange={(e) => setBedrag(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="omschrijving" className={styles.label}>Omschrijving</label>
        <input
          type="text"
          id="omschrijving"
          name="omschrijving"
          required
          placeholder="Bijv. Lunch met klant"
          className={styles.input}
          value={omschrijving}
          onChange={(e) => setOmschrijving(e.target.value)}
        />
      </div>

      {type === 'UITGAVEN' && (
        <div className={styles.field}>
          <label htmlFor="vat_treatment" className={styles.label}>Btw-type</label>
          <select
            id="vat_treatment"
            name="vat_treatment"
            className={styles.select}
            value={vatTreatment}
            onChange={(e) => setVatTreatment(e.target.value as 'domestic' | 'foreign_service_reverse_charge')}
          >
            <option value="domestic">Normale Nederlandse btw</option>
            <option value="foreign_service_reverse_charge">Btw verlegd – diensten uit het buitenland</option>
          </select>
          {vatTreatment === 'foreign_service_reverse_charge' && (
            <p className={styles.helperText}>
              Gebruik dit voor diensten uit het buitenland zonder btw op de factuur (bijv. Lovable, Figma, online software). De btw wordt in Nederland verlegd.
            </p>
          )}
        </div>
      )}

      {vatTreatment === 'domestic' && (
        <div className={styles.field}>
          <label htmlFor="btw_tarief" className={styles.label}>BTW Tarief</label>
          <select 
            id="btw_tarief" 
            name="btw_tarief" 
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

      <div className={styles.field}>
        <label htmlFor="categorie" className={styles.label}>Categorie</label>
        <select 
          id="categorie" 
          name="categorie" 
          className={styles.select} 
          required
          value={categorie}
          onChange={(e) => setCategorie(e.target.value)}
        >
          <option value="" disabled>Selecteer een categorie</option>
          <option value="Inkoop">Inkoop</option>
          <option value="Sales">Sales</option>
          <option value="Reiskosten">Reiskosten</option>
          <option value="Kantoor">Kantoor</option>
          <option value="Overig">Overig</option>
        </select>
      </div>

      <button type="submit" className={styles.submitButton} disabled={isLoading || isExtracting}>
        {isLoading 
          ? 'Opslaan...' 
          : mode === 'create' ? 'Transactie toevoegen' : 'Opslaan'
        }
      </button>

      {mode === 'edit' && (
        <button 
          type="button" 
          onClick={handleDelete}
          className={styles.deleteButton}
          disabled={isLoading}
        >
          Verwijderen
        </button>
      )}
    </form>
  )
}
