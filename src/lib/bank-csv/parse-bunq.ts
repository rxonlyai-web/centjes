import { type ParsedBankRow, splitLine } from './types'

/**
 * Parse Bunq CSV format
 *
 * Comma-delimited, UTF-8, 6 columns:
 * 0: Date (YYYY-MM-DD)
 * 1: Amount (signed, dot decimal)
 * 2: Account (own IBAN)
 * 3: Counterparty (IBAN)
 * 4: Name
 * 5: Description
 */
export function parseBunq(content: string): ParsedBankRow[] {
  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  // Skip header
  const rows: ParsedBankRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i], ',')
    if (cols.length < 5) continue

    const datum = cols[0]?.trim() || ''
    if (!datum) continue

    const bedrag = parseFloat(cols[1]?.trim() || '0') || 0
    const tegenrekening = cols[3]?.trim() || undefined
    const naam = cols[4]?.trim() || ''
    const description = cols[5]?.trim() || ''

    const omschrijving = description ? `${naam} - ${description}` : naam

    rows.push({ datum, omschrijving, bedrag, tegenrekening, naam })
  }

  return rows
}
