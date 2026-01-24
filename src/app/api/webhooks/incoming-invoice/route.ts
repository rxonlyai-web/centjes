import { NextRequest, NextResponse } from 'next/server'
import type { IncomingInvoiceRequest, IncomingInvoiceResponse, WebhookErrorResponse } from './types'

/**
 * POST /api/webhooks/incoming-invoice
 * 
 * Webhook endpoint to receive invoice data from n8n
 * Requires x-api-key header for authentication
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify API Key
    const apiKey = request.headers.get('x-api-key')
    const expectedKey = process.env.N8N_WEBHOOK_SECRET

    if (!expectedKey) {
      console.error('N8N_WEBHOOK_SECRET not configured')
      return NextResponse.json<WebhookErrorResponse>(
        { success: false, error: 'Webhook not configured' },
        { status: 500 }
      )
    }

    if (!apiKey || apiKey !== expectedKey) {
      return NextResponse.json<WebhookErrorResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse and validate request body
    let body: IncomingInvoiceRequest
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json<WebhookErrorResponse>(
        { success: false, error: 'Invalid JSON' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!body.sender || !body.subject || !body.date) {
      return NextResponse.json<WebhookErrorResponse>(
        { 
          success: false, 
          error: 'Missing required fields',
          details: 'sender, subject, and date are required'
        },
        { status: 400 }
      )
    }

    // 3. Create Supabase service role client (bypasses RLS)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not configured')
      return NextResponse.json<WebhookErrorResponse>(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the first user for webhook invoices
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError || !users || users.length === 0) {
      console.error('Error fetching users:', authError)
      return NextResponse.json<WebhookErrorResponse>(
        { success: false, error: 'No user found for invoice creation' },
        { status: 500 }
      )
    }

    const userId = users[0].id

    // 4. Generate invoice number
    const { data: invoiceNumber, error: numberError } = await supabase
      .rpc('generate_invoice_number', { p_user_id: userId })

    if (numberError || !invoiceNumber) {
      console.error('Error generating invoice number:', numberError)
      return NextResponse.json<WebhookErrorResponse>(
        { success: false, error: 'Failed to generate invoice number' },
        { status: 500 }
      )
    }

    // 5. Parse amount (if provided)
    let subtotal = 0
    const vatRate = 21.00
    let vatAmount = 0
    let totalAmount = 0

    if (body.amount) {
      const amountStr = String(body.amount).replace(/[^0-9.]/g, '')
      totalAmount = parseFloat(amountStr) || 0
      
      // Calculate backwards from total (assuming 21% VAT included)
      subtotal = totalAmount / 1.21
      vatAmount = totalAmount - subtotal
    }

    // 6. Parse and validate date
    let invoiceDate: string
    let dueDate: string
    
    try {
      // Try to parse the date from n8n
      const parsedDate = new Date(body.date)
      if (isNaN(parsedDate.getTime())) {
        // Invalid date, use current date
        console.warn('Invalid date received, using current date:', body.date)
        invoiceDate = new Date().toISOString().split('T')[0]
      } else {
        invoiceDate = parsedDate.toISOString().split('T')[0]
      }
      
      // Calculate due date (14 days from invoice date)
      const dueDateObj = new Date(invoiceDate)
      dueDateObj.setDate(dueDateObj.getDate() + 14)
      dueDate = dueDateObj.toISOString().split('T')[0]
    } catch (error) {
      // Fallback to current date if parsing fails
      console.error('Date parsing error:', error)
      invoiceDate = new Date().toISOString().split('T')[0]
      const dueDateObj = new Date()
      dueDateObj.setDate(dueDateObj.getDate() + 14)
      dueDate = dueDateObj.toISOString().split('T')[0]
    }

    // 7. Insert invoice
    const { data: invoice, error: insertError } = await supabase
      .from('invoices')
      .insert({
        user_id: userId,
        invoice_number: invoiceNumber,
        status: 'draft',
        source: 'webhook',
        client_name: body.sender,
        invoice_date: invoiceDate,
        due_date: dueDate,
        payment_terms: 'Betaling binnen 14 dagen',
        subtotal: subtotal.toFixed(2),
        vat_rate: vatRate,
        vat_amount: vatAmount.toFixed(2),
        total_amount: totalAmount.toFixed(2),
        notes: body.subject,
      })
      .select()
      .single()

    if (insertError || !invoice) {
      console.error('Error inserting invoice:', insertError)
      return NextResponse.json<WebhookErrorResponse>(
        { success: false, error: 'Failed to create invoice', details: insertError?.message },
        { status: 500 }
      )
    }

    // 7. Return success response
    return NextResponse.json<IncomingInvoiceResponse>(
      {
        success: true,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Webhook error:', error)
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

// Only allow POST requests
export async function GET() {
  return NextResponse.json<WebhookErrorResponse>(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  )
}
