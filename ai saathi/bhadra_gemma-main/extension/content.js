// Avoid injecting multiple times
if (!document.getElementById('ai-saathi-root')) {

const API_URL = 'http://localhost:3001/api/analyze'
const CAPTURE_URL = 'http://localhost:3001/api/capture'
const RESET_URL = 'http://localhost:3001/api/session/reset'
const WS_URL = 'ws://localhost:3001'

const MODES = [
  { id: 'explain', label: 'समझाओ', sublabel: 'Explain', icon: '💡' },
  { id: 'simplify', label: 'आसान करो', sublabel: 'Simplify', icon: '📝' },
  { id: 'scam_check', label: 'सुरक्षित है?', sublabel: 'Scam Check', icon: '🛡️' }
]

const LANGUAGES = [
  { id: 'hi', label: 'हिन्दी' },
  { id: 'en', label: 'English' },
  { id: 'ta', label: 'தமிழ்' },
  { id: 'bn', label: 'বাংলা' },
  { id: 'mr', label: 'मराठी' }
]

const state = {
  mode: 'explain',
  language: 'hi',
  question: '',
  response: '',
  loading: false,
  open: false,
  watching: false,
  notification: null
}

let autoCaptureInterval = null
let ws = null

// --- WebSocket ---
function connectWS() {
  try {
    ws = new WebSocket(WS_URL)
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'notification') {
          state.notification = data.message
          render()
        }
      } catch {}
    }
    ws.onclose = () => { ws = null }
    ws.onerror = () => { if (ws) ws.close() }
  } catch {}
}

function disconnectWS() {
  if (ws) { ws.close(); ws = null }
}

// --- Auto Capture ---
function startAutoCapture() {
  if (autoCaptureInterval) return
  state.watching = true

  connectWS()

  autoCaptureInterval = setInterval(async () => {
    try {
      const captureResult = await chrome.runtime.sendMessage({ type: 'capture' })
      if (captureResult.screenshot) {
        await fetch(CAPTURE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ screenshot: captureResult.screenshot })
        })
      }
    } catch (err) {
      console.error('Auto-capture error:', err)
    }
  }, 2000)

  render()
}

function stopAutoCapture() {
  if (autoCaptureInterval) {
    clearInterval(autoCaptureInterval)
    autoCaptureInterval = null
  }
  state.watching = false
  state.notification = null

  disconnectWS()
  fetch(RESET_URL, { method: 'POST' }).catch(() => {})

  render()
}

// --- Build UI ---

const root = document.createElement('div')
root.id = 'ai-saathi-root'
document.body.appendChild(root)

const fab = document.createElement('div')
fab.className = 'as-fab'
fab.innerHTML = '🤖'
fab.title = 'AI Saathi'
fab.onclick = () => toggleSidebar()
root.appendChild(fab)

const sidebar = document.createElement('div')
sidebar.className = 'as-sidebar as-hidden'
root.appendChild(sidebar)

function render() {
  sidebar.innerHTML = `
    <div class="as-header">
      <span class="as-title">AI Saathi</span>
      <button class="as-close" title="Close">✕</button>
    </div>

    <div class="as-body">
      <div class="as-section">
        <button class="as-watch-btn ${state.watching ? 'as-watching' : ''}">
          ${state.watching ? '⏹ Stop Watching' : '▶ Start Watching'}
        </button>
      </div>

      ${state.watching ? `
        <div class="as-section">
          <div class="as-label">What do you need?</div>
          <div class="as-modes">
            ${MODES.map(m => `
              <button class="as-mode ${state.mode === m.id ? 'as-active' : ''}" data-mode="${m.id}">
                <span class="as-mode-icon">${m.icon}</span>
                <span class="as-mode-label">${m.label}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="as-section">
          <div class="as-label">Language</div>
          <div class="as-langs">
            ${LANGUAGES.map(l => `
              <button class="as-lang ${state.language === l.id ? 'as-active' : ''}" data-lang="${l.id}">${l.label}</button>
            `).join('')}
          </div>
        </div>

        <div class="as-input-row">
          <input type="text" class="as-input" placeholder="Ask anything..." value="${escapeHtml(state.question)}" />
          <button class="as-voice-btn" title="Voice input">🎤</button>
        </div>

        <button class="as-ask-btn" ${state.loading ? 'disabled' : ''}>
          ${state.loading ? '<span class="as-spinner"></span> Thinking...' : '❓ Ask'}
        </button>
      ` : `
        <p class="as-hint">Start watching to let AI Saathi observe your screen and help you anytime.</p>
      `}

      ${state.notification ? `
        <div class="as-notification">
          <p class="as-notification-text">${escapeHtml(state.notification)}</p>
          <div class="as-notification-actions">
            <button class="as-notification-yes">Yes, explain</button>
            <button class="as-notification-no">Dismiss</button>
          </div>
        </div>
      ` : ''}

      ${state.response ? `
        <div class="as-response">
          <div class="as-response-text">${escapeHtml(state.response)}</div>
          <div class="as-response-actions">
            <button class="as-tts-btn">🔊 Read Aloud</button>
            <button class="as-clear-btn">Ask Again</button>
          </div>
        </div>
      ` : ''}

      ${state.error ? `<div class="as-error">${escapeHtml(state.error)}</div>` : ''}
    </div>
  `

  bindEvents()
}

function bindEvents() {
  sidebar.querySelector('.as-close')?.addEventListener('click', () => toggleSidebar(false))

  // Watch button
  sidebar.querySelector('.as-watch-btn')?.addEventListener('click', () => {
    if (state.watching) {
      stopAutoCapture()
    } else {
      startAutoCapture()
    }
  })

  // Mode buttons
  sidebar.querySelectorAll('.as-mode').forEach(btn => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode
      render()
    })
  })

  // Language buttons
  sidebar.querySelectorAll('.as-lang').forEach(btn => {
    btn.addEventListener('click', () => {
      state.language = btn.dataset.lang
      render()
    })
  })

  // Text input
  const input = sidebar.querySelector('.as-input')
  if (input) {
    input.addEventListener('input', (e) => { state.question = e.target.value })
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') askQuestion() })
  }

  // Voice input
  sidebar.querySelector('.as-voice-btn')?.addEventListener('click', startVoice)

  // Ask button
  sidebar.querySelector('.as-ask-btn')?.addEventListener('click', askQuestion)

  // Notification actions
  sidebar.querySelector('.as-notification-yes')?.addEventListener('click', () => {
    state.notification = null
    state.question = 'Explain what is on the screen now.'
    askQuestion()
  })
  sidebar.querySelector('.as-notification-no')?.addEventListener('click', () => {
    state.notification = null
    render()
  })

  // TTS
  sidebar.querySelector('.as-tts-btn')?.addEventListener('click', () => speak(state.response))

  // Clear
  sidebar.querySelector('.as-clear-btn')?.addEventListener('click', () => {
    state.response = ''
    state.error = ''
    state.question = ''
    window.speechSynthesis.cancel()
    render()
  })
}

function toggleSidebar(forceState) {
  state.open = forceState !== undefined ? forceState : !state.open
  sidebar.classList.toggle('as-hidden', !state.open)
  fab.classList.toggle('as-fab-hidden', state.open)
  if (state.open && !sidebar.innerHTML) render()
}

async function askQuestion() {
  if (state.loading || !state.watching) return
  state.loading = true
  state.error = ''
  state.response = ''
  state.notification = null
  render()

  try {
    // Capture a fresh screenshot to send with the question
    const captureResult = await chrome.runtime.sendMessage({ type: 'capture' })
    const screenshot = captureResult?.screenshot || undefined

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screenshot,
        mode: state.mode,
        language: state.language,
        question: state.question || undefined
      })
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Something went wrong')

    state.response = data.text
  } catch (err) {
    state.error = err.message
  } finally {
    state.loading = false
    state.question = ''
    render()
  }
}

function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) { state.error = 'Voice input not supported'; render(); return }

  const langMap = { hi: 'hi-IN', en: 'en-IN', ta: 'ta-IN', bn: 'bn-IN', mr: 'mr-IN' }
  const recognition = new SpeechRecognition()
  recognition.lang = langMap[state.language] || 'hi-IN'
  recognition.interimResults = false

  recognition.onresult = (e) => {
    state.question = e.results[0][0].transcript
    render()
  }
  recognition.onerror = () => render()

  recognition.start()
}

function speak(text) {
  if (window.speechSynthesis.speaking) { window.speechSynthesis.cancel(); return }
  const langMap = { hi: 'hi-IN', en: 'en-IN', ta: 'ta-IN', bn: 'bn-IN', mr: 'mr-IN' }
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = langMap[state.language] || 'hi-IN'
  utterance.rate = 0.8
  window.speechSynthesis.speak(utterance)
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

render()
}
