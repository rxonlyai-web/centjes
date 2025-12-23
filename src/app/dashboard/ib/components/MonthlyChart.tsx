/**
 * Monthly Chart Component
 * 
 * Displays revenue and expenses per month using a bar chart
 */

'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import styles from '../ib.module.css'

interface MonthlyChartProps {
  data: Array<{
    month: number
    monthName: string
    omzet: number
    kosten: number
  }>
}

// Custom tooltip for better formatting - defined outside component to avoid re-creation
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { name: string } }> }) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.chartTooltip}>
        <p className={styles.tooltipLabel}>{payload[0].payload.name}</p>
        <p className={styles.tooltipValue} style={{ color: '#34c759' }}>
          Omzet: {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(payload[0].value)}
        </p>
        <p className={styles.tooltipValue} style={{ color: '#ff3b30' }}>
          Kosten: {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(payload[1].value)}
        </p>
      </div>
    )
  }
  return null
}

export default function MonthlyChart({ data }: MonthlyChartProps) {
  // Format data for Recharts
  const chartData = data.map(item => ({
    name: item.monthName,
    Omzet: item.omzet,
    Kosten: item.kosten
  }))

  return (
    <div className={styles.chartContainer}>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
          <XAxis 
            dataKey="name" 
            stroke="rgba(255, 255, 255, 0.6)"
            style={{ fontSize: '0.875rem' }}
          />
          <YAxis 
            stroke="rgba(255, 255, 255, 0.6)"
            style={{ fontSize: '0.875rem' }}
            tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.875rem' }}
          />
          <Bar dataKey="Omzet" fill="#34c759" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Kosten" fill="#ff3b30" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
