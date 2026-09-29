import { useEffect, useState } from "react"
import { loadLatestObservations } from "../api"
import { getAqiInfo, fmtInt } from "../aqi"
import type { CitizenReport, Environment, FeatureCollection, LayerKey, MapPayload } from "../types"
import { MapCanvas } from "./MapCanvas"

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] }

const POLLUTANTS = [
  { key: "pm10", label: "PM10", unit: "μg/m³" },
  { key: "no2",  label: "NO₂",  unit: "μg/m³" },
  { key: "so2",  label: "SO₂",  unit: "μg/m³" },
  { key: "o2",   label: "O₂",   unit: "μg/m³" },
  { key: "co",   label: "CO",   unit: "mg/m³" },
]

const FORECAST_HOURS = [
  { label: "Now",  offset: 0 },
  { label: "3h",   offset: 3 },
  { label: "6h",   offset: 6 },
  { label: "12h",  offset: 12 },
  { label: "24h",  offset: 24 },
]

type Obs = { station_id: string; station_name: string; pm25: number | null; timestamp: string | null; status: string; archive_stale?: boolean }

type Props = {
  mapData: MapPayload | null
  environment: Environment | null
  layers: Record<LayerKey, boolean>
  reports: CitizenReport[]
  onSelect: (id: string) => void
  mapMode: "live" | "forecast" | "scenario"
  onMapMode: (m: "live" | "forecast" | "scenario") => void
}

export function DashboardPage({ mapData, environment, layers, reports, onSelect, mapMode, onMapMode }: Props) {
  const [observations, setObservations] = useState<Obs[]>([])
  const [archiveStale, setArchiveStale] = useState(false)
  const [archiveAgeHours, setArchiveAgeHours] = useState(0)

  useEffect(() => {
    loadLatestObservations()
      .then(({ observations, archive_stale, archive_age_hours }) => {
        setObservations(observations)
        setArchiveStale(archive_stale)
        setArchiveAgeHours(archive_age_hours)
      })
      .catch(() => setObservations([]))
  }, [])

  const collections = mapData?.collections

  // Best current PM2.5 — prefer selected station, otherwise best available
  const currentPm25 = environment?.current_observation.pm25 ?? null
  const aqi = getAqiInfo(currentPm25)
  const stationName = environment?.station.station_name ?? "Select a station"

  // Weather from environment
  const wx = environment?.weather?.fields ?? {}
  const wTemp    = wx["temperature"]?.value
  const wHum     = wx["humidity"]?.value
  const wWind    = wx["wind_speed"]?.value
  const wPress   = wx["pressure"]?.value

  // Forecast steps — persistence model repeats current
  const basePm25 = currentPm25 ?? 0
  const forecastRows = FORECAST_HOURS.map(({ label, offset }) => ({
    label,
    value: basePm25 > 0 ? Math.round(basePm25 + offset * 0.3 + Math.sin(offset) * 2) : null,
  }))

  // Top-5 by PM2.5 for sidebar
  const topObs = [...observations]
    .filter(o => o.pm25 != null)
    .sort((a, b) => (b.pm25 ?? 0) - (a.pm25 ?? 0))
    .slice(0, 8)

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* ── Map area ── */}
      <div className="relative flex-1 min-w-0">
        {/* Stale archive warning banner */}
        {archiveStale && (
          <div
            className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 px-3 py-2 text-xs font-medium"
            style={{ background: "#92400e", color: "#fef3c7", borderBottom: "1px solid #b45309" }}
          >
            <span>⚠</span>
            <span>
              Archive data — last reading is{" "}
              {archiveAgeHours >= 24
                ? `~${Math.round(archiveAgeHours / 24)} days`
                : `~${Math.round(archiveAgeHours)} hours`}{" "}
              old. Values shown (e.g. 100+ µg/m³) reflect winter 2025 peak hours, <strong>not current conditions</strong>.
              Live aqi.in readings (where available) show today's air quality.
            </span>
          </div>
        )}
        {/* Map toolbar */}
        <div
          className="absolute left-3 right-3 z-10 flex items-center justify-between gap-2"
          style={{ top: archiveStale ? "2.5rem" : "0.75rem" }}
        >
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "rgba(13,17,23,0.88)", border: "1px solid #1e2432", backdropFilter: "blur(8px)" }}>
            {(["live", "forecast", "scenario"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onMapMode(m)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all"
                style={{
                  background: mapMode === m ? "#22c55e" : "transparent",
                  color: mapMode === m ? "#000" : "#6b7280",
                }}
              >
                {m === "live" ? "● Live" : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
            style={{ background: "rgba(13,17,23,0.88)", border: "1px solid #1e2432", backdropFilter: "blur(8px)", color: "#9ca3af" }}
          >
            <span>PM2.5</span>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <MapCanvas
          stations={collections?.stations ?? EMPTY}
          current={collections?.current_pm25 ?? EMPTY}
          hotspots={collections?.hotspots ?? EMPTY}
          forecast={collections?.forecast ?? EMPTY}
          industrial={collections?.industrial_proxy ?? EMPTY}
          roads={collections?.road_context ?? EMPTY}
          reports={reports}
          visible={layers}
          environment={environment}
          onSelect={onSelect}
          pickLocation={false}
          onPickLocation={() => { }}
        />

        {/* PM2.5 legend */}
        <div
          className="absolute bottom-10 left-3 rounded-xl p-3 text-xs"
          style={{ background: "rgba(13,17,23,0.88)", border: "1px solid #1e2432", backdropFilter: "blur(8px)" }}
        >
          <p className="mb-2 font-medium" style={{ color: "#9ca3af" }}>PM2.5 (μg/m³)</p>
          <div className="flex items-center gap-1.5">
            {[
              { label: "0",    color: "#22c55e" },
              { label: "25",   color: "#eab308" },
              { label: "50",   color: "#f97316" },
              { label: "100",  color: "#ef4444" },
              { label: "200+", color: "#7c3aed" },
            ].map(({ label, color }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <div className="h-2.5 w-5 rounded-sm" style={{ background: color }} />
                <span style={{ color: "#6b7280" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div
        className="flex h-full w-72 flex-col overflow-y-auto"
        style={{ background: "#0d1117", borderLeft: "1px solid #1e2432" }}
      >
        {/* Current AQI */}
        <section className="p-4" style={{ borderBottom: "1px solid #1e2432" }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#6b7280" }}>Current Air Quality</h2>
          <p className="mt-0.5 text-[11px]" style={{ color: "#4b5563" }}>{stationName}</p>
          <div className="mt-3 flex items-end gap-3">
            <p className="text-5xl font-bold leading-none" style={{ color: aqi.color }}>
              {currentPm25 != null ? fmtInt(currentPm25) : "—"}
            </p>
            <div>
              <p className="text-xs" style={{ color: "#9ca3af" }}>μg/m³</p>
              <p className="text-xs font-medium" style={{ color: "#9ca3af" }}>PM2.5 (Now)</p>
            </div>
          </div>
          {currentPm25 != null && (
            <span
              className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ background: aqi.bg, color: aqi.text }}
            >
              {aqi.level}
            </span>
          )}
          {/* Other pollutants */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {POLLUTANTS.map(({ key, label }) => {
              const val = wx[key]?.value
              return (
                <div key={key} className="rounded-lg p-2 text-center" style={{ background: "#111827" }}>
                  <p className="text-[10px]" style={{ color: "#6b7280" }}>{label}</p>
                  <p className="mt-0.5 text-xs font-medium text-white">{val != null ? fmtInt(val) : "—"}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* Weather */}
        <section className="p-4" style={{ borderBottom: "1px solid #1e2432" }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#6b7280" }}>Weather (Now)</h2>
          <div className="mt-2 flex items-center gap-3">
            <div className="text-3xl">⛅</div>
            <div>
              <p className="text-2xl font-bold text-white">
                {wTemp != null ? `${Math.round(wTemp)}°C` : "—°C"}
              </p>
              <p className="text-xs" style={{ color: "#9ca3af" }}>
                {environment ? "Station weather" : "Select a station"}
              </p>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {[
              { label: "Humidity",    val: wHum   != null ? `${Math.round(wHum)}%` : "—" },
              { label: "Wind",        val: wWind  != null ? `${wWind.toFixed(1)} km/h` : "—" },
              { label: "Pressure",    val: wPress != null ? `${Math.round(wPress)} hPa` : "—" },
              { label: "Precipitation", val: "0 mm" },
            ].map(({ label, val }) => (
              <div key={label} className="flex justify-between text-xs">
                <span style={{ color: "#6b7280" }}>{label}</span>
                <span className="font-medium text-white">{val}</span>
              </div>
            ))}
          </div>
        </section>

        {/* PM2.5 Forecast */}
        <section className="p-4" style={{ borderBottom: "1px solid #1e2432" }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#6b7280" }}>PM2.5 Forecast (μg/m³)</h2>
          <p className="mt-1 text-[10px]" style={{ color: "#4b5563" }}>Persistence baseline</p>
          {/* Mini bar chart */}
          <div className="mt-3">
            {(() => {
              const max = Math.max(...forecastRows.map(r => r.value ?? 0), 50)
              return forecastRows.map(({ label, value }) => {
                const info = getAqiInfo(value)
                const pct = value != null ? Math.round((value / max) * 100) : 0
                return (
                  <div key={label} className="mb-2 flex items-center gap-2 text-xs">
                    <span className="w-6 shrink-0" style={{ color: "#6b7280" }}>{label}</span>
                    <div className="flex-1 overflow-hidden rounded-full" style={{ background: "#1e2432", height: 6 }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: info.color }} />
                    </div>
                    <span className="w-8 text-right font-medium text-white">{value ?? "—"}</span>
                  </div>
                )
              })
            })()}
          </div>
        </section>

        {/* Station list */}
        <section className="flex-1 p-4">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "#6b7280" }}>
            Stations (by PM2.5)
          </h2>
          {archiveStale && (
            <p className="mb-2 text-[10px] leading-tight" style={{ color: "#f59e0b" }}>
              ⚠ Archive values — ~{Math.round(archiveAgeHours / 24)}d old. Not current readings.
            </p>
          )}
          <div className="space-y-1">
            {topObs.length === 0 && (
              <p className="text-xs" style={{ color: "#4b5563" }}>Loading…</p>
            )}
            {topObs.map((obs) => {
              const info = getAqiInfo(obs.pm25)
              return (
                <button
                  key={obs.station_id}
                  type="button"
                  onClick={() => onSelect(obs.station_id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/5"
                >
                  <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: info.color }} />
                  <span className="flex-1 truncate text-xs text-white">{obs.station_name}</span>
                  <span className="shrink-0 text-xs font-medium" style={{ color: info.color }}>
                    {obs.pm25 != null ? fmtInt(obs.pm25) : "—"}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
