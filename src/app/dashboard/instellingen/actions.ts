'use server'

/**
 * Server Actions for Company Settings
 * Used for invoice generation and company information
 */

import { createClient } from '@/utils/supabase/server'
import { getUserOrganizationId } from '@/lib/org'

export interface CompanySettings {
  id: string
  user_id: string
  company_name: string
  kvk_number: string | null
  btw_number: string | null
  address_line1: string | null
  address_line2: string | null
  postal_code: string | null
  city: string | null
  country: string
  email: string | null
  phone: string | null
  bank_account: string | null
  logo_url: string | null
  created_at: string
  updated_at: string
}

export interface CompanySettingsInput {
  company_name: string
  kvk_number?: string
  btw_number?: string
  address_line1?: string
  address_line2?: string
  postal_code?: string
  city?: string
  country?: string
  email?: string
  phone?: string
  bank_account?: string
  logo_url?: string
}

/**
 * Get company settings for the current user
 */
export async function getCompanySettings(): Promise<CompanySettings | null> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  const orgId = await getUserOrganizationId(supabase)

  let query = supabase
    .from('company_settings')
    .select('*')

  if (orgId) {
    query = query.eq('organization_id', orgId)
  } else {
    query = query.eq('user_id', user.id)
  }

  const { data, error } = await query.single()

  if (error) {
    // If no settings exist yet, return null (not an error)
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('Error fetching company settings:', error)
    throw new Error('Failed to fetch company settings')
  }

  return data
}

/**
 * Check if user has company settings configured
 */
export async function hasCompanySettings(): Promise<boolean> {
  try {
    const settings = await getCompanySettings()
    return settings !== null && !!settings.company_name
  } catch (error) {
    return false
  }
}

/**
 * Update or create company settings
 */
export async function updateCompanySettings(
  input: CompanySettingsInput
): Promise<CompanySettings> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  const orgId = await getUserOrganizationId(supabase)

  // Check if settings already exist
  const existing = await getCompanySettings()

  if (existing) {
    // Update existing settings
    let updateQuery = supabase
      .from('company_settings')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })

    if (orgId) {
      updateQuery = updateQuery.eq('organization_id', orgId)
    } else {
      updateQuery = updateQuery.eq('user_id', user.id)
    }

    const { data, error } = await updateQuery
      .select()
      .single()

    if (error) {
      console.error('Error updating company settings:', error)
      throw new Error('Failed to update company settings')
    }

    return data
  } else {
    // Create new settings
    const { data, error } = await supabase
      .from('company_settings')
      .insert({
        user_id: user.id,
        ...input,
        country: input.country || 'Nederland',
        ...(orgId && { organization_id: orgId }),
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating company settings:', error)
      throw new Error('Failed to create company settings')
    }

    return data
  }
}
