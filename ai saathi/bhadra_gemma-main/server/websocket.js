import { WebSocketServer } from 'ws'

let wss = null

export function createWSS(server) {
  wss = new WebSocketServer({ server })

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected')

    ws.on('close', () => {
      console.log('WebSocket client disconnected')
    })
  })

  return wss
}

export function sendToClient(message) {
  if (!wss) return

  const data = JSON.stringify(message)
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(data)
    }
  }
}
