import { useEffect, useId, useState } from "react"
import { loadAllStations, loadLatestObservations } from "../api"
import { fmtInt, getAqiInfo } from "../aqi"
import {
  createBaselineFromStations,
  runWhatIfSimulation,
} from "../simulation/simulationEngine"
import { DEFAULT_PARAMETERS, SCENARIO_PRESETS } from "../simulation/scenarioPresets"
import type {
  SavedScenario,
  SimulationBaseline,
  SimulationParameters,
  SimulationResult,
  SimulationScope,
} from "../simulation/types"

type Station = { station_id: string; station_name: string; latitude: number | null; longitude: number | null; pm25?: number | null }

type Props = {
  onApplyToMap?: (
    pm25Map: Record<string, number>,
    label: string,
    targetStationId?: string,
    baselineMap?: Record<string, number>,
    diffMap?: Record<string, number>,
    summaryNarrative?: string,
  ) => void
  onResetMap?: () => void
  isSimulatingMap?: boolean
  simulationMapLabel?: string | null
}

const STORAGE_SAVED_SCENARIOS = "aerotwin_saved_scenarios_v2"

export function SimulationPage({
  onApplyToMap,
  onResetMap,
  isSimulatingMap = false,
  simulationMapLabel,
}: Props) {
  const uid = useId()
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Simulation Parameters state
  const [params, setParams] = useState<SimulationParameters>({ ...DEFAULT_PARAMETERS })
  const [activePresetId, setActivePresetId] = useState<string | null>(null)

  // Scope state (city-wide or targeted to a specific station)
  const [scopeType, setScopeType] = useState<"city_wide" | "station">("city_wide")
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)

  // Simulation Engine Results
  const [baseline, setBaseline] = useState<SimulationBaseline | null>(null)
  const [result, setResult] = useState<SimulationResult | null>(null)

  // Tab & History States
  const [activeTab, setActiveTab] = useState<"controls" | "station_breakdown" | "history">("controls")
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_SAVED_SCENARIOS)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [scenarioNameInput, setScenarioNameInput] = useState<string>("")
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false)
  const [compareScenarioId, setCompareScenarioId] = useState<string | null>(null)

  // 1. Load real-world observations to seed baseline
  useEffect(() => {
    async function initBaseline() {
      setLoading(true)
      try {
        const [allStns, latestObs] = await Promise.all([
          loadAllStations(),
          loadLatestObservations().catch(() => []),
        ])

        const obsMap = new Map<string, number>()
        latestObs.forEach((o) => {
          if (o.pm25 != null && o.pm25 > 0) obsMap.set(o.station_id, o.pm25)
        })

        const combined = allStns.map((s) => ({
          ...s,
          pm25: obsMap.get(s.station_id) ?? null,
        }))

        setStations(combined)
        setSelectedStationId(combined[0]?.station_id ?? null)

        const base = createBaselineFromStations(combined)
        setBaseline(base)

        const initialScope: SimulationScope = { type: "city_wide" }
        const sim = runWhatIfSimulation(DEFAULT_PARAMETERS, base, initialScope)
        setResult(sim)
      } catch (err) {
        console.error("Failed to initialize baseline observations:", err)
      } finally {
        setLoading(false)
      }
    }

    void initBaseline()
  }, [])

  // 2. Re-calculate simulation whenever parameters or scope change
  useEffect(() => {
    if (!baseline) return
    const scope: SimulationScope = {
      type: scopeType,
      stationId: scopeType === "station" ? selectedStationId ?? undefined : undefined,
      stationName: scopeType === "station"
        ? stations.find((s) => s.station_id === selectedStationId)?.station_name
        : undefined,
    }
    const sim = runWhatIfSimulation(params, baseline, scope)
    setResult(sim)
  }, [params, scopeType, selectedStationId, baseline, stations])

  // Parameter modifier helpers
  function handleParamChange(key: keyof SimulationParameters, value: number) {
    setActivePresetId(null)
    setParams((prev) => ({ ...prev, [key]: value }))
  }

  function handlePresetSelect(presetId: string) {
    const preset = SCENARIO_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    setActivePresetId(presetId)
    setParams({ ...preset.parameters })
  }

  function handleResetAll() {
    setActivePresetId(null)
    setParams({ ...DEFAULT_PARAMETERS })
  }

  // Save scenario
  function handleSaveScenario() {
    if (!result || !scenarioNameInput.trim()) return
    const newSaved: SavedScenario = {
      id: `whatif-${Date.now()}`,
      name: scenarioNameInput.trim(),
      description: result.summaryNarrative.slice(0, 140) + "...",
      parameters: { ...params },
      result: { ...result },
      createdAt: new Date().toISOString(),
    }
    const updated = [newSaved, ...savedScenarios]
    setSavedScenarios(updated)
    try {
      localStorage.setItem(STORAGE_SAVED_SCENARIOS, JSON.stringify(updated))
    } catch {}
    setScenarioNameInput("")
    setShowSaveModal(false)
  }

  function handleDeleteScenario(id: string) {
    const updated = savedScenarios.filter((s) => s.id !== id)
    setSavedScenarios(updated)
    if (compareScenarioId === id) setCompareScenarioId(null)
    try {
      localStorage.setItem(STORAGE_SAVED_SCENARIOS, JSON.stringify(updated))
    } catch {}
  }

  function handleLoadSavedScenario(sc: SavedScenario) {
    setParams({ ...sc.parameters })
    setActivePresetId(null)
    setActiveTab("controls")
  }

  // Apply to GIS Map
  function handleApplyToMap() {
    if (!result) return
    const activePreset = SCENARIO_PRESETS.find((p) => p.id === activePresetId)
    const scopeLabel = scopeType === "city_wide"
      ? "City-Wide Pune"
      : stations.find((s) => s.station_id === selectedStationId)?.station_name?.split(",")[0] || "Target Zone"
    const label = `${activePreset?.name || "What-If Scenario"} (${scopeLabel})`

    onApplyToMap?.(
      result.simulated.stationValues,
      label,
      scopeType === "station" ? selectedStationId ?? undefined : undefined,
      baseline?.stationValues,
      result.simulated.stationDiffs,
      result.summaryNarrative,
    )
  }

  const comparedScenario = savedScenarios.find((s) => s.id === compareScenarioId)

  return (
    <div className="flex h-full flex-col overflow-hidden animate-fade-in bg-[#0a0d14] text-slate-100">
      {/* ── TOP HEADER ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-[#1e2432] bg-[#0d1117]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400 font-bold text-sm border border-purple-500/30">
              ⚡
            </span>
            <h1 className="text-lg font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              Civic What-If Impact Simulation Lab
            </h1>
            {loading ? (
              <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-purple-400 border border-purple-500/20 animate-pulse">
                Syncing Real Baseline...
              </span>
            ) : (
              <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-400 border border-blue-500/20">
                Decision Support System
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Model hypothetical interventions, evaluate cross-sector trade-offs, and project spatial impacts onto Pune's real-time baseline.
          </p>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Simulation Scope Dropdown */}
          <div className="flex items-center gap-2 rounded-xl bg-[#161c28] px-3 py-1.5 border border-[#242e42]">
            <span className="text-xs text-slate-400 font-medium">Scope:</span>
            <select
              value={scopeType}
              onChange={(e) => setScopeType(e.target.value as "city_wide" | "station")}
              className="bg-transparent text-xs font-semibold text-purple-300 outline-none cursor-pointer"
            >
              <option value="city_wide" className="bg-[#161c28] text-white">City-Wide (Pune Metropolitan)</option>
              <option value="station" className="bg-[#161c28] text-white">Specific Monitoring Ward</option>
            </select>
          </div>

          {scopeType === "station" && (
            <select
              value={selectedStationId ?? ""}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="rounded-xl bg-[#161c28] px-3 py-1.5 text-xs font-medium text-slate-200 border border-[#242e42] outline-none cursor-pointer"
            >
              {stations.map((s) => (
                <option key={s.station_id} value={s.station_id} className="bg-[#161c28]">
                  {s.station_name} {s.pm25 ? `(${Math.round(s.pm25)} μg/m³)` : ""}
                </option>
              ))}
            </select>
          )}

          {/* Map Status Badge */}
          {isSimulatingMap ? (
            <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
              <span className="h-2 w-2 rounded-full bg-purple-400 animate-ping" />
              GIS Map: {simulationMapLabel ?? "Simulating"}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/30">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              GIS Map: Live Baseline
            </div>
          )}

          {isSimulatingMap && onResetMap && (
            <button
              type="button"
              onClick={onResetMap}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white bg-red-600/80 hover:bg-red-500 transition-all border border-red-500/30"
            >
              ↺ Reset Live Map
            </button>
          )}

          <button
            type="button"
            onClick={handleApplyToMap}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-lg transition-all hover:brightness-110 active:scale-95"
            style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
          >
            <span>🗺 Project to GIS Map</span>
          </button>
        </div>
      </div>

      {/* ── PRESET SCENARIOS BAR ── */}
      <div className="shrink-0 border-b border-[#1e2432] bg-[#0c1017] px-6 py-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Quick Scenarios:</span>
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {SCENARIO_PRESETS.map((preset) => {
                const isActive = activePresetId === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetSelect(preset.id)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all shrink-0 cursor-pointer"
                    style={{
                      background: isActive ? `${preset.color}25` : "#141923",
                      border: `1px solid ${isActive ? preset.color : "#222c3d"}`,
                      color: isActive ? "#fff" : "#94a3b8",
                    }}
                    title={preset.description}
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.name}</span>
                    <span className="text-[10px] opacity-75 font-mono">({preset.tagline.split(",")[0]})</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetAll}
              className="text-xs font-semibold text-slate-400 hover:text-white px-2.5 py-1 rounded-lg border border-[#242e42] hover:bg-[#161c28] transition"
            >
              ↺ Reset All Controls
            </button>
            <button
              type="button"
              onClick={() => setShowSaveModal(true)}
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 px-3 py-1 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 transition"
            >
              + Save Scenario
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN WORKSPACE CONTAINER ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* LEFT COLUMN: INTERACTIVE PARAMETER CONTROLS & TABLE (50% Width) */}
        <div className="w-[48%] flex flex-col border-r border-[#1e2432] bg-[#0c1017] min-h-0">
          {/* Navigation Sub-Tabs */}
          <div className="flex border-b border-[#1e2432] bg-[#0f141f]">
            <button
              type="button"
              onClick={() => setActiveTab("controls")}
              className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                activeTab === "controls"
                  ? "border-purple-500 text-purple-400 bg-purple-500/10"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              🎛 Policy Parameter Levers
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("station_breakdown")}
              className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                activeTab === "station_breakdown"
                  ? "border-purple-500 text-purple-400 bg-purple-500/10"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              📍 Ward & Station Matrix ({stations.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                activeTab === "history"
                  ? "border-purple-500 text-purple-400 bg-purple-500/10"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              📑 Scenario Comparison ({savedScenarios.length})
            </button>
          </div>

          {/* TAB 1: SLIDERS & CONTROLS */}
          {activeTab === "controls" && (
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-300">
                <span className="font-bold">Scenario Principle:</span> Adjust one or multiple policy levers to immediately forecast downstream effects on air quality, traffic flow, and emission factors.
              </div>

              {/* 6 SLIDERS GRID */}
              <div className="space-y-3.5">
                {/* 1. Traffic Volume */}
                <ParameterSliderCard
                  id={`${uid}-traffic`}
                  icon="🚗"
                  label="Traffic Volume"
                  description="Adjust total motorized private vehicular trips on Pune roads."
                  value={params.trafficVolume}
                  min={-60}
                  max={40}
                  step={5}
                  unit="%"
                  color="#3b82f6"
                  baselineDisplay="100% Volume"
                  simulatedDisplay={`${100 + params.trafficVolume}% Volume`}
                  onChange={(v) => handleParamChange("trafficVolume", v)}
                />

                {/* 2. Public Transport Ridership */}
                <ParameterSliderCard
                  id={`${uid}-pt`}
                  icon="🚌"
                  label="Public Transport Ridership"
                  description="Expand Metro & PMPML bus services, modal shift from private trips."
                  value={params.publicTransport}
                  min={-30}
                  max={60}
                  step={5}
                  unit="%"
                  color="#06b6d4"
                  baselineDisplay="35% Transit Share"
                  simulatedDisplay={`${Math.round(35 * (1 + params.publicTransport / 100))}% Transit Share`}
                  onChange={(v) => handleParamChange("publicTransport", v)}
                />

                {/* 3. Industrial Stack Emissions */}
                <ParameterSliderCard
                  id={`${uid}-ind`}
                  icon="🏭"
                  label="Industrial Emissions"
                  description="Industrial boiler scrubbers, manufacturing emission standards, and fuel norms."
                  value={params.industrialEmissions}
                  min={-60}
                  max={30}
                  step={5}
                  unit="%"
                  color="#f59e0b"
                  baselineDisplay="100 Baseline"
                  simulatedDisplay={`${100 + params.industrialEmissions} Index`}
                  onChange={(v) => handleParamChange("industrialEmissions", v)}
                />

                {/* 4. Construction & Fugitive Dust */}
                <ParameterSliderCard
                  id={`${uid}-dust`}
                  icon="🏗️"
                  label="Construction Activity & Dust Abatement"
                  description="Site windbreak barriers, water-misting cannons, and paved hauling roads."
                  value={params.constructionActivity}
                  min={-60}
                  max={30}
                  step={5}
                  unit="%"
                  color="#8b5cf6"
                  baselineDisplay="100 Baseline"
                  simulatedDisplay={`${100 + params.constructionActivity} Index`}
                  onChange={(v) => handleParamChange("constructionActivity", v)}
                />

                {/* 5. Urban Green Canopy */}
                <ParameterSliderCard
                  id={`${uid}-green`}
                  icon="🌳"
                  label="Urban Green Canopy & Bioswales"
                  description="Tree planting along arterial avenues, park expansion, and particulate bio-filtration."
                  value={params.greenCover}
                  min={-20}
                  max={50}
                  step={5}
                  unit="%"
                  color="#10b981"
                  baselineDisplay="22% Canopy"
                  simulatedDisplay={`${Math.round(22 * (1 + params.greenCover / 100))}% Canopy`}
                  onChange={(e) => handleParamChange("greenCover", e)}
                />

                {/* 6. Road Capacity & Signal Optimization */}
                <ParameterSliderCard
                  id={`${uid}-cap`}
                  icon="🚦"
                  label="Road Capacity & Smart Signals"
                  description="AI adaptive signal progression, bottleneck removal, and intersection throughput."
                  value={params.roadCapacity}
                  min={-20}
                  max={40}
                  step={5}
                  unit="%"
                  color="#ec4899"
                  baselineDisplay="100 Capacity"
                  simulatedDisplay={`${100 + params.roadCapacity} Capacity`}
                  onChange={(e) => handleParamChange("roadCapacity", e)}
                />
              </div>

              {/* CURRENT -> MODIFIED -> IMPACT SUMMARY TABLE */}
              <div className="mt-5 rounded-xl border border-[#1e2432] bg-[#111622] p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center justify-between">
                  <span>Current &rarr; Modified &rarr; Modeled Impact</span>
                  <span className="text-[10px] text-slate-500 font-mono">Civic Heuristic Matrix</span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#1e2432] text-slate-400 text-[11px]">
                        <th className="py-1.5 font-semibold">Parameter</th>
                        <th className="py-1.5 font-semibold text-right">Current</th>
                        <th className="py-1.5 font-semibold text-right">Simulated</th>
                        <th className="py-1.5 font-semibold text-right">Modeled Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e2432]/60 text-slate-200">
                      <tr>
                        <td className="py-2 flex items-center gap-1.5 font-medium">🚗 Traffic Volume</td>
                        <td className="py-2 text-right text-slate-400">100%</td>
                        <td className="py-2 text-right font-semibold">{100 + params.trafficVolume}%</td>
                        <td className="py-2 text-right">
                          <DeltaPill delta={params.trafficVolume} isLowerBetter />
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 flex items-center gap-1.5 font-medium">🚌 Public Transport</td>
                        <td className="py-2 text-right text-slate-400">35%</td>
                        <td className="py-2 text-right font-semibold">{Math.round(35 * (1 + params.publicTransport / 100))}%</td>
                        <td className="py-2 text-right">
                          <DeltaPill delta={params.publicTransport} isLowerBetter={false} />
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 flex items-center gap-1.5 font-medium">🏭 Industrial Emissions</td>
                        <td className="py-2 text-right text-slate-400">100</td>
                        <td className="py-2 text-right font-semibold">{100 + params.industrialEmissions}</td>
                        <td className="py-2 text-right">
                          <DeltaPill delta={params.industrialEmissions} isLowerBetter />
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 flex items-center gap-1.5 font-medium">🌳 Green Cover</td>
                        <td className="py-2 text-right text-slate-400">22%</td>
                        <td className="py-2 text-right font-semibold">{Math.round(22 * (1 + params.greenCover / 100))}%</td>
                        <td className="py-2 text-right">
                          <DeltaPill delta={params.greenCover} isLowerBetter={false} />
                        </td>
                      </tr>
                      <tr className="bg-purple-950/20 font-semibold">
                        <td className="py-2 text-purple-300">💨 Estimated PM2.5</td>
                        <td className="py-2 text-right text-slate-300">{baseline ? `${baseline.avgPm25} μg/m³` : "—"}</td>
                        <td className="py-2 text-right text-white">{result ? `${result.simulated.avgPm25} μg/m³` : "—"}</td>
                        <td className="py-2 text-right">
                          <DeltaPill delta={result?.impact.pm25DeltaPct ?? 0} isLowerBetter />
                        </td>
                      </tr>
                      <tr className="bg-purple-950/20 font-semibold">
                        <td className="py-2 text-purple-300">🚦 Arterial Congestion</td>
                        <td className="py-2 text-right text-slate-300">{baseline ? `${baseline.congestionIndex}%` : "—"}</td>
                        <td className="py-2 text-right text-white">{result ? `${result.simulated.congestionIndex}%` : "—"}</td>
                        <td className="py-2 text-right">
                          <DeltaPill delta={result?.impact.congestionDeltaPct ?? 0} isLowerBetter />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STATION BREAKDOWN */}
          {activeTab === "station_breakdown" && (
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Per-monitoring station impact based on {scopeType === "city_wide" ? "city-wide policy" : "targeted ward policy"}:
                </p>
                <span className="text-[11px] font-mono text-purple-400">
                  {result?.impact.improvedZones ?? 0} Improved / {stations.length} Total
                </span>
              </div>

              <div className="rounded-xl border border-[#1e2432] bg-[#111622] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#161c28] border-b border-[#1e2432] text-slate-400 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Monitoring Station</th>
                      <th className="py-2.5 px-3 text-right">Baseline</th>
                      <th className="py-2.5 px-3 text-right">Simulated</th>
                      <th className="py-2.5 px-3 text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2432]/60 text-slate-200">
                    {stations.map((st) => {
                      const baseVal = baseline?.stationValues[st.station_id] ?? 75
                      const simVal = result?.simulated.stationValues[st.station_id] ?? baseVal
                      const diff = result?.simulated.stationDiffs[st.station_id] ?? 0
                      const baseAqi = getAqiInfo(baseVal)
                      const simAqi = getAqiInfo(simVal)

                      return (
                        <tr key={st.station_id} className="hover:bg-slate-800/40 transition">
                          <td className="py-2 px-3">
                            <p className="font-semibold text-white">{st.station_name.split(",")[0]}</p>
                            <p className="text-[10px] text-slate-500">{st.station_id}</p>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className="font-mono" style={{ color: baseAqi.color }}>
                              {fmtInt(baseVal)}
                            </span>
                            <span className="text-[10px] text-slate-500 ml-1">μg/m³</span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className="font-mono font-bold" style={{ color: simAqi.color }}>
                              {fmtInt(simVal)}
                            </span>
                            <span className="text-[10px] text-slate-500 ml-1">μg/m³</span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span
                              className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                diff < -0.5
                                  ? "bg-green-500/20 text-green-400"
                                  : diff > 0.5
                                  ? "bg-red-500/20 text-red-400"
                                  : "text-slate-400"
                              }`}
                            >
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SAVED SCENARIOS & COMPARISON */}
          {activeTab === "history" && (
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Saved What-If Scenarios</h3>
                <button
                  type="button"
                  onClick={() => setShowSaveModal(true)}
                  className="rounded-lg px-2.5 py-1 text-xs font-semibold text-purple-300 bg-purple-500/20 border border-purple-500/40"
                >
                  + Save Current
                </button>
              </div>

              {savedScenarios.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#1e2432] p-8 text-center text-xs text-slate-500">
                  No saved scenarios yet. Configure parameters and click "+ Save Scenario" to compare side-by-side.
                </div>
              ) : (
                <div className="space-y-3">
                  {savedScenarios.map((sc) => {
                    const isCompared = compareScenarioId === sc.id
                    return (
                      <div
                        key={sc.id}
                        className="rounded-xl border p-4 transition-all"
                        style={{
                          background: isCompared ? "#171426" : "#111622",
                          borderColor: isCompared ? "#8b5cf6" : "#1e2432",
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-bold text-white">{sc.name}</h4>
                            <p className="mt-0.5 text-[11px] text-slate-400 font-mono">
                              Created: {new Date(sc.createdAt).toLocaleDateString()} · PM2.5: {sc.result.simulated.avgPm25} μg/m³ ({sc.result.impact.pm25DeltaPct}%)
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleLoadSavedScenario(sc)}
                              className="rounded px-2 py-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-[#1e2432] hover:bg-slate-700"
                            >
                              Load
                            </button>
                            <button
                              type="button"
                              onClick={() => setCompareScenarioId(isCompared ? null : sc.id)}
                              className={`rounded px-2 py-1 text-[11px] font-semibold ${
                                isCompared ? "bg-purple-600 text-white" : "text-purple-400 bg-purple-500/10 border border-purple-500/30"
                              }`}
                            >
                              {isCompared ? "Comparing" : "Compare"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteScenario(sc.id)}
                              className="rounded px-2 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-500/10"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {/* Parameter Chips */}
                        <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px]">
                          {Object.entries(sc.parameters)
                            .filter(([_, v]) => v !== 0)
                            .map(([k, v]) => (
                              <span key={k} className="rounded bg-[#1a2233] px-2 py-0.5 text-slate-300 border border-[#26334a]">
                                {k}: {v > 0 ? `+${v}` : v}%
                              </span>
                            ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Side-by-Side Comparison Matrix */}
              {comparedScenario && (
                <div className="mt-6 rounded-2xl border border-purple-500/40 bg-purple-950/20 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                      Side-by-Side Comparison: Current vs. "{comparedScenario.name}"
                    </h4>
                    <button
                      type="button"
                      onClick={() => setCompareScenarioId(null)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Close ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-xl bg-[#111622] p-2.5">
                      <p className="text-[10px] text-slate-400">Metric</p>
                      <p className="mt-1 font-bold text-slate-300">PM2.5</p>
                      <p className="mt-1 font-bold text-slate-300">Congestion</p>
                      <p className="mt-1 font-bold text-slate-300">Speed</p>
                    </div>
                    <div className="rounded-xl bg-[#111622] p-2.5">
                      <p className="text-[10px] text-purple-400">Current What-If</p>
                      <p className="mt-1 font-bold text-white">{result?.simulated.avgPm25} μg/m³</p>
                      <p className="mt-1 font-bold text-white">{result?.simulated.congestionIndex}%</p>
                      <p className="mt-1 font-bold text-white">{result?.simulated.avgSpeed} km/h</p>
                    </div>
                    <div className="rounded-xl bg-[#111622] p-2.5">
                      <p className="text-[10px] text-blue-400">Saved: {comparedScenario.name}</p>
                      <p className="mt-1 font-bold text-white">{comparedScenario.result.simulated.avgPm25} μg/m³</p>
                      <p className="mt-1 font-bold text-white">{comparedScenario.result.simulated.congestionIndex}%</p>
                      <p className="mt-1 font-bold text-white">{comparedScenario.result.simulated.avgSpeed} km/h</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: PREDICTED IMPACT & VISUALIZATIONS (52% Width) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#0a0d14]">
          {/* PRIMARY KPI IMPACT CARDS */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Modeled Impact Indicators
              </h2>
              <span className="text-[11px] text-purple-400 font-mono font-semibold">
                Net Score: {result?.impact.overallScore ? `${result.impact.overallScore > 0 ? "+" : ""}${result.impact.overallScore}` : "0"} / 100
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3.5">
              {/* 1. PM2.5 / AQI */}
              <KpiCard
                title="Estimated Ambient PM2.5"
                icon="💨"
                currentVal={`${baseline?.avgPm25 ?? 77.8} μg/m³`}
                simulatedVal={`${result?.simulated.avgPm25 ?? 77.8} μg/m³`}
                deltaPct={result?.impact.pm25DeltaPct ?? 0}
                isLowerBetter
                extraBadge={getAqiInfo(result?.simulated.avgPm25).level}
                badgeColor={getAqiInfo(result?.simulated.avgPm25).color}
              />

              {/* 2. Congestion Index */}
              <KpiCard
                title="Arterial Congestion"
                icon="🚗"
                currentVal={`${baseline?.congestionIndex ?? 72}%`}
                simulatedVal={`${result?.simulated.congestionIndex ?? 72}%`}
                deltaPct={result?.impact.congestionDeltaPct ?? 0}
                isLowerBetter
                extraBadge={
                  (result?.simulated.congestionIndex ?? 72) < 55
                    ? "Fluid Flow"
                    : (result?.simulated.congestionIndex ?? 72) < 75
                    ? "Moderate"
                    : "Gridlock"
                }
                badgeColor={(result?.simulated.congestionIndex ?? 72) < 60 ? "#22c55e" : "#f97316"}
              />

              {/* 3. Tailpipe Emissions Index */}
              <KpiCard
                title="Vehicle Emissions Index"
                icon="🏭"
                currentVal={`${baseline?.emissionsIndex ?? 100}`}
                simulatedVal={`${result?.simulated.emissionsIndex ?? 100}`}
                deltaPct={result?.impact.emissionsDeltaPct ?? 0}
                isLowerBetter
                extraBadge="Indexed"
                badgeColor="#3b82f6"
              />

              {/* 4. Average Speed */}
              <KpiCard
                title="Corridor Travel Speed"
                icon="⚡"
                currentVal={`${baseline?.avgSpeed ?? 23.5} km/h`}
                simulatedVal={`${result?.simulated.avgSpeed ?? 23.5} km/h`}
                deltaPct={result?.impact.speedDeltaPct ?? 0}
                isLowerBetter={false}
                extraBadge="Kinematic"
                badgeColor="#10b981"
              />

              {/* 5. Critical Hotspots */}
              <KpiCard
                title="High-Risk Hotspots (>100)"
                icon="⚠️"
                currentVal={`${baseline?.highRiskZones ?? 0} Zones`}
                simulatedVal={`${result?.simulated.highRiskZones ?? 0} Zones`}
                deltaPct={
                  baseline?.highRiskZones
                    ? Math.round(((result?.simulated.highRiskZones ?? 0) - baseline.highRiskZones) / baseline.highRiskZones * 100)
                    : 0
                }
                isLowerBetter
                extraBadge={`${result?.impact.improvedZones ?? 0} Cleaner`}
                badgeColor="#8b5cf6"
              />

              {/* 6. Overall Civic Impact */}
              <div className="rounded-xl border border-[#1e2432] bg-[#111622] p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Overall Improvement</span>
                  <span className="text-base">🎯</span>
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold font-mono text-white">
                    {result?.impact.overallScore && result.impact.overallScore > 0 ? `+${result.impact.overallScore}` : result?.impact.overallScore ?? "0"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {(result?.impact.overallScore ?? 0) > 15
                      ? "High Civic Benefit"
                      : (result?.impact.overallScore ?? 0) > 0
                      ? "Moderate Benefit"
                      : (result?.impact.overallScore ?? 0) === 0
                      ? "Baseline Neutral"
                      : "Negative Environmental Cost"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SENSITIVITY / "WHAT MATTERS MOST?" CONTRIBUTION BREAKDOWN */}
          <div className="rounded-2xl border border-[#1e2432] bg-[#111622] p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Sensitivity Analysis &mdash; "What Matters Most?"
                </h3>
                <p className="text-[11px] text-slate-400">
                  Modeled contribution of each policy lever toward the aggregate environmental improvement.
                </p>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Calculated Decomposition</span>
            </div>

            <div className="space-y-3 mt-4">
              {result?.sensitivity.map((factor) => (
                <div key={factor.parameterKey} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{factor.label}</span>
                    <span className="font-mono font-bold" style={{ color: factor.color }}>
                      {factor.contributionPct}% of modeled effect
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#1b2333] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(factor.contributionPct, 4)}%`,
                        background: factor.color,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">{factor.marginalEffect}</p>
                </div>
              ))}
            </div>
          </div>

          {/* EXPLAINABLE NARRATIVE BRIEFING */}
          <div className="rounded-2xl border border-purple-500/30 bg-[#121626] p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500/20 text-purple-400 text-xs font-bold">
                💡
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Decision Support Narrative & Civic Trade-Offs
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              {result?.summaryNarrative}
            </p>
            <div className="pt-2 border-t border-[#1e2432] flex items-center justify-between text-[10px] text-slate-500">
              <span>Scientific Framework: AeroTwin Civic Scenario-Based Heuristic Model</span>
              <span>Updated: {result ? new Date(result.calculatedAt).toLocaleTimeString() : "Live"}</span>
            </div>
          </div>

          {/* PROJECT ONTO GIS MAP ACTION BANNER */}
          <div className="rounded-2xl border border-purple-500/40 bg-gradient-to-r from-purple-950/40 to-indigo-950/40 p-5 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-white">Visualize What-If Spatial Impact on GIS Map</h4>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                Project the calculated PM2.5 and AQI values onto the GIS map to explore before/after hexagon heatmaps, station-level delta pins, and corridor congestion overlays.
              </p>
            </div>
            <button
              type="button"
              onClick={handleApplyToMap}
              className="shrink-0 rounded-xl px-5 py-3 text-xs font-bold text-white shadow-2xl transition-all hover:brightness-110 active:scale-95 flex items-center gap-2"
              style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
            >
              <span>🗺 Apply What-If to Map</span>
              <span>&rarr;</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── SAVE SCENARIO MODAL ── */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#242e42] bg-[#111622] p-6 shadow-2xl space-y-4 animate-scale-up">
            <h3 className="text-sm font-bold text-white">Save Current What-If Scenario</h3>
            <p className="text-xs text-slate-400">
              Store this combination of policy levers into local history to compare with other municipal strategies.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Scenario Name</label>
              <input
                type="text"
                placeholder="e.g., Phase 1 Clean Transit & Low-Emission Zone"
                value={scenarioNameInput}
                onChange={(e) => setScenarioNameInput(e.target.value)}
                className="w-full rounded-xl border border-[#242e42] bg-[#0c1017] px-3.5 py-2 text-xs text-white outline-none focus:border-purple-500"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveScenario}
                disabled={!scenarioNameInput.trim()}
                className="rounded-xl px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-40 transition"
              >
                Save to History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SLIDER CARD COMPONENT ───────────────────────────────────────────────────
interface ParameterSliderCardProps {
  id: string
  icon: string
  label: string
  description: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  color: string
  baselineDisplay: string
  simulatedDisplay: string
  onChange: (val: number) => void
}

function ParameterSliderCard({
  id,
  icon,
  label,
  description,
  value,
  min,
  max,
  step,
  unit,
  color,
  baselineDisplay,
  simulatedDisplay,
  onChange,
}: ParameterSliderCardProps) {
  const isChanged = value !== 0

  return (
    <div
      className="rounded-xl border p-4 transition-all"
      style={{
        background: isChanged ? "#141926" : "#111622",
        borderColor: isChanged ? `${color}55` : "#1e2432",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <div>
            <h4 className="text-xs font-bold text-white">{label}</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded-lg px-2.5 py-1 text-xs font-mono font-bold"
            style={{
              background: isChanged ? `${color}25` : "#1b2333",
              color: isChanged ? color : "#94a3b8",
              border: `1px solid ${isChanged ? color : "#2b384e"}`,
            }}
          >
            {value > 0 ? `+${value}` : value}
            {unit}
          </span>
          {isChanged && (
            <button
              type="button"
              onClick={() => onChange(0)}
              className="text-[11px] text-slate-500 hover:text-white"
              title="Reset to 0"
            >
              ↺
            </button>
          )}
        </div>
      </div>

      {/* Slider & Step Buttons */}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1a2233] text-xs font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-30"
        >
          -
        </button>

        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-purple-500 cursor-pointer h-1.5 rounded-lg bg-[#1f293d]"
        />

        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1a2233] text-xs font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-30"
        >
          +
        </button>
      </div>

      {/* Baseline vs Simulated comparison note */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
        <span>Current: {baselineDisplay}</span>
        <span className={isChanged ? "font-semibold text-white" : ""}>
          Simulated: {simulatedDisplay}
        </span>
      </div>
    </div>
  )
}

// ── KPI CARD COMPONENT ──────────────────────────────────────────────────────
interface KpiCardProps {
  title: string
  icon: string
  currentVal: string
  simulatedVal: string
  deltaPct: number
  isLowerBetter?: boolean
  extraBadge?: string
  badgeColor?: string
}

function KpiCard({
  title,
  icon,
  currentVal,
  simulatedVal,
  deltaPct,
  isLowerBetter = true,
  extraBadge,
  badgeColor = "#3b82f6",
}: KpiCardProps) {
  const isBetter = isLowerBetter ? deltaPct < 0 : deltaPct > 0
  const isWorse = isLowerBetter ? deltaPct > 0 : deltaPct < 0

  return (
    <div className="rounded-xl border border-[#1e2432] bg-[#111622] p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400 font-medium truncate">{title}</span>
        <span className="text-base">{icon}</span>
      </div>

      <div className="mt-3">
        <p className="text-xl font-bold font-mono text-white tracking-tight">{simulatedVal}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">Baseline: {currentVal}</p>
      </div>

      <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#1e2432]/60">
        <span
          className={`text-[11px] font-bold px-1.5 py-0.5 rounded font-mono ${
            isBetter
              ? "bg-green-500/20 text-green-400"
              : isWorse
              ? "bg-red-500/20 text-red-400"
              : "text-slate-400 bg-slate-800"
          }`}
        >
          {deltaPct > 0 ? `+${deltaPct}%` : `${deltaPct}%`}
        </span>

        {extraBadge && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: `${badgeColor}20`,
              color: badgeColor,
              border: `1px solid ${badgeColor}40`,
            }}
          >
            {extraBadge}
          </span>
        )}
      </div>
    </div>
  )
}

function DeltaPill({ delta, isLowerBetter = true }: { delta: number; isLowerBetter?: boolean }) {
  if (delta === 0) return <span className="text-slate-500 font-mono font-medium">0%</span>
  const isGood = isLowerBetter ? delta < 0 : delta > 0
  return (
    <span
      className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${
        isGood ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
      }`}
    >
      {delta > 0 ? `+${delta}%` : `${delta}%`}
    </span>
  )
}
