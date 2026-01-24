'use server'

/**
 * Server Actions for Tax Deadlines (Belastingen)
 * 
 * Handles Dutch tax deadlines:
 * - Inkomstenbelasting (annual, May 1st for previous year)
 * - BTW-aangifte (quarterly)
 */

import { createClient } from '@/utils/supabase/server'

export interface TaxDeadline {
  id: string
  deadline_type: 'inkomstenbelasting' | 'btw_q1' | 'btw_q2' | 'btw_q3' | 'btw_q4'
  tax_year: number
  deadline_date: string
  acknowledged: boolean
  acknowledged_at: string | null
  status: 'upcoming' | 'overdue' | 'acknowledged'
  days_until: number
  display_name: string
}

/**
 * Get tax deadlines for a specific year
 * Auto-generates deadlines if they don't exist
 */
export async function getTaxDeadlines(year: number): Promise<TaxDeadline[]> {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  // Check if deadlines exist for this year
  const { data: existing, error: fetchError } = await supabase
    .from('tax_deadlines')
    .select('*')
    .eq('user_id', user.id)
    .eq('tax_year', year)

  if (fetchError) {
    console.error('Error fetching tax deadlines:', fetchError)
    throw new Error('Failed to fetch tax deadlines')
  }

  // If no deadlines exist, generate them
  if (!existing || existing.length === 0) {
    await generateDeadlines(year, user.id)
    
    // Fetch the newly created deadlines
    const { data: newDeadlines, error: newFetchError } = await supabase
      .from('tax_deadlines')
      .select('*')
      .eq('user_id', user.id)
      .eq('tax_year', year)

    if (newFetchError || !newDeadlines) {
      throw new Error('Failed to fetch generated deadlines')
    }

    return processDeadlines(newDeadlines)
  }

  return processDeadlines(existing)
}

/**
 * Generate standard Dutch tax deadlines for a given year
 */
async function generateDeadlines(year: number, userId: string) {
  const supabase = await createClient()

  const deadlines = [
    {
      user_id: userId,
      deadline_type: 'inkomstenbelasting',
      tax_year: year - 1, // IB for previous year
      deadline_date: `${year}-05-01`, // May 1st
    },
    {
      user_id: userId,
      deadline_type: 'btw_q1',
      tax_year: year,
      deadline_date: `${year}-04-30`, // Q1 (Jan-Mar) due April 30
    },
    {
      user_id: userId,
      deadline_type: 'btw_q2',
      tax_year: year,
      deadline_date: `${year}-07-31`, // Q2 (Apr-Jun) due July 31
    },
    {
      user_id: userId,
      deadline_type: 'btw_q3',
      tax_year: year,
      deadline_date: `${year}-10-31`, // Q3 (Jul-Sep) due October 31
    },
    {
      user_id: userId,
      deadline_type: 'btw_q4',
      tax_year: year,
      deadline_date: `${year + 1}-01-31`, // Q4 (Oct-Dec) due January 31 next year
    },
  ]

  const { error } = await supabase
    .from('tax_deadlines')
    .insert(deadlines)

  if (error) {
    console.error('Error generating deadlines:', error)
    throw new Error('Failed to generate tax deadlines')
  }
}

/**
 * Database record type for tax deadlines
 */
interface DeadlineRecord {
  id: string
  user_id: string
  deadline_type: 'inkomstenbelasting' | 'btw_q1' | 'btw_q2' | 'btw_q3' | 'btw_q4'
  tax_year: number
  deadline_date: string
  acknowledged: boolean
  acknowledged_at: string | null
  created_at: string
}

/**
 * Process deadlines to add status and display information
 */
function processDeadlines(deadlines: DeadlineRecord[]): TaxDeadline[] {
  const now = new Date()
  now.setHours(0, 0, 0, 0) // Start of today

  return deadlines.map(deadline => {
    const deadlineDate = new Date(deadline.deadline_date)
    deadlineDate.setHours(0, 0, 0, 0)
    
    const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    let status: 'upcoming' | 'overdue' | 'acknowledged'
    if (deadline.acknowledged) {
      status = 'acknowledged'
    } else if (daysUntil < 0) {
      status = 'overdue'
    } else {
      status = 'upcoming'
    }

    // Generate display name
    let displayName = ''
    if (deadline.deadline_type === 'inkomstenbelasting') {
      displayName = `Inkomstenbelasting ${deadline.tax_year}`
    } else {
      const quarter = deadline.deadline_type.replace('btw_q', 'Q')
      displayName = `BTW-aangifte ${quarter} ${deadline.tax_year}`
    }

    return {
      id: deadline.id,
      deadline_type: deadline.deadline_type,
      tax_year: deadline.tax_year,
      deadline_date: deadline.deadline_date,
      acknowledged: deadline.acknowledged,
      acknowledged_at: deadline.acknowledged_at,
      status,
      days_until: daysUntil,
      display_name: displayName,
    }
  }).sort((a, b) => {
    // Sort by deadline date
    return new Date(a.deadline_date).getTime() - new Date(b.deadline_date).getTime()
  })
}

/**
 * Mark a deadline as acknowledged
 */
export async function acknowledgeDeadline(deadlineId: string): Promise<void> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  const { error } = await supabase
    .from('tax_deadlines')
    .update({
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', deadlineId)
    .eq('user_id', user.id) // Ensure user can only update their own deadlines

  if (error) {
    console.error('Error acknowledging deadline:', error)
    throw new Error('Failed to acknowledge deadline')
  }
}

/**
 * Get count of unacknowledged upcoming deadlines (within next 30 days)
 * Used for sidebar badge
 */
export async function getUnacknowledgedCount(): Promise<number> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return 0 // Return 0 if not authenticated
  }

  const now = new Date()
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(now.getDate() + 30)

  const { data, error } = await supabase
    .from('tax_deadlines')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('acknowledged', false)
    .gte('deadline_date', now.toISOString().split('T')[0])
    .lte('deadline_date', thirtyDaysFromNow.toISOString().split('T')[0])

  if (error) {
    console.error('Error fetching unacknowledged count:', error)
    return 0
  }

  return data?.length || 0
}
