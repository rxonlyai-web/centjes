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
  foreign_services_base: number // Base amount for foreign services (reverse charge)
  foreign_services_vat: number  // VAT amount for foreign services (21%)
  voorbelasting: number   // Deductible VAT on business expenses
  netto_btw: number       // Net VAT (positive = to pay, negative = refund)
  transaction_count: number
}

interface Transaction {
  datum: string
  bedrag: number
  type_transactie: 'INKOMSTEN' | 'UITGAVEN'
  btw_tarief: number
  vat_treatment?: 'domestic' | 'foreign_service_reverse_charge'
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
      foreign_services_base: 0,
      foreign_services_vat: 0,
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
    .select('datum, bedrag, type_transactie, btw_tarief, vat_treatment')
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
      foreign_services_base: 0,
      foreign_services_vat: 0,
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
  let foreign_services_base = 0
  let foreign_services_vat = 0
  let voorbelasting = 0

  // Process each transaction
  for (const transaction of (transactions as Transaction[])) {
    const { bedrag, type_transactie, btw_tarief, vat_treatment } = transaction

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
        // Reverse charge: 
        // 1. Amount is net base
        // 2. Calculate 21% VAT
        // 3. Add to foreign_services_vat (owed) AND voorbelasting (deductible)
        const base = bedrag
        const vat = base * 0.21
        
        foreign_services_base += base
        foreign_services_vat += vat
        voorbelasting += vat
      } else if (btw_tarief === 21 || btw_tarief === 9) {
        // Domestic standard/reduced rate
        const { vatAmount } = calculateVAT(bedrag, btw_tarief)
        voorbelasting += vatAmount
      }
      // btw_tarief === 0: no VAT applicable, ignore in VAT calculation
    }
  }

  // Calculate net VAT
  // Positive = VAT to pay to Belastingdienst
  // Negative = VAT refund to claim
  // Netto = (Domestic VAT Owed + Foreign VAT Owed) - Input VAT
  const netto_btw = (btw_21 + btw_9 + foreign_services_vat) - voorbelasting

  return {
    omzet_21: Math.round(omzet_21 * 100) / 100,
    btw_21: Math.round(btw_21 * 100) / 100,
    omzet_9: Math.round(omzet_9 * 100) / 100,
    btw_9: Math.round(btw_9 * 100) / 100,
    foreign_services_base: Math.round(foreign_services_base * 100) / 100,
    foreign_services_vat: Math.round(foreign_services_vat * 100) / 100,
    voorbelasting: Math.round(voorbelasting * 100) / 100,
    netto_btw: Math.round(netto_btw * 100) / 100,
    transaction_count: transactions?.length || 0,
  }
}
