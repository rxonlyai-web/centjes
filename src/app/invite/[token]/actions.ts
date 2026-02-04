'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export interface InviteInfo {
  valid: boolean
  orgName?: string
  expired?: boolean
  alreadyAccepted?: boolean
}

export async function getInviteInfo(token: string): Promise<InviteInfo> {
  const supabase = await createClient()

  const { data: invite, error } = await supabase
    .from('organization_invites')
    .select('id, organization_id, status, expires_at, organizations(name)')
    .eq('invite_token', token)
    .single()

  if (error || !invite) {
    return { valid: false }
  }

  if (invite.status === 'accepted') {
    return { valid: false, alreadyAccepted: true }
  }

  if (new Date(invite.expires_at) < new Date()) {
    return { valid: false, expired: true }
  }

  const org = invite.organizations as unknown as { name: string } | null

  return {
    valid: true,
    orgName: org?.name || 'Onbekend bedrijf',
  }
}

export async function acceptInvite(token: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { success: false, error: 'Je moet ingelogd zijn om een uitnodiging te accepteren' }
  }

  // Get invite
  const { data: invite, error: inviteError } = await supabase
    .from('organization_invites')
    .select('id, organization_id, status, expires_at')
    .eq('invite_token', token)
    .single()

  if (inviteError || !invite) {
    return { success: false, error: 'Uitnodiging niet gevonden' }
  }

  if (invite.status === 'accepted') {
    return { success: false, error: 'Deze uitnodiging is al geaccepteerd' }
  }

  if (new Date(invite.expires_at) < new Date()) {
    return { success: false, error: 'Deze uitnodiging is verlopen. Vraag een nieuwe link.' }
  }

  // Add user to organization
  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: invite.organization_id,
      user_id: user.id,
      role: 'member',
    })

  if (memberError) {
    if (memberError.code === '23505') {
      // Already a member
      return { success: true }
    }
    console.error('Error adding member:', memberError)
    return { success: false, error: 'Kon je niet toevoegen aan de organisatie' }
  }

  // Update invite status
  await supabase
    .from('organization_invites')
    .update({ status: 'accepted' })
    .eq('id', invite.id)

  // Set onboarding as completed and update profile
  await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      onboarding_completed: true,
      business_type: 'vof',
    })

  revalidatePath('/dashboard')

  return { success: true }
}
