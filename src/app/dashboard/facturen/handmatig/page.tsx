'use client'

/**
 * Manual Invoice Creation Page
 * 
 * Creates empty invoice template with company info pre-filled
 * Opens directly in edit mode
 */

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createEmptyInvoice } from '../actions'

export default function HandmatigeFactuurPage() {
  const router = useRouter()

  const createInvoice = useCallback(async () => {
    try {
      const invoiceId = await createEmptyInvoice()
      // Redirect to detail page in edit mode
      router.push(`/dashboard/facturen/${invoiceId}?edit=true`)
    } catch (error) {
      console.error('Error creating invoice:', error)
      alert('Kon factuur niet aanmaken')
      router.push('/dashboard/facturen')
    }
  }, [router])

  useEffect(() => {
    createInvoice()
  }, [createInvoice])

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      color: 'var(--text-secondary)'
    }}>
      <p>Factuur wordt aangemaakt...</p>
    </div>
  )
}
