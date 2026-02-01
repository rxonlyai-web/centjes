import { type ParsedBankRow, splitLine, parseCommaDecimal } from './types'

/**
 * Parse Rabobank CSV format
 *
 * Comma-delimited with quoted fields, 26 columns. Key columns:
 * 0: IBAN/BBAN (own account)
 * 4: Datum (YYYY-MM-DD)
 * 6: Bedrag (signed, comma decimal)
 * 8: Tegenrekening IBAN/BBAN
 * 9: Naam tegenpartij
 * 19: Omschrijving-1
 * 20: Omschrijving-2
 * 21: Omschrijving-3
 */
export function parseRabobank(content: string): ParsedBankRow[] {
  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  // Skip header
  const rows: ParsedBankRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i], ',')
    if (cols.length < 20) continue

    const datum = cols[4]?.trim() || ''
    if (!datum) continue

    const bedrag = parseCommaDecimal(cols[6])
    const tegenrekening = cols[8]?.trim() || undefined
    const naam = cols[9]?.trim() || ''
    const omschrijving1 = cols[19]?.trim() || ''
    const omschrijving2 = cols[20]?.trim() || ''
    const omschrijving3 = cols[21]?.trim() || ''

    const descParts = [naam, omschrijving1, omschrijving2, omschrijving3].filter(Boolean)
    const omschrijving = descParts.join(' - ')

    rows.push({ datum, omschrijving, bedrag, tegenrekening, naam })
  }

  return rows
}
