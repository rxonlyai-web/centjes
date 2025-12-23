/**
 * KPI Cards Component
 * 
 * Displays three key financial metrics:
 * - Total revenue (excl. VAT)
 * - Total expenses (excl. VAT)
 * - Profit/loss
 */

import styles from '../ib.module.css'

interface KPICardsProps {
  data: {
    omzet: number
    kosten: number
    winst: number
  }
}

export default function KPICards({ data }: KPICardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  return (
    <div className={styles.kpiGrid}>
      <div className={`${styles.kpiCard} ${styles.kpiRevenue}`}>
        <div className={styles.kpiLabel}>Omzet (excl. btw)</div>
        <div className={styles.kpiValue}>{formatCurrency(data.omzet)}</div>
      </div>

      <div className={`${styles.kpiCard} ${styles.kpiExpense}`}>
        <div className={styles.kpiLabel}>Kosten (excl. btw)</div>
        <div className={styles.kpiValue}>{formatCurrency(data.kosten)}</div>
      </div>

      <div className={`${styles.kpiCard} ${data.winst >= 0 ? styles.kpiProfit : styles.kpiLoss}`}>
        <div className={styles.kpiLabel}>Winst (vóór aftrekken)</div>
        <div className={styles.kpiValue}>{formatCurrency(data.winst)}</div>
      </div>
    </div>
  )
}
