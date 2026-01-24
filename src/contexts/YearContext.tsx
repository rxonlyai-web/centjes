'use client'

/**
 * Global Year Context
 * 
 * Provides a globally active year state that persists across navigation
 * and page refreshes using localStorage.
 * 
 * Usage:
 * ```tsx
 * const { activeYear, setActiveYear } = useActiveYear()
 * ```
 * 
 * Default: Current year from system date
 * Persistence: Stored in localStorage as 'activeYear'
 */

import { createContext, useContext, useState, ReactNode } from 'react'

interface YearContextType {
  activeYear: number
  setActiveYear: (year: number) => void
}

const YearContext = createContext<YearContextType | undefined>(undefined)

export function YearProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage or default to current year
  const [activeYear, setActiveYearState] = useState<number>(() => {
    const currentYear = new Date().getFullYear()
    
    // Only access localStorage on client side
    if (typeof window === 'undefined') return currentYear
    
    const stored = localStorage.getItem('activeYear')
    if (stored) {
      const parsedYear = parseInt(stored, 10)
      // Validate stored year is reasonable (within ±10 years)
      if (!isNaN(parsedYear) && parsedYear >= currentYear - 10 && parsedYear <= currentYear + 10) {
        return parsedYear
      }
    }
    return currentYear
  })

  // Update localStorage whenever active year changes
  const setActiveYear = (year: number) => {
    setActiveYearState(year)
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeYear', year.toString())
    }
  }

  return (
    <YearContext.Provider value={{ activeYear, setActiveYear }}>
      {children}
    </YearContext.Provider>
  )
}

/**
 * Hook to access the global active year
 * 
 * @returns { activeYear: number, setActiveYear: (year: number) => void }
 * 
 * Example:
 * ```tsx
 * const { activeYear, setActiveYear } = useActiveYear()
 * // Use activeYear for filtering data
 * // Call setActiveYear(2024) to change the global year
 * ```
 */
export function useActiveYear() {
  const context = useContext(YearContext)
  if (context === undefined) {
    throw new Error('useActiveYear must be used within a YearProvider')
  }
  return context
}
