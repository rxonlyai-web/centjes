'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * Create a transaction automatically from a receipt upload
 * 
 * Flow:
 * 1. Upload file to Supabase Storage bucket "documents"
 * 2. Insert row in public.documents
 * 3. Call Gemini to extract invoice fields
 * 4. Update documents.extracted_json + status
 * 5. Insert row into public.transacties with extracted values
 */
export async function createTransactionFromReceipt(formData: FormData) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Je moet ingelogd zijn om een transactie toe te voegen')
  }

  // Get file from formData
  const file = formData.get('receipt') as File | null

  if (!file || file.size === 0) {
    throw new Error('Geen bestand geselecteerd')
  }

  // Validation
  const MAX_SIZE = 10 * 1024 * 1024 // 10MB
  const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']

  if (file.size > MAX_SIZE) {
    throw new Error(`Bestand is te groot (max 10MB). Huidige grootte: ${(file.size / 1024 / 1024).toFixed(2)}MB`)
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Bestandstype niet toegestaan. Gebruik PDF, PNG of JPG. Huidig type: ${file.type}`)
  }

  // Sanitize filename
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${user.id}/${Date.now()}_${sanitizedName}`

  // 1. Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    console.error('[Upload] Failed:', uploadError)
    throw new Error(`Kon document niet uploaden: ${uploadError.message}`)
  }

  // 2. Insert into public.documents
  const { data: documentData, error: dbError } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      file_path: uploadData.path, // Legacy field
      storage_path: uploadData.path, // New field for clarity
      storage_bucket: 'documents',
      original_filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      status: 'uploaded',
    })
    .select()
    .single()

  if (dbError || !documentData) {
    console.error('[Database] Insert failed:', dbError)
    // Clean up uploaded file
    await supabase.storage.from('documents').remove([uploadData.path])
    throw new Error(`Kon document niet opslaan in database: ${dbError?.message}`)
  }

  const documentId = documentData.id

  try {
    // 3. Download file and convert to base64
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(uploadData.path)

    if (downloadError || !fileData) {
      throw new Error('Kon bestand niet downloaden voor extractie')
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')

    // 4. Call Gemini to extract invoice fields
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is missing in .env.local. Please add it and restart the server.')
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    
    // Try gemini-2.0-flash first, fallback to gemini-1.5-flash
    let model
    try {
      model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    } catch {
      model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    }

    const promptText = `
      Extract structured data from this invoice/receipt.
      Return ONLY valid JSON matching this schema:
      {
        "supplier": { "name": string|null, "vat_id": string|null },
        "invoice": { "invoice_number": string|null, "issue_date": "YYYY-MM-DD"|null, "currency": "EUR"|"USD"|null },
        "amounts": { "total": number|null, "subtotal": number|null, "vat_total": number|null },
        "vat": { "rate": 0|9|21|null, "reverse_charge": boolean|null, "amount_includes_vat": boolean|null }
      }
      If a field is missing, use null. Infer currency if possible (default EUR for Netherlands).
    `

    const result = await model.generateContent([
      promptText,
      {
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      },
    ])

    const response = await result.response
    const text = response.text()

    // Clean up markdown code blocks if present
    const jsonStr = text.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim()
    let extractedJson

    try {
      extractedJson = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError, 'Raw Text:', text)
      throw new Error('Gemini response was not valid JSON')
    }

    // 5. Update documents table with extraction results
    await supabase
      .from('documents')
      .update({
        status: 'extracted',
        extracted_json: extractedJson,
        warnings: null,
      })
      .eq('id', documentId)
      .eq('user_id', user.id)

    // 6. Create transaction from extracted data
    const supplier = extractedJson.supplier || {}
    const invoice = extractedJson.invoice || {}
    const amounts = extractedJson.amounts || {}
    const vat = extractedJson.vat || {}

    // Validate required fields
    if (!amounts.total) {
      throw new Error('Kon totaalbedrag niet extraheren uit de bon. Voeg de transactie handmatig toe.')
    }

    // Determine date
    const datum = invoice.issue_date || new Date().toISOString().split('T')[0]

    // Determine description
    const supplierName = supplier.name || 'Onbekend'
    const invoiceNumber = invoice.invoice_number || ''
    const omschrijving = `${supplierName} ${invoiceNumber}`.trim()

    // Determine VAT rate
    let btw_tarief = 21 // default
    if (vat.reverse_charge === true) {
      btw_tarief = 0
    } else if (vat.rate !== null && vat.rate !== undefined) {
      btw_tarief = vat.rate
    }

    // Create transaction
    const transactionData = {
      gebruiker_id: user.id,
      datum: new Date(datum).toISOString(),
      bedrag: amounts.total,
      omschrijving,
      categorie: 'Overig',
      btw_tarief,
      type_transactie: 'UITGAVEN',
      bon_url: uploadData.path, // Store the storage path, not public URL
    }

    const { data: transactionResult, error: transactionError } = await supabase
      .from('transacties')
      .insert(transactionData)
      .select()
      .single()

    if (transactionError) {
      console.error('Transaction insert error:', transactionError)
      throw new Error('Kon transactie niet aanmaken. Probeer het opnieuw.')
    }

    console.log('[createTransactionFromReceipt] Transaction created:', transactionResult.id)
    console.log('[createTransactionFromReceipt] Linking document:', documentId, 'to transaction:', transactionResult.id)

    // Link document to transaction via join table
    const { error: linkError } = await supabase
      .from('transaction_documents')
      .insert({
        transaction_id: transactionResult.id,
        document_id: documentId,
      })

    if (linkError) {
      console.error('[createTransactionFromReceipt] Failed to link document to transaction:', linkError)
      // Non-fatal: transaction was created successfully
      // The document exists but isn't linked - user can still see transaction
    } else {
      console.log('[createTransactionFromReceipt] Successfully linked document to transaction')
    }

    // Revalidate all affected pages
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/transacties')
    revalidatePath('/dashboard/btw')

    return {
      transactionId: transactionResult.id,
      documentId: documentId,
    }

  } catch (error) {
    console.error('Extraction/Transaction creation error:', error)

    // Update document status to failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await supabase
      .from('documents')
      .update({
        status: 'failed',
        warnings: [errorMessage],
      })
      .eq('id', documentId)
      .eq('user_id', user.id)

    // Re-throw the error
    throw error
  }
}


/**
 * Extract transaction data from an uploaded document (invoice/receipt)
 * 
 * This action uploads the file, calls Gemini to extract structured data,
 * and returns the extracted fields for form prefill. It does NOT create
 * a transaction - that happens when the user submits the form.
 */
export async function extractTransactionFromDocument(formData: FormData) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Je moet ingelogd zijn om documenten te uploaden')
  }

  // Get file from formData
  const file = formData.get('file') as File | null

  if (!file || file.size === 0) {
    throw new Error('Geen bestand geselecteerd')
  }

  // Validation
  const MAX_SIZE = 10 * 1024 * 1024 // 10MB
  const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']

  if (file.size > MAX_SIZE) {
    throw new Error(`Bestand is te groot (max 10MB). Huidige grootte: ${(file.size / 1024 / 1024).toFixed(2)}MB`)
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Bestandstype niet toegestaan. Gebruik PDF, PNG of JPG. Huidig type: ${file.type}`)
  }

  // Sanitize filename
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${user.id}/${Date.now()}_${sanitizedName}`

  // Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    console.error('[Upload] Failed:', uploadError)
    throw new Error(`Kon document niet uploaden: ${uploadError.message}`)
  }

  try {
    // Convert file to base64 for Gemini
    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')

    // Call Gemini to extract invoice fields
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is missing in .env.local. Please add it and restart the server.')
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const promptText = `
      Extract structured transaction data from this invoice/receipt for bookkeeping.
      Return ONLY valid JSON matching this schema:
      {
        "date": "YYYY-MM-DD" | null,
        "amount": number | null,
        "description": string | null,
        "supplier_name": string | null,
        "vat": {
          "vat_treatment": "domestic" | "foreign_service_reverse_charge" | "unknown",
          "vat_rate": 0 | 9 | 21 | null,
          "amount_includes_vat": boolean | null
        },
        "category": "Inkoop" | "Sales" | "Reiskosten" | "Kantoor" | "Overig" | null,
        "confidence_notes": string[]
      }

      Rules for vat_treatment:
      - "domestic": If Dutch VAT is clearly present on the invoice (BTW number starts with NL, or VAT breakdown shown)
      - "foreign_service_reverse_charge": If supplier appears to be non-Dutch (no NL VAT number) AND this looks like a service/SaaS (not goods) AND VAT is 0 or missing. Set vat_rate=21 and amount_includes_vat=false in this case.
      - "unknown": If uncertain about VAT treatment

      For category, suggest the most appropriate based on invoice content:
      - "Inkoop": Purchase of goods for resale
      - "Sales": Income/revenue (rare for expenses)
      - "Reiskosten": Travel, fuel, parking, hotels
      - "Kantoor": Office supplies, software, subscriptions
      - "Overig": Everything else

      If a field cannot be determined, use null.
      Add confidence_notes for any uncertainties or assumptions made.
    `

    const result = await model.generateContent([
      promptText,
      {
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      },
    ])

    const response = await result.response
    const text = response.text()

    // Clean up markdown code blocks if present
    const jsonStr = text.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim()
    let extractedData

    try {
      extractedData = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError, 'Raw Text:', text)
      throw new Error('Kon factuurgegevens niet verwerken. Probeer het opnieuw of vul handmatig in.')
    }

    // Create document record in database
    console.log('[extractTransactionFromDocument] Creating document record for:', uploadData.path)
    
    // Try with full schema first (includes migration 004 fields)
    let documentData = null
    let insertError = null
    
    const fullInsert = {
      user_id: user.id,
      file_path: uploadData.path,
      storage_path: uploadData.path,
      storage_bucket: 'documents',
      original_filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      status: 'extracted' as const,
      extracted_json: extractedData,
    }
    
    const { data: fullData, error: fullError } = await supabase
      .from('documents')
      .insert(fullInsert)
      .select()
      .single()
    
    if (fullError) {
      console.log('[extractTransactionFromDocument] Full insert failed:', fullError.message)
      
      // Try with base schema only (without migration 004 fields)
      const baseInsert = {
        user_id: user.id,
        file_path: uploadData.path,
        original_filename: file.name,
        mime_type: file.type,
        status: 'extracted' as const,
        extracted_json: extractedData,
      }
      
      const { data: baseData, error: baseError } = await supabase
        .from('documents')
        .insert(baseInsert)
        .select()
        .single()
      
      if (baseError) {
        console.error('[extractTransactionFromDocument] Base insert also failed:', baseError)
        insertError = baseError
      } else {
        documentData = baseData
        console.log('[extractTransactionFromDocument] Document created with base schema:', baseData.id)
      }
    } else {
      documentData = fullData
      console.log('[extractTransactionFromDocument] Document created with full schema:', fullData.id)
    }
    
    // If both inserts failed, clean up and throw
    if (!documentData) {
      await supabase.storage.from('documents').remove([uploadData.path])
      throw new Error(`Kon document niet opslaan: ${insertError?.message || 'Unknown error'}`)
    }

    // Get public URL for preview
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(uploadData.path)

    return {
      storage_path: uploadData.path,
      public_url: publicUrl,
      extracted: extractedData,
      document_id: documentData.id,
    }

  } catch (error) {
    console.error('Extraction error:', error)
    
    // Clean up uploaded file on error
    await supabase.storage.from('documents').remove([uploadData.path])
    
    // Re-throw the error
    throw error
  }
}


export async function createTransaction(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Je moet ingelogd zijn om een transactie toe te voegen')
  }

  // Validate and parse form data
  const datum = formData.get('datum') as string
  const bedragStr = formData.get('bedrag') as string
  const omschrijving = formData.get('omschrijving') as string
  const type_transactie = formData.get('type_transactie') as string
  const vat_treatment = (formData.get('vat_treatment') as string) || 'domestic'
  const btw_tariefStr = formData.get('btw_tarief') as string
  const categorie = formData.get('categorie') as string
  const receiptFile = formData.get('receipt') as File | null

  // Validation
  if (!datum || !bedragStr || !omschrijving || !type_transactie || !categorie) {
    throw new Error('Alle velden zijn verplicht')
  }

  const bedrag = parseFloat(bedragStr)
  // If reverse charge, we might not have a VAT rate selected, default to 0
  const btw_tarief = vat_treatment === 'foreign_service_reverse_charge' ? 0 : parseInt(btw_tariefStr)

  if (isNaN(bedrag) || bedrag <= 0) {
    throw new Error('Bedrag moet groter zijn dan 0')
  }

  // Only validate VAT rate if domestic
  if (vat_treatment === 'domestic' && (isNaN(btw_tarief) || ![0, 9, 21].includes(btw_tarief))) {
    throw new Error('Ongeldig BTW tarief')
  }

  if (!['INKOMSTEN', 'UITGAVEN'].includes(type_transactie)) {
    throw new Error('Ongeldig transactie type')
  }

  const validCategories = ['Inkoop', 'Sales', 'Reiskosten', 'Kantoor', 'Overig']
  if (!validCategories.includes(categorie)) {
    throw new Error('Ongeldige categorie')
  }

  // Upload receipt if provided
  let bon_url: string | null = null
  if (receiptFile && receiptFile.size > 0) {
    const fileExt = receiptFile.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}.${fileExt}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('Bonnetjes')
      .upload(fileName, receiptFile, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw new Error('Kon bon niet uploaden. Probeer het opnieuw.')
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('Bonnetjes')
      .getPublicUrl(uploadData.path)

    bon_url = publicUrl
  }

  const rawData = {
    gebruiker_id: user.id,
    datum: new Date(datum).toISOString(),
    bedrag,
    omschrijving,
    type_transactie,
    vat_treatment,
    btw_tarief,
    categorie,
    bon_url,
  }


  const { data: newTransaction, error } = await supabase
    .from('transacties')
    .insert(rawData)
    .select()
    .single()

  if (error) {
    console.error('Supabase error:', error)
    throw new Error('Kon transactie niet opslaan. Probeer het opnieuw.')
  }

  // Link document if bon_url was set from upload flow
  // Check if bon_url is a storage path (from extractTransactionFromDocument)
  const uploadedStoragePath = formData.get('bon_url') as string | null
  if (uploadedStoragePath && !uploadedStoragePath.startsWith('http')) {
    console.log('[createTransaction] Attempting to link document with path:', uploadedStoragePath)
    
    // Find document by storage_path OR file_path (for backward compatibility)
    const { data: documents, error: docFindError } = await supabase
      .from('documents')
      .select('id')
      .eq('user_id', user.id)
      .or(`storage_path.eq.${uploadedStoragePath},file_path.eq.${uploadedStoragePath}`)
      .limit(1)

    if (docFindError) {
      console.error('[createTransaction] Error finding document:', docFindError)
    } else if (!documents || documents.length === 0) {
      console.warn('[createTransaction] No document found for path:', uploadedStoragePath)
    } else {
      const document = documents[0]
      console.log('[createTransaction] Found document:', document.id)
      
      const { error: linkError } = await supabase
        .from('transaction_documents')
        .insert({
          transaction_id: newTransaction.id,
          document_id: document.id,
        })

      if (linkError) {
        console.error('[createTransaction] Failed to link document to transaction:', linkError)
        // Non-fatal: transaction was created, but link failed
        // Could be duplicate key error if already linked
      } else {
        console.log('[createTransaction] Successfully linked document', document.id, 'to transaction', newTransaction.id)
      }
    }
  }

  // Revalidate all affected pages
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/transacties')
  revalidatePath('/dashboard/btw')
}

/**
 * Update an existing transaction
 * 
 * Updates transaction fields and handles receipt uploads.
 * Only allows updating transactions that belong to the authenticated user (RLS enforced).
 */
export async function updateTransaction(transactionId: string, formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Je moet ingelogd zijn om een transactie te bewerken')
  }

  // Validate and parse form data (same as create)
  const datum = formData.get('datum') as string
  const bedragStr = formData.get('bedrag') as string
  const omschrijving = formData.get('omschrijving') as string
  const type_transactie = formData.get('type_transactie') as string
  const vat_treatment = (formData.get('vat_treatment') as string) || 'domestic'
  const btw_tariefStr = formData.get('btw_tarief') as string
  const categorie = formData.get('categorie') as string
  const receiptFile = formData.get('receipt') as File | null

  // Validation
  if (!datum || !bedragStr || !omschrijving || !type_transactie || !categorie) {
    throw new Error('Alle velden zijn verplicht')
  }

  const bedrag = parseFloat(bedragStr)
  // If reverse charge, we might not have a VAT rate selected, default to 0
  const btw_tarief = vat_treatment === 'foreign_service_reverse_charge' ? 0 : parseInt(btw_tariefStr)

  if (isNaN(bedrag) || bedrag <= 0) {
    throw new Error('Bedrag moet groter zijn dan 0')
  }

  // Only validate VAT rate if domestic
  if (vat_treatment === 'domestic' && (isNaN(btw_tarief) || ![0, 9, 21].includes(btw_tarief))) {
    throw new Error('Ongeldig BTW tarief')
  }

  if (!['INKOMSTEN', 'UITGAVEN'].includes(type_transactie)) {
    throw new Error('Ongeldig transactie type')
  }

  const validCategories = ['Inkoop', 'Sales', 'Reiskosten', 'Kantoor', 'Overig']
  if (!validCategories.includes(categorie)) {
    throw new Error('Ongeldige categorie')
  }

  // Get existing transaction to preserve bon_url if no new receipt uploaded
  const { data: existingTransaction } = await supabase
    .from('transacties')
    .select('bon_url')
    .eq('id', transactionId)
    .eq('gebruiker_id', user.id)
    .single()

  if (!existingTransaction) {
    throw new Error('Transactie niet gevonden')
  }

  // Handle receipt upload (upload new file if provided, otherwise keep existing)
  let bon_url: string | null = existingTransaction.bon_url || null
  if (receiptFile && receiptFile.size > 0) {
    const fileExt = receiptFile.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}.${fileExt}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('Bonnetjes')
      .upload(fileName, receiptFile, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw new Error('Kon bon niet uploaden. Probeer het opnieuw.')
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('Bonnetjes')
      .getPublicUrl(uploadData.path)

    bon_url = publicUrl
  }

  const updateData = {
    datum: new Date(datum).toISOString(),
    bedrag,
    omschrijving,
    type_transactie,
    vat_treatment,
    btw_tarief,
    categorie,
    bon_url,
  }

  // Update transaction (RLS ensures user can only update their own transactions)
  const { error } = await supabase
    .from('transacties')
    .update(updateData)
    .eq('id', transactionId)
    .eq('gebruiker_id', user.id)

  if (error) {
    console.error('Supabase error:', error)
    throw new Error('Kon transactie niet bijwerken. Probeer het opnieuw.')
  }

  // Revalidate all affected pages
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/transacties')
  revalidatePath('/dashboard/btw')
}

/**
 * Delete a transaction
 * 
 * Permanently removes a transaction from the database.
 * Only allows deleting transactions that belong to the authenticated user (RLS enforced).
 */
export async function deleteTransaction(transactionId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Je moet ingelogd zijn om een transactie te verwijderen')
  }

  // Delete transaction (RLS ensures user can only delete their own transactions)
  const { error } = await supabase
    .from('transacties')
    .delete()
    .eq('id', transactionId)
    .eq('gebruiker_id', user.id)

  if (error) {
    console.error('Supabase error:', error)
    throw new Error('Kon transactie niet verwijderen. Probeer het opnieuw.')
  }

  // Revalidate all affected pages
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/transacties')
  revalidatePath('/dashboard/btw')
}

export async function getTransactions() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('transacties')
    .select('*')
    .eq('gebruiker_id', user.id)
    .order('datum', { ascending: false })

  if (error) {
    console.error('Error fetching transactions:', error)
    return []
  }

  return data || []
}

/**
 * Get a single transaction by ID
 * 
 * Returns transaction details for the specified ID.
 * Only returns transactions owned by the authenticated user (RLS enforced).
 */
export async function getTransaction(transactionId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('transacties')
    .select('*')
    .eq('id', transactionId)
    .eq('gebruiker_id', user.id)
    .single()

  if (error) {
    console.error('Error fetching transaction:', error)
    return null
  }

  return data
}

/**
 * Get transactions with financial totals for a specific year and optional month
 * 
 * Returns:
 * - List of transactions filtered by year (and month if specified)
 * - Financial totals (VAT-excluded):
 *   - Total inkomsten (excl. btw)
 *   - Total uitgaven (excl. btw)
 *   - Resultaat (inkomsten - uitgaven)
 * 
 * Month filtering:
 * - month = null or 0: all months in the year
 * - month = 1-12: specific month in the year
 * 
 * Totals are always calculated for ALL transactions in the period,
 * regardless of tab filter (Alles/Inkomsten/Uitgaven) on the UI.
 */
interface Transaction {
  id: string
  gebruiker_id: string
  datum: string
  bedrag: number
  omschrijving: string
  type_transactie: string
  vat_treatment: string
  btw_tarief: number
  categorie: string
  bon_url: string | null
}

export async function getTransactionsWithTotals(
  year: number,
  month?: number | null
): Promise<{
  transactions: Transaction[]
  totals: {
    inkomsten: number
    uitgaven: number
    resultaat: number
  }
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      transactions: [],
      totals: { inkomsten: 0, uitgaven: 0, resultaat: 0 }
    }
  }

  // Build date filter based on year and optional month
  let startDate: string
  let endDate: string

  if (month && month >= 1 && month <= 12) {
    // Specific month
    const lastDay = new Date(year, month, 0).getDate() // Last day of month
    startDate = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`
    endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`
  } else {
    // All months in year
    startDate = `${year}-01-01T00:00:00`
    endDate = `${year}-12-31T23:59:59`
  }

  // Fetch transactions
  const { data: transactions, error } = await supabase
    .from('transacties')
    .select('*')
    .eq('gebruiker_id', user.id)
    .gte('datum', startDate)
    .lte('datum', endDate)
    .order('datum', { ascending: false })

  if (error) {
    console.error('Error fetching transactions:', error)
    return {
      transactions: [],
      totals: { inkomsten: 0, uitgaven: 0, resultaat: 0 }
    }
  }

  // Calculate VAT-excluded totals
  let totalInkomsten = 0
  let totalUitgaven = 0

  for (const transaction of transactions || []) {
    // Calculate amount excluding VAT
    let amountExcl = transaction.bedrag
    
    // If reverse charge, the amount is already net (excl. VAT)
    if (transaction.vat_treatment === 'foreign_service_reverse_charge') {
      amountExcl = transaction.bedrag
    } else if (transaction.btw_tarief === 21) {
      amountExcl = transaction.bedrag / 1.21
    } else if (transaction.btw_tarief === 9) {
      amountExcl = transaction.bedrag / 1.09
    }
    // If VAT rate is 0, amountExcl stays as is

    if (transaction.type_transactie === 'INKOMSTEN') {
      totalInkomsten += amountExcl
    } else if (transaction.type_transactie === 'UITGAVEN') {
      totalUitgaven += amountExcl
    }
  }

  const resultaat = totalInkomsten - totalUitgaven

  return {
    transactions: transactions || [],
    totals: {
      inkomsten: Math.round(totalInkomsten * 100) / 100,
      uitgaven: Math.round(totalUitgaven * 100) / 100,
      resultaat: Math.round(resultaat * 100) / 100
    }
  }
}

/**
 * Get all documents linked to a transaction
 * 
 * Returns document metadata for all documents attached to the specified transaction.
 * Uses the transaction_documents join table.
 */
export async function getTransactionDocuments(transactionId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.log('[getTransactionDocuments] No user found')
    return []
  }

  console.log('[getTransactionDocuments] Fetching documents for transaction:', transactionId)

  // Select only base schema fields (file_path, original_filename, mime_type)
  // uploaded_at may not exist in all schemas
  const { data, error } = await supabase
    .from('transaction_documents')
    .select(`
      document_id,
      documents (
        id,
        file_path,
        original_filename,
        mime_type
      )
    `)
    .eq('transaction_id', transactionId)

  if (error) {
    console.error('[getTransactionDocuments] Error fetching:', error)
    return []
  }

  console.log('[getTransactionDocuments] Raw data:', data)

  // Flatten the nested structure and map to expected format
  const documents = (data || [])
    .map((item: { documents: unknown }) => {
      const doc = item.documents as Record<string, unknown> | null
      if (!doc) return null
      
      return {
        id: doc.id,
        storage_path: doc.file_path, // Use file_path as storage_path for compatibility
        original_filename: doc.original_filename,
        mime_type: doc.mime_type,
        size_bytes: null, // May not exist in base schema
      }
    })
    .filter(Boolean)

  console.log('[getTransactionDocuments] Flattened documents:', documents)

  return documents
}

/**
 * Generate a signed URL for a document
 * 
 * Creates a temporary signed URL (1 hour expiry) for secure document access.
 * Only works for documents owned by the authenticated user (RLS enforced).
 */
export async function getDocumentSignedUrl(storagePath: string): Promise<string | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    console.log('[getDocumentSignedUrl] No user found')
    return null
  }

  console.log('[getDocumentSignedUrl] Generating signed URL for:', storagePath)

  // Verify user owns this document (via RLS)
  const { data: document } = await supabase
    .from('documents')
    .select('id, storage_bucket')
    .eq('storage_path', storagePath)
    .eq('user_id', user.id)
    .single()

  if (!document) {
    console.error('[getDocumentSignedUrl] Document not found or access denied for path:', storagePath)
    return null
  }

  console.log('[getDocumentSignedUrl] Document found, bucket:', document.storage_bucket)

  const { data, error } = await supabase.storage
    .from(document.storage_bucket)
    .createSignedUrl(storagePath, 3600) // 1 hour expiry

  if (error || !data) {
    console.error('[getDocumentSignedUrl] Failed to create signed URL:', error)
    return null
  }

  console.log('[getDocumentSignedUrl] Signed URL created successfully')

  return data.signedUrl
}
