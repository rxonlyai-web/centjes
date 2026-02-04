'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

export async function completeOnboarding(data: {
  businessType: 'zzp' | 'vof'
  companyName: string
  kvkNumber?: string
  btwNumber?: string
  bankAccount?: string
  addressLine1?: string
  postalCode?: string
  city?: string
}): Promise<void> {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Niet ingelogd')
  }

  // Create organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: data.companyName,
      business_type: data.businessType,
    })
    .select()
    .single()

  if (orgError || !org) {
    console.error('Error creating organization:', orgError)
    throw new Error('Kon organisatie niet aanmaken')
  }

  // Create owner membership
  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: org.id,
      user_id: user.id,
      role: 'owner',
    })

  if (memberError) {
    console.error('Error creating membership:', memberError)
    throw new Error('Kon lid niet toevoegen')
  }

  // Create company settings
  const { error: settingsError } = await supabase
    .from('company_settings')
    .insert({
      user_id: user.id,
      organization_id: org.id,
      company_name: data.companyName,
      kvk_number: data.kvkNumber || null,
      btw_number: data.btwNumber || null,
      bank_account: data.bankAccount || null,
      address_line1: data.addressLine1 || null,
      postal_code: data.postalCode || null,
      city: data.city || null,
      country: 'Nederland',
    })

  if (settingsError) {
    console.error('Error creating company settings:', settingsError)
    throw new Error('Kon bedrijfsgegevens niet opslaan')
  }

  // Update profile
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      onboarding_completed: true,
      business_type: data.businessType,
    })

  if (profileError) {
    console.error('Error updating profile:', profileError)
    throw new Error('Kon profiel niet bijwerken')
  }

  revalidatePath('/dashboard')
}

export async function createInviteLink(organizationId: string): Promise<string> {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Niet ingelogd')
  }

  const { data: invite, error } = await supabase
    .from('organization_invites')
    .insert({
      organization_id: organizationId,
      invited_by: user.id,
    })
    .select()
    .single()

  if (error || !invite) {
    console.error('Error creating invite:', error)
    throw new Error('Kon uitnodiging niet aanmaken')
  }

  // Build invite URL
  const headersList = await headers()
  const forwardedHost = headersList.get('x-forwarded-host')
  const host = forwardedHost || headersList.get('host') || 'centjes.eu'
  const cleanHost = host.split(',')[0].trim()
  const proto = headersList.get('x-forwarded-proto')?.split(',')[0].trim() || 'https'

  return `${proto}://${cleanHost}/invite/${invite.invite_token}`
}
