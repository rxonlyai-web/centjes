'use client'

/**
 * Tax Notification Center (Belastingen)
 * 
 * Displays Dutch tax deadlines:
 * - Inkomstenbelasting (annual, May 1st)
 * - BTW-aangifte (quarterly: Q1-Q4)
 * 
 * Features:
 * - Year selector
 * - Auto-generation of deadlines on first visit
 * - Status grouping (upcoming, overdue, acknowledged)
 * - Acknowledgment functionality
 */

import { useState, useEffect, useCallback } from 'react'
import { ExternalLink } from 'lucide-react'
import { getTaxDeadlines, acknowledgeDeadline, type TaxDeadline } from './actions'
import styles from './page.module.css'

export default function BelastingenPage() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [deadlines, setDeadlines] = useState<TaxDeadline[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)

  // Generate year options (current year ± 2 years)
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  const loadDeadlines = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getTaxDeadlines(selectedYear)
      setDeadlines(data)
    } catch (error) {
      console.error('Failed to load tax deadlines:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedYear])

  useEffect(() => {
    loadDeadlines()
  }, [loadDeadlines])

  const handleAcknowledge = async (deadlineId: string) => {
    setAcknowledgingId(deadlineId)
    try {
      await acknowledgeDeadline(deadlineId)
      await loadDeadlines() // Reload to update status
    } catch (error) {
      console.error('Failed to acknowledge deadline:', error)
    } finally {
      setAcknowledgingId(null)
    }
  }

  // Group deadlines by status
  const upcomingDeadlines = deadlines.filter(d => d.status === 'upcoming')
  const overdueDeadlines = deadlines.filter(d => d.status === 'overdue')
  const acknowledgedDeadlines = deadlines.filter(d => d.status === 'acknowledged')

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('nl-NL', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    })
  }

  const renderDeadlineCard = (deadline: TaxDeadline) => {
    const isAcknowledging = acknowledgingId === deadline.id
    
    return (
      <div 
        key={deadline.id} 
        className={`${styles.deadlineCard} ${styles[deadline.status]}`}
      >
        <div className={styles.deadlineHeader}>
          <div className={styles.deadlineInfo}>
            <h3 className={styles.deadlineName}>{deadline.display_name}</h3>
            <p className={styles.deadlineDate}>
              Deadline: {formatDate(deadline.deadline_date)}
            </p>
          </div>
          
          <div className={styles.deadlineStatus}>
            <span className={`${styles.statusBadge} ${styles[deadline.status]}`}>
              {deadline.status === 'upcoming' && 'Aankomend'}
              {deadline.status === 'overdue' && 'Verlopen'}
              {deadline.status === 'acknowledged' && 'Afgehandeld'}
            </span>
            
            {!deadline.acknowledged && (
              <span className={`${styles.daysUntil} ${deadline.days_until <= 7 ? styles.urgent : ''}`}>
                {deadline.days_until > 0 
                  ? `Over ${deadline.days_until} dag${deadline.days_until !== 1 ? 'en' : ''}`
                  : `${Math.abs(deadline.days_until)} dag${Math.abs(deadline.days_until) !== 1 ? 'en' : ''} geleden`
                }
              </span>
            )}
          </div>
        </div>
        
        {!deadline.acknowledged && (
          <button
            className={styles.acknowledgeButton}
            onClick={() => handleAcknowledge(deadline.id)}
            disabled={isAcknowledging}
          >
            {isAcknowledging ? 'Bezig...' : 'Markeer als afgehandeld'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>Belastingdeadlines</h1>
          
          <div className={styles.headerActions}>
            <a 
              href="https://mijnzakelijk.belastingdienst.nl/tmx-aik-web/inloggen?flowId=AhOeF6unjU"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.belastingdienstButton}
            >
              Naar Belastingdienst
              <ExternalLink size={16} />
            </a>
            
            <div className={styles.yearSelector}>
              <label htmlFor="year-select">Jaar:</label>
              <select
                id="year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {yearOptions.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        <p className={styles.subtitle}>
          Overzicht van Inkomstenbelasting en BTW-aangifte deadlines
        </p>
      </header>

      {isLoading ? (
        <div className={styles.loading}>
          <p>Laden...</p>
        </div>
      ) : deadlines.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Geen deadlines gevonden voor {selectedYear}</p>
        </div>
      ) : (
        <>
          {/* Overdue Section */}
          {overdueDeadlines.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                Verlopen
                <span className={styles.sectionCount}>{overdueDeadlines.length}</span>
              </h2>
              <div className={styles.deadlineList}>
                {overdueDeadlines.map(renderDeadlineCard)}
              </div>
            </section>
          )}

          {/* Upcoming Section */}
          {upcomingDeadlines.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                Aankomend
                <span className={styles.sectionCount}>{upcomingDeadlines.length}</span>
              </h2>
              <div className={styles.deadlineList}>
                {upcomingDeadlines.map(renderDeadlineCard)}
              </div>
            </section>
          )}

          {/* Acknowledged Section */}
          {acknowledgedDeadlines.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                Afgehandeld
                <span className={styles.sectionCount}>{acknowledgedDeadlines.length}</span>
              </h2>
              <div className={styles.deadlineList}>
                {acknowledgedDeadlines.map(renderDeadlineCard)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
