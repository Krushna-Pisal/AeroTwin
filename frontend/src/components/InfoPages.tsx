import { useEffect, useState } from "react"
import { loadHealth } from "../api"

type Health = {
  status: string
  clock: string
  hourly_rows: number
  pm25_hours: number
  observation_start: string | null
  observation_end: string | null
}

export function DataPage() {
  const [health, setHealth] = useState<Health | null>(null)

  useEffect(() => {
    loadHealth().then(setHealth).catch(() => setHealth(null))
  }, [])

  const sources = [
    { name: "CPCB Station Data", type: "Observed PM2.5", status: "Active", url: "https://data.opencity.in/dataset/pune-hourly-air-quality-reports", color: "#22c55e" },
    { name: "OpenStreetMap", type: "Road Network", status: "Static", url: "#", color: "#3b82f6" },
    { name: "GHSL Urban Data", type: "Industrial Proxy", status: "Static", url: "#", color: "#f97316" },
    { name: "ERA5 / IMD", type: "Meteorological", status: "Modeled", url: "#", color: "#8b5cf6" },
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden animate-fade-in">
      <div className="px-6 py-4" style={{ borderBottom: "1px solid #1e2432" }}>
        <h1 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>Data & Sources</h1>
        <p className="mt-0.5 text-xs" style={{ color: "#6b7280" }}>Data provenance and pipeline status.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* API health */}
        <div className="mb-6 rounded-xl p-4" style={{ background: "#111827", border: "1px solid #1e2432" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`h-2 w-2 rounded-full ${health?.status === "ok" ? "bg-green-400 live-dot" : "bg-red-400"}`} />
            <h2 className="text-sm font-semibold text-white">API Status</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Status",         value: health?.status ?? "…" },
              { label: "Total Hours",    value: health?.hourly_rows?.toLocaleString("en-IN") ?? "…" },
              { label: "Hours with PM2.5", value: health?.pm25_hours?.toLocaleString("en-IN") ?? "…" },
              { label: "Obs. Start",     value: health?.observation_start ? new Date(health.observation_start).toLocaleDateString("en-IN") : "—" },
              { label: "Obs. End",       value: health?.observation_end   ? new Date(health.observation_end).toLocaleDateString("en-IN")   : "—" },
              { label: "Clock",          value: health?.clock ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg p-3" style={{ background: "#0d1117" }}>
                <p className="text-[10px]" style={{ color: "#6b7280" }}>{label}</p>
                <p className="mt-0.5 text-xs font-semibold text-white break-all">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Data sources */}
        <h2 className="mb-3 text-sm font-semibold text-white">Data Sources</h2>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {sources.map(({ name, type, status, url, color }) => (
            <a
              key={name}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-xl p-4 transition-all hover:brightness-110"
              style={{ background: "#111827", border: "1px solid #1e2432", textDecoration: "none" }}
            >
              <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
              <div>
                <p className="text-xs font-semibold text-white">{name}</p>
                <p className="mt-0.5 text-[11px]" style={{ color: "#6b7280" }}>{type}</p>
                <span className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${color}22`, color }}>
                  {status}
                </span>
              </div>
            </a>
          ))}
        </div>

        {/* Data policy */}
        <div className="rounded-xl p-4" style={{ background: "#111827", border: "1px solid #1e2432" }}>
          <h2 className="mb-2 text-sm font-semibold text-white">Data Policy</h2>
          <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>
            The 2017–2023 OpenCity "hourly" files are wide matrices without a PM2.5 column. They are downloaded for inspection and are not used to train the model.
            The first model uses hourly means of the labelled 15-minute station files.
            All data is sourced from CPCB republished by OpenCity under their respective open-data licences.
            See <code className="rounded px-1" style={{ background: "#1e2432", color: "#94a3b8" }}>docs/data_policy.md</code> for full terms.
          </p>
        </div>
      </div>
    </div>
  )
}

export function AboutPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden animate-fade-in">
      <div className="px-6 py-4" style={{ borderBottom: "1px solid #1e2432" }}>
        <h1 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>About AERIS</h1>
        <p className="mt-0.5 text-xs" style={{ color: "#6b7280" }}>Urban Environmental Digital Twin — Pune PM2.5.</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-4">
          {[
            {
              title: "What is AERIS?",
              body: "AERIS is an Urban Environmental Digital Twin for monitoring, forecasting, and analysing PM2.5 air pollution across Pune. It combines observed CPCB station data, map-layer proxies, and a persistence-baseline forecast model to provide real-time situational awareness for both citizens and municipal planners.",
            },
            {
              title: "How does the forecast work?",
              body: "The current production forecast is a persistence baseline — it carries forward the latest observed PM2.5 reading. Future model versions will incorporate meteorological covariates and spatiotemporal machine-learning.",
            },
            {
              title: "What are source attribution scores?",
              body: "Source attribution evidence scores are derived from map-layer proxies: road network density (traffic), nighttime-light / industrial zone proximity (industrial), and NDVI/construction permits (dust). They are not a measured chemical split of the PM2.5 mass.",
            },
            {
              title: "Simulation lab limitations",
              body: "Scenario models apply a percentage reduction assumption to the evidence score. They do not use a validated emissions-chemistry model. Treat results as order-of-magnitude planning aids, not policy guarantees.",
            },
          ].map(({ title, body }) => (
            <div key={title} className="rounded-xl p-4" style={{ background: "#111827", border: "1px solid #1e2432" }}>
              <h2 className="text-sm font-semibold text-white">{title}</h2>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: "#9ca3af" }}>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
