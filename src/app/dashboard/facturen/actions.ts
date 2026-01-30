'use server'

/**
 * Server Actions for Invoice Management and AI Conversations
 */

import { createClient } from '@/utils/supabase/server'

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

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ConversationState {
  step: string
  collected_data: Partial<InvoiceData>
  is_complete: boolean
}

/**
 * Start a new invoice conversation
 */
export async function startInvoiceConversation(): Promise<{
  conversationId: string
  initialMessage: string
}> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  // Get company settings for context
  const { data: companySettings } = await supabase
    .from('company_settings')
    .select('company_name, kvk_number, btw_number, address_line1, city')
    .eq('user_id', user.id)
    .single()

  if (!companySettings) {
    throw new Error('Bedrijfsinstellingen niet gevonden. Ga eerst naar Instellingen om je bedrijfsgegevens in te vullen.')
  }

  // Create initial conversation
  const initialMessage: ChatMessage = {
    role: 'assistant',
    content: `Hoi! Ik help je graag met het opstellen van een factuur voor ${companySettings.company_name}. 

Laten we beginnen! Wat is de naam van je klant?`,
    timestamp: new Date().toISOString(),
  }

  const initialState: ConversationState = {
    step: 'client_name',
    collected_data: {
      invoice_date: new Date().toISOString().split('T')[0],
      vat_rate: 21,
      items: [],
    },
    is_complete: false,
  }

  const { data: conversation, error } = await supabase
    .from('invoice_conversations')
    .insert({
      user_id: user.id,
      messages: [initialMessage],
      conversation_state: initialState,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating conversation:', error)
    throw new Error('Failed to start conversation')
  }

  return {
    conversationId: conversation.id,
    initialMessage: initialMessage.content,
  }
}

/**
 * Send a message in the conversation and get AI response
 */
export async function sendInvoiceMessage(
  conversationId: string,
  userMessage: string
): Promise<{ response: string; isComplete: boolean }> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  // Get conversation
  const { data: conversation, error: convError } = await supabase
    .from('invoice_conversations')
    .select('id, messages, conversation_state')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (convError || !conversation) {
    throw new Error('Conversation not found')
  }

  // Get company settings for AI context
  const { data: companySettings } = await supabase
    .from('company_settings')
    .select('company_name, kvk_number, btw_number, address_line1, city')
    .eq('user_id', user.id)
    .single()

  const messages: ChatMessage[] = conversation.messages as ChatMessage[]
  const state: ConversationState = conversation.conversation_state as ConversationState

  // Add user message
  const newUserMessage: ChatMessage = {
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString(),
  }
  messages.push(newUserMessage)

  // Generate AI response using Gemini
  const aiResponse = await generateAIResponse(
    messages,
    state,
    companySettings || { company_name: 'Onbekend' },
    userMessage
  )

  // Add AI response
  const newAIMessage: ChatMessage = {
    role: 'assistant',
    content: aiResponse.message,
    timestamp: new Date().toISOString(),
  }
  messages.push(newAIMessage)

  // Update conversation
  const { error: updateError } = await supabase
    .from('invoice_conversations')
    .update({
      messages,
      conversation_state: aiResponse.newState,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)

  if (updateError) {
    console.error('Error updating conversation:', updateError)
    throw new Error('Failed to update conversation')
  }

  return {
    response: aiResponse.message,
    isComplete: aiResponse.newState.is_complete,
  }
}

/**
 * Generate AI response using Gemini
 */
interface CompanySettingsData {
  company_name: string
  kvk_number?: string | null
  btw_number?: string | null
  address_line1?: string | null
  city?: string | null
}

/**
 * Main AI response generator - tries Gemini first, falls back to smart rules
 */
async function generateAIResponse(
  messages: ChatMessage[],
  state: ConversationState,
  companySettings: CompanySettingsData,
  userMessage: string
): Promise<{ message: string; newState: ConversationState }> {
  // Always use rule-based for now (Gemini can be enabled later)
  return generateSmartRuleBasedResponse(messages, state, companySettings, userMessage)
}

/**
 * Smart rule-based conversation with context awareness
 */
function generateSmartRuleBasedResponse(
  messages: ChatMessage[],
  state: ConversationState,
  companySettings: CompanySettingsData,
  userMessage: string
): { message: string; newState: ConversationState } {
  const step = state.step
  const data = state.collected_data
  const msg = userMessage.toLowerCase().trim()
  
  let message = ''
  let nextStep = step
  let updatedData = { ...data }
  let isComplete = false

  switch (step) {
    case 'client_name':
      updatedData.client_name = userMessage.trim()
      nextStep = 'client_email'
      message = `Perfect! Factuur voor **${userMessage}**.\n\nWat is het e-mailadres van ${userMessage}?\n\n_(Of typ "skip" om over te slaan)_`
      break

    case 'client_email':
      if (msg === 'skip' || msg === 'geen' || msg === 'nee') {
        nextStep = 'invoice_items'
        message = `Oké, geen e-mailadres.\n\nLaten we de factuurregels toevoegen! Wat is de eerste dienst of product?\n\n_Bijvoorbeeld: "Website ontwikkeling" of "Adviesgesprek"_`
      } else {
        updatedData.client_email = userMessage.trim()
        nextStep = 'invoice_items'
        message = `Top! E-mail opgeslagen.\n\nNu de factuurregels. Wat is de eerste dienst of product?\n\n_Bijvoorbeeld: "Website ontwikkeling" of "Adviesgesprek"_`
      }
      break

    case 'invoice_items':
      // Check if user wants to finish
      if (msg === 'klaar' || msg === 'dat was het' || msg === 'stop' || msg === 'geen' || msg === 'nee') {
        if (!data.items || data.items.length === 0) {
          message = '⚠️ Je moet minimaal 1 factuur regel toevoegen.\n\nWat is de dienst of het product?'
          break
        }
        // Go to summary
        nextStep = 'summary'
        const subtotal = data.items.reduce((sum, item) => sum + item.total_price, 0)
        const vat = subtotal * 0.21
        const total = subtotal + vat
        
        message = `✅ **Factuur Samenvatting**\n\n**Klant:** ${data.client_name}\n${data.client_email ? `**E-mail:** ${data.client_email}\n` : ''}\n**Factuurregels:**\n${data.items.map((item, i) => `${i + 1}. ${item.description} - €${item.total_price.toFixed(2)}`).join('\n')}\n\n**Subtotaal:** €${subtotal.toFixed(2)}\n**BTW (21%):** €${vat.toFixed(2)}\n**━━━━━━━━━━━━━**\n**Totaal:** €${total.toFixed(2)}\n\nKlopt dit allemaal? Typ **"ja"** om de factuur aan te maken!`
        break
      }
      
      // User is adding a new item
      nextStep = 'item_price'
      ;(updatedData as Record<string, unknown>).current_item_description = userMessage.trim()
      message = `Mooi! **"${userMessage}"**\n\nWat is de prijs hiervoor?\n\n_Bijvoorbeeld: "500" of "1250.50"_`
      break

    case 'item_price':
      // Try to extract price from message
      const priceMatch = userMessage.match(/(\d+(?:[.,]\d{1,2})?)/)
      if (!priceMatch) {
        // Check if user is referring to previous context
        if (msg.includes('gezegd') || msg.includes('eerder') || msg.includes('al') || msg.includes('vorige')) {
          message = '🤔 Sorry, ik kan de prijs niet terugvinden in ons gesprek.\n\nKun je de prijs nog een keer geven?\n\n_Bijvoorbeeld: "500" voor €500_'
          break
        }
        message = '⚠️ Dat is geen geldig bedrag.\n\nProbeer het opnieuw met alleen het getal.\n\n_Bijvoorbeeld: "500" of "1250.50"_'
        break
      }
      
      const price = parseFloat(priceMatch[1].replace(',', '.'))
      if (isNaN(price) || price <= 0) {
        message = '⚠️ Dat is geen geldig bedrag (moet groter dan 0 zijn).\n\nProbeer opnieuw:'
        break
      }
      
      const newItem = {
        description: (updatedData as Record<string, unknown>).current_item_description as string || 'Item',
        quantity: 1,
        unit_price: price,
        total_price: price
      }
      
      updatedData.items = [...(data.items || []), newItem]
      delete (updatedData as Record<string, unknown>).current_item_description
      nextStep = 'invoice_items'
      
      const currentTotal = updatedData.items.reduce((sum, item) => sum + item.total_price, 0)
      message = `✓ **Toegevoegd:** ${newItem.description} - €${price.toFixed(2)}\n\n_Huidige subtotaal: €${currentTotal.toFixed(2)}_\n\nWil je nog een regel toevoegen?\n\n_(Typ de beschrijving, of "klaar" als je klaar bent)_`
      break

    case 'summary':
      if (msg === 'ja' || msg === 'yes' || msg === 'ok' || msg === 'oké' || msg === 'akkoord' || msg === 'correct' || msg === 'klopt') {
        isComplete = true
        message = '🎉 Perfect! De factuur wordt nu aangemaakt...'
      } else if (msg === 'nee' || msg === 'no' || msg === 'niet' || msg === 'wijzig' || msg === 'aanpassen') {
        nextStep = 'invoice_items'
        updatedData.items = []
        message = '👍 Oké, laten we opnieuw beginnen met de factuurregels.\n\nWat is de eerste dienst of product?'
      } else {
        message = '🤔 Ik begrijp je niet helemaal.\n\nKlopt de samenvatting? Typ **"ja"** om door te gaan of **"nee"** om aan te passen.'
      }
      break

    default:
      message = '🤔 Sorry, er ging iets mis. Laten we opnieuw beginnen.\n\nWat is de naam van je klant?'
      nextStep = 'client_name'
      updatedData = {}
  }

  return {
    message,
    newState: {
      step: nextStep,
      collected_data: updatedData,
      is_complete: isComplete
    }
  }
}

/**
 * Get conversation history
 */
export async function getConversationHistory(conversationId: string): Promise<{
  messages: ChatMessage[]
  state: ConversationState
}> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  const { data: conversation, error } = await supabase
    .from('invoice_conversations')
    .select('messages, conversation_state')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (error || !conversation) {
    throw new Error('Conversation not found')
  }

  return {
    messages: conversation.messages as ChatMessage[],
    state: conversation.conversation_state as ConversationState,
  }
}

/**
 * Create invoice from conversation data
 */
export async function createInvoiceFromConversation(
  conversationId: string
): Promise<string> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  // Get conversation
  const { data: conversation, error: convError } = await supabase
    .from('invoice_conversations')
    .select('conversation_state')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (convError || !conversation) {
    throw new Error('Conversation not found')
  }

  const state: ConversationState = conversation.conversation_state as ConversationState
  const data = state.collected_data

  if (!data.client_name || !data.items || data.items.length === 0) {
    throw new Error('Incomplete invoice data')
  }

  // Calculate totals
  const subtotal = data.items.reduce((sum, item) => sum + item.total_price, 0)
  const vatAmount = subtotal * ((data.vat_rate || 21) / 100)
  const totalAmount = subtotal + vatAmount

  // Generate invoice number
  const { data: invoiceNumberData, error: numberError } = await supabase
    .rpc('generate_invoice_number', { p_user_id: user.id })

  if (numberError) {
    throw new Error('Failed to generate invoice number')
  }

  // Create invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      user_id: user.id,
      invoice_number: invoiceNumberData,
      status: 'draft',
      client_name: data.client_name,
      client_email: data.client_email,
      client_address: data.client_address,
      client_kvk: data.client_kvk,
      client_btw: data.client_btw,
      invoice_date: data.invoice_date || new Date().toISOString().split('T')[0],
      due_date: data.due_date,
      payment_terms: data.payment_terms || 'Betaling binnen 14 dagen',
      subtotal,
      vat_rate: data.vat_rate || 21,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      notes: data.notes,
    })
    .select()
    .single()

  if (invoiceError) {
    console.error('Error creating invoice:', invoiceError)
    throw new Error('Failed to create invoice')
  }

  // Create invoice items
  const itemsToInsert = data.items.map((item, index) => ({
    invoice_id: invoice.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
    sort_order: index,
  }))

  const { error: itemsError } = await supabase
    .from('invoice_items')
    .insert(itemsToInsert)

  if (itemsError) {
    console.error('Error creating invoice items:', itemsError)
    throw new Error('Failed to create invoice items')
  }

  // Link conversation to invoice
  await supabase
    .from('invoice_conversations')
    .update({ invoice_id: invoice.id })
    .eq('id', conversationId)

  return invoice.id
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

  let query = supabase
    .from('invoices')
    .select('id, invoice_number, status, client_name, client_email, invoice_date, total_amount, created_at, updated_at')
    .eq('user_id', user.id)
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

  // Get invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, client_name, client_email, client_address, client_kvk, client_btw, invoice_date, due_date, payment_terms, subtotal, vat_rate, vat_amount, total_amount, notes, created_at, updated_at')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
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
    .eq('user_id', user.id)
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

  const { error } = await supabase
    .from('invoices')
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', invoiceId)
    .eq('user_id', user.id)

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

  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId)
    .eq('user_id', user.id)

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
    .eq('user_id', user.id)

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



