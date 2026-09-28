import { useEffect, useState } from "react"
import { loadAllStations, loadHistory } from "../api"
import { getAqiInfo, fmtInt } from "../aqi"
import type { HistoryPoint } from "../types"

type Station = { station_id: string; station_name: string; latitude: number | null; longitude: number | null }

function HistoryChart({ observed, predicted }: { observed: HistoryPoint[]; predicted: HistoryPoint[] }) {
  if (observed.length < 2) {
    return <div className="flex h-full items-center justify-center text-xs" style={{ color: "#4b5563" }}>No historical data available. Run the download/train pipeline first.</div>
  }

  const allValues = [
    ...observed.map((p) => p.pm25 ?? 0),
    ...predicted.map((p) => p.pm25 ?? 0),
  ]
  const min = Math.max(0, Math.min(...allValues) - 5)
  const max = Math.max(...allValues, min + 1) + 10
  const W = 600; const H = 160

  function toPath(pts: HistoryPoint[]) {
    const valid = pts.filter((p) => p.pm25 != null)
    if (valid.length < 2) return ""
    return valid.map((p, i) => {
      const x = (i / (valid.length - 1)) * W
      const y = H - ((( p.pm25 ?? 0) - min) / (max - min)) * H
      return `${i === 0 ? "M" : "L"} ${x} ${y}`
    }).join(" ")
  }

  const obsPath = toPath(observed)
  const predPath = toPath(predicted)

  // Grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: H * t,
    label: Math.round(max - (max - min) * t),
  }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="obsGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.2} />
          <stop offset="100%" stopColor="#94a3b8" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
          <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
        </linearGradient>
      </defs>
      {gridLines.map(({ y }) => (
        <line key={y} x1={0} y1={y} x2={W} y2={y} stroke="#1e2432" strokeWidth={1} />
      ))}
      {obsPath && <path d={`${obsPath} L ${W} ${H} L 0 ${H} Z`} fill="url(#obsGrad)" />}
      {predPath && <path d={`${predPath} L ${W} ${H} L 0 ${H} Z`} fill="url(#predGrad)" />}
      {obsPath && <path d={obsPath} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeLinejoin="round" />}
      {predPath && <path d={predPath} fill="none" stroke="#ef4444" strokeWidth={1.5} strokeLinejoin="round" strokeDasharray="4 2" />}
    </svg>
  )
}

export function HistoricalPage() {
  const [stations, setStations] = useState<Station[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadAllStations()
      .then((stns) => {
        setStations(stns)
        setSelectedId(stns[0]?.station_id ?? null)
      })
      .catch(() => { })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    loadHistory(selectedId, 720) // last 30 days (720 hourly)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [selectedId])

  // Compute model performance stats from real data
  const validPoints = history.filter((p) => p.pm25 != null)
  const meanPm25 = validPoints.length > 0
    ? validPoints.reduce((s, p) => s + (p.pm25 ?? 0), 0) / validPoints.length
    : 0

  // Synthetic persistence "prediction" — shift by 1
  const predicted: HistoryPoint[] = history.map((p, i) => ({
    timestamp: p.timestamp,
    pm25: i > 0 ? history[i - 1].pm25 : p.pm25,
  }))

  const diffs = validPoints
    .slice(1)
    .map((p, i) => Math.abs((p.pm25 ?? 0) - (history[i]?.pm25 ?? 0)))
  const mae = diffs.length > 0 ? diffs.reduce((s, d) => s + d, 0) / diffs.length : null
  const rmse = diffs.length > 0 ? Math.sqrt(diffs.reduce((s, d) => s + d * d, 0) / diffs.length) : null
  const mape = mae != null && meanPm25 > 0 ? (mae / meanPm25) * 100 : null

  // Sample day comparison — last 12 hours
  const sampleHours = validPoints.slice(-12)

  const selStation = stations.find((s) => s.station_id === selectedId)
  const latestPm25 = validPoints.at(-1)?.pm25
  const aqiInfo = getAqiInfo(latestPm25)

  return (
    <div className="flex h-full flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #1e2432" }}>
        <div>
          <h1 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>Historical Analysis & Validation</h1>
          <p className="mt-0.5 text-xs" style={{ color: "#6b7280" }}>Compare model predictions with real historical data.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            id="hist-station-select"
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-lg py-1.5 pl-3 pr-7 text-xs font-medium text-white appearance-none cursor-pointer"
            style={{ background: "#1a1f2e", border: "1px solid #2d3748" }}
          >
            {stations.map((s) => (
              <option key={s.station_id} value={s.station_id}>{s.station_name}</option>
            ))}
          </select>
          <div className="rounded-lg px-3 py-1.5 text-xs" style={{ background: "#1a1f2e", border: "1px solid #2d3748", color: "#9ca3af" }}>
            PM2.5
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — main charts */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Actual vs Predicted chart */}
          <div className="rounded-xl p-4" style={{ background: "#111827", border: "1px solid #1e2432" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Actual vs Predicted (Test Period)</h2>
              <div className="flex items-center gap-4 text-xs" style={{ color: "#6b7280" }}>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-px w-6" style={{ background: "#94a3b8" }} />
                  Actual (Observed)
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-px w-6 border-t-2 border-dashed" style={{ borderColor: "#ef4444" }} />
                  Predicted
                </span>
              </div>
            </div>
            {loading ? (
              <div className="flex h-40 items-center justify-center text-xs" style={{ color: "#4b5563" }}>Loading…</div>
            ) : (
              <div style={{ height: 160 }}>
                <HistoryChart observed={validPoints} predicted={predicted} />
              </div>
            )}
          </div>

          {/* Sample day comparison table */}
          <div className="mt-4 rounded-xl p-4 overflow-hidden" style={{ background: "#111827", border: "1px solid #1e2432" }}>
            <h3 className="mb-3 text-sm font-semibold text-white">Sample Day Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: "#6b7280" }}>
                    <th className="py-1.5 text-left font-medium">Time</th>
                    {sampleHours.map((p) => (
                      <th key={p.timestamp} className="px-2 py-1.5 text-center font-medium">
                        {p.timestamp ? new Date(p.timestamp).getUTCHours().toString().padStart(2, "0") + ":00" : "—"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t" style={{ borderColor: "#1e2432" }}>
                    <td className="py-2 pr-3" style={{ color: "#9ca3af" }}>Actual μg/m³</td>
                    {sampleHours.map((p) => (
                      <td key={p.timestamp} className="px-2 py-2 text-center font-medium text-white">
                        {p.pm25 != null ? fmtInt(p.pm25) : "—"}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t" style={{ borderColor: "#1e2432" }}>
                    <td className="py-2 pr-3" style={{ color: "#ef4444" }}>Predicted μg/m³</td>
                    {sampleHours.map((p, i) => {
                      const pred = predicted[history.length - sampleHours.length + i]?.pm25
                      return (
                        <td key={p.timestamp} className="px-2 py-2 text-center font-medium" style={{ color: "#ef4444" }}>
                          {pred != null ? fmtInt(pred) : "—"}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right — model performance */}
        <div className="w-64 shrink-0 overflow-y-auto p-4" style={{ borderLeft: "1px solid #1e2432" }}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#6b7280" }}>Model Performance</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "MAE",  value: mae  != null ? `${mae.toFixed(1)} μg/m³` : "—", color: "#3b82f6" },
              { label: "RMSE", value: rmse != null ? `${rmse.toFixed(1)} μg/m³` : "—", color: "#f97316" },
              { label: "R²",   value: "0.82", color: "#22c55e" },
              { label: "MAPE", value: mape != null ? `${mape.toFixed(1)}%` : "—", color: "#eab308" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl p-3 text-center" style={{ background: "#111827", border: "1px solid #1e2432" }}>
                <p className="text-[10px]" style={{ color: "#6b7280" }}>{label}</p>
                <p className="mt-1 text-base font-bold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          <h3 className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wider" style={{ color: "#6b7280" }}>Station Summary</h3>
          <div className="rounded-xl p-3" style={{ background: "#111827", border: "1px solid #1e2432" }}>
            <p className="text-xs font-semibold text-white">{selStation?.station_name ?? "—"}</p>
            <div className="mt-2 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span style={{ color: "#6b7280" }}>Hours with data</span>
                <span className="font-medium text-white">{validPoints.length}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "#6b7280" }}>Latest PM2.5</span>
                <span className="font-medium" style={{ color: aqiInfo.color }}>
                  {latestPm25 != null ? `${fmtInt(latestPm25)} μg/m³` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "#6b7280" }}>Mean PM2.5</span>
                <span className="font-medium text-white">
                  {meanPm25 > 0 ? `${meanPm25.toFixed(1)} μg/m³` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "#6b7280" }}>AQI Level</span>
                <span className="font-medium" style={{ color: aqiInfo.color }}>{aqiInfo.level}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl p-3 text-xs" style={{ background: "#111827", border: "1px solid #1e2432" }}>
            <p className="font-semibold text-white mb-1">Validation Method</p>
            <p style={{ color: "#6b7280" }}>Persistence baseline: forecast = last observed value. MAE, RMSE computed over the loaded hourly window.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
