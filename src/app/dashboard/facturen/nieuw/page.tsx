'use client'

/**
 * AI Invoice Chat Interface
 * 
 * Conversational interface for creating invoices step-by-step with AI assistance
 */

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Sparkles, Check, ArrowLeft } from 'lucide-react'
import {
  startInvoiceConversation,
  sendInvoiceMessage,
  createInvoiceFromConversation,
  type ChatMessage,
} from '../actions'
import styles from './page.module.css'

export default function NieuweFactuurPage() {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize conversation on mount
  useEffect(() => {
    initializeConversation()
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages, isSending])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const initializeConversation = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { conversationId: id, initialMessage } = await startInvoiceConversation()
      setConversationId(id)
      setMessages([{
        role: 'assistant',
        content: initialMessage,
        timestamp: new Date().toISOString(),
      }])
    } catch (err: any) {
      console.error('Failed to start conversation:', err)
      setError(err.message || 'Kon gesprek niet starten. Controleer of je bedrijfsinstellingen zijn ingevuld.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!inputValue.trim() || !conversationId || isSending) return

    const userMessage = inputValue.trim()
    setInputValue('')
    setIsSending(true)
    setError(null)

    // Add user message immediately
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, newUserMessage])

    try {
      const { response, isComplete: complete } = await sendInvoiceMessage(
        conversationId,
        userMessage
      )

      // Add AI response
      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, aiMessage])
      setIsComplete(complete)
    } catch (err) {
      console.error('Failed to send message:', err)
      setError('Kon bericht niet versturen. Probeer het opnieuw.')
    } finally {
      setIsSending(false)
    }
  }

  const handleCreateInvoice = async () => {
    if (!conversationId) return

    setIsCreating(true)
    setError(null)

    try {
      const invoiceId = await createInvoiceFromConversation(conversationId)
      // Navigate to invoice overview (we'll build this in Sprint 3)
      router.push(`/dashboard/facturen?created=${invoiceId}`)
    } catch (err: any) {
      console.error('Failed to create invoice:', err)
      setError(err.message || 'Kon factuur niet aanmaken')
      setIsCreating(false)
    }
  }

  const handleCancel = () => {
    router.push('/dashboard/facturen')
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Sparkles size={48} />
          <p>AI-assistent wordt gestart...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Header with Back Button */}
      <div className={styles.chatHeader}>
        <button onClick={() => router.push('/dashboard/facturen')} className={styles.backButton}>
          <ArrowLeft size={20} />
          Terug
        </button>
        <h1 className={styles.title}>Nieuwe Factuur - AI Assistent</h1>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      <div className={styles.chatContainer}>
        {/* Messages Area */}
        <div className={styles.messagesArea}>
          {messages.map((message, index) => (
            <div
              key={index}
              className={`${styles.message} ${styles[message.role]}`}
            >
              <div className={styles.messageAvatar}>
                {message.role === 'assistant' ? (
                  <Sparkles size={18} />
                ) : (
                  'U'
                )}
              </div>
              <div>
                <div className={styles.messageBubble}>
                  {message.content}
                </div>
                <div className={styles.messageTime}>
                  {formatTime(message.timestamp)}
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isSending && (
            <div className={styles.typingIndicator}>
              <div className={styles.messageAvatar}>
                <Sparkles size={18} />
              </div>
              <div className={styles.typingDots}>
                <div className={styles.typingDot} />
                <div className={styles.typingDot} />
                <div className={styles.typingDot} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area or Complete Actions */}
        {isComplete ? (
          <div className={styles.completeActions}>
            <button
              type="button"
              onClick={handleCancel}
              className={`${styles.completeButton} ${styles.cancelButton}`}
              disabled={isCreating}
            >
              Annuleren
            </button>
            <button
              type="button"
              onClick={handleCreateInvoice}
              className={`${styles.completeButton} ${styles.createButton}`}
              disabled={isCreating}
            >
              <Check size={18} />
              {isCreating ? 'Factuur wordt aangemaakt...' : 'Factuur aanmaken'}
            </button>
          </div>
        ) : (
          <div className={styles.inputArea}>
            <form onSubmit={handleSendMessage} className={styles.inputForm}>
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage(e)
                  }
                }}
                placeholder="Type je antwoord..."
                className={styles.input}
                disabled={isSending}
                rows={1}
              />
              <button
                type="submit"
                className={styles.sendButton}
                disabled={!inputValue.trim() || isSending}
              >
                <Send size={18} />
                Verstuur
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
