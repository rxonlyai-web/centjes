'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getGeminiClient } from '@/lib/gemini'
import { parseBankFile, type ParsedBankRow, type CategorizedTransaction, type BankFormat } from '@/lib/bank-csv'

// --- Action 1: Parse bank statement file ---

export async function parseBankStatement(formData: FormData): Promise<{
  success: boolean
  bank?: BankFormat
  transactions?: ParsedBankRow[]
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { success: false, error: 'Niet ingelogd' }
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return { success: false, error: 'Geen bestand ontvangen' }
  }

  try {
    const buffer = await file.arrayBuffer()
    const result = parseBankFile(buffer)
    return {
      success: true,
      bank: result.bank,
      transactions: result.transactions,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Bestand kon niet worden gelezen',
    }
  }
}

// --- Action 2: AI categorize + duplicate check ---

export async function categorizeBankTransactions(
  transactions: ParsedBankRow[]
): Promise<{
  success: boolean
  categorized?: CategorizedTransaction[]
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { success: false, error: 'Niet ingelogd' }
  }

  // 1. Determine type (income/expense) from sign
  const withType = transactions.map(t => ({
    ...t,
    type_transactie: (t.bedrag >= 0 ? 'INKOMSTEN' : 'UITGAVEN') as 'INKOMSTEN' | 'UITGAVEN',
    absBedrag: Math.abs(t.bedrag),
  }))

  // 2. AI categorization via Gemini
  let aiResults: Array<{ categorie: string; btw_tarief: number; confidence: string }> = []
  try {
    aiResults = await categorizeWithGemini(withType)
  } catch (err) {
    console.error('Gemini categorization failed:', err)
    // Fallback: all "Overig" with low confidence
    aiResults = withType.map(() => ({ categorie: 'Overig', btw_tarief: 21, confidence: 'low' }))
  }

  // 3. Duplicate detection
  const dates = transactions.map(t => t.datum).filter(Boolean)
  const minDate = dates.sort()[0]
  const maxDate = dates.sort().reverse()[0]

  const { data: existing } = await supabase
    .from('transacties')
    .select('datum, bedrag, omschrijving')
    .eq('gebruiker_id', user.id)
    .gte('datum', `${minDate}T00:00:00`)
    .lte('datum', `${maxDate}T23:59:59`)

  const existingKeys = new Set(
    (existing || []).map(e => {
      const d = e.datum.split('T')[0]
      return `${d}_${Number(e.bedrag).toFixed(2)}_${e.omschrijving.trim().toLowerCase()}`
    })
  )

  // 4. Build result
  const VALID_CATEGORIES = ['Inkoop', 'Sales', 'Reiskosten', 'Kantoor', 'Overig']
  const categorized: CategorizedTransaction[] = withType.map((t, i) => {
    const ai = aiResults[i] || { categorie: 'Overig', btw_tarief: 21, confidence: 'low' }
    const categorie = VALID_CATEGORIES.includes(ai.categorie) ? ai.categorie : 'Overig'
    const key = `${t.datum}_${t.absBedrag.toFixed(2)}_${t.omschrijving.trim().toLowerCase()}`

    return {
      datum: t.datum,
      omschrijving: t.omschrijving,
      bedrag: t.absBedrag,
      type_transactie: t.type_transactie,
      categorie: categorie as CategorizedTransaction['categorie'],
      btw_tarief: [0, 9, 21].includes(Number(ai.btw_tarief)) ? Number(ai.btw_tarief) : 21,
      vat_treatment: 'domestic' as const,
      isDuplicate: existingKeys.has(key),
      aiConfidence: (ai.confidence === 'high' ? 'high' : 'low') as 'high' | 'low',
    }
  })

  return { success: true, categorized }
}

// --- Action 3: Import transactions ---

export async function importBankTransactions(
  transactions: CategorizedTransaction[]
): Promise<{
  success: boolean
  imported?: number
  skipped?: number
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { success: false, error: 'Niet ingelogd' }
  }

  let imported = 0
  let skipped = 0

  // Filter out duplicates (already marked by categorize step, but user may have toggled)
  for (const t of transactions) {
    const { error: insertError } = await supabase
      .from('transacties')
      .insert({
        gebruiker_id: user.id,
        datum: new Date(t.datum).toISOString(),
        bedrag: t.bedrag,
        omschrijving: t.omschrijving,
        type_transactie: t.type_transactie,
        categorie: t.categorie,
        btw_tarief: t.btw_tarief,
        vat_treatment: t.vat_treatment,
      })

    if (insertError) {
      console.error('Failed to insert transaction:', insertError)
      skipped++
    } else {
      imported++
    }
  }

  revalidatePath('/dashboard/transacties')
  revalidatePath('/dashboard')

  return { success: true, imported, skipped }
}

// --- Gemini AI categorization ---

async function categorizeWithGemini(
  transactions: Array<{ datum: string; omschrijving: string; absBedrag: number; type_transactie: string }>
): Promise<Array<{ categorie: string; btw_tarief: number; confidence: string }>> {
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const results: Array<{ categorie: string; btw_tarief: number; confidence: string }> = []

  // Process in chunks of 100
  for (let i = 0; i < transactions.length; i += 100) {
    const chunk = transactions.slice(i, i + 100)

    const prompt = `Je bent een Nederlandse boekhoudasssistent. Categoriseer deze banktransacties voor een ZZP'er.

Per transactie, bepaal:
1. categorie: afhankelijk van type (zie regels)
2. btw_tarief: 21, 9, of 0
3. confidence: "high" of "low"

Regels:
- Als type INKOMSTEN is: categorie is "Sales" of "Overig", en btw_tarief 21
- Als type UITGAVEN is: categorie is een van "Inkoop", "Reiskosten", "Kantoor", "Overig" (NOOIT "Sales")
- "Inkoop" = inkoop van goederen voor doorverkoop
- "Reiskosten" = NS, OV, parkeren, brandstof, hotels, vluchten, taxi
- "Kantoor" = kantoorspullen, software abonnementen, internet, telefoon
- "Overig" = al het andere (bankkosten, verzekeringen, maaltijden, etc.)
- btw_tarief: 21 voor de meeste uitgaven, 9 voor eten/boeken/medicijnen, 0 voor bankkosten/verzekeringen

Geef ALLEEN een JSON array terug:
[{"index": 0, "categorie": "...", "btw_tarief": 21, "confidence": "high"}, ...]

Transacties:
${chunk.map((t, idx) => `${idx}. ${t.datum} | ${t.omschrijving.slice(0, 100)} | €${t.absBedrag.toFixed(2)} | ${t.type_transactie}`).join('\n')}
`

    const result = await model.generateContent([{ text: prompt }])
    const responseText = result.response.text()

    try {
      const jsonText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()

      const parsed = JSON.parse(jsonText) as Array<{
        index: number
        categorie: string
        btw_tarief: number
        confidence: string
      }>

      // Map back to chunk order
      for (let j = 0; j < chunk.length; j++) {
        const match = parsed.find(p => p.index === j)
        results.push(match || { categorie: 'Overig', btw_tarief: 21, confidence: 'low' })
      }
    } catch {
      // If parsing fails, fallback for this chunk
      for (let j = 0; j < chunk.length; j++) {
        results.push({ categorie: 'Overig', btw_tarief: 21, confidence: 'low' })
      }
    }
  }

  return results
}
