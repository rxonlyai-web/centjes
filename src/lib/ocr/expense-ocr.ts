/**
 * OCR Module for Expense Invoice Extraction
 * Uses Google Gemini to extract structured data from expense PDFs
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

export interface ExpenseData {
  vendorName: string
  invoiceNumber?: string
  invoiceDate: string  // YYYY-MM-DD
  dueDate?: string     // YYYY-MM-DD
  subtotal: number
  vatRate: number
  vatAmount: number
  totalAmount: number
  description?: string
  category?: string
  confidence: number   // 0-1
}

/**
 * Extract expense data from PDF using Gemini Vision
 */
export async function extractExpenseData(pdfUrl: string): Promise<ExpenseData> {
  const apiKey = process.env.GEMINI_API_KEY
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured')
  }

  // Initialize Gemini
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

  // Download PDF
  const response = await fetch(pdfUrl)
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.statusText}`)
  }

  const pdfBuffer = await response.arrayBuffer()
  const base64Pdf = Buffer.from(pdfBuffer).toString('base64')

  // Prepare prompt
  const prompt = `
You are an expert at extracting structured data from invoices.

Extract the following information from this invoice PDF:

1. **Vendor/Supplier Name**: The company that issued the invoice
2. **Invoice Number**: The unique invoice identifier
3. **Invoice Date**: When the invoice was issued (format: YYYY-MM-DD)
4. **Due Date**: Payment deadline (format: YYYY-MM-DD)
5. **Subtotal**: Amount excluding VAT/BTW
6. **VAT Rate**: VAT percentage (e.g., 21 for 21%)
7. **VAT Amount**: VAT amount in euros
8. **Total Amount**: Total including VAT
9. **Description**: Brief description of goods/services
10. **Category**: Best matching category from: "Software", "Office Supplies", "Services", "Marketing", "Travel", "Utilities", "Other"

Return ONLY a valid JSON object with these exact field names (camelCase):
{
  "vendorName": "string",
  "invoiceNumber": "string or null",
  "invoiceDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD or null",
  "subtotal": number,
  "vatRate": number,
  "vatAmount": number,
  "totalAmount": number,
  "description": "string or null",
  "category": "string or null",
  "confidence": number (0-1, your confidence in the extraction)
}

If a field cannot be found, use null for strings or 0 for numbers.
For dates, always use YYYY-MM-DD format.
For amounts, use decimal numbers (e.g., 121.50).

Do not include any explanation, only return the JSON object.
`

  // Call Gemini
  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: base64Pdf
      }
    },
    { text: prompt }
  ])

  const responseText = result.response.text()

  // Parse JSON response
  try {
    // Remove markdown code blocks if present
    const jsonText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const data = JSON.parse(jsonText) as ExpenseData

    // Validate and sanitize
    return {
      vendorName: data.vendorName || 'Unknown Vendor',
      invoiceNumber: data.invoiceNumber || undefined,
      invoiceDate: data.invoiceDate || new Date().toISOString().split('T')[0],
      dueDate: data.dueDate || undefined,
      subtotal: Number(data.subtotal) || 0,
      vatRate: Number(data.vatRate) || 21,
      vatAmount: Number(data.vatAmount) || 0,
      totalAmount: Number(data.totalAmount) || 0,
      description: data.description || undefined,
      category: data.category || 'Other',
      confidence: Number(data.confidence) || 0.5
    }
  } catch (error) {
    console.error('Failed to parse Gemini response:', error)
    console.error('Response text:', responseText)
    throw new Error('Failed to extract expense data from PDF')
  }
}

/**
 * Validate extracted expense data
 */
export function validateExpenseData(data: ExpenseData): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!data.vendorName || data.vendorName === 'Unknown Vendor') {
    errors.push('Vendor name is required')
  }

  if (!data.invoiceDate) {
    errors.push('Invoice date is required')
  }

  if (data.totalAmount <= 0) {
    errors.push('Total amount must be greater than 0')
  }

  // Check VAT calculation
  const expectedVatAmount = (data.subtotal * data.vatRate) / 100
  const vatDifference = Math.abs(data.vatAmount - expectedVatAmount)
  
  if (vatDifference > 0.02) {
    errors.push('VAT calculation does not match (subtotal × VAT rate)')
  }

  // Check total calculation
  const expectedTotal = data.subtotal + data.vatAmount
  const totalDifference = Math.abs(data.totalAmount - expectedTotal)
  
  if (totalDifference > 0.02) {
    errors.push('Total does not match (subtotal + VAT)')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}
