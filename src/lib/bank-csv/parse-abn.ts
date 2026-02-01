import { type ParsedBankRow, parseCommaDecimal, formatDate8 } from './types'

/**
 * Parse ABN AMRO TAB format
 *
 * Tab-delimited, NO header row, 8 columns:
 * 0: Rekeningnummer (own account)
 * 1: Munt (EUR)
 * 2: Transactiedatum (YYYYMMDD)
 * 3: Beginsaldo
 * 4: Eindsaldo
 * 5: Rentedatum (YYYYMMDD)
 * 6: Bedrag (signed, comma decimal)
 * 7: Omschrijving (contains /TRTP/, /NAME/, /REMI/ etc. tags)
 */
export function parseABN(content: string): ParsedBankRow[] {
  const lines = content.split('\n').filter(l => l.trim())
  const rows: ParsedBankRow[] = []

  for (const line of lines) {
    const cols = line.split('\t')
    if (cols.length < 7) continue

    const datum = formatDate8(cols[2])
    const bedrag = parseCommaDecimal(cols[6])
    const rawDesc = cols[7]?.trim() || ''

    // Parse ABN AMRO structured description tags
    const naam = extractTag(rawDesc, '/NAME/') || ''
    const remi = extractTag(rawDesc, '/REMI/') || ''
    const trtp = extractTag(rawDesc, '/TRTP/') || ''
    const tegenrekening = extractTag(rawDesc, '/IBAN/') || undefined

    const descParts = [naam, remi || trtp].filter(Boolean)
    const omschrijving = descParts.length > 0 ? descParts.join(' - ') : rawDesc

    rows.push({ datum, omschrijving, bedrag, tegenrekening, naam })
  }

  return rows
}

/**
 * Extract a value from ABN AMRO structured description
 * Format: /TAG/value/NEXTTAG/...
 */
function extractTag(desc: string, tag: string): string | null {
  const idx = desc.indexOf(tag)
  if (idx === -1) return null
  const start = idx + tag.length
  const nextSlash = desc.indexOf('/', start)
  if (nextSlash === -1) return desc.slice(start).trim()
  return desc.slice(start, nextSlash).trim()
}
