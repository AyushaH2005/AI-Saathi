const MAX_HISTORY = 10

let session = createFreshSession()

function createFreshSession() {
  return {
    lastOcrText: null,
    lastImage: null,
    conversationHistory: [],
    lastRelevanceCheckTime: 0
  }
}

export function getSession() {
  return session
}

export function updateSession(partial) {
  Object.assign(session, partial)
}

export function resetSession() {
  session = createFreshSession()
}

export function addToHistory(role, text) {
  session.conversationHistory.push({ role, text })
  if (session.conversationHistory.length > MAX_HISTORY * 2) {
    session.conversationHistory = session.conversationHistory.slice(-MAX_HISTORY * 2)
  }
}

export function getConversationSummary() {
  if (session.conversationHistory.length === 0) return null
  const lastFew = session.conversationHistory.slice(-4)
  return lastFew.map(e => `${e.role}: ${e.text}`).join('\n')
}
