import { useState } from 'react'

export default function ScreenAnnotations({ screenshot, annotations }) {
  const [activeTooltip, setActiveTooltip] = useState(null)

  if (!annotations || annotations.length === 0 || !screenshot) return null

  return (
    <div className="annotations-wrapper">
      <div className="annotations-label">Screen Guide</div>
      <div className="annotations-container">
        <img src={screenshot} className="annotations-image" alt="Annotated screen" />
        {annotations.map((ann) => (
          <div
            key={ann.id}
            className="annotation-marker"
            style={{ left: `${ann.x * 100}%`, top: `${ann.y * 100}%` }}
            onMouseEnter={() => setActiveTooltip(ann.id)}
            onMouseLeave={() => setActiveTooltip(null)}
            onClick={() => setActiveTooltip(activeTooltip === ann.id ? null : ann.id)}
          >
            <span className="annotation-number">{ann.id}</span>
            {activeTooltip === ann.id && (
              <div className="annotation-tooltip">{ann.label}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
