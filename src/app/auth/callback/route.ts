import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  console.log('[Callback] Received request to /auth/callback')
  console.log('[Callback] Code:', code ? 'present' : 'missing')
  console.log('[Callback] Origin:', origin)
  console.log('[Callback] Next:', next)

  if (code) {
    const supabase = await createClient()
    console.log('[Callback] Exchanging code for session...')
    
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      console.log('[Callback] Code exchange successful, redirecting to:', `${origin}${next}`)
      return NextResponse.redirect(`${origin}${next}`)
    }
    
    console.error('[Callback] Code exchange error:', error)
  }

  console.error('[Callback] No code or exchange failed, redirecting to error page')
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
