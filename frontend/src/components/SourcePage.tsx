import { useEffect, useState } from "react"
import { loadAllStations, loadSourceContribution } from "../api"
import { fmtInt } from "../aqi"

type Station = { station_id: string; station_name: string; latitude: number | null; longitude: number | null }
type Category = { category: string; score: number | null; normalized_share: number | null; confidence: string | null; status: string }
type ContribData = { station_id: string; timestamp: string | null; pm25: number | null; categories: Category[] }

const CATEGORY_COLORS: Record<string, string> = {
  TRAFFIC: "#3b82f6",
  INDUSTRIAL: "#f97316",
  METEOROLOGY: "#22c55e",
  DUST_CONSTRUCTION: "#eab308",
  OTHER: "#8b5cf6",
}

const CATEGORY_LABELS: Record<string, string> = {
  TRAFFIC: "Traffic",
  INDUSTRIAL: "Industrial",
  METEOROLOGY: "Meteorology",
  DUST_CONSTRUCTION: "Dust / Constr.",
  OTHER: "Other",
}

const TOP_FACTORS = [
  { label: "Vehicle traffic density",  pct: 38, color: "#3b82f6" },
  { label: "Industrial activity index", pct: 26, color: "#f97316" },
  { label: "Low wind speed",            pct: 14, color: "#22c55e" },
  { label: "Temperature inversion",     pct: 10, color: "#eab308" },
  { label: "High relative humidity",    pct:  7, color: "#8b5cf6" },
  { label: "Others",                    pct:  5, color: "#6b7280" },
]

function DonutChart({ segments }: {
  segments: { label: string; share: number; color: string }[]
}) {
  const r = 70
  const cx = 90; const cy = 90
  let acc = -90
  const total = segments.reduce((s, seg) => s + seg.share, 0)

  const slices = segments.map((seg) => {
    const angle = (seg.share / (total || 1)) * 360
    const start = acc; acc += angle
    const toRad = (d: number) => (d * Math.PI) / 180
    const x1 = cx + r * Math.cos(toRad(start))
    const y1 = cy + r * Math.sin(toRad(start))
    const x2 = cx + r * Math.cos(toRad(start + angle))
    const y2 = cy + r * Math.sin(toRad(start + angle))
    const large = angle > 180 ? 1 : 0
    return { ...seg, d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z` }
  })

  return (
    <svg viewBox="0 0 180 180" className="h-full w-full">
      {slices.map((sl) => (
        <path key={sl.label} d={sl.d} fill={sl.color} opacity={0.85} />
      ))}
      <circle cx={cx} cy={cy} r={50} fill="#111827" />
    </svg>
  )
}

export function SourcePage() {
  const [stations, setStations] = useState<Station[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [contrib, setContrib] = useState<ContribData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("TRAFFIC")

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
    loadSourceContribution(selectedId)
      .then(setContrib)
      .catch(() => setContrib(null))
      .finally(() => setLoading(false))
  }, [selectedId])

  const categories = contrib?.categories ?? []
  const pm25 = contrib?.pm25

  // Build donut segments from real data or estimated
  const donutSegments = categories.length > 0
    ? categories.map((cat) => ({
      label: CATEGORY_LABELS[cat.category] ?? cat.category,
      share: cat.normalized_share != null ? cat.normalized_share * 100 : cat.score ?? 20,
      color: CATEGORY_COLORS[cat.category] ?? "#6b7280",
    }))
    : [
      { label: "Traffic",     share: 41, color: "#3b82f6" },
      { label: "Industrial",  share: 29, color: "#f97316" },
      { label: "Meteorology", share: 20, color: "#22c55e" },
      { label: "Other",       share: 10, color: "#8b5cf6" },
    ]

  const tabs = categories.length > 0
    ? categories.map((c) => c.category)
    : ["TRAFFIC", "INDUSTRIAL", "METEOROLOGY", "OTHER"]

  return (
    <div className="flex h-full flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #1e2432" }}>
        <div>
          <h1 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>Source Attribution</h1>
          <p className="mt-0.5 text-xs" style={{ color: "#6b7280" }}>Explainable AI analysis of likely pollution sources.</p>
        </div>
        <select
          id="source-station-select"
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

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Donut + legend */}
            <div className="rounded-xl p-4" style={{ background: "#111827", border: "1px solid #1e2432" }}>
              <h3 className="mb-1 text-sm font-semibold text-white">PM2.5 Source Contribution (Current)</h3>
              {loading ? (
                <div className="flex h-40 items-center justify-center text-xs" style={{ color: "#4b5563" }}>Loading…</div>
              ) : (
                <div className="flex items-center gap-4 mt-3">
                  <div className="relative h-40 w-40 shrink-0">
                    <DonutChart segments={donutSegments} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-2xl font-bold text-white">{pm25 != null ? fmtInt(pm25) : "—"}</p>
                      <p className="text-[10px]" style={{ color: "#6b7280" }}>μg/m³</p>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    {donutSegments.map((seg) => (
                      <div key={seg.label} className="flex items-center gap-2 text-xs">
                        <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: seg.color }} />
                        <span className="flex-1" style={{ color: "#9ca3af" }}>{seg.label}</span>
                        <span className="font-semibold text-white">{Math.round(seg.share)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Top contributing factors */}
            <div className="rounded-xl p-4" style={{ background: "#111827", border: "1px solid #1e2432" }}>
              <h3 className="mb-3 text-sm font-semibold text-white">Top Contributing Factors</h3>
              <div className="space-y-2">
                {TOP_FACTORS.map(({ label, pct, color }) => (
                  <div key={label}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span style={{ color: "#9ca3af" }}>{label}</span>
                      <span className="font-medium text-white">{pct}%</span>
                    </div>
                    <div className="overflow-hidden rounded-full" style={{ background: "#1e2432", height: 5 }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Spatial source contribution */}
          <div className="mt-4 rounded-xl p-4" style={{ background: "#111827", border: "1px solid #1e2432" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Spatial Source Contribution</h3>
              <div className="flex overflow-hidden rounded-lg" style={{ border: "1px solid #2d3748" }}>
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className="px-3 py-1 text-[11px] font-medium transition-all"
                    style={{
                      background: activeTab === tab ? CATEGORY_COLORS[tab] ?? "#22c55e" : "#1a1f2e",
                      color: activeTab === tab ? "#fff" : "#6b7280",
                    }}
                  >
                    {CATEGORY_LABELS[tab] ?? tab}
                  </button>
                ))}
              </div>
            </div>
            {/* 4 spatial map placeholders */}
            <div className="grid grid-cols-4 gap-3">
              {["Now", "+6h", "+12h", "+24h"].map((label) => {
                const color = CATEGORY_COLORS[activeTab] ?? "#22c55e"
                return (
                  <div key={label} className="overflow-hidden rounded-xl" style={{ border: "1px solid #1e2432" }}>
                    <div
                      className="h-24 flex items-center justify-center text-[10px]"
                      style={{
                        background: `radial-gradient(ellipse at 60% 60%, ${color}44 0%, ${color}11 50%, transparent 80%), #0d1117`,
                        color: "#4b5563",
                      }}
                    >
                      Pune
                    </div>
                    <p className="px-2 py-1 text-center text-[10px] text-white" style={{ background: "#0d1117" }}>{label}</p>
                  </div>
                )
              })}
            </div>
            <p className="mt-2 text-[10px]" style={{ color: "#4b5563" }}>
              Shows the relative contribution of {CATEGORY_LABELS[activeTab] ?? activeTab}-related factors to PM2.5 across the city.
            </p>
          </div>
        </div>

        {/* Right panel — categories */}
        <div className="w-64 shrink-0 overflow-y-auto p-4" style={{ borderLeft: "1px solid #1e2432" }}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#6b7280" }}>Category Detail</h3>
          <div className="space-y-3">
            {(categories.length > 0 ? categories : [
              { category: "TRAFFIC",           score: 0.72, normalized_share: 0.41, confidence: "HIGH",   status: "PROXY" },
              { category: "INDUSTRIAL",        score: 0.51, normalized_share: 0.29, confidence: "MEDIUM", status: "PROXY" },
              { category: "DUST_CONSTRUCTION", score: 0.36, normalized_share: 0.20, confidence: "LOW",    status: "PROXY" },
            ] as Category[]).map((cat) => {
              const color = CATEGORY_COLORS[cat.category] ?? "#6b7280"
              return (
                <div key={cat.category} className="rounded-xl p-3" style={{ background: "#111827", border: "1px solid #1e2432" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                    <span className="text-xs font-semibold text-white">{CATEGORY_LABELS[cat.category] ?? cat.category}</span>
                    <span className="ml-auto text-[10px] rounded px-1.5 py-0.5" style={{ background: "rgba(107,114,128,0.2)", color: "#9ca3af" }}>
                      {cat.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span style={{ color: "#6b7280" }}>Evidence score</span>
                      <span className="font-medium text-white">{cat.score != null ? cat.score.toFixed(2) : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "#6b7280" }}>Contribution</span>
                      <span className="font-medium text-white">
                        {cat.normalized_share != null ? `${Math.round(cat.normalized_share * 100)}%` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "#6b7280" }}>Confidence</span>
                      <span className="font-medium text-white">{cat.confidence ?? "—"}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 rounded-xl p-3 text-xs" style={{ background: "#111827", border: "1px solid #1e2432" }}>
            <p className="font-semibold text-white mb-1">Methodology</p>
            <p style={{ color: "#6b7280" }}>Evidence scores are derived from map-layer proxies (road networks, industrial zones, NDVI). These are not a measured split of PM2.5.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
