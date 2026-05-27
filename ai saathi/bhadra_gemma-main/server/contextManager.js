import { extractText } from './ocr.js'
import { isSimilarEnough } from './similarity.js'
import { getSession, updateSession, getConversationSummary } from './sessionStore.js'
import { checkRelevance, generateSuggestion } from './gemini.js'

const RELEVANCE_COOLDOWN_MS = 10000
const OCR_TEXT_LIMIT = 2000

let isProcessing = false

export async function processIncomingCapture(base64Image) {
  if (isProcessing) {
    return { action: 'skipped', reason: 'processing' }
  }

  isProcessing = true
  try {
    const ocrText = (await extractText(base64Image)).slice(0, OCR_TEXT_LIMIT)
    const session = getSession()

    if (session.lastOcrText && isSimilarEnough(ocrText, session.lastOcrText)) {
      return { action: 'skipped', reason: 'similar' }
    }

    updateSession({ lastOcrText: ocrText, lastImage: base64Image })

    const conversationSummary = getConversationSummary()
    if (!conversationSummary) {
      return { action: 'updated', reason: 'no_conversation' }
    }

    const now = Date.now()
    if (now - session.lastRelevanceCheckTime < RELEVANCE_COOLDOWN_MS) {
      return { action: 'updated', reason: 'cooldown' }
    }

    updateSession({ lastRelevanceCheckTime: now })
    const relevant = await checkRelevance(ocrText, conversationSummary)

    if (!relevant) {
      try {
        const suggestion = await generateSuggestion(ocrText)
        return { action: 'notify', message: suggestion }
      } catch {
        return { action: 'notify', message: 'Do you need help with this?' }
      }
    }

    return { action: 'updated', reason: 'related' }
  } catch (err) {
    console.error('Context processing error:', err)
    return { action: 'skipped', reason: 'error' }
  } finally {
    isProcessing = false
  }
}
