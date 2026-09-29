/**
 * Civic What-If Impact Simulation Engine
 *
 * Provides a scenario-based estimation model linking urban policy levers
 * (traffic volume, public transit, industry, construction, green cover, road capacity)
 * to estimated civic & environmental outcomes (congestion, emissions, ambient PM2.5/AQI,
 * travel speed, high-risk zone count).
 *
 * NOTE: This is an explainable civic decision-support scenario model designed for policy exploration,
 * not an uncalibrated fluid-dynamics numerical solver. Coefficients are documented below.
 */

import type {
  ImpactSummary,
  SensitivityFactor,
  SimulatedState,
  SimulationBaseline,
  SimulationParameters,
  SimulationResult,
  SimulationScope,
} from "./types"

// ── HEURISTIC MODEL COEFFICIENTS ─────────────────────────────────────────────
//
// 1. Modal Shift Cross-Elasticity (PT -> Private Vehicle Traffic):
//    Every 10% increase in public transport ridership absorbs approximately 4.0% of private vehicle trips.
const COEFF_PT_TO_TRAFFIC = 0.40

// 2. Traffic Flow to Bottleneck Congestion:
//    Congestion scales near-linearly with effective vehicle volume, offset by capacity enhancements.
const COEFF_TRAFFIC_TO_CONGESTION = 0.90
const COEFF_CAPACITY_TO_CONGESTION = 0.60

// 3. Stop-and-Go Idling Emission Penalty:
//    Vehicular tailpipe emissions rise in heavy congestion due to idle-stop cycles and low engine efficiency.
const COEFF_CONGESTION_IDLING_PENALTY = 0.0035

// 4. Urban Green Canopy Bio-filtration:
//    Urban foliage and vegetative buffers capture coarse and fine particulates via physical impaction.
//    Every 10% increase in green cover provides ~2.8% direct settling of ambient fine particulates.
const COEFF_GREEN_PM25_FILTRATION = 0.28

// 5. Source Contribution Shares to Ambient PM2.5 in Urban Pune:
//    Derived from CPCB source apportionment studies for metropolitan areas:
//    - Vehicular tailpipe & road wear: ~40%
//    - Industrial fuel & process emissions: ~30%
//    - Construction & road dust: ~20%
//    - Regional/secondary background (invariable in local policy): ~10%
const WEIGHT_TRAFFIC_PM25 = 0.40
const WEIGHT_INDUSTRIAL_PM25 = 0.30
const WEIGHT_CONSTRUCTION_PM25 = 0.20

// 6. Kinematic Traffic Speed Relationship:
//    Average travel speed across arterial corridors inversely responds to congestion changes.
const BASELINE_AVERAGE_SPEED_KMH = 23.5 // Pune urban core average speed
const COEFF_CONGESTION_TO_SPEED = 0.0085

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Derives a baseline state from actual real-world station observations.
 */
export function createBaselineFromStations(
  stations: { station_id: string; station_name: string; pm25?: number | null }[],
  fallbackBaselinePm25 = 77.8,
): SimulationBaseline {
  const stationValues: Record<string, number> = {}
  let totalPm25 = 0
  let validCount = 0

  for (const s of stations) {
    const val = typeof s.pm25 === "number" && s.pm25 > 0 ? s.pm25 : fallbackBaselinePm25
    stationValues[s.station_id] = Math.round(val * 10) / 10
    totalPm25 += val
    validCount++
  }

  const avgPm25 = validCount > 0 ? Math.round((totalPm25 / validCount) * 10) / 10 : fallbackBaselinePm25
  const highRiskZones = Object.values(stationValues).filter((v) => v > 100).length

  return {
    avgPm25,
    avgAqi: Math.round(avgPm25 * 1.35), // Approximate AQI conversion for PM2.5
    congestionIndex: 72, // 72% baseline arterial congestion in peak Pune
    emissionsIndex: 100, // 100 index baseline
    avgSpeed: BASELINE_AVERAGE_SPEED_KMH,
    highRiskZones,
    affectedZonesCount: Object.keys(stationValues).length,
    stationValues,
  }
}

/**
 * Runs the What-If simulation engine with the provided parameters and baseline data.
 */
export function runWhatIfSimulation(
  params: SimulationParameters,
  baseline: SimulationBaseline,
  scope: SimulationScope = { type: "city_wide" },
): SimulationResult {
  const {
    trafficVolume,
    publicTransport,
    industrialEmissions,
    constructionActivity,
    greenCover,
    roadCapacity,
  } = params

  // 1. Effective Vehicle Volume (accounting for public transit absorption)
  const effectiveTrafficChange = trafficVolume - (publicTransport * COEFF_PT_TO_TRAFFIC)

  // 2. Congestion Index Change
  const congestionPctChange =
    (effectiveTrafficChange * COEFF_TRAFFIC_TO_CONGESTION) -
    (roadCapacity * COEFF_CAPACITY_TO_CONGESTION)

  const simulatedCongestion = clamp(
    Math.round((baseline.congestionIndex * (1 + congestionPctChange / 100)) * 10) / 10,
    12,
    98,
  )

  // 3. Vehicle & Tailpipe Emissions Index
  const congestionIdlingFactor = 1 + (congestionPctChange * COEFF_CONGESTION_IDLING_PENALTY)
  const vehicleEmissionsPctChange = (effectiveTrafficChange * 0.85) * congestionIdlingFactor
  const simulatedEmissionsIndex = clamp(
    Math.round((baseline.emissionsIndex * (1 + vehicleEmissionsPctChange / 100)) * 10) / 10,
    15,
    220,
  )

  // 4. Urban Kinematic Speed (km/h)
  const speedMultiplier = 1 - (congestionPctChange * COEFF_CONGESTION_TO_SPEED)
  const simulatedSpeed = clamp(
    Math.round(baseline.avgSpeed * speedMultiplier * 10) / 10,
    8.0,
    55.0,
  )

  // 5. Environmental Bio-filtration (Green Cover)
  const greenFiltrationReductionPct = greenCover * COEFF_GREEN_PM25_FILTRATION

  // 6. Net Ambient PM2.5 Percentage Impact
  const pm25NetPctChange =
    (vehicleEmissionsPctChange * WEIGHT_TRAFFIC_PM25) +
    (industrialEmissions * WEIGHT_INDUSTRIAL_PM25) +
    (constructionActivity * WEIGHT_CONSTRUCTION_PM25) -
    greenFiltrationReductionPct

  // 7. Per-Station and Spatial State
  const simulatedStationValues: Record<string, number> = {}
  const stationDiffs: Record<string, number> = {}
  let totalSimPm25 = 0
  let simulatedHighRiskCount = 0
  let improvedZones = 0
  let deterioratedZones = 0
  let affectedZones = 0

  const stationIds = Object.keys(baseline.stationValues)

  for (const stId of stationIds) {
    const baseVal = baseline.stationValues[stId]
    const isTarget = scope.type === "city_wide" || scope.stationId === stId

    if (isTarget) {
      affectedZones++
      const newVal = clamp(Math.round(baseVal * (1 + pm25NetPctChange / 100) * 10) / 10, 8.0, 350.0)
      const diff = Math.round((newVal - baseVal) * 10) / 10
      simulatedStationValues[stId] = newVal
      stationDiffs[stId] = diff

      if (diff < -0.5) improvedZones++
      else if (diff > 0.5) deterioratedZones++

      if (newVal > 100) simulatedHighRiskCount++
      totalSimPm25 += newVal
    } else {
      // In localized mode, unaffected stations remain at baseline
      simulatedStationValues[stId] = baseVal
      stationDiffs[stId] = 0
      if (baseVal > 100) simulatedHighRiskCount++
      totalSimPm25 += baseVal
    }
  }

  const simulatedAvgPm25 = stationIds.length > 0
    ? Math.round((totalSimPm25 / stationIds.length) * 10) / 10
    : baseline.avgPm25

  const simulatedAvgAqi = Math.round(simulatedAvgPm25 * 1.35)

  // 8. Overall Impact Summary
  const pm25Delta = Math.round((simulatedAvgPm25 - baseline.avgPm25) * 10) / 10
  const pm25DeltaPct = baseline.avgPm25 > 0
    ? Math.round((pm25Delta / baseline.avgPm25) * 1000) / 10
    : 0

  const aqiDelta = simulatedAvgAqi - baseline.avgAqi
  const aqiDeltaPct = baseline.avgAqi > 0
    ? Math.round((aqiDelta / baseline.avgAqi) * 1000) / 10
    : 0

  const congestionDelta = Math.round((simulatedCongestion - baseline.congestionIndex) * 10) / 10
  const congestionDeltaPct = Math.round((congestionDelta / baseline.congestionIndex) * 1000) / 10

  const emissionsDelta = Math.round((simulatedEmissionsIndex - baseline.emissionsIndex) * 10) / 10
  const emissionsDeltaPct = Math.round((emissionsDelta / baseline.emissionsIndex) * 1000) / 10

  const speedDelta = Math.round((simulatedSpeed - baseline.avgSpeed) * 10) / 10
  const speedDeltaPct = Math.round((speedDelta / baseline.avgSpeed) * 1000) / 10

  const highRiskZonesDelta = simulatedHighRiskCount - baseline.highRiskZones

  // Overall civic improvement score (-100 to +100)
  const overallScore = Math.round(
    (-pm25DeltaPct * 0.40) +
    (-congestionDeltaPct * 0.35) +
    (speedDeltaPct * 0.25),
  )

  const simulatedState: SimulatedState = {
    avgAqi: simulatedAvgAqi,
    avgPm25: simulatedAvgPm25,
    congestionIndex: simulatedCongestion,
    emissionsIndex: simulatedEmissionsIndex,
    avgSpeed: simulatedSpeed,
    highRiskZones: simulatedHighRiskCount,
    stationValues: simulatedStationValues,
    stationDiffs,
  }

  const impact: ImpactSummary = {
    pm25Delta,
    pm25DeltaPct,
    aqiDelta,
    aqiDeltaPct,
    congestionDelta,
    congestionDeltaPct,
    emissionsDelta,
    emissionsDeltaPct,
    speedDelta,
    speedDeltaPct,
    highRiskZonesDelta,
    affectedZones,
    improvedZones,
    deterioratedZones,
    overallScore,
  }

  // 9. Sensitivity / "What Matters Most?" Analysis
  const sensitivity = calculateSensitivity(params)

  // 10. Natural Language Explainable Narrative
  const summaryNarrative = generateSummaryNarrative(params, impact, scope)

  return {
    parameters: params,
    scope,
    baseline,
    simulated: simulatedState,
    impact,
    sensitivity,
    summaryNarrative,
    calculatedAt: new Date().toISOString(),
  }
}

/**
 * Calculates sensitivity factors explaining which parameter produced the largest modeled effect.
 */
function calculateSensitivity(params: SimulationParameters): SensitivityFactor[] {
  const rawWeights = [
    {
      parameterKey: "trafficVolume" as keyof SimulationParameters,
      label: "Traffic Volume Reduction",
      impactMagnitude: Math.abs(params.trafficVolume) * WEIGHT_TRAFFIC_PM25 * 1.2,
      color: "#3b82f6",
      marginal: "Reduces arterial tailpipe exhaust and stops bottleneck idling.",
    },
    {
      parameterKey: "publicTransport" as keyof SimulationParameters,
      label: "Public Transit Modal Shift",
      impactMagnitude: Math.abs(params.publicTransport) * COEFF_PT_TO_TRAFFIC * WEIGHT_TRAFFIC_PM25,
      color: "#06b6d4",
      marginal: "Diverts private single-occupancy commuters to mass transit.",
    },
    {
      parameterKey: "industrialEmissions" as keyof SimulationParameters,
      label: "Industrial Emission Controls",
      impactMagnitude: Math.abs(params.industrialEmissions) * WEIGHT_INDUSTRIAL_PM25,
      color: "#f59e0b",
      marginal: "Eliminates stationary point-source manufacturing combustion.",
    },
    {
      parameterKey: "greenCover" as keyof SimulationParameters,
      label: "Urban Green Canopy Bio-filtration",
      impactMagnitude: Math.abs(params.greenCover) * COEFF_GREEN_PM25_FILTRATION,
      color: "#10b981",
      marginal: "Bio-filters airborne particulate matter through vegetative impaction.",
    },
    {
      parameterKey: "constructionActivity" as keyof SimulationParameters,
      label: "Construction & Dust Abatement",
      impactMagnitude: Math.abs(params.constructionActivity) * WEIGHT_CONSTRUCTION_PM25,
      color: "#8b5cf6",
      marginal: "Limits fugitive dust plumes from earthworks and demolition.",
    },
    {
      parameterKey: "roadCapacity" as keyof SimulationParameters,
      label: "Smart Traffic Flow & Capacity",
      impactMagnitude: Math.abs(params.roadCapacity) * COEFF_CAPACITY_TO_CONGESTION * 0.15,
      color: "#ec4899",
      marginal: "Improves steady-state vehicular speed and cuts idling time.",
    },
  ]

  const totalMagnitude = rawWeights.reduce((acc, curr) => acc + curr.impactMagnitude, 0)

  if (totalMagnitude === 0) {
    // If no changes, return default distribution
    return rawWeights.map((w) => ({
      parameterKey: w.parameterKey,
      label: w.label,
      contributionPct: 16.7,
      marginalEffect: w.marginal,
      color: w.color,
    }))
  }

  return rawWeights
    .filter((w) => w.impactMagnitude > 0)
    .map((w) => ({
      parameterKey: w.parameterKey,
      label: w.label,
      contributionPct: Math.round((w.impactMagnitude / totalMagnitude) * 100),
      marginalEffect: w.marginal,
      color: w.color,
    }))
    .sort((a, b) => b.contributionPct - a.contributionPct)
}

/**
 * Generates an explainable narrative detailing policy mechanisms and civic trade-offs.
 */
function generateSummaryNarrative(
  params: SimulationParameters,
  impact: ImpactSummary,
  scope: SimulationScope,
): string {
  const isCityWide = scope.type === "city_wide"
  const scopeDesc = isCityWide ? "city-wide across Pune" : `for ${scope.stationName || "the selected zone"}`

  const activePolicies: string[] = []
  if (params.trafficVolume !== 0) {
    activePolicies.push(`traffic volume ${params.trafficVolume > 0 ? "increased" : "curtailed"} by ${Math.abs(params.trafficVolume)}%`)
  }
  if (params.publicTransport !== 0) {
    activePolicies.push(`public transit usage expanded by ${params.publicTransport}%`)
  }
  if (params.industrialEmissions !== 0) {
    activePolicies.push(`industrial stack emissions ${params.industrialEmissions > 0 ? "amplified" : "controlled"} by ${Math.abs(params.industrialEmissions)}%`)
  }
  if (params.greenCover !== 0) {
    activePolicies.push(`urban green canopy scaled by ${params.greenCover}%`)
  }
  if (params.constructionActivity !== 0) {
    activePolicies.push(`construction dust controls adjusted by ${params.constructionActivity}%`)
  }
  if (params.roadCapacity !== 0) {
    activePolicies.push(`road capacity optimized by ${params.roadCapacity}%`)
  }

  if (activePolicies.length === 0) {
    return `Baseline conditions currently active ${scopeDesc}. No policy intervention has been applied yet. Adjust sliders or select a scenario preset to explore simulated what-if outcomes.`
  }

  const direction = impact.pm25Delta <= 0 ? "improved" : "deteriorated"
  const aqiText = impact.pm25Delta <= 0
    ? `reduces modeled ambient PM2.5 by ${Math.abs(impact.pm25Delta)} μg/m³ (${Math.abs(impact.pm25DeltaPct)}%)`
    : `increases modeled ambient PM2.5 by ${impact.pm25Delta} μg/m³ (+${impact.pm25DeltaPct}%)`

  const congestionText = impact.congestionDelta <= 0
    ? `arterial congestion drops from baseline down to ${impact.congestionDeltaPct}% lower`
    : `congestion intensifies by +${impact.congestionDeltaPct}%`

  const speedText = impact.speedDelta >= 0
    ? `average corridor transit speed accelerates by +${impact.speedDeltaPct}%`
    : `average transit speed slows down by ${impact.speedDeltaPct}%`

  return (
    `Under the hypothetical scenario where ${activePolicies.join(", ")}, the modeled environmental state ${direction} ${scopeDesc}. ` +
    `Specifically, ${aqiText}, while ${congestionText} and ${speedText}. ` +
    `${impact.improvedZones > 0 ? `A total of ${impact.improvedZones} monitoring zones shifted into cleaner health categories.` : ""} ` +
    `Note: Modeled estimates are generated via AeroTwin's scenario heuristic matrix based on empirical CPCB source-contribution baselines, not direct sensor forecasts.`
  )
}
