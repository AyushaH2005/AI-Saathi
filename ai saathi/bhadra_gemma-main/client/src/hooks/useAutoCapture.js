import { useRef, useCallback, useEffect } from 'react'

export default function useAutoCapture(videoRef, stream, isActive, onCapture) {
  const intervalRef = useRef(null)
  const canvasRef = useRef(null)

  const captureAndSend = useCallback(() => {
    const video = videoRef.current
    if (!video || !stream) return

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
    }

    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
    onCapture(dataUrl)
  }, [videoRef, stream, onCapture])

  useEffect(() => {
    if (isActive && stream) {
      intervalRef.current = setInterval(captureAndSend, 2000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isActive, stream, captureAndSend])
}
