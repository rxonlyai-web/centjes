'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { User, Users, Check } from 'lucide-react'
import StepIndicator from '@/components/onboarding/StepIndicator'
import { completeOnboarding, createInviteLink } from './actions'
import styles from './page.module.css'

type BusinessType = 'zzp' | 'vof'

// Step definitions:
// 0: Welcome
// 1: Business type (ZZP/VOF)
// 2: Company name (required)
// 3: Business details (KVK, BTW, IBAN)
// 4: Address (street, postal, city)
// 5: Invite partner (VOF only)
// 6: Done

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [businessType, setBusinessType] = useState<BusinessType | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [kvkNumber, setKvkNumber] = useState('')
  const [btwNumber, setBtwNumber] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [orgId, setOrgId] = useState('')

  // Swipe handling
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  // VOF has 7 steps (0-6), ZZP has 6 steps (0-5, skips invite)
  const totalSteps = businessType === 'vof' ? 7 : 6

  // Which step number is the "done" step
  const doneStep = businessType === 'vof' ? 6 : 5
  // Which step number is the invite step (VOF only)
  const inviteStep = 5

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    // Only swipe if horizontal movement > 50px and greater than vertical
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && canGoNext()) {
        handleNext()
      } else if (dx > 0 && step > 0) {
        handleBack()
      }
    }
    touchStart.current = null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, businessType, companyName])

  function canGoNext() {
    if (step === 0) return true
    if (step === 1) return businessType !== null
    if (step === 2) return companyName.trim().length > 0
    if (step === 3) return true // Business details optional
    if (step === 4) return true // Address optional
    return true
  }

  function handleBack() {
    if (step > 0) {
      setStep(s => s - 1)
    }
  }

  async function handleNext() {
    setError('')

    // Step 4 (Address) is where we save everything
    if (step === 4 && canGoNext()) {
      setSaving(true)
      try {
        const result = await completeOnboarding({
          businessType: businessType!,
          companyName: companyName.trim(),
          kvkNumber: kvkNumber.trim() || undefined,
          btwNumber: btwNumber.trim() || undefined,
          bankAccount: bankAccount.trim() || undefined,
          addressLine1: addressLine1.trim() || undefined,
          postalCode: postalCode.trim() || undefined,
          city: city.trim() || undefined,
        })

        // Store the org ID for invite generation
        setOrgId(result.organizationId)

        if (businessType === 'vof') {
          setStep(inviteStep) // Go to invite step
        } else {
          setStep(doneStep) // Go to done step (ZZP skips invite)
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Er is iets misgegaan'
        setError(message)
      } finally {
        setSaving(false)
      }
      return
    }

    setStep(s => s + 1)
  }

  function handleBusinessTypeSelect(type: BusinessType) {
    setBusinessType(type)
    setStep(2) // Auto-advance to company name
  }

  async function handleGenerateInvite() {
    try {
      // createInviteLink will use orgId if provided, or look up user's org
      const url = await createInviteLink(orgId || undefined)
      setInviteUrl(url)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Kon link niet aanmaken'
      setError(message)
    }
  }

  function handleWhatsAppShare() {
    const message = `Hoi! Ik gebruik Centjes voor onze boekhouding. Doe je mee?\n\n${inviteUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const input = document.createElement('input')
      input.value = inviteUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleFinish() {
    router.push('/dashboard')
  }

  return (
    <div
      className={styles.container}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <StepIndicator totalSteps={totalSteps} currentStep={step} />

      <div className={styles.content}>
        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className={styles.step}>
            <div className={styles.welcomeContent}>
              <h1 className={styles.welcomeTitle}>Welkom bij Centjes</h1>
              <p className={styles.welcomeText}>
                In een paar stappen zetten we alles klaar.
              </p>
            </div>
            <div className={styles.bottomAction}>
              <button onClick={handleNext} className={styles.primaryBtn}>
                Aan de slag
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Business Type */}
        {step === 1 && (
          <div className={styles.step}>
            <h2 className={styles.stepTitle}>Wat voor bedrijf heb je?</h2>
            <div className={styles.typeCards}>
              <button
                className={`${styles.typeCard} ${businessType === 'zzp' ? styles.typeCardSelected : ''}`}
                onClick={() => handleBusinessTypeSelect('zzp')}
              >
                <User size={32} />
                <span className={styles.typeCardTitle}>ZZP / Eenmanszaak</span>
                <span className={styles.typeCardDesc}>Je werkt alleen</span>
              </button>
              <button
                className={`${styles.typeCard} ${businessType === 'vof' ? styles.typeCardSelected : ''}`}
                onClick={() => handleBusinessTypeSelect('vof')}
              >
                <Users size={32} />
                <span className={styles.typeCardTitle}>VOF</span>
                <span className={styles.typeCardDesc}>Je werkt samen met een vennoot</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Company Name */}
        {step === 2 && (
          <div className={styles.step}>
            <h2 className={styles.stepTitle}>Hoe heet je bedrijf?</h2>
            <p className={styles.stepHelper}>Dit verschijnt op je facturen</p>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Bedrijfsnaam *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={styles.input}
                  placeholder="Bijv. Jansen Consultancy"
                  autoComplete="organization"
                  autoFocus
                />
              </div>
            </div>

            <div className={styles.bottomAction}>
              <button
                onClick={handleNext}
                className={styles.primaryBtn}
                disabled={!canGoNext()}
              >
                Volgende
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Business Details (KVK, BTW, IBAN) */}
        {step === 3 && (
          <div className={styles.step}>
            <h2 className={styles.stepTitle}>Zakelijke gegevens</h2>
            <p className={styles.stepHelper}>Optioneel — je kunt dit later aanvullen</p>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>KVK-nummer</label>
                <input
                  type="text"
                  value={kvkNumber}
                  onChange={(e) => setKvkNumber(e.target.value)}
                  className={styles.input}
                  placeholder="12345678"
                  inputMode="numeric"
                  autoComplete="off"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>BTW-nummer</label>
                <input
                  type="text"
                  value={btwNumber}
                  onChange={(e) => setBtwNumber(e.target.value)}
                  className={styles.input}
                  placeholder="NL123456789B01"
                  autoComplete="off"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>IBAN</label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  className={styles.input}
                  placeholder="NL00 BANK 0000 0000 00"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className={styles.bottomAction}>
              <button
                onClick={handleNext}
                className={styles.primaryBtn}
              >
                Volgende
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Address */}
        {step === 4 && (
          <div className={styles.step}>
            <h2 className={styles.stepTitle}>Vestigingsadres</h2>
            <p className={styles.stepHelper}>Optioneel — voor je facturen</p>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Adres</label>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  className={styles.input}
                  placeholder="Straatnaam 123"
                  autoComplete="street-address"
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Postcode</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className={styles.input}
                    placeholder="1234 AB"
                    autoComplete="postal-code"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Plaats</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className={styles.input}
                    placeholder="Amsterdam"
                    autoComplete="address-level2"
                  />
                </div>
              </div>
            </div>

            <div className={styles.bottomAction}>
              <button
                onClick={handleNext}
                className={styles.primaryBtn}
                disabled={saving}
              >
                {saving ? 'Opslaan...' : 'Volgende'}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Invite Partner (VOF only) */}
        {step === inviteStep && businessType === 'vof' && (
          <div className={styles.step}>
            <h2 className={styles.stepTitle}>Nodig je vennoot uit</h2>

            {error && <div className={styles.error}>{error}</div>}

            {!inviteUrl ? (
              <div className={styles.inviteGenerate}>
                <p className={styles.stepHelper}>
                  Genereer een uitnodigingslink om je vennoot toe te voegen aan jullie administratie.
                </p>
                <button onClick={handleGenerateInvite} className={styles.primaryBtn}>
                  Link genereren
                </button>
              </div>
            ) : (
              <div className={styles.inviteActions}>
                <button onClick={handleWhatsAppShare} className={styles.whatsappBtn}>
                  Deel via WhatsApp
                </button>
                <button onClick={handleCopyLink} className={styles.secondaryBtn}>
                  {copied ? 'Gekopieerd!' : 'Kopieer link'}
                </button>
              </div>
            )}

            <div className={styles.bottomAction}>
              <button onClick={() => setStep(doneStep)} className={styles.textBtn}>
                Later doen
              </button>
            </div>
          </div>
        )}

        {/* Done Step */}
        {step === doneStep && (
          <div className={styles.step}>
            <div className={styles.doneContent}>
              <div className={styles.checkmark}>
                <Check size={48} />
              </div>
              <h2 className={styles.doneTitle}>Je bent klaar!</h2>
            </div>
            <div className={styles.bottomAction}>
              <button onClick={handleFinish} className={styles.primaryBtn}>
                Naar het dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
