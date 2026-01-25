/**
 * Type definitions for Incoming Expense Webhook
 */

export interface IncomingExpenseRequest {
  senderEmail: string
  subject: string
  receivedAt: string
  recipientEmail: string
  pdfData: string  // base64 encoded PDF
  fileName: string
}

export interface IncomingExpenseResponse {
  success: boolean
  expense_id: string
  pdf_url: string
}

export interface WebhookErrorResponse {
  success: false
  error: string
  details?: string
}
