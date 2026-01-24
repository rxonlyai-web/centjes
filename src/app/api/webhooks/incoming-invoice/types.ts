/**
 * Type definitions for N8N Webhook Endpoint
 */

export interface IncomingInvoiceRequest {
  sender: string
  subject: string
  date: string
  amount?: string | number
}

export interface IncomingInvoiceResponse {
  success: boolean
  invoice_id: string
  invoice_number: string
}

export interface WebhookErrorResponse {
  success: false
  error: string
  details?: string
}
