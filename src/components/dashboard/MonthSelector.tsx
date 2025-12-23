/**
 * Month Selector Component
 * 
 * Dropdown to select a month within the active year for filtering transactions.
 * Options include "Alle maanden" (all) or specific months (jan-dec).
 */

import styles from './MonthSelector.module.css'

interface MonthSelectorProps {
  value: number | null  // null = all months, 1-12 = specific month
  onChange: (month: number | null) => void
}

const monthOptions = [
  { value: null, label: 'Alle maanden' },
  { value: 1, label: 'jan' },
  { value: 2, label: 'feb' },
  { value: 3, label: 'mrt' },
  { value: 4, label: 'apr' },
  { value: 5, label: 'mei' },
  { value: 6, label: 'jun' },
  { value: 7, label: 'jul' },
  { value: 8, label: 'aug' },
  { value: 9, label: 'sep' },
  { value: 10, label: 'okt' },
  { value: 11, label: 'nov' },
  { value: 12, label: 'dec' },
]

export default function MonthSelector({ value, onChange }: MonthSelectorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value === '' ? null : parseInt(e.target.value)
    onChange(newValue)
  }

  return (
    <div className={styles.selector}>
      <label htmlFor="month-select" className={styles.label}>
        Maand
      </label>
      <select
        id="month-select"
        className={styles.select}
        value={value === null ? '' : value}
        onChange={handleChange}
      >
        {monthOptions.map((option) => (
          <option key={option.label} value={option.value === null ? '' : option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
