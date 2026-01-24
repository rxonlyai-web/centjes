'use client'

/**
 * Company Settings Page (Instellingen)
 * 
 * Allows users to configure their company information for invoices:
 * - Company name, KVK, BTW number
 * - Address details
 * - Contact information
 * - Bank account
 */

import { useState, useEffect } from 'react'
import { Check, Edit2, Save, X } from 'lucide-react'
import { getCompanySettings, updateCompanySettings, type CompanySettingsInput } from './actions'
import styles from './page.module.css'

export default function InstellingenPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  // Store original values for cancel
  const [originalSettings, setOriginalSettings] = useState<CompanySettingsInput>({
    company_name: '',
    kvk_number: '',
    btw_number: '',
    address_line1: '',
    address_line2: '',
    postal_code: '',
    city: '',
    country: 'Nederland',
    email: '',
    phone: '',
    bank_account: '',
  })

  const [settings, setSettings] = useState<CompanySettingsInput>({
    company_name: '',
    kvk_number: '',
    btw_number: '',
    address_line1: '',
    address_line2: '',
    postal_code: '',
    city: '',
    country: 'Nederland',
    email: '',
    phone: '',
    bank_account: '',
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getCompanySettings()
      if (data) {
        setSettings({
          company_name: data.company_name,
          kvk_number: data.kvk_number || '',
          btw_number: data.btw_number || '',
          address_line1: data.address_line1 || '',
          address_line2: data.address_line2 || '',
          postal_code: data.postal_code || '',
          city: data.city || '',
          country: data.country || 'Nederland',
          email: data.email || '',
          phone: data.phone || '',
          bank_account: data.bank_account || '',
        })
        setOriginalSettings({
          company_name: data.company_name,
          kvk_number: data.kvk_number || '',
          btw_number: data.btw_number || '',
          address_line1: data.address_line1 || '',
          address_line2: data.address_line2 || '',
          postal_code: data.postal_code || '',
          city: data.city || '',
          country: data.country || 'Nederland',
          email: data.email || '',
          phone: data.phone || '',
          bank_account: data.bank_account || '',
        })
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
      setError('Kon instellingen niet laden')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setSettings(prev => ({ ...prev, [name]: value }))
  }

  function handleEdit() {
    setIsEditing(true)
    setError(null)
    setSuccess(false)
  }

  function handleCancel() {
    setSettings(originalSettings)
    setIsEditing(false)
    setError(null)
    setSuccess(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      await updateCompanySettings(settings)
      setOriginalSettings(settings)
      setSuccess(true)
      setIsEditing(false)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Er is iets misgegaan')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <p>Laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Bedrijfsinstellingen</h1>
          <p className={styles.subtitle}>
            Deze gegevens worden gebruikt op je facturen
          </p>
        </div>
        
        {!isEditing ? (
          <button onClick={handleEdit} className={styles.editButton} type="button">
            <Edit2 size={20} />
            Bewerken
          </button>
        ) : (
          <div className={styles.headerActions}>
            <button onClick={handleCancel} className={styles.cancelButton} type="button" disabled={saving}>
              <X size={20} />
              Annuleren
            </button>
            <button onClick={handleSave} className={styles.saveButton} type="button" disabled={saving}>
              <Save size={20} />
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        )}
      </header>

      {success && (
        <div className={styles.successMessage}>
          <Check size={20} />
          <span>Instellingen succesvol opgeslagen!</span>
        </div>
      )}

      {error && (
        <div className={styles.error}>
          <p>{error}</p>
        </div>
      )}

      <form className={styles.form}>
        {/* Basic Company Info */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Bedrijfsgegevens</h2>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label htmlFor="company_name" className={styles.label}>
                Bedrijfsnaam <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                id="company_name"
                name="company_name"
                value={settings.company_name}
                onChange={handleChange}
                className={styles.input}
                required
                placeholder="Bijv. Centjes B.V."
                disabled={!isEditing}
              />
            </div>

            <div className={`${styles.formGrid} ${styles.twoColumns}`}>
              <div className={styles.formGroup}>
                <label htmlFor="kvk_number" className={styles.label}>
                  KVK-nummer
                </label>
                <input
                  type="text"
                  id="kvk_number"
                  name="kvk_number"
                  value={settings.kvk_number}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="12345678"
                  disabled={!isEditing}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="btw_number" className={styles.label}>
                  BTW-nummer
                </label>
                <input
                  type="text"
                  id="btw_number"
                  name="btw_number"
                  value={settings.btw_number}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="NL123456789B01"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Address */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Adresgegevens</h2>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label htmlFor="address_line1" className={styles.label}>
                Adres
              </label>
              <input
                type="text"
                id="address_line1"
                name="address_line1"
                value={settings.address_line1}
                onChange={handleChange}
                className={styles.input}
                placeholder="Straatnaam 123"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="address_line2" className={styles.label}>
                Adres regel 2 (optioneel)
              </label>
              <input
                type="text"
                id="address_line2"
                name="address_line2"
                value={settings.address_line2}
                onChange={handleChange}
                className={styles.input}
                placeholder="Bijv. Verdieping 2"
              />
            </div>

            <div className={`${styles.formGrid} ${styles.twoColumns}`}>
              <div className={styles.formGroup}>
                <label htmlFor="postal_code" className={styles.label}>
                  Postcode
                </label>
                <input
                  type="text"
                  id="postal_code"
                  name="postal_code"
                  value={settings.postal_code}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="1234 AB"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="city" className={styles.label}>
                  Plaats
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={settings.city}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="Amsterdam"
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="country" className={styles.label}>
                Land
              </label>
              <input
                type="text"
                id="country"
                name="country"
                value={settings.country}
                onChange={handleChange}
                className={styles.input}
                placeholder="Nederland"
              />
            </div>
          </div>
        </section>

        {/* Contact Info */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Contactgegevens</h2>
          <div className={`${styles.formGrid} ${styles.twoColumns}`}>
            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>
                E-mailadres
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={settings.email}
                onChange={handleChange}
                className={styles.input}
                placeholder="info@bedrijf.nl"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="phone" className={styles.label}>
                Telefoonnummer
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={settings.phone}
                onChange={handleChange}
                className={styles.input}
                placeholder="+31 6 12345678"
              />
            </div>
          </div>
        </section>

        {/* Bank Account */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Betaalgegevens</h2>
          <div className={styles.formGroup}>
            <label htmlFor="bank_account" className={styles.label}>
              IBAN
            </label>
            <input
              type="text"
              id="bank_account"
              name="bank_account"
              value={settings.bank_account}
              onChange={handleChange}
              className={styles.input}
              placeholder="NL00 BANK 0000 0000 00"
            />
            <p className={styles.helperText}>
              Dit rekeningnummer wordt op je facturen vermeld voor betalingen
            </p>
          </div>
        </section>
      </form>
    </div>
  )
}
