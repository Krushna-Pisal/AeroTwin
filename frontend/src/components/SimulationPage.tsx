import { useEffect, useState } from "react"
import { compare, loadAllStations } from "../api"
import { fmtInt, getAqiInfo } from "../aqi"
import type { ComparePayload, Intensity, Intervention } from "../types"

type Station = { station_id: string; station_name: string; latitude: number | null; longitude: number | null }

const SCENARIOS: { id: Intervention; label: string; desc: string; color: string }[] = [
  { id: "traffic_restriction",       label: "Traffic Restriction",   desc: "Reduce traffic activity by 20%",   color: "#3b82f6" },
  { id: "industrial_control",        label: "Industrial Control",    desc: "Reduce industrial activity by 15%", color: "#f97316" },
  { id: "dust_construction_control", label: "Combined Intervention", desc: "Traffic −20% + Industry −15%",     color: "#8b5cf6" },
]

export function SimulationPage() {
  const [stations, setStations] = useState<Station[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [intensity, setIntensity] = useState<Intensity>("MEDIUM")
  const [activeScenario, setActiveScenario] = useState<Intervention>("traffic_restriction")
  const [comparison, setComparison] = useState<ComparePayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAllStations()
      .then((stns) => {
        setStations(stns)
        setSelectedId(stns[0]?.station_id ?? null)
      })
      .catch(() => { })
  }, [])

  async function runCompare() {
    if (!selectedId) return
    setLoading(true)
    setError(null)
    try {
      const result = await compare(selectedId, intensity)
      setComparison(result)
    } catch {
      setError("Scenario comparison failed. Make sure a station with data is selected.")
    } finally {
      setLoading(false)
    }
  }

  const baseline = comparison?.baseline.pm25
  const scenarios = comparison?.scenarios ?? []

  // Build bar chart values
  const barValues = [
    { label: "Baseline", value: baseline, color: "#6b7280" },
    ...SCENARIOS.map((sc, i) => ({
      label: sc.label.split(" ")[0],
      value: scenarios[i]?.modeled_pm25 ?? null,
      color: sc.color,
    })),
  ]
  const barMax = Math.max(...barValues.map((b) => b.value ?? 0), 50)

  const activeScenarioObj = SCENARIOS.find((s) => s.id === activeScenario)
  const activeResult = scenarios.find((s) => s.intervention_type === activeScenario)

  return (
    <div className="flex h-full flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #1e2432" }}>
        <div>
          <h1 className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>Simulation Lab</h1>
          <p className="mt-0.5 text-xs" style={{ color: "#6b7280" }}>Compare interventions and see their modeled impact on air quality.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            id="sim-station-select"
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-lg py-1.5 pl-3 pr-7 text-xs font-medium text-white appearance-none cursor-pointer"
            style={{ background: "#1a1f2e", border: "1px solid #2d3748" }}
          >
            {stations.map((s) => (
              <option key={s.station_id} value={s.station_id}>{s.station_name}</option>
            ))}
          </select>
          <div className="flex overflow-hidden rounded-lg" style={{ border: "1px solid #2d3748" }}>
            {(["LOW", "MEDIUM", "HIGH"] as Intensity[]).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setIntensity(lvl)}
                className="px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  background: intensity === lvl ? "#22c55e" : "#1a1f2e",
                  color: intensity === lvl ? "#000" : "#6b7280",
                }}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — scenarios list + chart */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Scenario selector */}
            <div className="rounded-xl p-4" style={{ background: "#111827", border: "1px solid #1e2432" }}>
              <h3 className="mb-3 text-sm font-semibold text-white">Intervention Scenarios</h3>
              <div className="space-y-2">
                {SCENARIOS.map((sc, i) => (
                  <button
                    key={sc.id}
                    type="button"
                    id={`scenario-btn-${sc.id}`}
                    onClick={() => setActiveScenario(sc.id)}
                    className="flex w-full items-start gap-3 rounded-xl p-3 text-left transition-all"
                    style={{
                      background: activeScenario === sc.id ? `${sc.color}22` : "#0d1117",
                      border: `1px solid ${activeScenario === sc.id ? sc.color : "#1e2432"}`,
                    }}
                  >
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{ background: sc.color }}
                    >
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">{sc.label}</p>
                      <p className="mt-0.5 text-[11px]" style={{ color: "#6b7280" }}>{sc.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                id="run-comparison-btn"
                onClick={() => void runCompare()}
                disabled={loading || !selectedId}
                className="mt-4 w-full rounded-xl py-2.5 text-xs font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}
              >
                {loading ? "Running…" : "+ Run Comparison"}
              </button>
              {error && <p className="mt-2 text-xs" style={{ color: "#ef4444" }}>{error}</p>}
            </div>

            {/* Impact comparison chart */}
            <div className="rounded-xl p-4" style={{ background: "#111827", border: "1px solid #1e2432" }}>
              <h3 className="mb-1 text-sm font-semibold text-white">Impact Comparison (PM2.5)</h3>
              <p className="mb-4 text-[10px]" style={{ color: "#4b5563" }}>μg/m³ — lower is better</p>
              {comparison ? (
                <div className="flex items-end gap-3" style={{ height: 140 }}>
                  {barValues.map(({ label, value, color }) => {
                    const pct = value != null ? (value / barMax) * 100 : 0
                    const info = getAqiInfo(value)
                    return (
                      <div key={label} className="flex flex-1 flex-col items-center gap-1">
                        <p className="text-xs font-bold" style={{ color: info.color }}>{value != null ? fmtInt(value) : "—"}</p>
                        <div className="w-full rounded-t-lg transition-all" style={{ height: `${pct}%`, background: color, minHeight: 4 }} />
                        <p className="text-[10px] text-center" style={{ color: "#6b7280" }}>{label}</p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center text-xs" style={{ color: "#4b5563" }}>
                  Run a comparison to see results
                </div>
              )}
            </div>
          </div>

          {/* Scenario detail */}
          {activeResult && (
            <div className="mt-4 rounded-xl p-4" style={{ background: "#111827", border: "1px solid #1e2432" }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Scenario Details: {activeScenarioObj?.label}</h3>
                  <p className="mt-1 text-xs" style={{ color: "#6b7280" }}>{activeScenarioObj?.desc} across the selected area.</p>
                </div>
                <button
                  type="button"
                  id="apply-to-map-btn"
                  className="shrink-0 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-all"
                  style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb)" }}
                >
                  Apply to Map
                </button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl p-3 text-center" style={{ background: "#0d1117" }}>
                  <p className="text-[10px]" style={{ color: "#6b7280" }}>Estimated Impact</p>
                  <p className="mt-1 text-xl font-bold" style={{ color: "#22c55e" }}>
                    {activeResult.percentage_change != null ? `${activeResult.percentage_change.toFixed(1)}%` : "—"}
                  </p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: "#0d1117" }}>
                  <p className="text-[10px]" style={{ color: "#6b7280" }}>Predicted PM2.5</p>
                  <p className="mt-1 text-xl font-bold text-white">
                    {activeResult.modeled_pm25 != null ? `${fmtInt(activeResult.modeled_pm25)} μg/m³` : "—"}
                  </p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: "#0d1117" }}>
                  <p className="text-[10px]" style={{ color: "#6b7280" }}>Baseline PM2.5</p>
                  <p className="mt-1 text-xl font-bold text-white">
                    {activeResult.baseline_pm25 != null ? `${fmtInt(activeResult.baseline_pm25)} μg/m³` : "—"}
                  </p>
                </div>
              </div>
              {activeResult.limitations.length > 0 && (
                <p className="mt-3 text-[10px]" style={{ color: "#4b5563" }}>
                  ⚠ Note: {activeResult.limitations[0]}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right — all scenario results */}
        <div className="w-64 shrink-0 overflow-y-auto p-4" style={{ borderLeft: "1px solid #1e2432" }}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#6b7280" }}>All Scenarios</h3>
          {scenarios.length === 0 ? (
            <div className="rounded-xl p-4 text-center text-xs" style={{ background: "#111827", border: "1px solid #1e2432", color: "#4b5563" }}>
              Run a comparison to see all scenario results side by side.
            </div>
          ) : (
            <div className="space-y-3">
              {scenarios.map((row) => {
                const sc = SCENARIOS.find((s) => s.id === row.intervention_type)
                return (
                  <div key={row.scenario_id} className="rounded-xl p-3" style={{ background: "#111827", border: "1px solid #1e2432" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-2 w-2 rounded-full" style={{ background: sc?.color ?? "#6b7280" }} />
                      <p className="text-xs font-semibold text-white">{sc?.label ?? row.intervention_type}</p>
                    </div>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span style={{ color: "#6b7280" }}>Baseline</span>
                        <span className="font-medium text-white">{row.baseline_pm25 != null ? `${fmtInt(row.baseline_pm25)} μg/m³` : "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: "#6b7280" }}>Modeled</span>
                        <span className="font-medium text-white">{row.modeled_pm25 != null ? `${fmtInt(row.modeled_pm25)} μg/m³` : "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: "#6b7280" }}>Change</span>
                        <span className="font-semibold" style={{ color: (row.percentage_change ?? 0) < 0 ? "#22c55e" : "#ef4444" }}>
                          {row.percentage_change != null ? `${row.percentage_change > 0 ? "+" : ""}${row.percentage_change.toFixed(1)}%` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-4 rounded-xl p-3 text-xs" style={{ background: "#111827", border: "1px solid #1e2432" }}>
            <p className="font-semibold text-white mb-1">Model Assumptions</p>
            <p style={{ color: "#6b7280" }}>These are modeled estimates based on machine learning and should be interpreted as scenario projections, not real-world guarantees.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
