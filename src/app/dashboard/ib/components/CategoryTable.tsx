/**
 * Category Table Component
 * 
 * Reusable table for displaying revenue or expense breakdowns by category
 */

import styles from '../ib.module.css'

interface CategoryTableProps {
  title: string
  data: Array<{
    category: string
    amount: number
  }>
}

export default function CategoryTable({ title, data }: CategoryTableProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const total = data.reduce((sum, item) => sum + item.amount, 0)

  if (data.length === 0) {
    return (
      <div className={styles.tableWrapper}>
        <h3 className={styles.tableTitle}>{title}</h3>
        <div className={styles.emptyState}>
          <p>Geen data beschikbaar</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.tableWrapper}>
      <h3 className={styles.tableTitle}>{title}</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.tableHeader}>Categorie</th>
            <th className={styles.tableHeaderRight}>Bedrag (excl. btw)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={index} className={styles.tableRow}>
              <td className={styles.tableCell}>{item.category}</td>
              <td className={styles.tableCellRight}>{formatCurrency(item.amount)}</td>
            </tr>
          ))}
          <tr className={`${styles.tableRow} ${styles.tableTotalRow}`}>
            <td className={styles.tableCell}><strong>Totaal</strong></td>
            <td className={styles.tableCellRight}><strong>{formatCurrency(total)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
