import { type BankFormat, type ParsedBankRow } from './types'
import { detectBankFormat } from './detect'
import { parseING } from './parse-ing'
import { parseRabobank } from './parse-rabobank'
import { parseABN } from './parse-abn'
import { parseBunq } from './parse-bunq'

export type { BankFormat, ParsedBankRow, CategorizedTransaction } from './types'

export interface ParseResult {
  bank: BankFormat
  transactions: ParsedBankRow[]
}

/**
 * Parse a bank statement file. Auto-detects format and encoding.
 */
export function parseBankFile(buffer: ArrayBuffer): ParseResult {
  // Try ISO-8859-1 first (ING, Rabobank, ABN AMRO), then UTF-8 (Bunq)
  let content = new TextDecoder('iso-8859-1').decode(buffer)
  let bank = detectBankFormat(content)

  if (!bank) {
    content = new TextDecoder('utf-8').decode(buffer)
    bank = detectBankFormat(content)
  }

  if (!bank) {
    throw new Error('Bankformaat niet herkend. Ondersteunde banken: ING, Rabobank, ABN AMRO, Bunq')
  }

  // For Bunq, re-decode as UTF-8 if we used ISO-8859-1 initially
  if (bank === 'BUNQ') {
    content = new TextDecoder('utf-8').decode(buffer)
  }

  let transactions: ParsedBankRow[]
  switch (bank) {
    case 'ING':
      transactions = parseING(content)
      break
    case 'RABOBANK':
      transactions = parseRabobank(content)
      break
    case 'ABN_AMRO':
      transactions = parseABN(content)
      break
    case 'BUNQ':
      transactions = parseBunq(content)
      break
  }

  if (transactions.length === 0) {
    throw new Error('Geen transacties gevonden in dit bestand')
  }

  return { bank, transactions }
}
