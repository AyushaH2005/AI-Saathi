import { useState, useRef } from 'react'

const MODES = [
  { id: 'explain', label: 'Explain', labelHi: 'समझाओ', icon: '💡' },
  { id: 'simplify', label: 'Simplify', labelHi: 'आसान करो', icon: '📝' },
  { id: 'scam_check', label: 'Scam Check', labelHi: 'सुरक्षित है?', icon: '🛡️' },
  { id: 'guide', label: 'Guide Me', labelHi: 'गाइड करो', icon: '👉' }
]

const LANGUAGES = [
  { id: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
  { id: 'bn', label: 'বাংলা', flag: '🇮🇳' },
  { id: 'mr', label: 'मराठी', flag: '🇮🇳' }
]

const LANG_CODES = {
  en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', bn: 'bn-IN', mr: 'mr-IN'
}

export default function Controls({ mode, onModeChange, language, onLanguageChange, question, onQuestionChange, onSubmit, disabled, autoCapture, onAutoCaptureChange }) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)

  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = LANG_CODES[language] || 'hi-IN'
    recognition.interimResults = false
    recognition.continuous = false

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      onQuestionChange(transcript)
      setListening(false)
    }

    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <div className="controls" role="region" aria-label="Analysis controls">
      <div className="auto-capture-toggle">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={autoCapture}
            onChange={(e) => onAutoCaptureChange(e.target.checked)}
            aria-label="Auto-track screen changes"
          />
          <span className="toggle-text">Auto-track screen</span>
          {autoCapture && <span className="live-dot" aria-hidden="true" />}
        </label>
      </div>

      <form className="question-bar" onSubmit={handleSubmit} role="search">
        <input
          type="text"
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          placeholder="Ask anything about your screen..."
          className="question-input"
          disabled={disabled}
          aria-label="Your question"
        />
        <button
          type="button"
          className={`voice-btn ${listening ? 'listening' : ''}`}
          onClick={startVoice}
          title="Voice input"
          aria-label={listening ? 'Stop voice input' : 'Start voice input'}
          aria-pressed={listening}
        >
          {listening ? (
            <div className="voice-waveform" aria-hidden="true">
              <span className="bar" /><span className="bar" /><span className="bar" />
              <span className="bar" /><span className="bar" />
            </div>
          ) : '🎤'}
        </button>
        <button
          type="submit"
          className="ask-btn"
          disabled={disabled || !question.trim()}
          aria-label="Ask question"
        >
          Ask
        </button>
      </form>

      <div className="control-group" role="group" aria-label="Analysis mode">
        <div className="mode-buttons">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`mode-btn ${mode === m.id ? 'active' : ''}`}
              onClick={() => onModeChange(m.id)}
              disabled={disabled}
              aria-pressed={mode === m.id}
              aria-label={`${m.labelHi} - ${m.label}`}
            >
              <span className="mode-icon" aria-hidden="true">{m.icon}</span>
              <span className="mode-label">{m.labelHi}</span>
              <span className="mode-sublabel">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="control-group" role="group" aria-label="Response language">
        <div className="lang-buttons">
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`lang-btn ${language === l.id ? 'active' : ''}`}
              onClick={() => onLanguageChange(l.id)}
              aria-pressed={language === l.id}
              aria-label={l.label}
            >
              <span aria-hidden="true">{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
