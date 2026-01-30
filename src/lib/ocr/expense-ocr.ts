/**
 * OCR Module for Expense Invoice Extraction
 * Uses Google Gemini to extract structured data from expense PDFs
 */

import { getGeminiClient } from '@/lib/gemini'

export interface ExpenseData {
  vendorName: string
  vendorCountry?: string  // 2-letter ISO code (NL, US, SG, etc.)
  invoiceNumber?: string
  invoiceDate: string  // YYYY-MM-DD
  dueDate?: string     // YYYY-MM-DD
  currency: string     // EUR, USD, etc.
  subtotal: number     // In original currency
  vatRate: number
  vatAmount: number    // In original currency
  totalAmount: number  // In original currency
  totalAmountEur?: number  // Converted to EUR if not EUR
  exchangeRate?: number    // Used for conversion
  description?: string
  category?: string
  vatTreatment: 'domestic' | 'foreign_service_reverse_charge' | 'unknown'
  euLocation: 'EU' | 'NON_EU' | 'UNKNOWN'
  confidence: number   // 0-1
}

/**
 * Detect MIME type from URL or file extension
 */
function getMimeType(url: string): string {
  const urlLower = url.toLowerCase()

  if (urlLower.includes('.pdf')) {
    return 'application/pdf'
  } else if (urlLower.includes('.png')) {
    return 'image/png'
  } else if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) {
    return 'image/jpeg'
  } else if (urlLower.includes('.heic')) {
    return 'image/heic'
  } else if (urlLower.includes('.heif')) {
    return 'image/heif'
  } else if (urlLower.includes('.webp')) {
    return 'image/webp'
  }

  // Default to PDF for backwards compatibility
  return 'application/pdf'
}

/**
 * Extract expense data from PDF or image using Gemini Vision
 */
export async function extractExpenseData(fileUrl: string): Promise<ExpenseData> {
  // Initialize Gemini
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  // Download file
  const response = await fetch(fileUrl)
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`)
  }

  const fileBuffer = await response.arrayBuffer()
  const base64File = Buffer.from(fileBuffer).toString('base64')
  const mimeType = getMimeType(fileUrl)

  // Prepare prompt (matching the existing receipt OCR logic)
  const prompt = `
Extract structured transaction data from this invoice/receipt for Dutch bookkeeping.
Return ONLY valid JSON matching this schema:
{
  "vendorName": string,
  "vendorCountry": string | null,  // 2-letter ISO code (NL, US, SG, GB, DE, etc.)
  "invoiceNumber": string | null,
  "invoiceDate": "YYYY-MM-DD" | null,
  "dueDate": "YYYY-MM-DD" | null,
  "currency": "EUR" | "USD" | "GBP" | null,  // Invoice currency
  "subtotal": number | null,  // Amount excluding VAT in original currency
  "vatRate": 0 | 9 | 21 | null,
  "vatAmount": number | null,  // VAT amount in original currency
  "totalAmount": number | null,  // Total including VAT in original currency
  "description": string | null,
  "category": "Software" | "Office Supplies" | "Services" | "Marketing" | "Travel" | "Utilities" | "Other" | null,
  "vatTreatment": "domestic" | "foreign_service_reverse_charge" | "unknown",
  "euLocation": "EU" | "NON_EU" | "UNKNOWN",
  "confidence": number  // 0-1
}

CRITICAL RULES for vatTreatment (READ CAREFULLY):

1. "foreign_service_reverse_charge" if ANY of these conditions are met:
   - Invoice explicitly mentions "reverse charge", "reverse VAT", "customer to account for VAT", or similar
   - Supplier address is outside Netherlands (check city, postal code, country)
   - Supplier is a SaaS/software/online service company (like Railway, Supabase, Vercel, AWS, Stripe, etc.)
   - No Dutch VAT (BTW) shown on invoice AND supplier appears foreign
   - Invoice shows GST, Sales Tax, or other non-EU tax instead of VAT
   When this applies: Set vatRate=21, vatAmount=0

2. "domestic" ONLY if:
   - Supplier has NL VAT number (starts with NL) OR
   - Invoice clearly shows Dutch BTW breakdown OR
   - Supplier address is clearly in Netherlands with Dutch postal code

3. "unknown" if genuinely uncertain

CRITICAL RULES for euLocation (for Dutch VAT reporting):

1. "NON_EU" if supplier is from:
   - Singapore (SG), United States (US), United Kingdom (UK), Switzerland (CH), Norway (NO), Canada (CA), Australia (AU), etc.
   - ANY country outside the European Union
   - Check the supplier's full address carefully - city and country are key indicators

2. "EU" if supplier is from EU countries:
   - Belgium (BE), Germany (DE), France (FR), Italy (IT), Spain (ES), Austria (AT), Denmark (DK), Sweden (SE), etc.
   - Must be an EU member state (UK is NOT EU since Brexit)

3. "UNKNOWN" only if you cannot determine the country from the invoice

For vendorCountry: Extract 2-letter ISO code (NL, SG, US, GB, DE, etc.)
Look at the full supplier address - the city and postal code format are strong indicators.

For currency: Extract the currency code from the invoice (EUR, USD, GBP, etc.)
If not explicitly shown, infer from supplier country (US = USD, UK = GBP, EU = EUR, etc.)

For amounts: Always use the amounts in the ORIGINAL CURRENCY shown on the invoice.
Do not convert - we will handle conversion separately.

If a field cannot be found, use null.
For dates, always use YYYY-MM-DD format.
For amounts, use decimal numbers (e.g., 121.50).

Do not include any explanation, only return the JSON object.
`

  // Call Gemini
  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: mimeType,
        data: base64File
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

    const data = JSON.parse(jsonText) as {
      vendorName?: string
      vendorCountry?: string
      invoiceNumber?: string
      invoiceDate?: string
      dueDate?: string
      currency?: string
      subtotal?: number
      vatRate?: number
      vatAmount?: number
      totalAmount?: number
      description?: string
      category?: string
      vatTreatment?: string
      euLocation?: string
      confidence?: number
    }

    // Convert to EUR if needed
    let totalAmountEur = data.totalAmount
    let exchangeRate: number | undefined

    if (data.currency && data.currency !== 'EUR' && data.totalAmount) {
      // Get exchange rate (you can replace this with a real API call)
      exchangeRate = await getExchangeRate(data.currency, 'EUR')
      totalAmountEur = data.totalAmount * exchangeRate
    }

    // Validate and sanitize
    return {
      vendorName: data.vendorName || 'Unknown Vendor',
      vendorCountry: data.vendorCountry || undefined,
      invoiceNumber: data.invoiceNumber || undefined,
      invoiceDate: data.invoiceDate || new Date().toISOString().split('T')[0],
      dueDate: data.dueDate || undefined,
      currency: data.currency || 'EUR',
      subtotal: Number(data.subtotal) || 0,
      vatRate: Number(data.vatRate) || 21,
      vatAmount: Number(data.vatAmount) || 0,
      totalAmount: Number(data.totalAmount) || 0,
      totalAmountEur: totalAmountEur ? Number(totalAmountEur.toFixed(2)) : undefined,
      exchangeRate: exchangeRate ? Number(exchangeRate.toFixed(4)) : undefined,
      description: data.description || undefined,
      category: mapOcrCategory(data.category),
      vatTreatment: (data.vatTreatment === 'domestic' || data.vatTreatment === 'foreign_service_reverse_charge' || data.vatTreatment === 'unknown') 
        ? data.vatTreatment 
        : 'unknown',
      euLocation: (data.euLocation === 'EU' || data.euLocation === 'NON_EU' || data.euLocation === 'UNKNOWN')
        ? data.euLocation
        : 'UNKNOWN',
      confidence: Number(data.confidence) || 0.5
    }
  } catch (error) {
    console.error('Failed to parse Gemini response:', error)
    console.error('Response text:', responseText)
    throw new Error('Failed to extract expense data from PDF')
  }
}

/**
 * Map English OCR category names to Dutch DB constraint values
 */
function mapOcrCategory(category: string | undefined | null): string {
  const map: Record<string, string> = {
    'Software': 'Kantoor',
    'Office Supplies': 'Kantoor',
    'Services': 'Inkoop',
    'Marketing': 'Overig',
    'Travel': 'Reiskosten',
    'Meals': 'Overig',
    'Utilities': 'Overig',
    'Other': 'Overig',
  }
  if (!category) return 'Overig'
  if (['Inkoop', 'Sales', 'Reiskosten', 'Kantoor', 'Overig'].includes(category)) return category
  return map[category] || 'Overig'
}

/**
 * Get exchange rate from currency to EUR
 * 
 * For MVP, uses hardcoded rates. In production, use a real API like:
 * - https://exchangerate-api.com
 * - https://fixer.io
 * - European Central Bank API
 */
async function getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
  // Hardcoded rates for common currencies (as of Jan 2026)
  // In production, fetch from API
  const rates: Record<string, number> = {
    'USD': 0.92,  // 1 USD = 0.92 EUR
    'GBP': 1.17,  // 1 GBP = 1.17 EUR
    'CHF': 1.05,  // 1 CHF = 1.05 EUR
    'SGD': 0.68,  // 1 SGD = 0.68 EUR
    'CAD': 0.65,  // 1 CAD = 0.65 EUR
    'AUD': 0.58,  // 1 AUD = 0.58 EUR
  }

  if (fromCurrency === toCurrency) {
    return 1
  }

  const rate = rates[fromCurrency]
  if (!rate) {
    console.warn(`No exchange rate found for ${fromCurrency}, using 1:1`)
    return 1
  }

  return rate
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

  // Skip VAT validation for reverse charge
  if (data.vatTreatment !== 'foreign_service_reverse_charge') {
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
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}
