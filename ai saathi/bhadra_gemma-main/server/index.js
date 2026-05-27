import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { analyzeScreenshot, streamAnalyzeScreenshot } from './gemini.js'
import { initOCR } from './ocr.js'
import { processIncomingCapture } from './contextManager.js'
import { getSession, updateSession, addToHistory, resetSession } from './sessionStore.js'
import { createWSS, sendToClient } from './websocket.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.post('/api/capture', async (req, res) => {
  try {
    const { screenshot } = req.body
    if (!screenshot) return res.status(400).json({ error: 'Screenshot required' })

    const result = await processIncomingCapture(screenshot)

    if (result.action === 'notify') {
      sendToClient({ type: 'notification', message: result.message })
    }

    res.json({ action: result.action })
  } catch (err) {
    console.error('Capture processing failed:', err)
    res.status(500).json({ error: 'Processing failed' })
  }
})

app.post('/api/analyze', async (req, res) => {
  try {
    const { screenshot, mode, language, question, pageText } = req.body
    const session = getSession()

    const imageToAnalyze = screenshot || session.lastImage
    if (!imageToAnalyze && !pageText) {
      return res.status(400).json({ error: 'No screenshot or page text available. Share your screen first.' })
    }

    const validModes = ['explain', 'simplify', 'scam_check', 'guide']
    const validLangs = ['en', 'hi', 'ta', 'bn', 'mr']
    if (!validModes.includes(mode)) {
      return res.status(400).json({ error: `Mode must be one of: ${validModes.join(', ')}` })
    }
    if (!validLangs.includes(language)) {
      return res.status(400).json({ error: `Language must be one of: ${validLangs.join(', ')}` })
    }

    const userQuery = question?.trim() || 'What is on this screen? Please explain.'
    addToHistory('user', userQuery)

    const result = await analyzeScreenshot(
      imageToAnalyze, mode, language, userQuery, session.conversationHistory, pageText || null
    )

    addToHistory('assistant', result.text)
    res.json({ text: result.text, annotations: result.annotations })
  } catch (err) {
    console.error('Analysis failed:', err)
    res.status(500).json({ error: 'Failed to analyze screenshot. Please try again.' })
  }
})

app.post('/api/analyze/stream', async (req, res) => {
  try {
    const { screenshot, mode, language, question, pageText } = req.body
    const session = getSession()

    const imageToAnalyze = screenshot || session.lastImage
    if (!imageToAnalyze && !pageText) {
      return res.status(400).json({ error: 'No screenshot or page text available. Share your screen first.' })
    }

    const validModes = ['explain', 'simplify', 'scam_check', 'guide']
    const validLangs = ['en', 'hi', 'ta', 'bn', 'mr']
    if (!validModes.includes(mode)) {
      return res.status(400).json({ error: `Mode must be one of: ${validModes.join(', ')}` })
    }
    if (!validLangs.includes(language)) {
      return res.status(400).json({ error: `Language must be one of: ${validLangs.join(', ')}` })
    }

    const userQuery = question?.trim() || 'What is on this screen? Please explain.'
    addToHistory('user', userQuery)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    let rawAccumulated = ''

    const cleanText = await streamAnalyzeScreenshot(
      imageToAnalyze, mode, language, userQuery, session.conversationHistory,
      (event) => {
        if (event.type === 'token') {
          rawAccumulated += event.text
          const display = rawAccumulated.split('---ANNOTATIONS---')[0]
          res.write(`data: ${JSON.stringify({ type: 'token', text: event.text, display })}\n\n`)
        } else if (event.type === 'annotations') {
          res.write(`data: ${JSON.stringify({ type: 'annotations', annotations: event.annotations })}\n\n`)
        } else if (event.type === 'done') {
          res.write(`data: ${JSON.stringify({ type: 'done', text: event.text })}\n\n`)
        }
      }
    , pageText || null)

    addToHistory('assistant', cleanText)
    res.end()
  } catch (err) {
    console.error('Streaming analysis failed:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to analyze screenshot.' })
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Stream interrupted' })}\n\n`)
      res.end()
    }
  }
})

app.post('/api/session/reset', (req, res) => {
  resetSession()
  res.json({ success: true })
})

const server = app.listen(PORT, '0.0.0.0', async () => {
  await initOCR()
  console.log(`AI Saathi server running on http://localhost:${PORT}`)
})

createWSS(server)
