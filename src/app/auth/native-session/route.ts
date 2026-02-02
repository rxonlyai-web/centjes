import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const refreshToken = searchParams.get('refresh_token')

  if (!refreshToken) {
    return NextResponse.redirect(`${origin}/login?error=Missing session token`)
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  })

  if (error) {
    console.error('[NativeSession] Failed to restore session:', error)
    return NextResponse.redirect(`${origin}/login?error=Session restore failed`)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
