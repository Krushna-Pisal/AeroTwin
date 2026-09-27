import { useEffect, useState } from "react"
import { compare, loadEnvironment, loadHistory, loadMap, simulate } from "./api"
import { CitizenPanel } from "./components/CitizenPanel"
import { Login, type Role } from "./components/Login"
import { MapCanvas } from "./components/MapCanvas"
import { MunicipalPanel } from "./components/MunicipalPanel"
import type { CitizenReport, ComparePayload, Environment, FeatureCollection, HistoryPoint, Intensity, Intervention, LayerKey, MapPayload, ScenarioRow } from "./types"

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] }

const BASE_LAYERS: Record<LayerKey, boolean> = {
  stations: true,
  current: true,
  hotspots: true,
  forecast: false,
  industrial: false,
  roads: false,
  citizen: false,
}

export function App() {
  const [mapData, setMapData] = useState<MapPayload | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [layers, setLayers] = useState(BASE_LAYERS)
  const [stationId, setStationId] = useState<string | null>(null)
  const [environment, setEnvironment] = useState<Environment | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [loadingStation, setLoadingStation] = useState(false)
  const [section, setSection] = useState("now")
  const [intensity, setIntensity] = useState<Intensity>("MEDIUM")
  const [intervention, setIntervention] = useState<Intervention>("traffic_restriction")
  const [scenario, setScenario] = useState<ScenarioRow | null>(null)
  const [comparison, setComparison] = useState<ComparePayload | null>(null)
  const [scenarioError, setScenarioError] = useState<string | null>(null)
  const [reports, setReports] = useState<CitizenReport[]>([])
  const [pin, setPin] = useState<{ longitude: number; latitude: number } | null>(null)
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    loadMap().then(setMapData).catch(() => setMapError("The map data did not load. Start the API on port 8000."))
  }, [])

  useEffect(() => {
    if (!stationId) return
    setLoadingStation(true)
    setScenario(null)
    setComparison(null)
    setScenarioError(null)
    Promise.all([loadEnvironment(stationId), loadHistory(stationId)])
      .then(([nextEnvironment, nextHistory]) => {
        setEnvironment(nextEnvironment)
        setHistory(nextHistory)
      })
      .catch(() => setMapError("The station record did not load."))
      .finally(() => setLoadingStation(false))
  }, [stationId])

  function enter(next: Role) {
    setRole(next)
    setStationId(null)
    setEnvironment(null)
    setLayers(next === "citizen"
      ? { stations: false, current: true, hotspots: true, forecast: false, industrial: false, roads: false, citizen: false }
      : { ...BASE_LAYERS })
  }

  function toggle(key: LayerKey) {
    setLayers((current) => ({ ...current, [key]: !current[key] }))
  }

  async function runScenario(nextIntervention = intervention, nextIntensity = intensity) {
    if (!stationId) return
    setScenarioError(null)
    try {
      const body = await simulate(stationId, nextIntervention, nextIntensity)
      setScenario(body.scenario)
    } catch {
      setScenarioError("The scenario did not run.")
    }
  }

  async function runCompare(nextIntensity = intensity) {
    if (!stationId) return
    setScenarioError(null)
    try {
      setComparison(await compare(stationId, nextIntensity))
    } catch {
      setScenarioError("The comparison did not run.")
    }
  }

  const collections = mapData?.collections

  if (!role) return <Login onEnter={enter} />

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-end justify-between gap-3 bg-[#12110f] px-4 py-3 text-[#f4efe6]">
        <div>
          <p className="text-[11px] tracking-[0.2em] text-[#d6c48a]">PUNE ENVIRONMENTAL TWIN</p>
          <h1 className="font-display text-3xl leading-none">AeroTwin</h1>
          <p className="mt-1 text-xs text-[#d6d3d1]">{role === "citizen" ? "Citizen" : "Municipal corporation"}</p>
        </div>
        <button type="button" onClick={() => setRole(null)} className="rounded-full border border-[#d6c48a] px-3 py-1 text-xs text-[#d6c48a]">Sign out</button>
      </header>
      {mapError && <p className="bg-[#9f1239] px-4 py-2 text-xs text-white">{mapError}</p>}
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(240px,1fr)_minmax(280px,46vh)] md:grid-cols-[minmax(0,1fr)_400px] md:grid-rows-1">
        <div className="relative min-h-0">
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
            onSelect={(id) => {
              setStationId(id)
              setSection("now")
            }}
            pickLocation={picking}
            onPickLocation={(longitude, latitude) => {
              setPin({ longitude, latitude })
              setPicking(false)
            }}
          />
          {role === "municipal" && (
            <details className="absolute left-3 top-3 z-10 max-w-[220px] rounded-2xl bg-[#f4efe6]/95 p-3 text-xs shadow-lg">
              <summary className="cursor-pointer font-medium">Map layers</summary>
              <div className="mt-2">
                <LayerToggle label="Stations" on={layers.stations} onClick={() => toggle("stations")} />
                <LayerToggle label="Current PM2.5" on={layers.current} onClick={() => toggle("current")} />
                <LayerToggle label="Hotspots" on={layers.hotspots} onClick={() => toggle("hotspots")} />
                <LayerToggle label="24-hour forecast" on={layers.forecast} onClick={() => toggle("forecast")} />
                <LayerToggle label="Industrial proxy" on={layers.industrial} onClick={() => toggle("industrial")} />
                <LayerToggle label="Road context" on={layers.roads} onClick={() => toggle("roads")} />
                <LayerToggle label="Citizen observations" on={layers.citizen} onClick={() => toggle("citizen")} />
              </div>
            </details>
          )}
        </div>
        {role === "municipal" ? (
          <MunicipalPanel
            environment={environment}
            history={history}
            loading={loadingStation}
            section={section}
            intensity={intensity}
            intervention={intervention}
            scenario={scenario}
            comparison={comparison}
            scenarioError={scenarioError}
            onIntensity={setIntensity}
            onIntervention={setIntervention}
            onSimulate={() => void runScenario()}
            onCompare={() => void runCompare()}
          />
        ) : (
          <CitizenPanel
            environment={environment}
            reports={reports}
            pin={pin ?? (environment?.station.latitude != null && environment.station.longitude != null
              ? { latitude: environment.station.latitude, longitude: environment.station.longitude }
              : null)}
            picking={picking}
            onPick={setPicking}
            onSubmit={(report) => {
              setReports((current) => [report, ...current])
              setLayers((current) => ({ ...current, citizen: true }))
            }}
          />
        )}
      </div>
    </div>
  )
}

function LayerToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <label className="flex shrink-0 cursor-pointer items-center justify-between gap-2 whitespace-nowrap py-0.5 md:w-full">
      <span>{label}</span>
      <input type="checkbox" checked={on} onChange={onClick} />
    </label>
  )
}
