import { useState, useEffect } from 'react'

export default function Notification({ message, onAccept, onDismiss }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onDismiss()
    }, 15000)

    return () => clearTimeout(timer)
  }, [onDismiss])

  if (!visible) return null

  return (
    <div className="notification">
      <p className="notification-text">{message}</p>
      <div className="notification-actions">
        <button className="notification-accept" onClick={() => { setVisible(false); onAccept() }}>
          Yes, explain
        </button>
        <button className="notification-dismiss" onClick={() => { setVisible(false); onDismiss() }}>
          Dismiss
        </button>
      </div>
    </div>
  )
}
