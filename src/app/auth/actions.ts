'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
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

export async function signInWithGoogle() {
  const supabase = await createClient()
  
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const redirectTo = `${origin}/auth/callback`
  
  console.log('[OAuth] Starting Google sign-in flow')
  console.log('[OAuth] Computed redirectTo:', redirectTo)
  console.log('[OAuth] Origin:', origin)
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
    },
  })
  
  console.log('[OAuth] Response data:', data)
  console.log('[OAuth] Response error:', error)
  
  if (error) {
    console.error('[OAuth] Error during sign-in:', error)
    redirect('/login?error=Could not authenticate with Google')
  }
  
  if (data.url) {
    console.log('[OAuth] Redirecting to:', data.url)
    redirect(data.url)
  }
  
  console.warn('[OAuth] No redirect URL received from Supabase')
}
