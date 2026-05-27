// Listen for capture requests from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'capture') {
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' })
      .then((dataUrl) => {
        sendResponse({ screenshot: dataUrl })
      })
      .catch((err) => {
        console.error('Capture failed:', err)
        sendResponse({ error: err.message })
      })
    return true // async response
  }
})
