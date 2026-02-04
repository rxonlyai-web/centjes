import { SupabaseClient } from '@supabase/supabase-js'

export interface Organization {
  id: string
  name: string
  business_type: 'zzp' | 'vof'
  created_at: string
  updated_at: string
}

/**
 * Get the organization ID for the current user.
 * Returns null if the user has no organization (not yet onboarded).
 */
export async function getUserOrganizationId(supabase: SupabaseClient): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (error || !data) return null
  return data.organization_id
}

/**
 * Get the full organization object for the current user.
 */
export async function getUserOrganization(supabase: SupabaseClient): Promise<Organization | null> {
  const orgId = await getUserOrganizationId(supabase)
  if (!orgId) return null

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single()

  if (error || !data) return null
  return data as Organization
}

/**
 * Check if the current user has completed onboarding.
 */
export async function isOnboardingCompleted(supabase: SupabaseClient): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()

  if (error || !data) return false
  return data.onboarding_completed === true
}
