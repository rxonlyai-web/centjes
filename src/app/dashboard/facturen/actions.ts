'use server'

/**
 * Server Actions for Invoice Management and AI Conversations
 */

import { createClient } from '@/utils/supabase/server'
import { getUserOrganizationId } from '@/lib/org'

export interface InvoiceItem {
  description: string
  quantity: number
  unit_price: number
  total_price: number
}

export interface InvoiceData {
  client_name: string
  client_email?: string
  client_address?: string
  client_kvk?: string
  client_btw?: string
  invoice_date: string
  due_date?: string
  payment_terms?: string
  items: InvoiceItem[]
  vat_rate: number
  notes?: string
}

/**
 * Invoice filters interface
 */
export interface InvoiceFilters {
  status?: 'draft' | 'sent' | 'paid' | 'all'
  searchQuery?: string
}

/**
 * Invoice with items interface
 */
export interface Invoice {
  id: string
  invoice_number: string
  status: 'draft' | 'sent' | 'paid'
  client_name: string
  client_email: string | null
  invoice_date: string
  total_amount: number
  created_at: string
  updated_at: string
}

export interface InvoiceWithItems extends Invoice {
  client_address: string | null
  client_kvk: string | null
  client_btw: string | null
  due_date: string | null
  payment_terms: string | null
  subtotal: number
  vat_rate: number
  vat_amount: number
  notes: string | null
  items: Array<{
    id: string
    description: string
    quantity: number
    unit_price: number
    total_price: number
    sort_order: number
  }>
  company_settings?: {
    company_name: string
    kvk_number: string | null
    btw_number: string | null
    address_line1: string | null
    address_line2: string | null
    postal_code: string | null
    city: string | null
    country: string | null
    email: string | null
    phone: string | null
    bank_account: string | null
  } | null
}

/**
 * Get all invoices for the current user with optional filters
 */
export async function getInvoices(filters?: InvoiceFilters): Promise<Invoice[]> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  const orgId = await getUserOrganizationId(supabase)

  let query = supabase
    .from('invoices')
    .select('id, invoice_number, status, client_name, client_email, invoice_date, total_amount, created_at, updated_at')
    .eq(orgId ? 'organization_id' : 'user_id', orgId || user.id)
    .order('created_at', { ascending: false })

  // Apply status filter
  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  // Apply search filter
  if (filters?.searchQuery && filters.searchQuery.trim() !== '') {
    const searchTerm = `%${filters.searchQuery.trim()}%`
    query = query.or(`invoice_number.ilike.${searchTerm},client_name.ilike.${searchTerm},client_email.ilike.${searchTerm}`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching invoices:', error)
    throw new Error('Failed to fetch invoices')
  }

  return data as Invoice[]
}

/**
 * Get a single invoice by ID with all items
 */
export async function getInvoiceById(invoiceId: string): Promise<InvoiceWithItems | null> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  const orgId = await getUserOrganizationId(supabase)

  // Get invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, client_name, client_email, client_address, client_kvk, client_btw, invoice_date, due_date, payment_terms, subtotal, vat_rate, vat_amount, total_amount, notes, created_at, updated_at')
    .eq('id', invoiceId)
    .eq(orgId ? 'organization_id' : 'user_id', orgId || user.id)
    .single()

  if (invoiceError || !invoice) {
    console.error('Error fetching invoice:', invoiceError)
    return null
  }

  // Get invoice items
  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .select('id, description, quantity, unit_price, total_price, sort_order')
    .eq('invoice_id', invoiceId)
    .order('sort_order', { ascending: true })

  if (itemsError) {
    console.error('Error fetching invoice items:', itemsError)
    throw new Error('Failed to fetch invoice items')
  }

  // Get company settings
  const { data: companySettings } = await supabase
    .from('company_settings')
    .select('company_name, kvk_number, btw_number, address_line1, address_line2, postal_code, city, country, email, phone, bank_account')
    .eq(orgId ? 'organization_id' : 'user_id', orgId || user.id)
    .single()

  return {
    ...invoice,
    items: items || [],
    company_settings: companySettings || null
  } as InvoiceWithItems
}

/**
 * Update invoice status
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: 'draft' | 'sent' | 'paid'
): Promise<void> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  const orgId = await getUserOrganizationId(supabase)

  const { error } = await supabase
    .from('invoices')
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', invoiceId)
    .eq(orgId ? 'organization_id' : 'user_id', orgId || user.id)

  if (error) {
    console.error('Error updating invoice status:', error)
    throw new Error('Failed to update invoice status')
  }
}

/**
 * Delete an invoice (and its items via CASCADE)
 */
export async function deleteInvoice(invoiceId: string): Promise<void> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  const orgId = await getUserOrganizationId(supabase)

  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId)
    .eq(orgId ? 'organization_id' : 'user_id', orgId || user.id)

  if (error) {
    console.error('Error deleting invoice:', error)
    throw new Error('Failed to delete invoice')
  }
}

/**
 * Update invoice data
 */
export async function updateInvoice(
  invoiceId: string,
  updates: {
    client_name?: string
    client_email?: string
    client_address?: string
    notes?: string
    items?: Array<{
      id?: string
      description: string
      quantity: number
      unit_price: number
      total_price: number
    }>
  }
): Promise<void> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  const orgId = await getUserOrganizationId(supabase)

  // Update invoice basic info
  const invoiceUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  }

  if (updates.client_name !== undefined) invoiceUpdates.client_name = updates.client_name
  if (updates.client_email !== undefined) invoiceUpdates.client_email = updates.client_email
  if (updates.client_address !== undefined) invoiceUpdates.client_address = updates.client_address
  if (updates.notes !== undefined) invoiceUpdates.notes = updates.notes

  // If items are being updated, recalculate totals
  if (updates.items) {
    const subtotal = updates.items.reduce((sum, item) => sum + item.total_price, 0)
    const vatRate = 21 // Default VAT rate
    const vatAmount = subtotal * (vatRate / 100)
    const totalAmount = subtotal + vatAmount

    invoiceUpdates.subtotal = subtotal
    invoiceUpdates.vat_amount = vatAmount
    invoiceUpdates.total_amount = totalAmount
  }

  const { error: updateError } = await supabase
    .from('invoices')
    .update(invoiceUpdates)
    .eq('id', invoiceId)
    .eq(orgId ? 'organization_id' : 'user_id', orgId || user.id)

  if (updateError) {
    console.error('Error updating invoice:', updateError)
    throw new Error('Failed to update invoice')
  }

  // Update items if provided
  if (updates.items) {
    // Delete all existing items
    await supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', invoiceId)

    // Insert new items
    const itemsToInsert = updates.items.map((item, index) => ({
      invoice_id: invoiceId,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      sort_order: index
    }))

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(itemsToInsert)

    if (itemsError) {
      console.error('Error updating invoice items:', itemsError)
      throw new Error('Failed to update invoice items')
    }
  }
}

/**
 * Create an empty invoice template for manual filling
 */
export async function createEmptyInvoice(): Promise<string> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  const orgId = await getUserOrganizationId(supabase)

  // Generate invoice number
  const { data: invoiceNumber, error: numberError } = await supabase
    .rpc('generate_invoice_number', { p_user_id: user.id })

  if (numberError) {
    console.error('Error generating invoice number:', numberError)
    throw new Error('Failed to generate invoice number')
  }

  // Create empty invoice with today's date and 14 days payment term
  const today = new Date().toISOString().split('T')[0]
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 14)
  const dueDateStr = dueDate.toISOString().split('T')[0]

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      user_id: user.id,
      ...(orgId && { organization_id: orgId }),
      invoice_number: invoiceNumber,
      status: 'draft',
      client_name: '',
      invoice_date: today,
      due_date: dueDateStr,
      payment_terms: 'Betaling binnen 14 dagen',
      subtotal: 0,
      vat_rate: 21,
      vat_amount: 0,
      total_amount: 0
    })
    .select()
    .single()

  if (invoiceError) {
    console.error('Error creating empty invoice:', invoiceError)
    throw new Error('Failed to create empty invoice')
  }

  return invoice.id
}

/**
 * Generate PDF for an invoice
 */
export async function generateInvoicePDF(invoiceId: string): Promise<string> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  // Get invoice with items and company settings
  const invoice = await getInvoiceById(invoiceId)
  
  if (!invoice) {
    throw new Error('Invoice not found')
  }

  // Note: Ownership is already verified in getInvoiceById via RLS

  try {
    // Dynamically import React-PDF modules (only on server)
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { default: InvoicePDFTemplate } = await import('@/components/InvoicePDFTemplate')
    const React = await import('react')

    // Render PDF to buffer
    const pdfBuffer = await renderToBuffer(
      // @ts-expect-error - Type mismatch between InvoicePDFTemplate props and DocumentProps
      React.createElement(InvoicePDFTemplate, { invoice })
    )

    // Convert buffer to base64 data URL
    const base64 = pdfBuffer.toString('base64')
    const dataUrl = `data:application/pdf;base64,${base64}`

    return dataUrl
  } catch (error) {
    console.error('Error generating PDF:', error)
    throw new Error('Failed to generate PDF')
  }
}



