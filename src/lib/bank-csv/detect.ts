import { type BankFormat } from './types'

/**
 * Auto-detect bank format from file content
 */
export function detectBankFormat(content: string): BankFormat | null {
  const firstLine = content.split('\n')[0]?.trim() || ''

  // ABN AMRO: no header, tab-delimited, column 3 is 8-digit date, column 2 is currency
  const tabCols = firstLine.split('\t')
  if (tabCols.length >= 7 && /^\d{8}$/.test(tabCols[2]?.trim())) {
    return 'ABN_AMRO'
  }

  // ING: semicolon-delimited header with "Datum"
  if (firstLine.includes('Datum') && firstLine.includes(';')) {
    return 'ING'
  }

  // Bunq: comma-delimited with "Date" and "Counterparty" in header
  if (firstLine.includes('"Date"') && firstLine.includes('"Counterparty"')) {
    return 'BUNQ'
  }

  // Rabobank: header starts with IBAN/BBAN
  if (firstLine.includes('IBAN/BBAN')) {
    return 'RABOBANK'
  }

  return null
}
