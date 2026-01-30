'use server'

import { createClient } from '@/utils/supabase/server'
import { extractExpenseData, validateExpenseData, type ExpenseData } from '@/lib/ocr/expense-ocr'

/**
 * Create a pending expense from a camera capture
 */
export async function createExpenseFromCamera(formData: FormData): Promise<{
  success: boolean
  expenseId?: string
  error?: string
}> {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { success: false, error: 'Niet ingelogd' }
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return { success: false, error: 'Geen bestand ontvangen' }
  }

  // Validate file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif']
  if (!validTypes.includes(file.type)) {
    return { success: false, error: 'Alleen afbeeldingen toegestaan' }
  }

  // Validate file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return { success: false, error: 'Bestand is te groot (max 10MB)' }
  }

  try {
    // Generate unique filename
    const timestamp = Date.now()
    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${timestamp}_camera.${ext}`
    const filePath = `${user.id}/${filename}`

    // Convert file to buffer for upload
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('expense-pdfs')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return { success: false, error: 'Uploaden mislukt' }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('expense-pdfs')
      .getPublicUrl(filePath)

    const fileUrl = urlData.publicUrl

    // Create pending_expense record
    const { data: expense, error: insertError } = await supabase
      .from('pending_expenses')
      .insert({
        user_id: user.id,
        sender_email: 'camera@app',
        subject: `Camera upload ${new Date().toLocaleDateString('nl-NL')}`,
        received_at: new Date().toISOString(),
        pdf_url: fileUrl,
        pdf_filename: filename,
        pdf_size_bytes: file.size,
        ocr_status: 'pending',
        status: 'pending'
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      // Clean up uploaded file
      await supabase.storage.from('expense-pdfs').remove([filePath])
      return { success: false, error: 'Opslaan mislukt' }
    }

    return { success: true, expenseId: expense.id }
  } catch (error) {
    console.error('createExpenseFromCamera error:', error)
    return { success: false, error: 'Er ging iets mis' }
  }
}

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
  ocr_error: string | null
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
    return []
  }

  const { data, error } = await supabase
    .from('pending_expenses')
    .select('id, sender_email, subject, received_at, pdf_url, pdf_filename, pdf_size_bytes, ocr_status, ocr_completed_at, vendor_name, vendor_country, invoice_number, invoice_date, due_date, currency, subtotal, vat_rate, vat_amount, total_amount, total_amount_eur, exchange_rate, description, category, vat_treatment, eu_location, ocr_error, status, created_at')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching pending expenses:', error)
    return []
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
    .select('id, sender_email, subject, received_at, pdf_url, pdf_filename, pdf_size_bytes, ocr_status, ocr_completed_at, vendor_name, vendor_country, invoice_number, invoice_date, due_date, currency, subtotal, vat_rate, vat_amount, total_amount, total_amount_eur, exchange_rate, description, category, vat_treatment, eu_location, ocr_error, status, created_at')
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

const VALID_CATEGORIES = ['Inkoop', 'Sales', 'Reiskosten', 'Kantoor', 'Overig'] as const
const CATEGORY_FALLBACK: Record<string, string> = {
  'Software': 'Kantoor',
  'Office Supplies': 'Kantoor',
  'Services': 'Inkoop',
  'Marketing': 'Overig',
  'Travel': 'Reiskosten',
  'Meals': 'Overig',
  'Utilities': 'Overig',
  'Other': 'Overig',
}

function sanitizeCategory(category: string): string {
  if ((VALID_CATEGORIES as readonly string[]).includes(category)) return category
  return CATEGORY_FALLBACK[category] || 'Overig'
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
    const rawCategory = overrides?.category || expense.category || 'Overig'
    const finalData = {
      vendor_name: overrides?.vendorName || expense.vendor_name || 'Unknown',
      invoice_date: overrides?.invoiceDate || expense.invoice_date || new Date().toISOString().split('T')[0],
      subtotal: overrides?.subtotal || expense.subtotal || 0,
      vat_rate: overrides?.vatRate || expense.vat_rate || 21,
      vat_amount: overrides?.vatAmount || expense.vat_amount || 0,
      total_amount: overrides?.totalAmount || expense.total_amount || 0,
      description: overrides?.description || expense.description || expense.subject,
      category: sanitizeCategory(rawCategory),
      vat_treatment: expense.vat_treatment || 'domestic',
      eu_location: expense.eu_location || null
    }

    // Use EUR amount if available, otherwise use original amount
    const amountToUse = expense.currency !== 'EUR' && expense.total_amount_eur 
      ? expense.total_amount_eur 
      : finalData.total_amount

    // Create transaction using correct schema
    // For eu_location: only include if reverse charge, otherwise let DB default handle it
    const transactionData: any = {
      gebruiker_id: user.id,
      datum: new Date(finalData.invoice_date).toISOString(),
      bedrag: amountToUse,
      omschrijving: `${finalData.vendor_name} - ${finalData.description}`,
      categorie: finalData.category,
      btw_tarief: finalData.vat_rate,
      vat_treatment: finalData.vat_treatment,
      type_transactie: 'UITGAVEN',
      bon_url: expense.pdf_url
    }

    // Only add eu_location if reverse charge
    if (finalData.vat_treatment === 'foreign_service_reverse_charge') {
      transactionData.eu_location = finalData.eu_location || 'UNKNOWN'
    }

    const { data: transaction, error: transactionError } = await supabase
      .from('transacties')
      .insert(transactionData)
      .select('id')
      .single()

    if (transactionError) {
      console.error('[approveExpense] Transaction insert error:', transactionError)
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
      console.error('[approveExpense] Update expense error:', updateError)
      throw updateError
    }

    return { success: true, transactionId: transaction.id }
  } catch (error) {
    console.error('[approveExpense] Error:', error)
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
