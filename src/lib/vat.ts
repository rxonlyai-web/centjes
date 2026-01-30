/**
 * Shared VAT calculation utilities for Dutch tax compliance
 *
 * Dutch VAT rules:
 * - Amounts in the database are stored INCLUDING VAT (for domestic)
 * - Reverse charge: amount is already net (excl. VAT)
 * - Standard rates: 21%, 9%, 0%
 */

/**
 * Calculate amount excluding VAT from an amount that includes VAT
 */
export function calculateExclVAT(
  amountInclVAT: number,
  vatRate: number,
  vatTreatment?: string
): number {
  if (vatTreatment === 'foreign_service_reverse_charge') {
    return amountInclVAT
  }
  if (vatRate === 0) return amountInclVAT
  return amountInclVAT / (1 + vatRate / 100)
}

/**
 * Calculate VAT breakdown from an amount that includes VAT
 */
export function calculateVATAmount(
  amountInclVAT: number,
  vatRate: number
): { amountExcl: number; vatAmount: number } {
  if (vatRate === 0) {
    return { amountExcl: amountInclVAT, vatAmount: 0 }
  }
  const divisor = 1 + vatRate / 100
  const amountExcl = amountInclVAT / divisor
  const vatAmount = amountInclVAT - amountExcl
  return { amountExcl, vatAmount }
}
