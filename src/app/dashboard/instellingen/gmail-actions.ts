'use server'

import { createClient } from '@/utils/supabase/server'

export interface GmailConnection {
  id: string
  gmail_address: string
  connected_at: string
  is_active: boolean
  last_sync_at: string | null
}

/**
 * Get current user's Gmail connection
 */
export async function getGmailConnection(): Promise<GmailConnection | null> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('user_gmail_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    console.error('Error fetching Gmail connection:', error)
    throw new Error('Failed to fetch Gmail connection')
  }

  return data
}

/**
 * Connect Gmail account
 */
export async function connectGmailAccount(email: string): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Not authenticated')
  }

  // Validate email format
  const gmailRegex = /^[A-Za-z0-9._%+-]+@gmail\.com$/
  if (!gmailRegex.test(email)) {
    return { 
      success: false, 
      message: 'Alleen Gmail adressen (@gmail.com) worden ondersteund' 
    }
  }

  // Check if email already in use by another user
  const { data: existing } = await supabase
    .from('user_gmail_connections')
    .select('user_id')
    .eq('gmail_address', email)
    .eq('is_active', true)
    .single()

  if (existing && existing.user_id !== user.id) {
    return { 
      success: false, 
      message: 'Dit Gmail adres is al gekoppeld aan een ander account' 
    }
  }

  // Check if user already has a connection
  const { data: userConnection } = await supabase
    .from('user_gmail_connections')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (userConnection) {
    // Update existing connection
    const { error } = await supabase
      .from('user_gmail_connections')
      .update({
        gmail_address: email,
        is_active: true,
        connected_at: new Date().toISOString()
      })
      .eq('user_id', user.id)

    if (error) {
      console.error('Error updating Gmail connection:', error)
      throw new Error('Failed to update Gmail connection')
    }
  } else {
    // Insert new connection
    const { error } = await supabase
      .from('user_gmail_connections')
      .insert({
        user_id: user.id,
        gmail_address: email,
        is_active: true
      })

    if (error) {
      console.error('Error creating Gmail connection:', error)
      throw new Error('Failed to create Gmail connection')
    }
  }

  return { 
    success: true, 
    message: 'Gmail account succesvol gekoppeld! De admin zal je account binnen 24 uur activeren.' 
  }
}

/**
 * Disconnect Gmail account
 */
export async function disconnectGmailAccount(): Promise<{ success: boolean }> {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase
    .from('user_gmail_connections')
    .update({ is_active: false })
    .eq('user_id', user.id)

  if (error) {
    console.error('Error disconnecting Gmail:', error)
    throw new Error('Failed to disconnect Gmail')
  }

  return { success: true }
}
