'use client'

import styles from './TransactionFilter.module.css'

type FilterType = 'ALLES' | 'INKOMSTEN' | 'UITGAVEN'

interface TransactionFilterProps {
  activeFilter: FilterType
  onFilterChange: (filter: FilterType) => void
}

export default function TransactionFilter({ activeFilter, onFilterChange }: TransactionFilterProps) {
  const filters: { label: string; value: FilterType }[] = [
    { label: 'Alles', value: 'ALLES' },
    { label: 'Inkomsten', value: 'INKOMSTEN' },
    { label: 'Uitgaven', value: 'UITGAVEN' },
  ]

  return (
    <div className={styles.filterContainer}>
      {filters.map((filter) => (
        <button
          key={filter.value}
          className={`${styles.filterButton} ${activeFilter === filter.value ? styles.active : ''}`}
          onClick={() => onFilterChange(filter.value)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  )
}
