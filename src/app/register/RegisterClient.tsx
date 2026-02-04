'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { signup, signInWithGoogle } from '../auth/actions'
import styles from '../auth/auth.module.css'

export default function RegisterClient() {
  const [showEmailForm, setShowEmailForm] = useState(false)
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const inviteToken = searchParams.get('invite')

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div>
          <h2 className={styles.title}>
            Registreren
          </h2>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        {!showEmailForm ? (
          // OAuth-first view
          <div className={styles.form}>
            <form>
              <button
                formAction={signInWithGoogle}
                className={styles.oauthButton}
                type="submit"
              >
                <svg className={styles.oauthIcon} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Doorgaan met Google
              </button>
            </form>

            <div className={styles.divider}>
              <span>OF</span>
            </div>

            <button
              onClick={() => setShowEmailForm(true)}
              className={styles.emailButton}
              type="button"
            >
              Doorgaan met e-mail
            </button>

            <Link href="/login" className={styles.link}>
              Al een account? Log in.
            </Link>
          </div>
        ) : (
          // Email/password form view
          <div className={styles.form}>
            <button
              onClick={() => setShowEmailForm(false)}
              className={styles.backButton}
              type="button"
            >
              ← Terug
            </button>

            <form>
              <div className={styles.inputGroup}>
                <label htmlFor="email" style={{ display: 'none' }}>Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={styles.input}
                  placeholder="Emailadres"
                />
                <label htmlFor="password" style={{ display: 'none' }}>Wachtwoord</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className={styles.input}
                  placeholder="Wachtwoord"
                />
              </div>

              <div>
                <button
                  formAction={signup}
                  className={styles.button}
                >
                  Registreren
                </button>
              </div>
            </form>

            <Link href="/login" className={styles.link}>
              Al een account? Log in.
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
