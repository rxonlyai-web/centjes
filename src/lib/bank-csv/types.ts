export type BankFormat = 'ING' | 'RABOBANK' | 'ABN_AMRO' | 'BUNQ'

export interface ParsedBankRow {
  datum: string           // YYYY-MM-DD
  omschrijving: string    // Combined name + description
  bedrag: number          // Signed: positive = income, negative = expense
  tegenrekening?: string  // Counter-party IBAN
  naam?: string           // Counter-party name
}

export interface CategorizedTransaction {
  datum: string
  omschrijving: string
  bedrag: number           // Always positive (absolute value)
  type_transactie: 'INKOMSTEN' | 'UITGAVEN'
  categorie: 'Inkoop' | 'Sales' | 'Reiskosten' | 'Kantoor' | 'Overig'
  btw_tarief: number       // 0, 9, or 21
  vat_treatment: 'domestic'
  isDuplicate: boolean
  aiConfidence: 'high' | 'low'
}

/**
 * Split a CSV/TSV line respecting quoted fields
 */
export function splitLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === delimiter && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

/**
 * Parse Dutch comma-decimal format to number (e.g. "1.234,56" → 1234.56)
 */
export function parseCommaDecimal(s: string): number {
  const cleaned = s.replace(/\./g, '').replace(',', '.').trim()
  return parseFloat(cleaned) || 0
}

/**
 * Format YYYYMMDD to YYYY-MM-DD
 */
export function formatDate8(s: string): string {
  const d = s.trim()
  if (d.length !== 8) return d
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}
