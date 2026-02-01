'use client'

import { useState, useRef } from 'react'
import { X, Upload, Loader2, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react'
import { parseBankStatement, categorizeBankTransactions, importBankTransactions } from '@/app/dashboard/transacties/import-actions'
import type { ParsedBankRow, CategorizedTransaction, BankFormat } from '@/lib/bank-csv'
import styles from './BankImportModal.module.css'

interface BankImportModalProps {
  onClose: () => void
  onSuccess: () => void
}

type Phase = 'upload' | 'parsing' | 'categorizing' | 'review' | 'importing' | 'done'

const BANK_NAMES: Record<BankFormat, string> = {
  ING: 'ING',
  RABOBANK: 'Rabobank',
  ABN_AMRO: 'ABN AMRO',
  BUNQ: 'Bunq',
}

const CATEGORIES = ['Inkoop', 'Sales', 'Reiskosten', 'Kantoor', 'Overig'] as const

interface ReviewRow extends CategorizedTransaction {
  selected: boolean
  index: number
}

export default function BankImportModal({ onClose, onSuccess }: BankImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('upload')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  // Parse results
  const [bankName, setBankName] = useState('')
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([])
  const [importResult, setImportResult] = useState({ imported: 0, skipped: 0 })

  async function handleFile(file: File) {
    setError('')
    setPhase('parsing')

    // 1. Parse
    const formData = new FormData()
    formData.append('file', file)
    const parseResult = await parseBankStatement(formData)

    if (!parseResult.success || !parseResult.transactions) {
      setError(parseResult.error || 'Bestand kon niet worden gelezen')
      setPhase('upload')
      return
    }

    setBankName(BANK_NAMES[parseResult.bank!] || parseResult.bank!)
    setPhase('categorizing')

    // 2. AI categorize + duplicate check
    const catResult = await categorizeBankTransactions(parseResult.transactions)

    if (!catResult.success || !catResult.categorized) {
      setError(catResult.error || 'Categorisering mislukt')
      setPhase('upload')
      return
    }

    // 3. Build review rows
    const rows: ReviewRow[] = catResult.categorized.map((t, i) => ({
      ...t,
      selected: !t.isDuplicate,
      index: i,
    }))

    setReviewRows(rows)
    setPhase('review')
  }

  async function handleImport() {
    setPhase('importing')
    setError('')

    const toImport = reviewRows.filter(r => r.selected)
    const result = await importBankTransactions(toImport)

    if (!result.success) {
      setError(result.error || 'Importeren mislukt')
      setPhase('review')
      return
    }

    setImportResult({ imported: result.imported || 0, skipped: result.skipped || 0 })
    setPhase('done')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function toggleRow(index: number) {
    setReviewRows(prev =>
      prev.map(r => (r.index === index ? { ...r, selected: !r.selected } : r))
    )
  }

  function updateCategory(index: number, categorie: string) {
    setReviewRows(prev =>
      prev.map(r => (r.index === index ? { ...r, categorie: categorie as ReviewRow['categorie'] } : r))
    )
  }

  function toggleAll(checked: boolean) {
    setReviewRows(prev =>
      prev.map(r => (r.isDuplicate ? r : { ...r, selected: checked }))
    )
  }

  const selectedCount = reviewRows.filter(r => r.selected).length
  const duplicateCount = reviewRows.filter(r => r.isDuplicate).length
  const lowConfidenceCount = reviewRows.filter(r => r.aiConfidence === 'low' && !r.isDuplicate).length

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <FileSpreadsheet size={24} />
            <h2>Bankafschrift importeren</h2>
          </div>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {error && (
            <div className={styles.alert} data-type="error">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {/* Phase: Upload */}
          {phase === 'upload' && (
            <div
              className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tab,.txt"
                onChange={handleFileChange}
                className={styles.fileInput}
              />
              <Upload size={48} className={styles.dropzoneIcon} />
              <span className={styles.dropzoneText}>
                Sleep je bankafschrift hierheen
              </span>
              <span className={styles.dropzoneHint}>
                CSV of TAB bestand van ING, Rabobank, ABN AMRO of Bunq
              </span>
            </div>
          )}

          {/* Phase: Parsing / Categorizing */}
          {(phase === 'parsing' || phase === 'categorizing') && (
            <div className={styles.loadingState}>
              <Loader2 size={48} className={styles.spinner} />
              <p>{phase === 'parsing' ? 'Bestand wordt gelezen...' : `${bankName} transacties worden gecategoriseerd...`}</p>
            </div>
          )}

          {/* Phase: Review */}
          {phase === 'review' && (
            <>
              <div className={styles.alert} data-type="info">
                <FileSpreadsheet size={20} />
                <span>{bankName} — {reviewRows.length} transacties gevonden</span>
              </div>

              <div className={styles.summary}>
                <span className={styles.summaryItem}>
                  <span className={styles.summaryValue}>{selectedCount}</span> te importeren
                </span>
                {duplicateCount > 0 && (
                  <span className={styles.summaryItem}>
                    <span className={styles.summaryValue}>{duplicateCount}</span> duplicaten
                  </span>
                )}
                {lowConfidenceCount > 0 && (
                  <span className={styles.summaryItem}>
                    <span className={styles.summaryValue}>{lowConfidenceCount}</span> onzeker
                  </span>
                )}
              </div>

              <div className={styles.transactionList}>
                {/* Select all */}
                <div className={styles.transactionRow}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={selectedCount === reviewRows.length - duplicateCount}
                    onChange={e => toggleAll(e.target.checked)}
                  />
                  <span className={styles.datum} style={{ fontWeight: 600 }}>Datum</span>
                  <span className={styles.omschrijving} style={{ fontWeight: 600 }}>Omschrijving</span>
                  <span className={styles.bedrag} style={{ fontWeight: 600 }}>Bedrag</span>
                  <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)' }}>Categorie</span>
                </div>

                {reviewRows.map(row => (
                  <div
                    key={row.index}
                    className={`${styles.transactionRow} ${row.isDuplicate ? styles.transactionRowDuplicate : ''}`}
                  >
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={row.selected}
                      disabled={row.isDuplicate}
                      onChange={() => toggleRow(row.index)}
                    />
                    <span className={styles.datum}>
                      {new Date(row.datum).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' })}
                    </span>
                    <span className={styles.omschrijving} title={row.omschrijving}>
                      {row.isDuplicate && <span className={styles.duplicateBadge}>Duplicaat</span>}{' '}
                      {row.omschrijving}
                    </span>
                    <span className={`${styles.bedrag} ${row.type_transactie === 'INKOMSTEN' ? styles.income : styles.expense}`}>
                      {row.type_transactie === 'UITGAVEN' ? '-' : '+'}€{row.bedrag.toFixed(2).replace('.', ',')}
                    </span>
                    <select
                      className={`${styles.categorieSelect} ${row.aiConfidence === 'low' ? styles.lowConfidence : ''}`}
                      value={row.categorie}
                      onChange={e => updateCategory(row.index, e.target.value)}
                      disabled={row.isDuplicate}
                    >
                      {CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Phase: Importing */}
          {phase === 'importing' && (
            <div className={styles.loadingState}>
              <Loader2 size={48} className={styles.spinner} />
              <p>{selectedCount} transacties worden geïmporteerd...</p>
            </div>
          )}

          {/* Phase: Done */}
          {phase === 'done' && (
            <div className={styles.successState}>
              <CheckCircle size={64} className={styles.successIcon} />
              <span className={styles.successText}>
                {importResult.imported} transacties geïmporteerd
              </span>
              {importResult.skipped > 0 && (
                <span className={styles.successSub}>
                  {importResult.skipped} transacties overgeslagen
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {(phase === 'review' || phase === 'done') && (
          <div className={styles.actions}>
            {phase === 'review' && (
              <>
                <button onClick={onClose} className={styles.buttonSecondary}>
                  Annuleren
                </button>
                <button
                  onClick={handleImport}
                  disabled={selectedCount === 0}
                  className={styles.buttonPrimary}
                >
                  <Upload size={20} />
                  Importeer {selectedCount} transacties
                </button>
              </>
            )}
            {phase === 'done' && (
              <button
                onClick={() => { onSuccess(); onClose() }}
                className={styles.buttonPrimary}
              >
                Sluiten
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
