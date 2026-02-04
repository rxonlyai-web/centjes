'use server'

import { createClient } from '@/utils/supabase/server'
import { getUserOrganizationId } from '@/lib/org'
import { sendInvoiceEmail } from '@/lib/email'
import { getInvoiceById, updateInvoiceStatus } from './actions'

export async function sendInvoiceByEmail(
  invoiceId: string,
  recipientEmail: string,
  personalMessage?: string
): Promise<void> {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Niet ingelogd')
  }

  const orgId = await getUserOrganizationId(supabase)

  // Get invoice with items and company settings
  const invoice = await getInvoiceById(invoiceId)
  if (!invoice) {
    throw new Error('Factuur niet gevonden')
  }

  if (!invoice.company_settings?.email) {
    throw new Error('Stel eerst je e-mailadres in bij Instellingen')
  }

  if (!invoice.company_settings?.company_name) {
    throw new Error('Stel eerst je bedrijfsnaam in bij Instellingen')
  }

  // Generate PDF
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { default: InvoicePDFTemplate } = await import('@/components/InvoicePDFTemplate')
  const React = await import('react')

  const pdfBuffer = await renderToBuffer(
    // @ts-expect-error - Type mismatch between InvoicePDFTemplate props and DocumentProps
    React.createElement(InvoicePDFTemplate, { invoice })
  )

  // Format total amount
  const totalFormatted = new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(invoice.total_amount)

  // Send email
  const result = await sendInvoiceEmail({
    to: recipientEmail,
    replyTo: invoice.company_settings.email,
    fromName: invoice.company_settings.company_name,
    invoiceNumber: invoice.invoice_number,
    clientName: invoice.client_name || 'klant',
    totalAmount: totalFormatted,
    pdfBuffer: Buffer.from(pdfBuffer),
    personalMessage,
  })

  // Log the send
  await supabase
    .from('invoice_email_log')
    .insert({
      invoice_id: invoiceId,
      ...(orgId && { organization_id: orgId }),
      sent_to: recipientEmail,
      sent_by: user.id,
      resend_id: result.id,
      status: 'sent',
    })

  // Update invoice status to sent (if currently draft)
  if (invoice.status === 'draft') {
    await updateInvoiceStatus(invoiceId, 'sent')
  }
}
