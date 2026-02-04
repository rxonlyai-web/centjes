import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendInvoiceEmail(params: {
  to: string
  replyTo: string
  fromName: string
  invoiceNumber: string
  clientName: string
  totalAmount: string
  pdfBuffer: Buffer
  personalMessage?: string
}): Promise<{ id: string }> {
  const subject = `Factuur ${params.invoiceNumber} van ${params.fromName}`

  const textBody = [
    `Beste ${params.clientName},`,
    '',
    params.personalMessage || `Hierbij ontvangt u factuur ${params.invoiceNumber}.`,
    '',
    `Bedrag: ${params.totalAmount}`,
    '',
    'De factuur vindt u als bijlage bij deze e-mail.',
    '',
    'Met vriendelijke groet,',
    params.fromName,
  ].join('\n')

  const { data, error } = await resend.emails.send({
    from: `${params.fromName} via Centjes <facturen@centjes.eu>`,
    to: params.to,
    replyTo: params.replyTo,
    subject,
    text: textBody,
    attachments: [
      {
        filename: `${params.invoiceNumber}.pdf`,
        content: params.pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })

  if (error) {
    console.error('Resend error:', error)
    throw new Error(error.message || 'Kon e-mail niet verzenden')
  }

  return { id: data?.id || '' }
}
