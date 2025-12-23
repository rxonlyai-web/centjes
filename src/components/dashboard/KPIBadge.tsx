/**
 * KPI Badge Component
 * 
 * Displays a compact financial metric badge with label and amount.
 * Used on the Transacties page to show totals for inkomsten, uitgaven, and resultaat.
 */

import styles from './KPIBadge.module.css'

interface KPIBadgeProps {
  label: string
  amount: number
  type: 'income' | 'expense' | 'profit' | 'loss' | 'neutral'
}

export default function KPIBadge({ label, amount, type }: KPIBadgeProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  return (
    <div className={styles.badge}>
      <div className={styles.label}>{label}</div>
      <div className={`${styles.amount} ${styles[type]}`}>
        {formatCurrency(amount)}
      </div>
    </div>
  )
}
