'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { getInviteInfo, acceptInvite, type InviteInfo } from './actions'
import styles from './page.module.css'

export default function InvitePage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string
  const supabase = createClient()

  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setIsLoggedIn(!!user)

      const inviteInfo = await getInviteInfo(token)
      setInfo(inviteInfo)
      setLoading(false)
    }
    load()
  }, [token])

  async function handleAccept() {
    setAccepting(true)
    setError('')
    const result = await acceptInvite(token)
    if (result.success) {
      router.push('/dashboard')
    } else {
      setError(result.error || 'Er is iets misgegaan')
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <p className={styles.loadingText}>Laden...</p>
        </div>
      </div>
    )
  }

  if (!info?.valid) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Uitnodiging ongeldig</h1>
          <p className={styles.subtitle}>
            {info?.expired
              ? 'Deze uitnodiging is verlopen. Vraag een nieuwe link aan je vennoot.'
              : info?.alreadyAccepted
              ? 'Deze uitnodiging is al geaccepteerd.'
              : 'Deze uitnodiging bestaat niet of is niet meer geldig.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>{info.orgName}</h1>
        <p className={styles.subtitle}>
          nodigt je uit om samen te werken in Centjes.
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          {isLoggedIn ? (
            <button
              onClick={handleAccept}
              className={styles.primaryBtn}
              disabled={accepting}
            >
              {accepting ? 'Accepteren...' : 'Accepteer uitnodiging'}
            </button>
          ) : (
            <>
              <Link href={`/register?invite=${token}`} className={styles.primaryBtn}>
                Maak een account aan
              </Link>
              <Link href={`/login?redirect=/invite/${token}`} className={styles.secondaryLink}>
                Al een account? Log in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
