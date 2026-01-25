import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import type { 
  IncomingExpenseRequest, 
  IncomingExpenseResponse, 
  WebhookErrorResponse 
} from './types'

/**
 * Webhook endpoint for incoming expense invoices from N8N
 * 
 * Flow:
 * 1. Validate API key
 * 2. Match user by recipient email
 * 3. Decode and upload PDF to Supabase Storage
 * 4. Create pending_expense record
 * 5. Return success with expense ID
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

    // 2. Parse request body
    const body = await request.json() as IncomingExpenseRequest

    // 3. Validate required fields
    if (!body.senderEmail || !body.subject || !body.receivedAt || !body.recipientEmail) {
      return NextResponse.json<WebhookErrorResponse>(
        { 
          success: false, 
          error: 'Missing required fields',
          details: 'senderEmail, subject, receivedAt, and recipientEmail are required'
        },
        { status: 400 }
      )
    }

    if (!body.pdfData || !body.fileName) {
      return NextResponse.json<WebhookErrorResponse>(
        { 
          success: false, 
          error: 'Missing PDF data',
          details: 'pdfData and fileName are required'
        },
        { status: 400 }
      )
    }

    // 4. Create Supabase client with service role (bypasses RLS)
    const supabase = createServiceRoleClient()

    // 5. Find user by Gmail connection
    const recipientEmail = body.recipientEmail.toLowerCase()

    const { data: connection, error: connectionError } = await supabase
      .from('user_gmail_connections')
      .select('user_id')
      .eq('gmail_address', recipientEmail)
      .eq('is_active', true)
      .single()

    if (connectionError || !connection) {
      console.error('No active Gmail connection found for:', recipientEmail)
      return NextResponse.json<WebhookErrorResponse>(
        { 
          success: false, 
          error: 'No user found for this email address',
          details: `No active connection for ${recipientEmail}`
        },
        { status: 404 }
      )
    }

    const userId = connection.user_id

    // 6. Decode base64 PDF
    let pdfBuffer: Buffer
    try {
      // Remove data URL prefix if present
      const base64Data = body.pdfData.replace(/^data:application\/pdf;base64,/, '')
      pdfBuffer = Buffer.from(base64Data, 'base64')
    } catch (error) {
      console.error('Error decoding PDF:', error)
      return NextResponse.json<WebhookErrorResponse>(
        { 
          success: false, 
          error: 'Invalid PDF data',
          details: 'Failed to decode base64 PDF'
        },
        { status: 400 }
      )
    }

    // 7. Upload PDF to Supabase Storage
    const timestamp = Date.now()
    const sanitizedFileName = body.fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
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

    // 8. Get public URL for PDF
    const { data: urlData } = supabase.storage
      .from('expense-pdfs')
      .getPublicUrl(storagePath)

    const pdfUrl = urlData.publicUrl

    // 9. Parse received date
    let receivedDate: Date
    try {
      receivedDate = new Date(body.receivedAt)
      if (isNaN(receivedDate.getTime())) {
        receivedDate = new Date()
      }
    } catch {
      receivedDate = new Date()
    }

    // 10. Create pending_expense record
    const { data: expense, error: expenseError } = await supabase
      .from('pending_expenses')
      .insert({
        user_id: userId,
        sender_email: body.senderEmail,
        subject: body.subject,
        received_at: receivedDate.toISOString(),
        pdf_url: pdfUrl,
        pdf_filename: body.fileName,
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

    // 11. Update last_sync_at for Gmail connection
    await supabase
      .from('user_gmail_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('user_id', userId)

    // 12. Return success
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
