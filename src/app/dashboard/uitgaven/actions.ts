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
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  subtotal: number | null
  vat_rate: number | null
  vat_amount: number | null
  total_amount: number | null
  description: string | null
  category: string | null
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
        invoice_number: extractedData.invoiceNumber,
        invoice_date: extractedData.invoiceDate,
        due_date: extractedData.dueDate,
        subtotal: extractedData.subtotal,
        vat_rate: extractedData.vatRate,
        vat_amount: extractedData.vatAmount,
        total_amount: extractedData.totalAmount,
        description: extractedData.description,
        category: extractedData.category
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
    // Merge expense data with overrides
    const finalData = {
      vendor_name: overrides?.vendorName || expense.vendor_name || 'Unknown',
      invoice_date: overrides?.invoiceDate || expense.invoice_date || new Date().toISOString().split('T')[0],
      subtotal: overrides?.subtotal || expense.subtotal || 0,
      vat_rate: overrides?.vatRate || expense.vat_rate || 21,
      vat_amount: overrides?.vatAmount || expense.vat_amount || 0,
      total_amount: overrides?.totalAmount || expense.total_amount || 0,
      description: overrides?.description || expense.description || expense.subject,
      category: overrides?.category || expense.category || 'Other'
    }

    // Create transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transacties')
      .insert({
        user_id: user.id,
        type: 'expense',
        description: finalData.description,
        amount: finalData.total_amount,
        vat_rate: finalData.vat_rate,
        date: finalData.invoice_date,
        category: finalData.category,
        vendor: finalData.vendor_name
      })
      .select('id')
      .single()

    if (transactionError) {
      throw transactionError
    }

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
      throw updateError
    }

    return { success: true, transactionId: transaction.id }
  } catch (error) {
    console.error('Error approving expense:', error)
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
