/**
 * Statewide PM2.5 map for Maharashtra. Monitor values come from OpenAQ.
 * Only a monitor hour reported within the last 3 hours is OBSERVED. The
 * surface, point estimates and every future hour are MODELED.
 */

import maplibregl from "maplibre-gl"
import { cellToBoundary, polygonToCells } from "h3-js"
import { useEffect, useMemo, useRef, useState } from "react"
import { loadMhPoint, loadMhStation, loadMhStations } from "../api"
import { getAqiInfo } from "../aqi"
import { ageLabel, pm25, utcTime } from "../format"
import type { MhForecastRow, MhPointEstimate, MhStation, MhStationDetail, MhStationsPayload } from "../types"
import { StatusBadge } from "./StatusBadge"

const CENTER: [number, number] = [76.8, 19.1]
const H3_RES = 5
const IDW_NEIGHBOURS = 4
const IDW_MAX_KM = 150

const PM_COLOR: maplibregl.ExpressionSpecification = [
  "step",
  ["get", "pm"],
  "#6b7280",
  0,
  "#22c55e",
  30.01,
  "#eab308",
  60.01,
  "#f97316",
  90.01,
  "#ef4444",
  120.01,
  "#a855f7",
  250.01,
  "#7f1d1d",
]

type Selection = { kind: "station"; data: MhStationDetail } | { kind: "point"; data: MhPointEstimate }

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}

function buildSurface(boundary: GeoJSON.FeatureCollection | null, stations: MhStation[]): GeoJSON.FeatureCollection {
  const usable = stations.filter((s) => s.now_pm25 != null)
  if (!boundary || usable.length === 0) return { type: "FeatureCollection", features: [] }
  const cells = new Set<string>()
  for (const feature of boundary.features) {
    const geometry = feature.geometry
    const polygons =
      geometry.type === "MultiPolygon" ? geometry.coordinates : geometry.type === "Polygon" ? [geometry.coordinates] : []
    for (const polygon of polygons) {
      const outer = polygon[0].map(([lon, lat]) => [lat, lon] as [number, number])
      for (const cell of polygonToCells([outer], H3_RES)) cells.add(cell)
    }
  }
  const features: GeoJSON.Feature[] = []
  for (const cell of cells) {
    const boundaryLatLng = cellToBoundary(cell)
    const lat = boundaryLatLng.reduce((sum, p) => sum + p[0], 0) / boundaryLatLng.length
    const lon = boundaryLatLng.reduce((sum, p) => sum + p[1], 0) / boundaryLatLng.length
    const near = usable
      .map((s) => ({ s, d: haversineKm(lat, lon, s.latitude, s.longitude) }))
      .filter((n) => n.d <= IDW_MAX_KM)
      .sort((a, b) => a.d - b.d)
      .slice(0, IDW_NEIGHBOURS)
    if (near.length === 0) continue
    let num = 0
    let den = 0
    for (const { s, d } of near) {
      const w = 1 / Math.max(d, 0.5) ** 2
      num += w * (s.now_pm25 as number)
      den += w
    }
    const ring = boundaryLatLng.map(([la, lo]) => [lo, la])
    ring.push(ring[0])
    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [ring] },
      properties: { pm: Math.round((num / den) * 10) / 10, nearest_km: Math.round(near[0].d) },
    })
  }
  return { type: "FeatureCollection", features }
}

function stationsGeo(payload: MhStationsPayload | null): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: (payload?.features ?? []).map((f) => ({
      type: "Feature",
      geometry: f.geometry,
      properties: {
        id: f.properties.location_id,
        name: f.properties.name,
        pm: f.properties.now_pm25 ?? -1,
        status: f.properties.now_status,
      },
    })),
  }
}

function leadLabel(hours: number): string {
  if (hours === 0) return "Now"
  if (hours < 24) return `+${hours} h`
  const days = Math.floor(hours / 24)
  const rest = hours % 24
  return rest ? `+${days} d ${rest} h` : `+${days} d`
}

export function MaharashtraMap() {
  const container = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const [ready, setReady] = useState(false)
  const [boundary, setBoundary] = useState<GeoJSON.FeatureCollection | null>(null)
  const [payload, setPayload] = useState<MhStationsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSurface, setShowSurface] = useState(true)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [loadingSelection, setLoadingSelection] = useState(false)
  const [lead, setLead] = useState(0)

  const stations = useMemo(() => (payload?.features ?? []).map((f) => f.properties), [payload])
  const surface = useMemo(() => buildSurface(boundary, stations), [boundary, stations])
  const warming = payload != null && payload.stations_read < payload.stations_listed

  useEffect(() => {
    fetch("/api/maharashtra/boundary")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setBoundary)
      .catch(() => setError("Maharashtra boundary failed to load. Start FastAPI on port 8000, then refresh."))
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    const tick = () => {
      loadMhStations()
        .then((next) => {
          if (cancelled) return
          setPayload(next)
          setError(null)
          const again = next.stations_read < next.stations_listed ? 10_000 : 120_000
          timer = window.setTimeout(tick, again)
        })
        .catch(() => {
          if (cancelled) return
          setError("Statewide readings failed to load. Start FastAPI on port 8000, then refresh.")
          timer = window.setTimeout(tick, 15_000)
        })
    }
    tick()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  function placeMarker(lon: number, lat: number) {
    const map = mapRef.current
    if (!map) return
    markerRef.current?.remove()
    markerRef.current = new maplibregl.Marker({ color: "#22c55e", scale: 0.7 }).setLngLat([lon, lat]).addTo(map)
  }

  function selectStation(id: number, lon: number, lat: number) {
    setLoadingSelection(true)
    setLead(0)
    placeMarker(lon, lat)
    loadMhStation(id)
      .then((data) => setSelection({ kind: "station", data }))
      .catch(() => setError("Station detail failed to load."))
      .finally(() => setLoadingSelection(false))
  }

  function selectPoint(lon: number, lat: number) {
    setLoadingSelection(true)
    setLead(0)
    placeMarker(lon, lat)
    loadMhPoint(lat, lon)
      .then((data) => setSelection({ kind: "point", data }))
      .catch(() => setError("Point estimate failed to load."))
      .finally(() => setLoadingSelection(false))
  }

  function pickFromList(station: MhStation) {
    mapRef.current?.flyTo({ center: [station.longitude, station.latitude], zoom: 10 })
    selectStation(station.location_id, station.longitude, station.latitude)
  }

  useEffect(() => {
    if (!container.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: container.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: CENTER,
      zoom: 5.9,
      minZoom: 5,
      attributionControl: { customAttribution: "Boundary: geoBoundaries (CC BY 2.5 IN) · PM2.5: OpenAQ" },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")
    map.on("load", () => {
      const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] }
      map.addSource("mh-surface", { type: "geojson", data: empty })
      map.addSource("mh-boundary", { type: "geojson", data: empty })
      map.addSource("mh-stations", { type: "geojson", data: empty })
      map.addLayer({
        id: "mh-surface",
        type: "fill",
        source: "mh-surface",
        paint: { "fill-color": PM_COLOR, "fill-opacity": 0.33, "fill-outline-color": "rgba(0,0,0,0)" },
      })
      map.addLayer({
        id: "mh-boundary",
        type: "line",
        source: "mh-boundary",
        paint: { "line-color": "#94a3b8", "line-width": 1.4 },
      })
      map.addLayer({
        id: "mh-stations",
        type: "circle",
        source: "mh-stations",
        paint: {
          "circle-color": PM_COLOR,
          "circle-radius": ["match", ["get", "status"], "OBSERVED", 8, "MODELED", 6, 4],
          "circle-opacity": ["match", ["get", "status"], "OBSERVED", 1, "MODELED", 0.85, 0.6],
          "circle-stroke-color": ["match", ["get", "status"], "OBSERVED", "#ffffff", "#0f1117"],
          "circle-stroke-width": ["match", ["get", "status"], "OBSERVED", 2.5, 1],
        },
      })
      setReady(true)
    })
    map.on("mouseenter", "mh-stations", () => (map.getCanvas().style.cursor = "pointer"))
    map.on("mouseleave", "mh-stations", () => (map.getCanvas().style.cursor = ""))
    map.on("click", (event) => {
      const hit = map.queryRenderedFeatures(event.point, { layers: ["mh-stations"] })[0]
      if (hit) {
        const [lon, lat] = (hit.geometry as GeoJSON.Point).coordinates
        selectStation(Number(hit.properties?.id), lon, lat)
      } else {
        selectPoint(event.lngLat.lng, event.lngLat.lat)
      }
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!ready || !boundary) return
    ;(mapRef.current?.getSource("mh-boundary") as maplibregl.GeoJSONSource | undefined)?.setData(boundary)
  }, [ready, boundary])

  useEffect(() => {
    if (!ready) return
    ;(mapRef.current?.getSource("mh-stations") as maplibregl.GeoJSONSource | undefined)?.setData(stationsGeo(payload))
  }, [ready, payload])

  useEffect(() => {
    if (!ready) return
    ;(mapRef.current?.getSource("mh-surface") as maplibregl.GeoJSONSource | undefined)?.setData(surface)
  }, [ready, surface])

  useEffect(() => {
    if (!ready) return
    mapRef.current?.setLayoutProperty("mh-surface", "visibility", showSurface ? "visible" : "none")
  }, [ready, showSurface])

  const counts = payload?.counts

  return (
    <div className="flex h-full min-h-0">
      <div className="relative min-w-0 flex-1">
        <div ref={container} style={{ position: "absolute", inset: 0 }} />

        <div className="absolute left-4 top-4 z-10 max-w-md space-y-2 rounded-xl border border-[#1e2432] bg-[#0d1117]/90 p-3 text-xs text-slate-300 backdrop-blur">
          <p className="text-sm font-semibold text-white">Maharashtra PM2.5</p>
          {payload && !payload.api_key_set && (
            <p className="text-amber-300">OPENAQ_API_KEY is not set on the backend. No readings are requested.</p>
          )}
          {counts && (
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <span>
                <span className="font-semibold text-white">{counts.OBSERVED}</span> reported in the last{" "}
                {payload?.observed_max_age_hours ?? 3} h
              </span>
              <span>
                <span className="font-semibold text-white">{counts.MODELED}</span> estimated from own recent hours
              </span>
              <span>
                <span className="font-semibold text-white">{counts.DATA_UNAVAILABLE}</span> no usable value
              </span>
            </div>
          )}
          {warming && (
            <p className="text-sky-300">
              Reading monitors from OpenAQ: {payload?.stations_read} of {payload?.stations_listed}. Paced to the API
              rate limit.
            </p>
          )}
          <p className="text-slate-500">
            Click a monitor for its reading and forecast. Click anywhere else for an estimate from the nearest monitors.
          </p>
          <label className="flex items-center gap-2 text-slate-400">
            <input type="checkbox" checked={showSurface} onChange={(e) => setShowSurface(e.target.checked)} />
            Show modeled surface (inverse-distance from monitors)
          </label>
        </div>

        <Legend />

        {error && (
          <div className="absolute bottom-4 left-4 z-10 rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}
      </div>

      <aside className="w-[400px] shrink-0 overflow-y-auto border-l border-[#1e2432] bg-[#0d1117] p-5 text-sm text-slate-300">
        {loadingSelection && <p className="text-slate-500">Loading…</p>}
        {!loadingSelection && !selection && <EmptyPanel payload={payload} onPick={pickFromList} />}
        {!loadingSelection && selection && (
          <button
            type="button"
            onClick={() => {
              setSelection(null)
              markerRef.current?.remove()
            }}
            className="mb-3 text-xs text-slate-500 hover:text-slate-300"
          >
            ← All monitors
          </button>
        )}
        {!loadingSelection && selection?.kind === "station" && (
          <StationPanel detail={selection.data} lead={lead} onLead={setLead} />
        )}
        {!loadingSelection && selection?.kind === "point" && (
          <PointPanel point={selection.data} lead={lead} onLead={setLead} />
        )}
      </aside>
    </div>
  )
}

function Legend() {
  const rows: [string, string][] = [
    ["#22c55e", "0–30"],
    ["#eab308", "31–60"],
    ["#f97316", "61–90"],
    ["#ef4444", "91–120"],
    ["#a855f7", "121–250"],
    ["#7f1d1d", "250+"],
  ]
  return (
    <div className="absolute bottom-8 right-4 z-10 rounded-xl border border-[#1e2432] bg-[#0d1117]/90 p-3 text-[11px] text-slate-300">
      <p className="mb-1.5 font-semibold text-slate-200">PM2.5 µg/m³</p>
      {rows.map(([color, label]) => (
        <div key={label} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          {label}
        </div>
      ))}
      <div className="mt-2 space-y-1 border-t border-[#1e2432] pt-2">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border-2 border-white bg-slate-400" /> Reported in last 3 h
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-400 opacity-80" /> Estimated
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-slate-500 opacity-60" /> No usable value
        </div>
      </div>
    </div>
  )
}

function EmptyPanel({ payload, onPick }: { payload: MhStationsPayload | null; onPick: (s: MhStation) => void }) {
  const live = (payload?.features ?? [])
    .map((f) => f.properties)
    .filter((s) => s.now_status === "OBSERVED")
    .sort((a, b) => (b.now_pm25 ?? 0) - (a.now_pm25 ?? 0))
  const [query, setQuery] = useState("")
  const needle = query.trim().toLowerCase()
  const all = (payload?.features ?? [])
    .map((f) => f.properties)
    .filter((s) => !needle || s.name.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name))
  return (
    <div className="space-y-4">
      <div>
        <p className="text-base font-semibold text-white">Pick a place</p>
        <p className="mt-1 text-slate-400">
          Monitors reporting within the last 3 hours are labelled OBSERVED. Every other value on this page is a MODELED
          estimate and is labelled that way.
        </p>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Reporting now</p>
        {live.length === 0 && <p className="text-slate-500">No monitor has reported in the last 3 hours.</p>}
        <ul className="space-y-1.5">
          {live.map((s) => (
            <li key={s.location_id}>
              <button
                type="button"
                onClick={() => onPick(s)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left hover:bg-[#111827]"
              >
                <span className="truncate">{s.name}</span>
                <span className="font-mono" style={{ color: getAqiInfo(s.now_pm25).text }}>
                  {s.now_pm25?.toFixed(1)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">All monitors</p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a city or monitor"
          className="mb-2 w-full rounded-lg border border-[#1e2432] bg-[#111827] px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600"
        />
        <ul className="max-h-[45vh] space-y-0.5 overflow-y-auto">
          {all.map((s) => (
            <li key={s.location_id}>
              <button
                type="button"
                onClick={() => onPick(s)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-xs hover:bg-[#111827]"
              >
                <span className="truncate text-slate-300">{s.name}</span>
                <span className="flex shrink-0 items-center gap-1.5 font-mono">
                  <span style={{ color: getAqiInfo(s.now_pm25).text }}>
                    {s.now_pm25 == null ? "—" : s.now_pm25.toFixed(1)}
                  </span>
                  <span className="text-[9px] text-slate-500">
                    {s.now_status === "OBSERVED" ? "OBS" : s.now_status === "MODELED" ? "EST" : "N/A"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {payload?.last_refresh_utc && (
        <p className="text-xs text-slate-500">Last full OpenAQ pass {utcTime(payload.last_refresh_utc)}.</p>
      )}
      <p className="text-xs text-slate-500">Source: {payload?.source ?? "OpenAQ v3"}</p>
    </div>
  )
}

function BigValue({ value, status, caption }: { value: number | null; status: string; caption: string }) {
  const info = getAqiInfo(value)
  return (
    <div className="rounded-xl border border-[#1e2432] p-4" style={{ background: info.bg }}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-slate-400">{caption}</span>
        <StatusBadge status={status} />
      </div>
      <p className="mt-2 text-3xl font-bold" style={{ color: info.text }}>
        {value == null ? "—" : value.toFixed(1)}
        <span className="ml-1 text-sm font-normal text-slate-400">µg/m³</span>
      </p>
      <p className="text-xs" style={{ color: info.text }}>
        {info.level}
      </p>
    </div>
  )
}

function ForecastSlider({
  forecast,
  lead,
  onLead,
  note,
}: {
  forecast: MhForecastRow[]
  lead: number
  onLead: (h: number) => void
  note: string
}) {
  const row = forecast[lead]
  if (!row) return null
  const max = forecast.length - 1
  return (
    <div className="space-y-3 rounded-xl border border-[#1e2432] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Forecast</span>
        <span className="font-mono text-xs text-slate-300">{leadLabel(lead)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={lead}
        onChange={(e) => onLead(Number(e.target.value))}
        className="w-full accent-green-500"
        aria-label="Forecast lead time in hours"
      />
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>Now</span>
        <span>+1 d</span>
        <span>+3 d</span>
        <span>+7 d</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold" style={{ color: getAqiInfo(row.pm25).text }}>
            {pm25(row.pm25)}
          </p>
          <p className="text-xs text-slate-500">{utcTime(row.valid_utc)}</p>
        </div>
        <StatusBadge status={row.status} />
      </div>
      {row.typical_error != null && (
        <p className="text-xs text-slate-400">
          Typical error at this lead: ±{row.typical_error.toFixed(1)} µg/m³ (mean absolute error in a backtest on
          OpenAQ hourly data).
        </p>
      )}
      <p className="text-[11px] leading-relaxed text-slate-500">{note}</p>
    </div>
  )
}

function Chart({
  recent,
  forecast,
  lead,
}: {
  recent: { utc: string; pm25: number }[]
  forecast: MhForecastRow[]
  lead: number
}) {
  const points = forecast.filter((r) => r.pm25 != null)
  if (points.length === 0 && recent.length === 0) return null
  const times = [...recent.map((r) => Date.parse(r.utc)), ...points.map((r) => Date.parse(r.valid_utc))]
  const values = [...recent.map((r) => r.pm25), ...points.map((r) => r.pm25 as number)]
  const t0 = Math.min(...times)
  const t1 = Math.max(...times)
  const vMax = Math.max(10, ...values) * 1.1
  const W = 360
  const H = 130
  const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * (W - 8) + 4
  const y = (v: number) => H - 14 - (v / vMax) * (H - 24)
  const recentPath = recent.map((r, i) => `${i ? "L" : "M"}${x(Date.parse(r.utc))},${y(r.pm25)}`).join(" ")
  const forecastPath = points.map((r, i) => `${i ? "L" : "M"}${x(Date.parse(r.valid_utc))},${y(r.pm25 as number)}`).join(" ")
  const at = forecast[lead]
  const nowX = points.length ? x(Date.parse(points[0].valid_utc)) : null
  return (
    <div className="rounded-xl border border-[#1e2432] p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {nowX != null && <line x1={nowX} x2={nowX} y1={4} y2={H - 14} stroke="#334155" strokeDasharray="2 3" />}
        <path d={recentPath} fill="none" stroke="#e2e8f0" strokeWidth={1.5} />
        <path d={forecastPath} fill="none" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="4 3" />
        {at?.pm25 != null && (
          <circle cx={x(Date.parse(at.valid_utc))} cy={y(at.pm25)} r={4} fill="#22c55e" stroke="#0f1117" />
        )}
        <text x={4} y={H - 2} fill="#64748b" fontSize={9}>
          {utcTime(new Date(t0).toISOString())}
        </text>
        <text x={W - 4} y={H - 2} fill="#64748b" fontSize={9} textAnchor="end">
          {utcTime(new Date(t1).toISOString())}
        </text>
      </svg>
      <div className="mt-1 flex gap-4 text-[10px] text-slate-500">
        {recent.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-slate-200" /> Monitor hours (OBSERVED)
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 border-t border-dashed border-sky-400" /> Forecast (MODELED)
        </span>
      </div>
    </div>
  )
}

function StationPanel({ detail, lead, onLead }: { detail: MhStationDetail; lead: number; onLead: (h: number) => void }) {
  const s = detail.station
  const live = s.now_status === "OBSERVED"
  return (
    <div className="space-y-4">
      <div>
        <p className="text-base font-semibold text-white">{s.name}</p>
        <p className="text-xs text-slate-500">
          OpenAQ location {s.location_id}
          {s.provider ? ` · ${s.provider}` : ""} · {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
        </p>
      </div>
      <BigValue value={s.now_pm25} status={s.now_status} caption={live ? "Live reading" : "Current hour estimate"} />
      <div className="rounded-xl border border-[#1e2432] p-3 text-xs">
        <p className="text-slate-400">Last monitor hour</p>
        <p className="mt-0.5 text-slate-200">
          {pm25(s.last_pm25)}
          {s.last_utc ? ` · ${utcTime(s.last_utc)} · ${ageLabel(s.age_hours)}` : ""}
        </p>
        <p className="mt-2 text-slate-500">{s.now_basis}</p>
      </div>
      {detail.forecast.some((r) => r.pm25 != null) ? (
        <>
          <ForecastSlider forecast={detail.forecast} lead={lead} onLead={onLead} note={detail.forecast_note} />
          <Chart recent={detail.recent_hours} forecast={detail.forecast} lead={lead} />
        </>
      ) : (
        <p className="text-xs text-slate-500">No forecast: this monitor has no recent hours to build one from.</p>
      )}
    </div>
  )
}

function PointPanel({ point, lead, onLead }: { point: MhPointEstimate; lead: number; onLead: (h: number) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-base font-semibold text-white">Selected point</p>
        <p className="text-xs text-slate-500">
          {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)} · no monitor here
        </p>
      </div>
      {point.now_pm25 == null ? (
        <p className="rounded-xl border border-dashed border-[#334155] p-4 text-slate-400">{point.detail}</p>
      ) : (
        <>
          <BigValue value={point.now_pm25} status={point.now_status} caption="Estimated current hour" />
          <div className="rounded-xl border border-[#1e2432] p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Confidence</span>
              <span className="font-semibold text-slate-200">
                {point.confidence} · nearest monitor {point.nearest_km} km
              </span>
            </div>
            <p className="mt-2 text-slate-500">{point.detail}</p>
            <ul className="mt-2 space-y-1">
              {point.neighbours.map((n) => (
                <li key={n.location_id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-slate-300">{n.name}</span>
                  <span className="shrink-0 font-mono text-slate-400">
                    {n.distance_km} km · {n.now_pm25.toFixed(1)} · {Math.round(n.weight * 100)}% weight
                    {n.now_status === "OBSERVED" ? " · live" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <ForecastSlider forecast={point.forecast} lead={lead} onLead={onLead} note={point.forecast_note} />
          <Chart recent={[]} forecast={point.forecast} lead={lead} />
        </>
      )}
    </div>
  )
}
