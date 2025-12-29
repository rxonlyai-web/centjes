'use server'

import { createClient } from '@/utils/supabase/server'

/**
 * Dutch VAT Summary for quarterly reporting
 * 
 * This calculates VAT amounts according to Dutch tax rules for a one-man business.
 * All amounts in the database are stored INCLUDING VAT.
 */

export interface VATSummary {
  omzet_21: number        // Revenue at 21% VAT rate (excluding VAT)
  btw_21: number          // VAT amount at 21% rate
  omzet_9: number         // Revenue at 9% VAT rate (excluding VAT)
  btw_9: number           // VAT amount at 9% rate
  
  // Rubric 4a - Services from non-EU countries (reverse charge)
  rubric_4a_turnover: number
  rubric_4a_vat: number
  
  // Rubric 4b - Services from EU countries (reverse charge)
  rubric_4b_turnover: number
  rubric_4b_vat: number
  
  // Transactions with UNKNOWN eu_location (requires manual review)
  incomplete_reverse_charge_count: number
  
  voorbelasting: number   // Domestic deductible VAT only (rubric 5b) - reverse-charge deduction is separate
  netto_btw: number       // Net VAT (positive = to pay, negative = refund)
  transaction_count: number
}

interface Transaction {
  datum: string
  bedrag: number
  type_transactie: 'INKOMSTEN' | 'UITGAVEN'
  btw_tarief: number
  vat_treatment?: 'domestic' | 'foreign_service_reverse_charge'
  eu_location?: 'EU' | 'NON_EU' | 'UNKNOWN' | null
}

/**
 * Calculate the date range for a specific quarter
 */
function getQuarterDateRange(year: number, quarter: 1 | 2 | 3 | 4): { start: string; end: string } {
  const quarterMonths = {
    1: { start: 0, end: 2 },   // Q1: Jan-Mar
    2: { start: 3, end: 5 },   // Q2: Apr-Jun
    3: { start: 6, end: 8 },   // Q3: Jul-Sep
    4: { start: 9, end: 11 },  // Q4: Oct-Dec
  }

  const { start: startMonth, end: endMonth } = quarterMonths[quarter]
  
  // Start date: first day of first month
  const startDate = new Date(year, startMonth, 1)
  
  // End date: last day of last month
  const endDate = new Date(year, endMonth + 1, 0, 23, 59, 59, 999)

  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  }
}

/**
 * Calculate VAT amounts from a transaction amount that INCLUDES VAT
 * 
 * Dutch VAT calculation:
 * - Amount stored in DB includes VAT
 * - To get amount excluding VAT: amount / (1 + vat_rate/100)
 * - VAT amount = amount_incl - amount_excl
 */
function calculateVAT(amountIncludingVAT: number, vatRate: number): { amountExcl: number; vatAmount: number } {
  if (vatRate === 0) {
    return { amountExcl: amountIncludingVAT, vatAmount: 0 }
  }

  // Calculate divisor (1.21 for 21%, 1.09 for 9%)
  const divisor = 1 + (vatRate / 100)
  
  // Amount excluding VAT
  const amountExcl = amountIncludingVAT / divisor
  
  // VAT amount
  const vatAmount = amountIncludingVAT - amountExcl

  return { amountExcl, vatAmount }
}

/**
 * Get VAT summary for a specific year and quarter
 */
export async function getVATSummary(year: number, quarter: 1 | 2 | 3 | 4): Promise<VATSummary> {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      omzet_21: 0,
      btw_21: 0,
      omzet_9: 0,
      btw_9: 0,
      rubric_4a_turnover: 0,
      rubric_4a_vat: 0,
      rubric_4b_turnover: 0,
      rubric_4b_vat: 0,
      incomplete_reverse_charge_count: 0,
      voorbelasting: 0,
      netto_btw: 0,
      transaction_count: 0,
    }
  }

  // Get date range for the quarter
  const { start, end } = getQuarterDateRange(year, quarter)

  // Fetch all transactions for this user in the date range
  const { data: transactions, error } = await supabase
    .from('transacties')
    .select('datum, bedrag, type_transactie, btw_tarief, vat_treatment, eu_location')
    .eq('gebruiker_id', user.id)
    .gte('datum', start)
    .lte('datum', end)

  if (error) {
    console.error('Error fetching transactions for VAT summary:', error)
    return {
      omzet_21: 0,
      btw_21: 0,
      omzet_9: 0,
      btw_9: 0,
      rubric_4a_turnover: 0,
      rubric_4a_vat: 0,
      rubric_4b_turnover: 0,
      rubric_4b_vat: 0,
      incomplete_reverse_charge_count: 0,
      voorbelasting: 0,
      netto_btw: 0,
      transaction_count: 0,
    }
  }

  // Initialize summary
  let omzet_21 = 0
  let btw_21 = 0
  let omzet_9 = 0
  let btw_9 = 0
  let rubric_4a_turnover = 0
  let rubric_4a_vat = 0
  let rubric_4b_turnover = 0
  let rubric_4b_vat = 0
  let incomplete_reverse_charge_count = 0
  let voorbelasting = 0

  // Process each transaction
  for (const transaction of (transactions as Transaction[])) {
    const { bedrag, type_transactie, btw_tarief, vat_treatment, eu_location } = transaction

    if (type_transactie === 'INKOMSTEN') {
      // Income: calculate revenue and VAT collected
      if (btw_tarief === 21) {
        const { amountExcl, vatAmount } = calculateVAT(bedrag, 21)
        omzet_21 += amountExcl
        btw_21 += vatAmount
      } else if (btw_tarief === 9) {
        const { amountExcl, vatAmount } = calculateVAT(bedrag, 9)
        omzet_9 += amountExcl
        btw_9 += vatAmount
      }
      // btw_tarief === 0: no VAT applicable, ignore in VAT calculation
    } else if (type_transactie === 'UITGAVEN') {
      // Expenses: calculate deductible VAT (voorbelasting)
      
      if (vat_treatment === 'foreign_service_reverse_charge') {
        // Reverse charge: Split by EU location for proper rubric assignment
        const base = bedrag
        const vat = base * 0.21
        
        if (eu_location === 'NON_EU') {
          // Rubric 4a - Services from non-EU countries
          rubric_4a_turnover += base
          rubric_4a_vat += vat
        } else if (eu_location === 'EU') {
          // Rubric 4b - Services from EU countries
          rubric_4b_turnover += base
          rubric_4b_vat += vat
        } else {
          // UNKNOWN or null - flag for manual review
          incomplete_reverse_charge_count++
          // Still calculate VAT but don't assign to rubric
          // This will be visible in the UI as incomplete
        }
        
        // IMPORTANT: Reverse-charged VAT is NOT added to standard voorbelasting (rubric 5b)
        // It's handled separately in rubrics 4a/4b
        
      } else if (btw_tarief === 21 || btw_tarief === 9) {
        // Domestic standard/reduced rate - this goes to rubric 5b
        const { vatAmount } = calculateVAT(bedrag, btw_tarief)
        voorbelasting += vatAmount
      }
      // btw_tarief === 0: no VAT applicable, ignore in VAT calculation
    }
  }

  // Calculate net VAT according to Dutch tax form structure:
  // 
  // Rubric 5a: Verschuldigde btw (Total VAT owed)
  //   = Domestic VAT (21% + 9%) + Reverse-charge VAT (4a + 4b)
  // 
  // Rubric 5b: Voorbelasting (Domestic deductible VAT ONLY)
  //   = Domestic input VAT (does NOT include reverse-charge)
  // 
  // Net VAT = 5a - 5b
  //         = (btw_21 + btw_9 + reverse_charge) - voorbelasting
  // 
  // NOTE: Reverse-charge VAT is OWED (in 5a) but NOT automatically deductible.
  // It can be deducted separately, but that's handled elsewhere in the tax form.
  
  const total_reverse_charge_vat = rubric_4a_vat + rubric_4b_vat
  const netto_btw = (btw_21 + btw_9 + total_reverse_charge_vat) - voorbelasting

  return {
    omzet_21: Math.round(omzet_21 * 100) / 100,
    btw_21: Math.round(btw_21 * 100) / 100,
    omzet_9: Math.round(omzet_9 * 100) / 100,
    btw_9: Math.round(btw_9 * 100) / 100,
    rubric_4a_turnover: Math.round(rubric_4a_turnover * 100) / 100,
    rubric_4a_vat: Math.round(rubric_4a_vat * 100) / 100,
    rubric_4b_turnover: Math.round(rubric_4b_turnover * 100) / 100,
    rubric_4b_vat: Math.round(rubric_4b_vat * 100) / 100,
    incomplete_reverse_charge_count,
    voorbelasting: Math.round(voorbelasting * 100) / 100,  // Domestic input VAT only (rubric 5b)
    netto_btw: Math.round(netto_btw * 100) / 100,
    transaction_count: transactions?.length || 0,
  }
}
