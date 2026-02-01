import { type ParsedBankRow, splitLine, parseCommaDecimal, formatDate8 } from './types'

/**
 * Parse ING CSV format
 *
 * Columns (semicolon-delimited, all quoted):
 * 0: Datum (YYYYMMDD)
 * 1: Naam / Omschrijving
 * 2: Rekening (own IBAN)
 * 3: Tegenrekening (counterparty IBAN)
 * 4: Code
 * 5: Af Bij ("Af" = debit, "Bij" = credit)
 * 6: Bedrag (EUR) - always positive, comma decimal
 * 7: Mutatiesoort
 * 8: Mededelingen
 * 9: Saldo na mutatie
 * 10: Tag
 */
export function parseING(content: string): ParsedBankRow[] {
  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  // Skip header
  const rows: ParsedBankRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i], ';')
    if (cols.length < 7) continue

    const datum = formatDate8(cols[0])
    const naam = cols[1]?.trim() || ''
    const tegenrekening = cols[3]?.trim() || undefined
    const afBij = cols[5]?.trim().toLowerCase()
    const bedragAbs = parseCommaDecimal(cols[6])
    const mededelingen = cols[8]?.trim() || ''

    const bedrag = afBij === 'af' ? -bedragAbs : bedragAbs
    const omschrijving = mededelingen ? `${naam} - ${mededelingen}` : naam

    rows.push({ datum, omschrijving, bedrag, tegenrekening, naam })
  }

  return rows
}
