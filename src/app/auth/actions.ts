'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/login?error=Could not authenticate user')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    redirect('/register?error=Could not create user')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

/**
 * Computes the request origin dynamically from headers.
 * Supports Vercel's x-forwarded-host/proto and handles comma-separated values.
 */
async function getRequestOrigin(): Promise<string> {
  const headersList = await headers()
  
  // Prefer x-forwarded-host (Vercel) over host
  const forwardedHost = headersList.get('x-forwarded-host')
  const host = forwardedHost || headersList.get('host')
  
  if (!host) {
    throw new Error('Unable to determine request host')
  }
  
  // Handle comma-separated forwarded hosts (take first)
  const cleanHost = host.split(',')[0].trim()
  
  // Prefer x-forwarded-proto (Vercel) over default
  const forwardedProto = headersList.get('x-forwarded-proto')
  const proto = forwardedProto ? forwardedProto.split(',')[0].trim() : 'http'
  
  return `${proto}://${cleanHost}`
}

export async function signInWithGoogle() {
  const supabase = await createClient()

  const origin = await getRequestOrigin()
  const redirectTo = `${origin}/auth/callback`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
    },
  })

  if (error) {
    redirect('/login?error=Could not authenticate with Google')
  }

  if (data.url) {
    redirect(data.url)
  }

  redirect('/login?error=No redirect URL received from Supabase')
}

/**
 * Returns the Google OAuth URL without performing a redirect.
 * Used by the native app to open OAuth in SFSafariViewController
 * instead of an embedded WebView (which Google blocks).
 */
export async function getGoogleOAuthUrl(): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createClient()

  const origin = await getRequestOrigin()
  const redirectTo = `${origin}/auth/callback?native=true`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  })

  if (error) {
    return { url: null, error: 'Could not authenticate with Google' }
  }

  return { url: data.url, error: null }
}
