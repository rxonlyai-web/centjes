'use client'

import { useEffect } from 'react'
import { isNativeApp } from '@/utils/capacitor'

export default function NativeAppListener() {
  useEffect(() => {
    if (!isNativeApp()) return

    let cleanup: (() => void) | undefined

    async function setup() {
      const { App } = await import('@capacitor/app')
      const { Browser } = await import('@capacitor/browser')

      const listener = await App.addListener('appUrlOpen', async (event) => {
        if (event.url.startsWith('centjes://callback')) {
          await Browser.close()

          const url = new URL(event.url.replace('centjes://', 'https://centjes.eu/'))
          const refreshToken = url.searchParams.get('refresh_token')

          if (refreshToken) {
            window.location.href = `/auth/native-session?refresh_token=${encodeURIComponent(refreshToken)}`
          } else {
            window.location.href = '/dashboard'
          }
        }
      })

      cleanup = () => { listener.remove() }
    }

    setup()

    return () => { cleanup?.() }
  }, [])

  return null
}
