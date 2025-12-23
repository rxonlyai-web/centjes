/**
 * Cost Classification Table Component
 * 
 * Displays breakdown of costs by deductibility:
 * - Fully deductible (100%)
 * - Limited deductible (80%)
 */

import styles from '../ib.module.css'

interface CostClassificationTableProps {
  data: {
    fullyDeductible: number
    limitedDeductible: number
    limited80Percent: number
    limited20Percent: number
  }
}

export default function CostClassificationTable({ data }: CostClassificationTableProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const totalDeductible = data.fullyDeductible + data.limited80Percent

  return (
    <div className={styles.tableWrapper}>
      <h3 className={styles.tableTitle}>Kostenclassificatie</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.tableHeader}>Type</th>
            <th className={styles.tableHeaderRight}>Bedrag</th>
            <th className={styles.tableHeaderRight}>Aftrekbaar</th>
          </tr>
        </thead>
        <tbody>
          <tr className={styles.tableRow}>
            <td className={styles.tableCell}>Volledig aftrekbaar</td>
            <td className={styles.tableCellRight}>{formatCurrency(data.fullyDeductible)}</td>
            <td className={styles.tableCellRight}>100%</td>
          </tr>
          <tr className={styles.tableRow}>
            <td className={styles.tableCell}>Beperkt aftrekbaar (totaal)</td>
            <td className={styles.tableCellRight}>{formatCurrency(data.limitedDeductible)}</td>
            <td className={styles.tableCellRight}>-</td>
          </tr>
          <tr className={`${styles.tableRow} ${styles.tableSubRow}`}>
            <td className={styles.tableCell}>→ Aftrekbaar (80%)</td>
            <td className={styles.tableCellRight}>{formatCurrency(data.limited80Percent)}</td>
            <td className={styles.tableCellRight}>80%</td>
          </tr>
          <tr className={`${styles.tableRow} ${styles.tableSubRow}`}>
            <td className={styles.tableCell}>→ Niet-aftrekbaar (20%)</td>
            <td className={styles.tableCellRight}>{formatCurrency(data.limited20Percent)}</td>
            <td className={styles.tableCellRight}>0%</td>
          </tr>
          <tr className={`${styles.tableRow} ${styles.tableTotalRow}`}>
            <td className={styles.tableCell}><strong>Totaal aftrekbaar</strong></td>
            <td className={styles.tableCellRight}><strong>{formatCurrency(totalDeductible)}</strong></td>
            <td className={styles.tableCellRight}>-</td>
          </tr>
        </tbody>
      </table>

      <div className={styles.helpText}>
        <p>
          <strong>Toelichting:</strong> Volledig aftrekbare kosten (zoals kantoor, reiskosten, inkoop) zijn 100% aftrekbaar. 
          Beperkt aftrekbare kosten (zoals lunch, maaltijden, representatie) zijn slechts 80% aftrekbaar voor de inkomstenbelasting.
        </p>
      </div>
    </div>
  )
}
