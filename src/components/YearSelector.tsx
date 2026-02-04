'use client'

import { useActiveYear } from '@/contexts/YearContext'
import styles from './YearSelector.module.css'

export default function YearSelector() {
  const { activeYear, setActiveYear } = useActiveYear()
  const currentYear = new Date().getFullYear()

  const yearOptions = []
  for (let i = -2; i <= 2; i++) {
    yearOptions.push(currentYear + i)
  }

  return (
    <div className={styles.pill}>
      <select
        id="global-year-selector"
        className={styles.select}
        value={activeYear}
        onChange={(e) => setActiveYear(Number(e.target.value))}
        aria-label="Actief jaar"
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
