'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Upload, Camera, Loader2 } from 'lucide-react'
import { createExpenseFromCamera } from '@/app/dashboard/uitgaven/actions'
import styles from './CameraCapture.module.css'

interface CameraCaptureProps {
  onClose: () => void
}

export default function CameraCapture({ onClose }: CameraCaptureProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif']
    if (!validTypes.includes(file.type)) {
      setError('Alleen afbeeldingen toegestaan (JPG, PNG, HEIC)')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Bestand is te groot (max 10MB)')
      return
    }

    setError(null)
    setSelectedFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit() {
    if (!selectedFile) return

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const result = await createExpenseFromCamera(formData)

      if (result.success && result.expenseId) {
        onClose()
        router.push(`/dashboard/uitgaven?review=${result.expenseId}`)
      } else {
        setError(result.error || 'Uploaden mislukt')
      }
    } catch (err) {
      console.error('Upload error:', err)
      setError('Er ging iets mis bij het uploaden')
    } finally {
      setIsUploading(false)
    }
  }

  function handleRetake() {
    setPreview(null)
    setSelectedFile(null)
    setError(null)
    fileInputRef.current?.click()
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Bon Scannen</h2>
          <button onClick={onClose} className={styles.closeButton} disabled={isUploading}>
            <X size={24} />
          </button>
        </div>

        <div className={styles.content}>
          {!preview ? (
            <div className={styles.captureArea}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className={styles.fileInput}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={styles.captureButton}
              >
                <Camera size={48} />
                <span>Maak foto van bon</span>
              </button>
              <p className={styles.hint}>
                Of selecteer een bestaande afbeelding
              </p>
            </div>
          ) : (
            <div className={styles.previewArea}>
              <img src={preview} alt="Preview" className={styles.previewImage} />
            </div>
          )}

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {preview ? (
            <>
              <button
                onClick={handleRetake}
                className={styles.secondaryButton}
                disabled={isUploading}
              >
                Opnieuw
              </button>
              <button
                onClick={handleSubmit}
                className={styles.primaryButton}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 size={20} className={styles.spinner} />
                    Verwerken...
                  </>
                ) : (
                  <>
                    <Upload size={20} />
                    Verwerk bon
                  </>
                )}
              </button>
            </>
          ) : (
            <button onClick={onClose} className={styles.secondaryButton}>
              Annuleren
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
