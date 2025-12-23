'use server'

/**
 * IB (Income Tax) Overview Server Actions
 * 
 * Aggregates annual financial data for income tax reporting including:
 * - Revenue and expense totals (VAT-excluded)
 * - Monthly breakdowns
 * - Category breakdowns
 * - Cost deductibility classification
 */

import { createClient } from '@/utils/supabase/server'

export interface IBSummary {
  totals: {
    omzet: number          // Total revenue (excl. VAT)
    kosten: number         // Total expenses (excl. VAT)
    winst: number          // Profit (omzet - kosten)
  }
  monthly: Array<{
    month: number          // 1-12
    monthName: string      // 'jan', 'feb', etc.
    omzet: number         // Monthly revenue (excl. VAT)
    kosten: number        // Monthly expenses (excl. VAT)
  }>
  categories: {
    revenue: Array<{ category: string; amount: number }>
    expenses: Array<{ category: string; amount: number }>
  }
  classification: {
    fullyDeductible: number        // 100% deductible costs
    limitedDeductible: number      // Total limited deductible costs
    limited80Percent: number       // 80% of limited deductible
    limited20Percent: number       // 20% non-deductible
  }
  debug: {
    transactionCount: number
    revenueCount: number
    expenseCount: number
  }
}

interface Transaction {
  datum: string
  bedrag: number
  type_transactie: 'INKOMSTEN' | 'UITGAVEN'
  btw_tarief: number
  categorie: string
  vat_treatment?: 'domestic' | 'foreign_service_reverse_charge'
}

/**
 * Cost Classification Rules
 * 
 * Fully Deductible (100%):
 * - Kantoor: Office expenses
 * - Reiskosten: Travel expenses
 * - Inkoop: Inventory/purchases
 * - Software: Software and tools
 * - Sales: Sales-related costs
 * - Overig: Other business expenses
 * 
 * Limited Deductible (80%):
 * - Lunch: Business lunches
 * - Maaltijden: Meals
 * - Representatie: Representation/entertainment
 * 
 * To update classification:
 * 1. Modify the arrays below to add/remove categories
 * 2. For different deductibility percentages, add new classification logic
 * 3. Update the classification object structure and CostClassificationTable component
 */
const FULLY_DEDUCTIBLE_CATEGORIES = [
  'Kantoor',
  'Reiskosten',
  'Inkoop',
  'Software',
  'Sales',
  'Overig'
]

const LIMITED_DEDUCTIBLE_CATEGORIES = [
  'Lunch',
  'Maaltijden',
  'Representatie'
]

const LIMITED_DEDUCTIBLE_PERCENTAGE = 0.80  // 80% deductible

/**
 * Calculate amount excluding VAT
 * 
 * Dutch VAT calculation:
 * - Reverse Charge: amount is already net (excl. VAT)
 * - 21% VAT: amount / 1.21
 * - 9% VAT: amount / 1.09
 * - 0% VAT: amount (no VAT applied)
 */
function calculateExclVAT(amountInclVAT: number, vatRate: number, vatTreatment?: string): number {
  if (vatTreatment === 'foreign_service_reverse_charge') {
    return amountInclVAT
  }
  if (vatRate === 0) return amountInclVAT
  if (vatRate === 21) return amountInclVAT / 1.21
  if (vatRate === 9) return amountInclVAT / 1.09
  return amountInclVAT
}

/**
 * Get comprehensive IB summary for a specific year
 */
export async function getIBSummary(year: number): Promise<IBSummary> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      totals: { omzet: 0, kosten: 0, winst: 0 },
      monthly: [],
      categories: { revenue: [], expenses: [] },
      classification: {
        fullyDeductible: 0,
        limitedDeductible: 0,
        limited80Percent: 0,
        limited20Percent: 0
      },
      debug: { transactionCount: 0, revenueCount: 0, expenseCount: 0 }
    }
  }

  // Fetch all transactions for the year
  const startDate = `${year}-01-01T00:00:00`
  const endDate = `${year}-12-31T23:59:59`

  const { data: transactions, error } = await supabase
    .from('transacties')
    .select('datum, bedrag, type_transactie, btw_tarief, categorie, vat_treatment')
    .eq('gebruiker_id', user.id)
    .gte('datum', startDate)
    .lte('datum', endDate)

  if (error || !transactions) {
    console.error('Error fetching IB transactions:', error)
    return {
      totals: { omzet: 0, kosten: 0, winst: 0 },
      monthly: [],
      categories: { revenue: [], expenses: [] },
      classification: {
        fullyDeductible: 0,
        limitedDeductible: 0,
        limited80Percent: 0,
        limited20Percent: 0
      },
      debug: { transactionCount: 0, revenueCount: 0, expenseCount: 0 }
    }
  }

  const typedTransactions = transactions as Transaction[]

  // Initialize aggregation variables
  let totalOmzet = 0
  let totalKosten = 0
  
  // Monthly data (initialize all 12 months)
  const monthNames = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 
                      'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  const monthlyData = monthNames.map((name, index) => ({
    month: index + 1,
    monthName: name,
    omzet: 0,
    kosten: 0
  }))

  // Category maps
  const revenueByCategory = new Map<string, number>()
  const expensesByCategory = new Map<string, number>()

  // Cost classification
  let fullyDeductible = 0
  let limitedDeductible = 0

  // Process each transaction
  for (const transaction of typedTransactions) {
    const amountExcl = calculateExclVAT(transaction.bedrag, transaction.btw_tarief, transaction.vat_treatment)
    const month = new Date(transaction.datum).getMonth() // 0-11

    if (transaction.type_transactie === 'INKOMSTEN') {
      // Revenue
      totalOmzet += amountExcl
      monthlyData[month].omzet += amountExcl
      
      const current = revenueByCategory.get(transaction.categorie) || 0
      revenueByCategory.set(transaction.categorie, current + amountExcl)
      
    } else if (transaction.type_transactie === 'UITGAVEN') {
      // Expenses
      totalKosten += amountExcl
      monthlyData[month].kosten += amountExcl
      
      const current = expensesByCategory.get(transaction.categorie) || 0
      expensesByCategory.set(transaction.categorie, current + amountExcl)
      
      // Cost classification
      if (FULLY_DEDUCTIBLE_CATEGORIES.includes(transaction.categorie)) {
        fullyDeductible += amountExcl
      } else if (LIMITED_DEDUCTIBLE_CATEGORIES.includes(transaction.categorie)) {
        limitedDeductible += amountExcl
      } else {
        // Default to fully deductible for unknown categories
        fullyDeductible += amountExcl
      }
    }
  }

  // Calculate profit
  const winst = totalOmzet - totalKosten

  // Convert category maps to sorted arrays
  const revenueCategories = Array.from(revenueByCategory.entries())
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)

  const expenseCategories = Array.from(expensesByCategory.entries())
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)

  // Calculate limited deductible breakdown
  const limited80Percent = limitedDeductible * LIMITED_DEDUCTIBLE_PERCENTAGE
  const limited20Percent = limitedDeductible * (1 - LIMITED_DEDUCTIBLE_PERCENTAGE)

  // Round all monthly amounts
  monthlyData.forEach(month => {
    month.omzet = Math.round(month.omzet * 100) / 100
    month.kosten = Math.round(month.kosten * 100) / 100
  })

  const revenueCount = typedTransactions.filter(t => t.type_transactie === 'INKOMSTEN').length
  const expenseCount = typedTransactions.filter(t => t.type_transactie === 'UITGAVEN').length

  // Debug logging
  console.log(`[IB Summary ${year}]`, {
    transactionCount: typedTransactions.length,
    revenueCount,
    expenseCount,
    totalRevenue: totalOmzet.toFixed(2),
    totalExpenses: totalKosten.toFixed(2),
    profit: winst.toFixed(2),
    fullyDeductible: fullyDeductible.toFixed(2),
    limitedDeductible: limitedDeductible.toFixed(2)
  })

  return {
    totals: {
      omzet: Math.round(totalOmzet * 100) / 100,
      kosten: Math.round(totalKosten * 100) / 100,
      winst: Math.round(winst * 100) / 100
    },
    monthly: monthlyData,
    categories: {
      revenue: revenueCategories,
      expenses: expenseCategories
    },
    classification: {
      fullyDeductible: Math.round(fullyDeductible * 100) / 100,
      limitedDeductible: Math.round(limitedDeductible * 100) / 100,
      limited80Percent: Math.round(limited80Percent * 100) / 100,
      limited20Percent: Math.round(limited20Percent * 100) / 100
    },
    debug: {
      transactionCount: typedTransactions.length,
      revenueCount,
      expenseCount
    }
  }
}
