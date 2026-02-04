'use client'

import styles from './StepIndicator.module.css'

interface StepIndicatorProps {
  totalSteps: number
  currentStep: number
}

export default function StepIndicator({ totalSteps, currentStep }: StepIndicatorProps) {
  return (
    <div className={styles.container}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`${styles.dot} ${
            i < currentStep ? styles.completed :
            i === currentStep ? styles.current :
            styles.upcoming
          }`}
        />
      ))}
    </div>
  )
}
