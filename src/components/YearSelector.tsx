'use client'

/**
 * Global Year Selector Component
 * 
 * Displays in the top-right of the dashboard layout.
 * Uses the global YearContext to manage the active year.
 */

import { useActiveYear } from '@/contexts/YearContext'
import styles from './YearSelector.module.css'

export default function YearSelector() {
  const { activeYear, setActiveYear } = useActiveYear()
  const currentYear = new Date().getFullYear()

  // Generate year options (current year ± 2 years)
  const yearOptions = []
  for (let i = -2; i <= 2; i++) {
    yearOptions.push(currentYear + i)
  }

  return (
    <div className={styles.container}>
      <label htmlFor="global-year-selector" className={styles.label}>
        Actief jaar
      </label>
      <select
        id="global-year-selector"
        className={styles.select}
        value={activeYear}
        onChange={(e) => setActiveYear(Number(e.target.value))}
      >
        {yearOptions.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  )
}
