import { GoogleGenAI } from '@google/genai'
import { getSystemPrompt } from './prompts.js'

let genAI = null

const ANNOTATION_MARKER = '---ANNOTATIONS---'

function getClient() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set')
    }
    genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }
  return genAI
}

export function parseAnnotations(rawText) {
  const idx = rawText.indexOf(ANNOTATION_MARKER)
  if (idx === -1) return { text: rawText, annotations: [] }

  const text = rawText.slice(0, idx).trim()
  const block = rawText.slice(idx + ANNOTATION_MARKER.length).trim()

  try {
    const match = block.match(/\[[\s\S]*\]/)
    if (match) {
      const annotations = JSON.parse(match[0])
      if (Array.isArray(annotations)) return { text, annotations }
    }
  } catch {}

  return { text, annotations: [] }
}

function buildContents(screenshot, question, mode, conversationHistory, pageText) {
  const defaults = {
    explain: 'What is on this screen? Please explain.',
    simplify: 'Please simplify the text on this screen.',
    scam_check: 'Is this safe? Please check for scams.',
    guide: 'Guide me step by step on how to use this page.'
  }
  const userText = question?.trim() || defaults[mode] || defaults.explain

  const contents = []
  for (const entry of conversationHistory) {
    contents.push({
      role: entry.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: entry.text }]
    })
  }

  const parts = []

  // If page text provided (mobile), use text — much more accurate than OCR
  if (pageText) {
    parts.push({ text: `[PAGE CONTENT]\n${pageText.slice(0, 8000)}\n[/PAGE CONTENT]\n\n${userText}` })
  } else if (screenshot) {
    // Otherwise use screenshot (web app / extension)
    const base64Match = screenshot.match(/^data:image\/[^;]+;base64,(.+)$/)
    const base64Data = base64Match ? base64Match[1] : screenshot
    parts.push({ inlineData: { mimeType: 'image/png', data: base64Data } })
    parts.push({ text: userText })
  }

  contents.push({ role: 'user', parts })
  return contents
}

export async function analyzeScreenshot(screenshot, mode, language, question, conversationHistory = [], pageText = null) {
  const client = getClient()
  const systemPrompt = getSystemPrompt(mode, language)
  const contents = buildContents(screenshot, question, mode, conversationHistory, pageText)

  const response = await client.models.generateContent({
    model: 'gemma-4-31b-it',
    contents,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.4,
      maxOutputTokens: 1024
    }
  })

  return parseAnnotations(response.text)
}

export async function streamAnalyzeScreenshot(screenshot, mode, language, question, conversationHistory, onEvent, pageText = null) {
  const client = getClient()
  const systemPrompt = getSystemPrompt(mode, language)
  const contents = buildContents(screenshot, question, mode, conversationHistory, pageText)

  const response = await client.models.generateContentStream({
    model: 'gemma-4-31b-it',
    contents,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.4,
      maxOutputTokens: 1024
    }
  })

  let fullText = ''
  for await (const chunk of response) {
    const token = chunk.text || ''
    fullText += token
    onEvent({ type: 'token', text: token })
  }

  const { text, annotations } = parseAnnotations(fullText)
  if (annotations.length > 0) {
    onEvent({ type: 'annotations', annotations })
  }
  onEvent({ type: 'done', text })
  return text
}

export async function checkRelevance(newOcrText, conversationSummary) {
  const client = getClient()

  const response = await client.models.generateContent({
    model: 'gemma-4-31b-it',
    contents: [
      {
        role: 'user',
        parts: [{ text: `Conversation:\n${conversationSummary}\n\nNew screen content:\n${newOcrText}` }]
      }
    ],
    config: {
      systemInstruction: 'You are a relevance classifier. Given a conversation and new screen content, determine if they are related. Reply with exactly one word: "related" or "unrelated".',
      temperature: 0,
      maxOutputTokens: 10
    }
  })

  const answer = response.text.trim().toLowerCase()
  return answer.includes('related') && !answer.includes('unrelated')
}

export async function generateSuggestion(ocrText) {
  const client = getClient()

  const response = await client.models.generateContent({
    model: 'gemma-4-31b-it',
    contents: [{
      role: 'user',
      parts: [{ text: `Screen content:\n${ocrText.slice(0, 1000)}` }]
    }],
    config: {
      systemInstruction: 'Identify what this web page is and suggest a very short helpful action. Reply in one short sentence like: "I see a login page — need help signing in?" or "I see a shopping cart — want me to check if it\'s safe?" or "I see a form — need help filling it?". Keep it under 20 words. Be specific about what you see.',
      temperature: 0.3,
      maxOutputTokens: 60
    }
  })

  return response.text.trim()
}
