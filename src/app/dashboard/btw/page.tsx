'use client'

// BTW (VAT) Overview page for quarterly Dutch tax reporting
// Mirrors the Belastingdienst aangifte form rubrics for easy copy-paste filing
//
// Year Management:
// - Uses global activeYear from YearContext (top-right selector)
// - Quarter selection remains local to this page

import { useState, useEffect, useCallback } from 'react'
import { useActiveYear } from '@/contexts/YearContext'
import styles from './btw.module.css'
import { getVATSummary, type VATSummary } from './actions'

export default function BTWPage() {
  const { activeYear } = useActiveYear()

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentQuarter = Math.floor(currentMonth / 3) + 1 as 1 | 2 | 3 | 4

  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(currentQuarter)
  const [summary, setSummary] = useState<VATSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const quarterOptions = [
    { value: 1, label: 'Q1 (jan-mrt)' },
    { value: 2, label: 'Q2 (apr-jun)' },
    { value: 3, label: 'Q3 (jul-sep)' },
    { value: 4, label: 'Q4 (okt-dec)' },
  ]

  useEffect(() => {
    async function fetchSummary() {
      setIsLoading(true)
      try {
        const data = await getVATSummary(activeYear, selectedQuarter)
        setSummary(data)
      } catch (error) {
        console.error('Error fetching VAT summary:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSummary()
  }, [activeYear, selectedQuarter])

  // Format for display (with currency symbol)
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  // Format for copying (plain number, Dutch format)
  const formatForCopy = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(amount))
  }

  const copyToClipboard = useCallback(async (value: number, field: string) => {
    try {
      await navigator.clipboard.writeText(formatForCopy(value))
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 1500)
    } catch {
      // Fallback: select text
    }
  }, [])

  // Calculated values for rubric 5a
  const verschuldigdeBtw = summary
    ? summary.btw_21 + summary.btw_9 + summary.rubric_4a_vat + summary.rubric_4b_vat
    : 0

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>BTW-aangifte</h1>
        <p className={styles.headerSub}>
          Vul deze bedragen in op de Belastingdienst. Klik op een bedrag om te kopiëren.
        </p>
      </header>

      {/* Quarter Selection */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label htmlFor="quarter" className={styles.label}>
            Kwartaal
          </label>
          <select
            id="quarter"
            className={styles.select}
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
          >
            {quarterOptions.map((q) => (
              <option key={q.value} value={q.value}>
                {q.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* VAT Form */}
      <main className={styles.main}>
        {isLoading ? (
          <div className={styles.emptyState}>
            <p>Laden...</p>
          </div>
        ) : summary && summary.transaction_count > 0 ? (
          <>
            {/* Section 1: Binnenlandse omzet */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>1. Prestaties binnenland</h2>
              <div className={styles.rubricGrid}>
                <RubricRow
                  rubric="1a"
                  label="Leveringen/diensten belast met hoog tarief"
                  turnover={summary.omzet_21}
                  vat={summary.btw_21}
                  copiedField={copiedField}
                  onCopy={copyToClipboard}
                  formatCurrency={formatCurrency}
                />
                <RubricRow
                  rubric="1b"
                  label="Leveringen/diensten belast met laag tarief"
                  turnover={summary.omzet_9}
                  vat={summary.btw_9}
                  copiedField={copiedField}
                  onCopy={copyToClipboard}
                  formatCurrency={formatCurrency}
                />
              </div>
            </div>

            {/* Section 4: Verlegde btw */}
            {(summary.rubric_4a_turnover > 0 || summary.rubric_4b_turnover > 0 || summary.incomplete_reverse_charge_count > 0) && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>4. Prestaties vanuit het buitenland aan u verricht</h2>
                <div className={styles.rubricGrid}>
                  {summary.rubric_4a_turnover > 0 && (
                    <RubricRow
                      rubric="4a"
                      label="Diensten uit landen buiten de EU"
                      turnover={summary.rubric_4a_turnover}
                      vat={summary.rubric_4a_vat}
                      copiedField={copiedField}
                      onCopy={copyToClipboard}
                      formatCurrency={formatCurrency}
                    />
                  )}
                  {summary.rubric_4b_turnover > 0 && (
                    <RubricRow
                      rubric="4b"
                      label="Diensten uit EU-landen"
                      turnover={summary.rubric_4b_turnover}
                      vat={summary.rubric_4b_vat}
                      copiedField={copiedField}
                      onCopy={copyToClipboard}
                      formatCurrency={formatCurrency}
                    />
                  )}
                </div>
                {summary.incomplete_reverse_charge_count > 0 && (
                  <div className={styles.warning}>
                    <strong>Let op:</strong> {summary.incomplete_reverse_charge_count} transactie{summary.incomplete_reverse_charge_count !== 1 ? 's' : ''} met verlegde btw {summary.incomplete_reverse_charge_count !== 1 ? 'hebben' : 'heeft'} geen EU-locatie.
                    Classificeer {summary.incomplete_reverse_charge_count !== 1 ? 'deze' : 'dit'} bij Transacties als EU of niet-EU.
                  </div>
                )}
              </div>
            )}

            {/* Section 5: Berekening */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>5. Berekening</h2>
              <div className={styles.rubricGrid}>
                <div className={styles.rubricRow}>
                  <div className={styles.rubricCode}>5a</div>
                  <div className={styles.rubricLabel}>Verschuldigde omzetbelasting</div>
                  <div className={styles.rubricValues}>
                    <CopyableValue
                      value={verschuldigdeBtw}
                      field="5a"
                      copiedField={copiedField}
                      onCopy={copyToClipboard}
                      formatCurrency={formatCurrency}
                    />
                  </div>
                </div>
                <div className={styles.rubricRow}>
                  <div className={styles.rubricCode}>5b</div>
                  <div className={styles.rubricLabel}>Voorbelasting</div>
                  <div className={styles.rubricValues}>
                    <CopyableValue
                      value={summary.voorbelasting}
                      field="5b"
                      copiedField={copiedField}
                      onCopy={copyToClipboard}
                      formatCurrency={formatCurrency}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Net result */}
            <div className={styles.resultCard}>
              <div className={styles.resultRow}>
                <div>
                  <span className={styles.resultLabel}>Te betalen / terug te vragen</span>
                  <span className={styles.resultHint}>
                    {summary.netto_btw >= 0 ? 'Betalen aan Belastingdienst' : 'Terugvragen van Belastingdienst'}
                  </span>
                </div>
                <button
                  className={`${styles.resultValue} ${summary.netto_btw >= 0 ? styles.positive : styles.negative}`}
                  onClick={() => copyToClipboard(Math.abs(summary.netto_btw), 'netto')}
                  title="Klik om te kopiëren"
                >
                  {formatCurrency(summary.netto_btw)}
                  <span className={styles.copyHint}>
                    {copiedField === 'netto' ? 'Gekopieerd!' : ''}
                  </span>
                </button>
              </div>
            </div>

            <p className={styles.transactionCount}>
              Gebaseerd op {summary.transaction_count} transactie{summary.transaction_count !== 1 ? 's' : ''} in {quarterOptions[selectedQuarter - 1].label} {activeYear}
            </p>
          </>
        ) : (
          <div className={styles.emptyState}>
            <p>Geen transacties gevonden voor {quarterOptions[selectedQuarter - 1].label} {activeYear}</p>
            <small>Voeg transacties toe om je btw-aangifte te genereren</small>
          </div>
        )}
      </main>
    </div>
  )
}

function RubricRow({
  rubric,
  label,
  turnover,
  vat,
  copiedField,
  onCopy,
  formatCurrency,
}: {
  rubric: string
  label: string
  turnover: number
  vat: number
  copiedField: string | null
  onCopy: (value: number, field: string) => void
  formatCurrency: (amount: number) => string
}) {
  return (
    <div className={styles.rubricRow}>
      <div className={styles.rubricCode}>{rubric}</div>
      <div className={styles.rubricLabel}>{label}</div>
      <div className={styles.rubricValues}>
        <CopyableValue
          value={turnover}
          field={`${rubric}-omzet`}
          label="Omzet"
          copiedField={copiedField}
          onCopy={onCopy}
          formatCurrency={formatCurrency}
        />
        <CopyableValue
          value={vat}
          field={`${rubric}-btw`}
          label="BTW"
          copiedField={copiedField}
          onCopy={onCopy}
          formatCurrency={formatCurrency}
        />
      </div>
    </div>
  )
}

function CopyableValue({
  value,
  field,
  label,
  copiedField,
  onCopy,
  formatCurrency,
}: {
  value: number
  field: string
  label?: string
  copiedField: string | null
  onCopy: (value: number, field: string) => void
  formatCurrency: (amount: number) => string
}) {
  const isCopied = copiedField === field
  return (
    <button
      className={`${styles.copyableValue} ${isCopied ? styles.copied : ''}`}
      onClick={() => onCopy(value, field)}
      title="Klik om te kopiëren"
    >
      {label && <span className={styles.valueLabel}>{label}</span>}
      <span className={styles.valueAmount}>{formatCurrency(value)}</span>
      <span className={styles.copyIndicator}>
        {isCopied ? 'Gekopieerd!' : 'Kopieer'}
      </span>
    </button>
  )
}
