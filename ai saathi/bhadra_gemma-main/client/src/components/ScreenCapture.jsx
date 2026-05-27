import { useRef, useState, useEffect, useCallback } from 'react'
import useAutoCapture from '../hooks/useAutoCapture'

export default function ScreenCapture({ stream, onStreamChange, onCapture, autoCaptureActive, onAutoCapture }) {
  const videoRef = useRef(null)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const startSharing = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false
      })

      mediaStream.getVideoTracks()[0].onended = () => {
        setSharing(false)
        onStreamChange(null)
      }

      onStreamChange(mediaStream)
      setSharing(true)
    } catch (err) {
      console.error('Screen share cancelled or failed:', err)
    }
  }

  const stopSharing = async () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
    }
    onStreamChange(null)
    setSharing(false)
  }

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !stream) return null

    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)
    return canvas.toDataURL('image/png')
  }, [stream])

  useAutoCapture(videoRef, stream, autoCaptureActive && sharing, onAutoCapture)

  return (
    <div className="screen-section">
      {sharing ? (
        <div className="screen-preview">
          <video ref={videoRef} autoPlay playsInline muted />
          <div className="preview-bar">
            <span><span className="live-dot" /> Watching</span>
            <button className="stop-share-btn" onClick={stopSharing}>⏹ Stop Sharing</button>
          </div>
        </div>
      ) : (
        <div className="screen-share-prompt">
          <div className="upload-icon">🖥️</div>
          <h2>AI Saathi is not watching</h2>
          <p>Share your screen so I can help you</p>
          <button className="start-share-btn" onClick={startSharing}>
            ▶ Start Screen Share
          </button>
        </div>
      )}
    </div>
  )
}
