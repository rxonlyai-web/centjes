'use client'

// BTW (VAT) Overview page for quarterly Dutch tax reporting
// Shows revenue, VAT collected, deductible VAT, and net VAT per quarter
//
// Year Management:
// - Uses global activeYear from YearContext (top-right selector)
// - No local year selector - user changes year via global selector
// - Quarter selection remains local to this page

import { useState, useEffect } from 'react'
import { useActiveYear } from '@/contexts/YearContext'
import styles from './btw.module.css'
import { getVATSummary, type VATSummary } from './actions'

export default function BTWPage() {
  // Get global active year - this is the ONLY source of year for this page
  const { activeYear } = useActiveYear()
  
  // Get current quarter as default
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentQuarter = Math.floor(currentMonth / 3) + 1 as 1 | 2 | 3 | 4

  // Local state - only quarter selection (year comes from global context)
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(currentQuarter)
  const [summary, setSummary] = useState<VATSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const quarterOptions = [
    { value: 1, label: 'Q1 (jan-mrt)' },
    { value: 2, label: 'Q2 (apr-jun)' },
    { value: 3, label: 'Q3 (jul-sep)' },
    { value: 4, label: 'Q4 (okt-dec)' },
  ]

  // Fetch VAT summary when activeYear or quarter changes
  // Note: activeYear comes from global context, will re-fetch when user changes it
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

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>BTW-overzicht</h1>
      </header>

      {/* Quarter Selection - Year is controlled by global selector in top bar */}
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

      {/* VAT Summary Table or Empty State */}
      <main className={styles.main}>
        {isLoading ? (
          <div className={styles.emptyState}>
            <p>Laden...</p>
          </div>
        ) : summary && summary.transaction_count > 0 ? (
          <>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.tableHeader}>Omschrijving</th>
                    <th className={styles.tableHeaderRight}>Bedrag</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={styles.tableRow}>
                    <td className={styles.tableCell}>Omzet 21% (excl. btw)</td>
                    <td className={styles.tableCellRight}>{formatCurrency(summary.omzet_21)}</td>
                  </tr>
                  <tr className={styles.tableRow}>
                    <td className={styles.tableCell}>Btw 21%</td>
                    <td className={styles.tableCellRight}>{formatCurrency(summary.btw_21)}</td>
                  </tr>
                  <tr className={styles.tableRow}>
                    <td className={styles.tableCell}>Omzet 9% (excl. btw)</td>
                    <td className={styles.tableCellRight}>{formatCurrency(summary.omzet_9)}</td>
                  </tr>
                  <tr className={styles.tableRow}>
                    <td className={styles.tableCell}>Btw 9%</td>
                    <td className={styles.tableCellRight}>{formatCurrency(summary.btw_9)}</td>
                  </tr>
                  <tr className={styles.tableRow}>
                    <td className={styles.tableCell}>Voorbelasting (btw op zakelijke kosten)</td>
                    <td className={styles.tableCellRight}>{formatCurrency(summary.voorbelasting)}</td>
                  </tr>

                  {/* Reverse Charge Section - Rubrics 4a and 4b */}
                  {(summary.rubric_4a_turnover > 0 || summary.rubric_4b_turnover > 0 || summary.incomplete_reverse_charge_count > 0) && (
                    <>
                      <tr className={styles.tableRow} style={{ backgroundColor: 'var(--bg-subtle)' }}>
                        <td className={styles.tableCell} colSpan={2} style={{ paddingTop: '1.5rem', paddingBottom: '0.5rem', fontWeight: 600 }}>
                          Verlegde btw – diensten uit het buitenland
                        </td>
                      </tr>
                      
                      {/* Rubric 4a - NON_EU */}
                      {summary.rubric_4a_turnover > 0 && (
                        <>
                          <tr className={styles.tableRow}>
                            <td className={styles.tableCell} style={{ paddingLeft: '1.5rem', fontWeight: 500 }}>
                              Rubric 4a – Diensten uit niet-EU landen
                            </td>
                            <td className={styles.tableCellRight}></td>
                          </tr>
                          <tr className={styles.tableRow}>
                            <td className={styles.tableCell} style={{ paddingLeft: '2rem' }}>Grondslag diensten</td>
                            <td className={styles.tableCellRight}>{formatCurrency(summary.rubric_4a_turnover)}</td>
                          </tr>
                          <tr className={styles.tableRow}>
                            <td className={styles.tableCell} style={{ paddingLeft: '2rem' }}>Verschuldigde btw 21%</td>
                            <td className={styles.tableCellRight}>{formatCurrency(summary.rubric_4a_vat)}</td>
                          </tr>
                        </>
                      )}
                      
                      {/* Rubric 4b - EU */}
                      {summary.rubric_4b_turnover > 0 && (
                        <>
                          <tr className={styles.tableRow}>
                            <td className={styles.tableCell} style={{ paddingLeft: '1.5rem', fontWeight: 500 }}>
                              Rubric 4b – Diensten uit EU-landen
                            </td>
                            <td className={styles.tableCellRight}></td>
                          </tr>
                          <tr className={styles.tableRow}>
                            <td className={styles.tableCell} style={{ paddingLeft: '2rem' }}>Grondslag diensten</td>
                            <td className={styles.tableCellRight}>{formatCurrency(summary.rubric_4b_turnover)}</td>
                          </tr>
                          <tr className={styles.tableRow}>
                            <td className={styles.tableCell} style={{ paddingLeft: '2rem' }}>Verschuldigde btw 21%</td>
                            <td className={styles.tableCellRight}>{formatCurrency(summary.rubric_4b_vat)}</td>
                          </tr>
                        </>
                      )}
                      
                      {/* Summary of reverse charge */}
                      {(summary.rubric_4a_vat > 0 || summary.rubric_4b_vat > 0) && (
                        <>
                          <tr className={styles.tableRow}>
                            <td className={styles.tableCell} style={{ paddingLeft: '1.5rem', fontStyle: 'italic' }}>
                              Totaal verlegde btw (ook aftrekbaar)
                            </td>
                            <td className={styles.tableCellRight}>
                              {formatCurrency(summary.rubric_4a_vat + summary.rubric_4b_vat)}
                            </td>
                          </tr>
                          <tr className={styles.tableRow} style={{ borderBottom: '2px solid var(--border-color)' }}>
                            <td className={styles.tableCell} style={{ paddingLeft: '1.5rem', fontStyle: 'italic' }}>Netto effect</td>
                            <td className={styles.tableCellRight}>€ 0,00</td>
                          </tr>
                        </>
                      )}
                      
                      {/* Warning for incomplete transactions */}
                      {summary.incomplete_reverse_charge_count > 0 && (
                        <tr className={styles.tableRow} style={{ backgroundColor: '#FEF3C7' }}>
                          <td className={styles.tableCell} colSpan={2} style={{ padding: '1rem 1.5rem', color: '#92400E' }}>
                            <strong>⚠️ Let op:</strong> {summary.incomplete_reverse_charge_count} transactie{summary.incomplete_reverse_charge_count !== 1 ? 's' : ''} met verlegde btw {summary.incomplete_reverse_charge_count !== 1 ? 'hebben' : 'heeft'} geen EU-locatie. 
                            Deze {summary.incomplete_reverse_charge_count !== 1 ? 'moeten' : 'moet'} handmatig worden geclassificeerd als EU of niet-EU voor een correcte btw-aangifte.
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                  <tr className={`${styles.tableRow} ${styles.totalRow}`}>
                    <td className={styles.tableCell}>
                      <strong>Netto btw (te betalen / terug te vragen)</strong>
                    </td>
                    <td className={styles.tableCellRight}>
                      <strong className={summary.netto_btw >= 0 ? styles.positive : styles.negative}>
                        {formatCurrency(summary.netto_btw)}
                      </strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={styles.helpText}>
              <p>
                <strong>Toelichting:</strong> Gebruik deze bedragen om je btw-aangifte bij de Belastingdienst in te vullen. 
                Netto btw is de btw op je inkomsten minus de btw op je uitgaven (voorbelasting). 
                {(summary.rubric_4a_vat > 0 || summary.rubric_4b_vat > 0) && ' Verlegde btw (rubrieken 4a/4b) wordt hierbij opgeteld en direct weer afgetrokken, dus heeft geen effect op het netto bedrag.'}
                {summary.netto_btw >= 0 
                  ? ' Dit bedrag moet je betalen aan de Belastingdienst.'
                  : ' Dit bedrag kun je terugvragen van de Belastingdienst.'}
              </p>
              <p className={styles.transactionCount}>
                Gebaseerd op {summary.transaction_count} transactie{summary.transaction_count !== 1 ? 's' : ''} in dit kwartaal.
              </p>
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            <p>Geen transacties gevonden voor {quarterOptions[selectedQuarter - 1].label} {activeYear}</p>
            <small>Voeg transacties toe om je btw-overzicht te genereren</small>
          </div>
        )}
      </main>
    </div>
  )
}
