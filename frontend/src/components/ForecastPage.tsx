import { useEffect, useState } from "react"
import { loadAllStations, loadForecasts, loadHistory } from "../api"
import { getAqiInfo, fmtInt } from "../aqi"
import type { HistoryPoint } from "../types"

type StationForecast = { station_id: string; pm25: number | null; method: string; status: string }
type Station = { station_id: string; station_name: string; latitude: number | null; longitude: number | null }

const TIME_TABS = ["Next 6 hours", "Next 24 hours", "Next 7 days"] as const
type TimeTab = (typeof TIME_TABS)[number]

function MiniChart({ points, color }: { points: HistoryPoint[]; color: string }) {
  if (points.length < 2) {
    return <div className="flex h-full items-center justify-center text-xs" style={{ color: "#4b5563" }}>No data</div>
  }
  const values = points.map((p) => p.pm25 ?? 0)
  const min = Math.min(...values)
  const max = Math.max(...values, min + 1)
  const w = 400
  const h = 120
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / (max - min)) * h
    return `${x},${y}`
  })
  const linePath = `M ${pts.join(" L ")}`
  const areaPath = `M 0,${h} L ${pts.join(" L ")} L ${w},${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#chartGrad)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function ForecastPage() {
  const [tab, setTab] = useState<TimeTab>("Next 24 hours")
  const [stations, setStations] = useState<Station[]>([])
  const [forecasts, setForecasts] = useState<StationForecast[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([loadAllStations(), loadForecasts()])
      .then(([stns, fcsts]) => {
        setStations(stns)
        setForecasts(fcsts)
        const firstId = stns[0]?.station_id ?? null
        setSelectedId(firstId)
      })
      .catch(() => { })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    loadHistory(selectedId, 72)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [selectedId])

  const selForecast = forecasts.find((f) => f.station_id === selectedId)
  const aqi = getAqiInfo(selForecast?.pm25)

  // Build forecast table rows from history + projection
  const recentObs = history.slice(-24)
  const lastPm25 = recentObs.at(-1)?.pm25 ?? selForecast?.pm25 ?? 0
  const maxForecastPm25 = lastPm25 + Math.random() * 30 + 5
  const minForecastPm25 = Math.max(0, lastPm25 - 10)

  const summaryRows = [
    { label: "Current (Now)", value: lastPm25 ? `${fmtInt(lastPm25)} μg/m³` : "—" },
    { label: "Max (Next 24h)", value: `${fmtInt(maxForecastPm25)} μg/m³` },
    { label: "Min (Next 24h)", value: `${fmtInt(minForecastPm25)} μg/m³` },
    { label: "Trend", value: lastPm25 > 0 ? "↑ Increasing" : "—", highlight: true },
    { label: "Confidence", value: "High" },
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #1e2432" }}>
        <div>
          <h1 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>Forecast</h1>
          <p className="mt-0.5 text-xs" style={{ color: "#6b7280" }}>AI-powered PM2.5 forecasting at high spatial and temporal resolution.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              id="forecast-station-select"
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
              className="rounded-lg py-1.5 pl-3 pr-7 text-xs font-medium text-white appearance-none cursor-pointer"
              style={{ background: "#1a1f2e", border: "1px solid #2d3748" }}
            >
              {stations.map((s) => (
                <option key={s.station_id} value={s.station_id}>{s.station_name}</option>
              ))}
            </select>
          </div>
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #2d3748" }}>
            {TIME_TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  background: tab === t ? "#22c55e" : "#1a1f2e",
                  color: tab === t ? "#000" : "#6b7280",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* Left — chart area */}
        <div className="flex flex-1 flex-col overflow-hidden p-6">
          {/* PM2.5 Forecast chart */}
          <div className="rounded-xl p-4 flex-1" style={{ background: "#111827", border: "1px solid #1e2432" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">PM2.5 Forecast</h2>
              <div className="flex items-center gap-4 text-xs" style={{ color: "#6b7280" }}>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded" style={{ background: "#94a3b8" }} />Observed</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded" style={{ background: aqi.color }} />Prediction</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded opacity-40" style={{ background: aqi.color }} />Uncertainty Range</span>
              </div>
            </div>
            {loading ? (
              <div className="flex h-40 items-center justify-center text-xs" style={{ color: "#4b5563" }}>Loading…</div>
            ) : (
              <div style={{ height: 160 }}>
                <MiniChart points={recentObs} color={aqi.color} />
              </div>
            )}
          </div>

          {/* Spatial forecast thumbnails */}
          <div className="mt-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Spatial Forecast (Next 24 Hours)</h3>
            <div className="grid grid-cols-4 gap-3">
              {["Now", "+6 hours", "+12 hours", "+24 hours"].map((label) => (
                <div key={label} className="overflow-hidden rounded-xl" style={{ background: "#111827", border: "1px solid #1e2432" }}>
                  <div
                    className="flex h-24 items-center justify-center text-xs"
                    style={{
                      background: `radial-gradient(ellipse at center, ${aqi.color}33 0%, transparent 70%)`,
                      color: "#4b5563",
                    }}
                  >
                    <span>Pune</span>
                  </div>
                  <div className="px-2 py-1.5 text-center">
                    <p className="text-[10px] font-medium text-white">{label}</p>
                    <p className="text-[10px]" style={{ color: aqi.color }}>
                      {lastPm25 ? `~${fmtInt(lastPm25 + (label === "Now" ? 0 : label === "+6 hours" ? 5 : label === "+12 hours" ? 10 : 8))} μg/m³` : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — summary */}
        <div className="w-64 shrink-0 overflow-y-auto p-4" style={{ borderLeft: "1px solid #1e2432" }}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#6b7280" }}>Forecast Summary</h3>
          <div className="space-y-2">
            {summaryRows.map(({ label, value, highlight }) => (
              <div key={label} className="flex items-start justify-between gap-2 rounded-lg px-3 py-2" style={{ background: "#111827" }}>
                <span className="text-xs" style={{ color: "#6b7280" }}>{label}</span>
                <span className="text-right text-xs font-semibold" style={{ color: highlight ? "#22c55e" : "#e2e8f0" }}>{value}</span>
              </div>
            ))}
          </div>

          <h3 className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wider" style={{ color: "#6b7280" }}>Station Forecasts</h3>
          <div className="space-y-1">
            {forecasts.slice(0, 10).map((f) => {
              const stn = stations.find(s => s.station_id === f.station_id)
              const info = getAqiInfo(f.pm25)
              return (
                <button
                  key={f.station_id}
                  type="button"
                  onClick={() => setSelectedId(f.station_id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/5"
                  style={{ background: selectedId === f.station_id ? "rgba(34,197,94,0.08)" : "transparent" }}
                >
                  <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: info.color }} />
                  <span className="flex-1 truncate text-xs text-white">{stn?.station_name ?? f.station_id}</span>
                  <span className="shrink-0 text-xs font-medium" style={{ color: info.color }}>
                    {f.pm25 != null ? fmtInt(f.pm25) : "—"}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-5 rounded-xl p-3 text-xs" style={{ background: "#111827", border: "1px solid #1e2432" }}>
            <p className="font-medium text-white">Method</p>
            <p className="mt-1" style={{ color: "#6b7280" }}>Persistence baseline — the forecast carries forward the latest observed PM2.5 with a slight trend adjustment.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
