'use server'

import { createClient } from '@/utils/supabase/server'
import { extractExpenseData, validateExpenseData, type ExpenseData } from '@/lib/ocr/expense-ocr'

export interface PendingExpense {
  id: string
  sender_email: string
  subject: string
  received_at: string
  pdf_url: string
  pdf_filename: string
  pdf_size_bytes: number
  ocr_status: string
  ocr_completed_at: string | null
  vendor_name: string | null
  vendor_country: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  currency: string | null
  subtotal: number | null
  vat_rate: number | null
  vat_amount: number | null
  total_amount: number | null
  total_amount_eur: number | null
  exchange_rate: number | null
  description: string | null
  category: string | null
  vat_treatment: string | null
  eu_location: string | null
  status: string
  created_at: string
}

/**
 * Get all pending expenses for current user
 */
export async function getPendingExpenses(): Promise<PendingExpense[]> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('pending_expenses')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching pending expenses:', error)
    throw new Error('Failed to fetch pending expenses')
  }

  return data || []
}

/**
 * Get single pending expense by ID
 */
export async function getPendingExpense(expenseId: string): Promise<PendingExpense | null> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('pending_expenses')
    .select('*')
    .eq('id', expenseId)
    .eq('user_id', user.id)
    .single()

  if (error) {
    console.error('Error fetching expense:', error)
    return null
  }

  return data
}

/**
 * Run OCR on a pending expense
 */
export async function runExpenseOCR(expenseId: string): Promise<{
  success: boolean
  data?: ExpenseData
  error?: string
}> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Not authenticated')
  }

  // Get expense
  const expense = await getPendingExpense(expenseId)
  if (!expense) {
    return { success: false, error: 'Expense not found' }
  }

  try {
    // Update status to processing
    await supabase
      .from('pending_expenses')
      .update({ ocr_status: 'processing' })
      .eq('id', expenseId)

    // Run OCR
    const extractedData = await extractExpenseData(expense.pdf_url)

    // Validate data
    const validation = validateExpenseData(extractedData)
    if (!validation.isValid) {
      console.warn('OCR validation warnings:', validation.errors)
    }

    // Update expense with extracted data
    const { error: updateError } = await supabase
      .from('pending_expenses')
      .update({
        ocr_status: 'completed',
        ocr_completed_at: new Date().toISOString(),
        vendor_name: extractedData.vendorName,
        vendor_country: extractedData.vendorCountry,
        invoice_number: extractedData.invoiceNumber,
        invoice_date: extractedData.invoiceDate,
        due_date: extractedData.dueDate,
        currency: extractedData.currency,
        subtotal: extractedData.subtotal,
        vat_rate: extractedData.vatRate,
        vat_amount: extractedData.vatAmount,
        total_amount: extractedData.totalAmount,
        total_amount_eur: extractedData.totalAmountEur,
        exchange_rate: extractedData.exchangeRate,
        description: extractedData.description,
        category: extractedData.category,
        vat_treatment: extractedData.vatTreatment,
        eu_location: extractedData.euLocation
      })
      .eq('id', expenseId)

    if (updateError) {
      throw updateError
    }

    return { success: true, data: extractedData }
  } catch (error) {
    console.error('OCR error:', error)

    // Update status to failed
    await supabase
      .from('pending_expenses')
      .update({
        ocr_status: 'failed',
        ocr_error: error instanceof Error ? error.message : 'Unknown error'
      })
      .eq('id', expenseId)

    return {
      success: false,
      error: error instanceof Error ? error.message : 'OCR failed'
    }
  }
}

/**
 * Approve expense and create transaction
 */
export async function approveExpense(
  expenseId: string,
  overrides?: Partial<ExpenseData>
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Not authenticated')
  }

  // Get expense
  const expense = await getPendingExpense(expenseId)
  if (!expense) {
    return { success: false, error: 'Expense not found' }
  }

  if (expense.status !== 'pending') {
    return { success: false, error: 'Expense already processed' }
  }

  try {
    console.log('[approveExpense] Starting approval for expense:', expenseId)
    console.log('[approveExpense] Expense data:', expense)
    
    // Merge expense data with overrides
    const finalData = {
      vendor_name: overrides?.vendorName || expense.vendor_name || 'Unknown',
      invoice_date: overrides?.invoiceDate || expense.invoice_date || new Date().toISOString().split('T')[0],
      subtotal: overrides?.subtotal || expense.subtotal || 0,
      vat_rate: overrides?.vatRate || expense.vat_rate || 21,
      vat_amount: overrides?.vatAmount || expense.vat_amount || 0,
      total_amount: overrides?.totalAmount || expense.total_amount || 0,
      description: overrides?.description || expense.description || expense.subject,
      category: overrides?.category || expense.category || 'Overig',
      vat_treatment: expense.vat_treatment || 'domestic',
      eu_location: expense.eu_location || null
    }

    console.log('[approveExpense] Final data:', finalData)

    // Use EUR amount if available, otherwise use original amount
    const amountToUse = expense.currency !== 'EUR' && expense.total_amount_eur 
      ? expense.total_amount_eur 
      : finalData.total_amount

    console.log('[approveExpense] Amount to use:', amountToUse, 'Currency:', expense.currency)

    // Create transaction using correct schema
    const transactionData = {
      gebruiker_id: user.id,
      datum: new Date(finalData.invoice_date).toISOString(),
      bedrag: amountToUse,
      omschrijving: `${finalData.vendor_name} - ${finalData.description}`,
      categorie: finalData.category,
      btw_tarief: finalData.vat_rate,
      vat_treatment: finalData.vat_treatment,
      eu_location: finalData.vat_treatment === 'foreign_service_reverse_charge' ? finalData.eu_location : null,
      type_transactie: 'UITGAVEN',
      bon_url: expense.pdf_url
    }

    console.log('[approveExpense] Transaction data to insert:', transactionData)

    const { data: transaction, error: transactionError } = await supabase
      .from('transacties')
      .insert(transactionData)
      .select('id')
      .single()

    if (transactionError) {
      console.error('[approveExpense] Transaction insert error:', transactionError)
      console.error('[approveExpense] Error details:', JSON.stringify(transactionError, null, 2))
      throw transactionError
    }

    console.log('[approveExpense] Transaction created:', transaction)

    // Update expense status
    const { error: updateError } = await supabase
      .from('pending_expenses')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        transaction_id: transaction.id
      })
      .eq('id', expenseId)

    if (updateError) {
      console.error('[approveExpense] Update expense error:', updateError)
      throw updateError
    }

    console.log('[approveExpense] Success! Transaction ID:', transaction.id)
    return { success: true, transactionId: transaction.id }
  } catch (error) {
    console.error('[approveExpense] CATCH ERROR:', error)
    console.error('[approveExpense] Error type:', typeof error)
    console.error('[approveExpense] Error details:', JSON.stringify(error, null, 2))
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve expense'
    }
  }
}

/**
 * Reject expense
 */
export async function rejectExpense(
  expenseId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase
    .from('pending_expenses')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason
    })
    .eq('id', expenseId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error rejecting expense:', error)
    return { success: false, error: 'Failed to reject expense' }
  }

  return { success: true }
}

/**
 * Delete expense (cleanup)
 */
export async function deleteExpense(expenseId: string): Promise<{ success: boolean }> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Not authenticated')
  }

  // Get expense to get PDF path
  const expense = await getPendingExpense(expenseId)
  if (!expense) {
    return { success: false }
  }

  // Delete PDF from storage
  const pdfPath = expense.pdf_url.split('/expense-pdfs/')[1]
  if (pdfPath) {
    await supabase.storage
      .from('expense-pdfs')
      .remove([pdfPath])
  }

  // Delete expense record
  const { error } = await supabase
    .from('pending_expenses')
    .delete()
    .eq('id', expenseId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting expense:', error)
    return { success: false }
  }

  return { success: true }
}
