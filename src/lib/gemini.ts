import { GoogleGenerativeAI } from '@google/generative-ai'

let instance: GoogleGenerativeAI | null = null

export function getGeminiClient(): GoogleGenerativeAI {
  if (!instance) {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is missing in .env.local')
    }
    instance = new GoogleGenerativeAI(apiKey)
  }
  return instance
}
