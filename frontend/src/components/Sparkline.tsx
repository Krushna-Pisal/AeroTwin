import type { HistoryPoint } from "../types"

export function Sparkline({ points }: { points: HistoryPoint[] }) {
  const values = points.map((point) => point.pm25).filter((value): value is number => value != null)
  if (values.length < 2) {
    return <p className="text-sm text-[#57534e]">Not enough recent hours to draw a trend.</p>
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const width = 280
  const height = 72
  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width
    const y = height - ((value - min) / span) * (height - 8) - 4
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full" role="img" aria-label="Recent PM2.5 trend">
        <polyline fill="none" stroke="#9a3412" strokeWidth="2" points={coords.join(" ")} />
      </svg>
      <p className="text-xs text-[#57534e]">
        Last {values.length} observed hours. Low {min.toFixed(1)}, high {max.toFixed(1)} µg/m³.
      </p>
    </div>
  )
}
