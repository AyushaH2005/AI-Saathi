import { useState, useCallback, useRef, useEffect } from 'react'
import ScreenCapture from './components/ScreenCapture'
import Controls from './components/Controls'
import Response from './components/Response'
import Notification from './components/Notification'
import useWebSocket from './hooks/useWebSocket'

const ONBOARDING_SLIDES = [
  { emoji: '📸', title: 'Share Your Screen', subtitle: 'Share any screen and AI Saathi will understand what you see — no tech skills needed.' },
  { emoji: '🗣️', title: 'Ask in Your Language', subtitle: 'Hindi, English, Tamil, Bengali, Marathi — speak or type your question.' },
  { emoji: '🛡️', title: 'Stay Safe from Scams', subtitle: 'Instantly check if a message, website, or offer looks like a scam.' },
]

function Onboarding({ onComplete }) {
  const [slide, setSlide] = useState(0)
  const s = ONBOARDING_SLIDES[slide]

  const next = () => {
    if (slide < ONBOARDING_SLIDES.length - 1) {
      setSlide(slide + 1)
    } else {
      localStorage.setItem('ai-saathi-onboarded', 'true')
      onComplete()
    }
  }

  const skip = () => {
    localStorage.setItem('ai-saathi-onboarded', 'true')
    onComplete()
  }

  return (
    <div className="onboarding-overlay" role="dialog" aria-label="Welcome to AI Saathi">
      <button className="onboarding-skip" onClick={skip}>Skip</button>
      <div className="onboarding-emoji" aria-hidden="true">{s.emoji}</div>
      <h2 className="onboarding-title">{s.title}</h2>
      <p className="onboarding-subtitle">{s.subtitle}</p>
      <div className="onboarding-dots">
        {ONBOARDING_SLIDES.map((_, i) => (
          <div key={i} className={`onboarding-dot ${i === slide ? 'active' : ''}`} />
        ))}
      </div>
      <button className="onboarding-btn" onClick={next}>
        {slide === ONBOARDING_SLIDES.length - 1 ? 'Get Started' : 'Next'}
      </button>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="skeleton-container" role="status" aria-label="Loading response" aria-busy="true">
      <div className="skeleton-line" style={{ width: '90%' }} />
      <div className="skeleton-line" style={{ width: '100%' }} />
      <div className="skeleton-line" style={{ width: '75%' }} />
      <div className="skeleton-line" style={{ width: '85%' }} />
      <div className="skeleton-line" style={{ width: '60%' }} />
    </div>
  )
}

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('ai-saathi-onboarded'))
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('ai-saathi-theme')
    if (saved) return saved === 'dark'
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('ai-saathi-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const [stream, setStream] = useState(null)
  const [capturedFrame, setCapturedFrame] = useState(null)
  const [mode, setMode] = useState('explain')
  const [language, setLanguage] = useState('hi')
  const [question, setQuestion] = useState('')
  const [response, setResponse] = useState('')
  const [annotations, setAnnotations] = useState([])
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [autoCapture, setAutoCapture] = useState(true)
  const [notification, setNotification] = useState(null)
  const captureFrameRef = useRef(null)

  const wsUrl = `ws://${window.location.hostname}:3001`
  const { lastMessage } = useWebSocket(wsUrl)

  if (lastMessage?.type === 'notification' && lastMessage.message !== notification) {
    setNotification(lastMessage.message)
  }

  const haptic = () => navigator.vibrate?.(10)

  const handleCapture = useCallback((captureFn) => {
    captureFrameRef.current = captureFn
    const frame = captureFn()
    if (frame) setCapturedFrame(frame)
  }, [])

  const handleAutoCapture = useCallback(async (base64Image) => {
    try {
      await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenshot: base64Image })
      })
    } catch (err) {
      console.error('Auto-capture send failed:', err)
    }
  }, [])

  const handleAnalyze = async (customQuestion) => {
    const userQuery = customQuestion || question
    setLoading(true)
    setError('')
    setResponse('')
    setAnnotations([])
    setStreaming(false)
    haptic()

    let screenshot = capturedFrame
    if (captureFrameRef.current) {
      const fresh = captureFrameRef.current()
      if (fresh) screenshot = fresh
    }

    try {
      const res = await fetch('/api/analyze/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshot: screenshot || undefined,
          mode,
          language,
          question: userQuery
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Something went wrong')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let rawText = ''

      setStreaming(true)
      setLoading(false)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'token') {
              rawText += event.text
              const display = rawText.split('---ANNOTATIONS---')[0]
              setResponse(display)
            } else if (event.type === 'annotations') {
              setAnnotations(event.annotations)
            } else if (event.type === 'done') {
              setResponse(event.text)
            } else if (event.type === 'error') {
              throw new Error(event.error)
            }
          } catch (e) {
            if (e.message !== 'Stream interrupted' && !line.includes('data:')) {
              // ignore parse errors for non-data lines
            }
          }
        }
      }

      setQuestion('')
      setNotification(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setStreaming(false)
      setLoading(false)
    }
  }

  const handleStopSharing = () => {
    fetch('/api/session/reset', { method: 'POST' }).catch(() => {})
    setNotification(null)
  }

  const handleNotificationAccept = () => {
    setNotification(null)
    handleAnalyze('Explain what is on the screen now.')
  }

  const handleNotificationDismiss = () => {
    setNotification(null)
  }

  const handleReset = () => {
    setResponse('')
    setAnnotations([])
    setCapturedFrame(null)
    setError('')
  }

  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />
  }

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <header className="app-header" style={{ position: 'relative' }}>
        <h1>AI Saathi</h1>
        <p className="tagline">Share your screen, ask anything</p>
        <button
          className="theme-toggle"
          onClick={() => setDarkMode(!darkMode)}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          title={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </header>

      <main className="app-main" id="main-content">
        <ScreenCapture
          stream={stream}
          onStreamChange={(newStream) => {
            if (!newStream) handleStopSharing()
            setStream(newStream)
            if (!newStream) setCapturedFrame(null)
          }}
          onCapture={handleCapture}
          autoCaptureActive={autoCapture}
          onAutoCapture={handleAutoCapture}
        />

        {stream && (
          <Controls
            mode={mode}
            onModeChange={setMode}
            language={language}
            onLanguageChange={setLanguage}
            question={question}
            onQuestionChange={setQuestion}
            onSubmit={() => handleAnalyze()}
            disabled={loading || streaming}
            autoCapture={autoCapture}
            onAutoCaptureChange={setAutoCapture}
          />
        )}

        {loading && <LoadingSkeleton />}

        {error && (
          <div className="error-state" role="alert">
            <div className="error-icon" aria-hidden="true">⚠️</div>
            <div className="error-title">Something went wrong</div>
            <p className="error-message">Could not analyze the screen. Please check your connection and try again.</p>
            <button className="error-retry" onClick={() => handleAnalyze()}>
              ↻ Try Again
            </button>
          </div>
        )}

        {(response || streaming) && (
          <Response
            text={response}
            language={language}
            onReset={handleReset}
            streaming={streaming}
            annotations={annotations}
            screenshot={capturedFrame}
          />
        )}

        {notification && (
          <Notification
            message={notification}
            onAccept={handleNotificationAccept}
            onDismiss={handleNotificationDismiss}
          />
        )}
      </main>
    </div>
  )
}
