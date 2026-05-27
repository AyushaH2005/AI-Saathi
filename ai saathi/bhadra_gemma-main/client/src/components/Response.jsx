import { useState, useRef } from 'react'
import ScreenAnnotations from './ScreenAnnotations'

const LANG_CODES = {
  en: 'en-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  bn: 'bn-IN',
  mr: 'mr-IN'
}

export default function Response({ text, language, onReset, streaming, annotations, screenshot }) {
  const [speaking, setSpeaking] = useState(false)
  const [speed, setSpeed] = useState(0.8)
  const utteranceRef = useRef(null)

  const displayText = text || ''

  const speak = () => {
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }

    const cleanText = displayText.replace(/\[\d+\]/g, '').trim()
    if (!cleanText) return

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = LANG_CODES[language] || 'hi-IN'
    utterance.rate = speed
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)

    utteranceRef.current = utterance
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  return (
    <div className="response-section">
      {annotations && annotations.length > 0 && screenshot && (
        <ScreenAnnotations screenshot={screenshot} annotations={annotations} />
      )}

      <div className="response-card">
        <p
          className="response-text"
          aria-live="polite"
          aria-busy={streaming}
          role="log"
        >
          {displayText}
          {streaming && <span className="streaming-cursor" aria-hidden="true" />}
        </p>
      </div>

      {!streaming && (
        <div className="response-actions">
          <button
            className={`tts-btn ${speaking ? 'speaking' : ''}`}
            onClick={speak}
            aria-label={speaking ? 'Stop reading aloud' : 'Read response aloud'}
          >
            {speaking ? '⏹ Stop' : '🔊 Read Aloud'}
          </button>

          <div className="speed-control" role="group" aria-label="Speech speed">
            <label>Speed:</label>
            <button
              className={`speed-btn ${speed === 0.6 ? 'active' : ''}`}
              onClick={() => setSpeed(0.6)}
              aria-pressed={speed === 0.6}
            >
              Slow
            </button>
            <button
              className={`speed-btn ${speed === 0.8 ? 'active' : ''}`}
              onClick={() => setSpeed(0.8)}
              aria-pressed={speed === 0.8}
            >
              Normal
            </button>
            <button
              className={`speed-btn ${speed === 1.0 ? 'active' : ''}`}
              onClick={() => setSpeed(1.0)}
              aria-pressed={speed === 1.0}
            >
              Fast
            </button>
          </div>

          <button className="new-btn" onClick={onReset} aria-label="Start new analysis">
            Upload New Screenshot
          </button>
        </div>
      )}
    </div>
  )
}
