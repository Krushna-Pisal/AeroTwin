export interface SimulationParameters {
  /** Traffic volume change in percentage (-60 to +40) */
  trafficVolume: number
  /** Public transport ridership change in percentage (-30 to +60) */
  publicTransport: number
  /** Industrial stack and manufacturing emission change in percentage (-60 to +30) */
  industrialEmissions: number
  /** Construction site and demolition dust activity in percentage (-60 to +30) */
  constructionActivity: number
  /** Urban tree canopy and green cover change in percentage (-20 to +50) */
  greenCover: number
  /** Road network capacity and synchronized signal flow change in percentage (-20 to +40) */
  roadCapacity: number
}

export type ScopeType = "city_wide" | "station"

export interface SimulationScope {
  type: ScopeType
  stationId?: string
  stationName?: string
}

export interface SimulationBaseline {
  avgAqi: number
  avgPm25: number
  congestionIndex: number // percentage 0-100%
  emissionsIndex: number // base 100
  avgSpeed: number // km/h
  highRiskZones: number // count of monitoring zones > 100 μg/m³
  affectedZonesCount: number
  stationValues: Record<string, number>
}

export interface SimulatedState {
  avgAqi: number
  avgPm25: number
  congestionIndex: number
  emissionsIndex: number
  avgSpeed: number
  highRiskZones: number
  stationValues: Record<string, number>
  stationDiffs: Record<string, number>
}

export interface ImpactSummary {
  pm25Delta: number
  pm25DeltaPct: number
  aqiDelta: number
  aqiDeltaPct: number
  congestionDelta: number
  congestionDeltaPct: number
  emissionsDelta: number
  emissionsDeltaPct: number
  speedDelta: number
  speedDeltaPct: number
  highRiskZonesDelta: number
  affectedZones: number
  improvedZones: number
  deterioratedZones: number
  overallScore: number // -100 to +100 improvement index
}

export interface SensitivityFactor {
  parameterKey: keyof SimulationParameters
  label: string
  contributionPct: number
  marginalEffect: string
  color: string
}

export interface SimulationResult {
  parameters: SimulationParameters
  scope: SimulationScope
  baseline: SimulationBaseline
  simulated: SimulatedState
  impact: ImpactSummary
  sensitivity: SensitivityFactor[]
  summaryNarrative: string
  calculatedAt: string
}

export interface ScenarioPreset {
  id: string
  name: string
  icon: string
  tagline: string
  description: string
  parameters: SimulationParameters
  color: string
}

export interface SavedScenario {
  id: string
  name: string
  description: string
  parameters: SimulationParameters
  result: SimulationResult
  createdAt: string
}
