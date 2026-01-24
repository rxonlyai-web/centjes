'use client'

import { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'
import { getTaxDeadlines, type TaxDeadline } from '@/app/dashboard/belastingen/actions'
import styles from './TaxNotifications.module.css'

export default function TaxNotifications() {
  const [isOpen, setIsOpen] = useState(false)
  const [deadlines, setDeadlines] = useState<TaxDeadline[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && deadlines.length === 0) {
      loadDeadlines()
    }
  }, [isOpen, deadlines.length])

  async function loadDeadlines() {
    setLoading(true)
    try {
      const currentYear = new Date().getFullYear()
      const data = await getTaxDeadlines(currentYear)
      setDeadlines(data)
    } catch (error) {
      console.error('Failed to load tax deadlines:', error)
    } finally {
      setLoading(false)
    }
  }

  const upcomingCount = deadlines.filter(d => !d.acknowledged && d.status !== 'overdue').length

  return (
    <div className={styles.container}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={styles.bellButton}
        title="Belastingdeadlines"
      >
        <Bell size={20} />
        {upcomingCount > 0 && (
          <span className={styles.badge}>{upcomingCount}</span>
        )}
      </button>

      {isOpen && (
        <>
          <div className={styles.overlay} onClick={() => setIsOpen(false)} />
          <div className={styles.dropdown}>
            <div className={styles.header}>
              <h3>Belastingdeadlines</h3>
              <button onClick={() => setIsOpen(false)} className={styles.closeButton}>
                <X size={20} />
              </button>
            </div>

            <div className={styles.content}>
              {loading ? (
                <div className={styles.loading}>Laden...</div>
              ) : deadlines.length === 0 ? (
                <div className={styles.empty}>Geen aankomende deadlines</div>
              ) : (
                <div className={styles.deadlinesList}>
                  {deadlines.map((deadline) => (
                    <div 
                      key={deadline.id} 
                      className={`${styles.deadline} ${deadline.acknowledged ? styles.completed : ''}`}
                    >
                      <div className={styles.deadlineHeader}>
                        <h4>{deadline.display_name}</h4>
                        <span className={deadline.days_until < 30 ? styles.urgent : styles.normal}>
                          {deadline.days_until < 0 ? 'Verlopen' : `Over ${deadline.days_until} dagen`}
                        </span>
                      </div>
                      <p className={styles.deadlineDate}>
                        Deadline: {new Date(deadline.deadline_date).toLocaleDateString('nl-NL', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.footer}>
              <a 
                href="https://www.belastingdienst.nl" 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.link}
              >
                Naar Belastingdienst →
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
