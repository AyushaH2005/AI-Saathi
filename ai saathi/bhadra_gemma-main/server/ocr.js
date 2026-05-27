import { createWorker } from 'tesseract.js'

let worker = null

export async function initOCR() {
  worker = await createWorker('eng')
  console.log('OCR worker ready')
}

export async function extractText(base64DataUrl) {
  if (!worker) throw new Error('OCR not initialized')

  const base64Match = base64DataUrl.match(/^data:image\/[^;]+;base64,(.+)$/)
  const rawBase64 = base64Match ? base64Match[1] : base64DataUrl

  const buffer = Buffer.from(rawBase64, 'base64')
  const { data: { text } } = await worker.recognize(buffer)
  return text.trim()
}

export async function terminateOCR() {
  if (worker) {
    await worker.terminate()
    worker = null
  }
}
