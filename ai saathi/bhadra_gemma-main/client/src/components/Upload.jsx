import { useRef, useState } from 'react'

export default function Upload({ screenshot, onUpload, onRemove }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = (e) => onUpload(e.target.result)
    reader.readAsDataURL(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        handleFile(item.getAsFile())
        break
      }
    }
  }

  if (screenshot) {
    return (
      <div className="upload-preview" onClick={onRemove}>
        <img src={screenshot} alt="Screenshot preview" />
        <div className="upload-overlay">
          <span>Tap to change</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`upload-area ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onPaste={handlePaste}
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
    >
      <div className="upload-content">
        <div className="upload-icon">📸</div>
        <h2>Upload Screenshot</h2>
        <p>Drag & drop, paste, or tap to select</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFile(e.target.files[0])}
        hidden
      />
    </div>
  )
}
