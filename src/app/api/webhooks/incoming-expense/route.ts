import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import type { 
  IncomingExpenseResponse, 
  WebhookErrorResponse 
} from './types'

/**
 * Webhook endpoint for incoming expense invoices from N8N
 * 
 * Flow:
 * 1. Validate API key
 * 2. Parse multipart/form-data
 * 3. Match user by recipient email
 * 4. Upload PDF to Supabase Storage
 * 5. Create pending_expense record
 * 6. Return success with expense ID
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Validate API Key
    const apiKey = request.headers.get('x-api-key')
    const expectedKey = process.env.N8N_WEBHOOK_SECRET

    if (!apiKey || !expectedKey || apiKey !== expectedKey) {
      return NextResponse.json<WebhookErrorResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse FormData
    const formData = await request.formData()
    
    // 3. Extract fields
    const file = formData.get('file') as File | null
    const senderEmail = formData.get('senderEmail') as string | null
    const subject = formData.get('subject') as string | null
    const receivedAt = formData.get('receivedAt') as string | null
    const recipientEmail = formData.get('recipientEmail') as string | null

    // 4. Validate required fields
    if (!senderEmail || !subject) {
      return NextResponse.json<WebhookErrorResponse>(
        { 
          success: false, 
          error: 'Missing required fields',
          details: 'senderEmail and subject are required'
        },
        { status: 400 }
      )
    }

    if (!file) {
      return NextResponse.json<WebhookErrorResponse>(
        { 
          success: false, 
          error: 'Missing PDF file',
          details: 'file field is required'
        },
        { status: 400 }
      )
    }

    // 5. Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const pdfBuffer = Buffer.from(arrayBuffer)

    if (pdfBuffer.length === 0) {
      return NextResponse.json<WebhookErrorResponse>(
        { 
          success: false, 
          error: 'Empty PDF file',
          details: 'The uploaded file is empty'
        },
        { status: 400 }
      )
    }

    // 6. Create Supabase client with service role (bypasses RLS)
    const supabase = createServiceRoleClient()

    // 7. Find user by Gmail connection
    const normalizedRecipientEmail = (recipientEmail || 'rxonly.ai@gmail.com').toLowerCase()

    const { data: connection, error: connectionError } = await supabase
      .from('user_gmail_connections')
      .select('user_id')
      .eq('gmail_address', normalizedRecipientEmail)
      .eq('is_active', true)
      .single()

    if (connectionError || !connection) {
      console.error('No active Gmail connection found for:', normalizedRecipientEmail)
      return NextResponse.json<WebhookErrorResponse>(
        { 
          success: false, 
          error: 'No user found for this email address',
          details: `No active connection for ${normalizedRecipientEmail}`
        },
        { status: 404 }
      )
    }

    const userId = connection.user_id

    // 8. Upload PDF to Supabase Storage
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `${userId}/${timestamp}_${sanitizedFileName}`

    const { error: uploadError } = await supabase.storage
      .from('expense-pdfs')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false
      })

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError)
      return NextResponse.json<WebhookErrorResponse>(
        { 
          success: false, 
          error: 'Failed to upload PDF',
          details: uploadError.message
        },
        { status: 500 }
      )
    }

    // 9. Get public URL for PDF
    const { data: urlData } = supabase.storage
      .from('expense-pdfs')
      .getPublicUrl(storagePath)

    const pdfUrl = urlData.publicUrl

    // 10. Parse received date
    let receivedDate: Date
    try {
      receivedDate = receivedAt ? new Date(receivedAt) : new Date()
      if (isNaN(receivedDate.getTime())) {
        receivedDate = new Date()
      }
    } catch {
      receivedDate = new Date()
    }

    // 11. Create pending_expense record
    const { data: expense, error: expenseError } = await supabase
      .from('pending_expenses')
      .insert({
        user_id: userId,
        sender_email: senderEmail,
        subject: subject,
        received_at: receivedDate.toISOString(),
        pdf_url: pdfUrl,
        pdf_filename: file.name,
        pdf_size_bytes: pdfBuffer.length,
        status: 'pending',
        ocr_status: 'pending'
      })
      .select('id')
      .single()

    if (expenseError) {
      console.error('Error creating pending expense:', expenseError)
      
      // Cleanup: delete uploaded PDF
      await supabase.storage
        .from('expense-pdfs')
        .remove([storagePath])

      return NextResponse.json<WebhookErrorResponse>(
        { 
          success: false, 
          error: 'Failed to create expense record',
          details: expenseError.message
        },
        { status: 500 }
      )
    }

    // 12. Update last_sync_at for Gmail connection
    await supabase
      .from('user_gmail_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('user_id', userId)

    // 13. Return success
    return NextResponse.json<IncomingExpenseResponse>(
      {
        success: true,
        expense_id: expense.id,
        pdf_url: pdfUrl
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Unexpected error in incoming-expense webhook:', error)
    return NextResponse.json<WebhookErrorResponse>(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
