# AI Saathi — AI Saathi (आर्टिफिशियल इंटेलिजेंस साथी)

**Your personal digital assistant — built with Gemma 4, powered by LangGraph, designed for Digital India.**

AI Saathi helps anyone navigate the digital world — explain pages in your language, simplify complex text, detect scams, guide you step-by-step, and even fill forms safely
---

## What It Does

| Feature | Hindi | What Happens |
|---------|-------|--------------|
| **Explain** | समझाओ | Tells you what's on the page in simple words |
| **Simplify** | आसान करो | Rewrites complex text so a 10-year-old can understand |
| **Scam Check** | सुरक्षित? | Detects fraud, phishing, fake KYC, lottery scams |
| **Guide** | गाइड | Step-by-step instructions — exactly where to click |
| **Navigate** | Search | Searches Google and navigates for you |
| **Fill Form** | भरो | Fills forms with guardrails — never fills passwords/OTP automatically |

---

## Architecture

```
┌──────────────────────┐       ┌─────────────────────────────────┐
│   Mobile App (Expo)  │──────→│  Agent Service (FastAPI :8000)  │
│   Voice-first UI     │       │  ├── LangGraph (intent routing) │
│   WebView browser    │←──────│  ├── Guardrails (passwords etc) │
│   Auto-speak Hindi   │       │  └── Gemma 4 31B IT            │
└──────────────────────┘       └─────────────────────────────────┘

┌──────────────────────┐       ┌─────────────────────────────────┐
│  Web App (React)     │──────→│  Express Server (Node :3001)    │
│  Screen share + OCR  │       │  ├── Screenshot analysis        │
│  Chrome Extension    │←──────│  ├── Context manager            │
│  Auto-capture 2s     │       │  └── Gemma 4 31B IT            │
└──────────────────────┘       └─────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI Model | **Gemma 4 31B IT** via Google AI Studio API |
| Agent Framework | **LangGraph** (deterministic intent routing) |
| Mobile App | Expo React Native + WebView |
| Web App | React 19 + Vite |
| Chrome Extension | Manifest V3 |
| Agent Backend | FastAPI (Python) |
| Web Backend | Express.js (Node.js) |
| OCR | Tesseract.js (server-side) |
| Voice | expo-speech (TTS), expo-speech-recognition (STT) |
| Guardrails | LangGraph + rule-based (password/OTP/PIN never auto-filled) |

---

## Prerequisites

- **Node.js** 18+ → [download](https://nodejs.org/)
- **Python** 3.10+ → [download](https://www.python.org/downloads/)
- **Google AI Studio API key** (free) → [get one here](https://aistudio.google.com/apikey)
- **Expo Go** app on your phone → [iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)
- **Your laptop and phone on the SAME WiFi network**

---

## Setup — Step by Step

### 1. Clone and install everything

```bash
git clone <repo-url>
cd gemma

# Install web app + server dependencies
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..

# Install Python agent dependencies
cd agent
pip install -r requirements.txt
cd ..
```

### 2. Set up API keys

**Server (.env):**
```bash
cd server
echo "GEMINI_API_KEY=your_api_key_here" > .env
echo "PORT=3001" >> .env
cd ..
```

**Agent (.env) — already created, just edit:**
```bash
# Open agent/.env and paste your API key
# It should look like:
# GEMINI_API_KEY=your_api_key_here
# MODEL_NAME=gemma-4-31b-it
# AGENT_PORT=8000
```

### 3. Find your laptop's local IP address

This is critical for the mobile app to connect to your laptop.

**On Mac:**
```bash
ipconfig getifaddr en0
```
This gives you something like `192.168.1.5` — that's your IP.

**On Windows:**
```cmd
ipconfig
```
Look for "Wireless LAN adapter" → IPv4 Address (e.g., `192.168.1.5`).

**On Linux:**
```bash
hostname -I
```

Write this down. You'll need it below.

---

## Running the Web App (Laptop only)

### Option A: Web App with Screen Share

```bash
# Terminal 1 — start both client and server
npm run dev
```

This starts:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

1. Open http://localhost:5173 in Chrome
2. Click **"Start Screen Share"**
3. Pick a mode: समझाओ / आसान करो / सुरक्षित? / गाइड
4. Type or speak your question
5. AI Saathi responds in your chosen language

### Option B: Chrome Extension

```bash
# Terminal 1 — start server only
cd server && node index.js
```

1. Open Chrome → go to `chrome://extensions/`
2. Turn on **Developer mode** (top right toggle)
3. Click **"Load unpacked"** → select the `extension/` folder
4. Go to any website
5. Click the AI Saathi floating button (bottom right)
6. Click **"Start Watching"** and ask questions

---

## Running the Mobile App (Phone + Laptop)

**Make sure your phone and laptop are on the SAME WiFi.**

### Step 1: Start the Agent Service

```bash
# Terminal 1 — Python agent
cd agent
uvicorn main:app --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

Test it works:
```bash
curl http://localhost:8000/health
# Should return: {"status":"ok","service":"ai-saathi-agent"}
```

### Step 2: Start the Express Server (fallback)

```bash
# Terminal 2 — Express server
cd server
node index.js
```

### Step 3: Configure the mobile app with your IP

Open `mobile/store/appStore.ts` and replace the IP address with yours:

```typescript
serverUrl: 'http://YOUR_IP_HERE:3001',    // e.g. http://192.168.1.5:3001
agentUrl: 'http://YOUR_IP_HERE:8000',     // e.g. http://192.168.1.5:8000
```

**Example** — if your IP is `192.168.1.12`:
```typescript
serverUrl: 'http://192.168.1.12:3001',
agentUrl: 'http://192.168.1.12:8000',
```

### Step 4: Start Expo

```bash
# Terminal 3 — Expo dev server
cd mobile
npx expo start
```

1. Expo shows a QR code in the terminal
2. Open **Expo Go** on your phone
3. **iPhone**: Point camera at QR code → tap notification
4. **Android**: Open Expo Go → tap "Scan QR code"
4. The app loads on your phone

### Step 5: Use the mobile app

1. The app opens with Google in the browser
2. Browse to any website (type URL in the address bar)
3. Tap a mode: समझाओ / आसान करो / सुरक्षित? / गाइड
4. Type your question OR tap the **mic button** (blue circle)
5. Hit send — AI Saathi responds and **speaks the answer aloud**
6. For forms: say "form bharna hai" — the AI asks for each field safely

---

## Guardrails — How AI Saathi Protects You

| Field Type | Examples | What AI Does |
|------------|----------|--------------|
| **SENSITIVE** (never fill) | Password, OTP, PIN, CVV, Credit Card, Aadhaar | Refuses to fill. Tells user "please type it yourself" |
| **CONFIRM** (ask first) | Name, Email, Phone, Address | Asks "What should I fill?" → user confirms → then fills |
| **NORMAL** (safe to fill) | Search boxes, dropdowns, general text fields | Fills automatically |
| **PAYMENT buttons** | Pay, Submit, Buy, Checkout | Asks "Are you sure?" before clicking |

**Scam detection** adds extra protection:
- Blocks form submission on pages flagged as LIKELY SCAM
- Shows red warning banner on the page
- Tells user "DO NOT proceed" in their language

---

## API Reference

### Agent Service (Python, port 8000)

#### `POST /api/agent`

Main endpoint. Sends user input + page context → LangGraph routes → Gemma 4 responds.

```json
{
  "user_input": "ye kya hai",
  "page_text": "Login page with email and password fields...",
  "page_url": "https://example.com/login",
  "page_title": "Login",
  "conversation_history": [{"role": "user", "text": "hello"}]
}
```

**Response:**
```json
{
  "response_text": "यह एक लॉगिन पेज है...",
  "tts_text": "यह एक लॉगिन पेज है",
  "actions": [{"action": "show_warning", "message": "...", "severity": "high"}],
  "guardrails": [{"action": "guardrail_block", "field_type": "password", "message": "..."}],
  "intent": "explain",
  "language": "hi"
}
```

#### `POST /api/execute-confirmed`

Execute a guardrail-protected action after user says "yes".

```json
{"action": {"action": "confirm_fill", "selector": "#name", "value": "Rahul", "field_type": "name"}}
```

#### `GET /health`

Returns `{"status": "ok", "service": "ai-saathi-agent"}`

### Express Server (Node, port 3001)

#### `POST /api/analyze`

Analyze a screenshot or page text. Used by web app and extension.

```json
{
  "screenshot": "data:image/png;base64,...",
  "pageText": "Page content...",
  "mode": "explain",
  "language": "hi",
  "question": "ye kya hai?"
}
```

#### `POST /api/capture`

Auto-capture endpoint for screen share (every 2 seconds).

#### `POST /api/session/reset`

Clear conversation history and cached context.

---

## Project Structure

```
gemma/
├── agent/                     # Python Agent Service (LangGraph + Gemma 4)
│   ├── main.py                # FastAPI server, /api/agent endpoint
│   ├── graph.py               # LangGraph StateGraph — intent routing
│   ├── tools.py               # LangChain tools with guardrails
│   ├── prompts.py             # System prompts per mode × language
│   ├── config.py              # Model name, guardrail constants
│   ├── requirements.txt       # Python dependencies
│   └── .env                   # API key + model config
│
├── mobile/                    # Expo React Native App
│   ├── app/
│   │   └── index.tsx          # Main screen — WebView + mic + guardrails
│   ├── hooks/
│   │   ├── useAnalysis.ts     # Agent service calls + fallback
│   │   └── useVoiceInput.ts   # Voice input + TTS
│   ├── store/
│   │   └── appStore.ts        # Zustand state (agent, guardrails, voice)
│   ├── utils/
│   │   └── injectScripts.ts   # WebView JS injection (fill, click, warn)
│   └── constants/
│       └── theme.ts           # Colors
│
├── server/                    # Express Backend (Web App + Extension)
│   ├── index.js               # Express routes
│   ├── gemini.js              # Gemma 4 API calls
│   ├── prompts.js             # System prompts
│   ├── contextManager.js      # OCR → dedup → context
│   ├── ocr.js                 # Tesseract.js wrapper
│   ├── similarity.js          # Dice coefficient
│   ├── sessionStore.js        # In-memory session
│   ├── websocket.js           # WebSocket notifications
│   └── .env                   # API key
│
├── client/                    # React Web App
│   ├── src/
│   │   ├── App.jsx            # Main app
│   │   └── components/        # ScreenCapture, Controls, Response, etc.
│   └── dist/                  # Built static files
│
├── extension/                 # Chrome Extension
│   ├── manifest.json          # Manifest V3
│   ├── background.js          # Screenshot capture
│   ├── content.js             # Injected panel
│   └── content.css            # Panel styles
│
└── package.json               # Root — runs client + server via concurrently
```

---

## Supported Languages

| Code | Language | Example |
|------|----------|---------|
| `hi` | Hindi (हिन्दी) | "यह क्या है?" |
| `en` | English | "What is this page?" |
| `ta` | Tamil (தமிழ்) | "இது என்ன?" |
| `bn` | Bengali (বাংলা) | "এটা কী?" |
| `mr` | Marathi (मराठी) | "हे काय आहे?" |

---

## Quick Troubleshooting

| Problem | Fix |
|---------|-----|
| Mobile can't connect | Make sure phone + laptop on **same WiFi**. Check IP in `appStore.ts` |
| Agent service not found | Run `curl http://localhost:8000/health` — if it fails, restart the agent |
| Model not found error | Make sure your API key works at [aistudio.google.com](https://aistudio.google.com) |
| `pip install` fails | Try `pip install -r requirements.txt --upgrade` |
| Expo QR code not loading | Run `npx expo start --tunnel` instead of `npx expo start` |
| "Processing" stuck on mobile | Kill and restart the agent service |

---

## Privacy

- Screenshots are sent to Google AI Studio API (Gemma 4) for analysis
- OCR text is processed locally via Tesseract.js — not sent externally
- AI only sees page content — ignores browser UI and its own panel
- No data stored beyond the active session — no database, no logs, no analytics
- Guardrails ensure passwords, OTPs, and sensitive data are never auto-filled

---

## Built With

- **Gemma 4 31B IT** — Google's latest open model via AI Studio API
- **LangGraph** — Deterministic agent orchestration with state management
- **LangChain** — Tool calling and message management

---

## License

MIT
