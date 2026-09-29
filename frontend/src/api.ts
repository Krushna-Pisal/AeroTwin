import type {
  ComparePayload,
  Environment,
  HistoryPoint,
  Intensity,
  Intervention,
  MapPayload,
  MhPointEstimate,
  MhStationDetail,
  MhStationsPayload,
  ScenarioRow,
} from "./types"

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`${response.status} ${path}`)
  return response.json() as Promise<T>
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${response.status} ${path}`)
  return response.json() as Promise<T>
}

export function loadMap(
  scenarioIntervention?: string,
  scenarioIntensity?: string,
): Promise<MapPayload> {
  const params = new URLSearchParams()
  if (scenarioIntervention) params.set("scenario_intervention", scenarioIntervention)
  if (scenarioIntensity) params.set("scenario_intensity", scenarioIntensity)
  const qs = params.toString()
  return getJson(`/api/map/layers${qs ? `?${qs}` : ""}`)
}

export function loadEnvironment(stationId: string): Promise<Environment> {
  return getJson(`/api/environment/${stationId}`)
}

export async function loadHistory(
  stationId: string,
  limit = 168,
): Promise<HistoryPoint[]> {
  const body = await getJson<{ observations: HistoryPoint[] }>(
    `/api/observations/history?station_id=${encodeURIComponent(stationId)}&limit=${limit}`,
  )
  return body.observations ?? []
}

export async function loadAllStations(): Promise<
  { station_id: string; station_name: string; latitude: number | null; longitude: number | null }[]
> {
  const body = await getJson<{
    stations: { station_id: string; station_name: string; latitude: number | null; longitude: number | null }[]
  }>("/api/stations")
  return body.stations ?? []
}

export async function loadLatestObservations(): Promise<{
  observations: { station_id: string; station_name: string; pm25: number | null; timestamp: string | null; status: string; archive_stale?: boolean; archive_age_hours?: number }[]
  archive_stale: boolean
  archive_age_hours: number
}> {
  const body = await getJson<{
    observations: { station_id: string; station_name: string; pm25: number | null; timestamp: string | null; status: string; archive_stale?: boolean; archive_age_hours?: number }[]
    archive_stale: boolean
    archive_age_hours: number
  }>("/api/observations/latest")
  return {
    observations: body.observations ?? [],
    archive_stale: body.archive_stale ?? false,
    archive_age_hours: body.archive_age_hours ?? 0,
  }
}

export async function loadForecasts(): Promise<
  { station_id: string; pm25: number | null; method: string; status: string }[]
> {
  const body = await getJson<{
    forecasts: { station_id: string; pm25: number | null; method: string; status: string }[]
  }>("/api/forecast")
  return body.forecasts ?? []
}

export async function loadForecast(stationId: string) {
  return getJson<{ station_id: string; pm25: number | null; method: string; status: string }>(
    `/api/forecast?station_id=${encodeURIComponent(stationId)}`,
  )
}

export async function loadHotspots() {
  return getJson<{ hotspots: { station_id: string; station_name: string; pm25: number | null; rolling_24h_mean: number | null; percentile: number | null }[] }>(
    "/api/hotspots",
  )
}

export async function loadSourceContribution(stationId: string) {
  return getJson<{
    station_id: string
    timestamp: string | null
    pm25: number | null
    categories: { category: string; score: number | null; normalized_share: number | null; confidence: string | null; status: string }[]
  }>(`/api/source-contributions/${stationId}`)
}

export function simulate(
  stationId: string,
  intervention: Intervention,
  intensity: Intensity,
): Promise<{ scenario: ScenarioRow; limitations: string[] }> {
  return postJson("/api/scenarios/simulate", {
    station_id: stationId,
    intervention,
    intensity,
  })
}

export function compare(
  stationId: string,
  intensity: Intensity,
): Promise<ComparePayload> {
  return postJson("/api/scenarios/compare", {
    station_id: stationId,
    interventions: [
      { intervention: "traffic_restriction", intensity },
      { intervention: "industrial_control", intensity },
      { intervention: "dust_construction_control", intensity },
    ],
  })
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${response.status} ${path}`)
  return response.json() as Promise<T>
}

export async function loadHealth() {
  return getJson<{
    status: string
    clock: string
    hourly_rows: number
    pm25_hours: number
    observation_start: string | null
    observation_end: string | null
  }>("/api/health")
}

export async function loadReports(filters?: { category?: string; status?: string; severity?: string }) {
  const params = new URLSearchParams()
  if (filters?.category) params.set("category", filters.category)
  if (filters?.status) params.set("status", filters.status)
  if (filters?.severity) params.set("severity", filters.severity)
  const qs = params.toString()
  const data = await getJson<{ reports: any[] }>(`/api/reports${qs ? `?${qs}` : ""}`)
  return data.reports ?? []
}

export async function createReport(payload: any) {
  return postJson<any>("/api/reports", payload)
}

export async function updateReport(reportId: string, payload: any) {
  return patchJson<any>(`/api/reports/${reportId}`, payload)
}

export async function loadSpatialContributions(status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ""
  const data = await getJson<{ spatial_contributions: any[] }>(`/api/spatial-contributions${qs}`)
  return data.spatial_contributions ?? []
}

export async function createSpatialContribution(payload: any) {
  return postJson<any>("/api/spatial-contributions", payload)
}

export async function reviewSpatialContribution(contribId: string, action: string, remarks?: string, rejection_reason?: string) {
  return patchJson<any>(`/api/spatial-contributions/${contribId}`, { action, remarks, rejection_reason })
}

export async function loadDepartments() {
  const data = await getJson<{ departments: any[] }>("/api/departments")
  return data.departments ?? []
}

export async function loadAuditLogs() {
  const data = await getJson<{ audit_logs: any[] }>("/api/audit-logs")
  return data.audit_logs ?? []
}

export async function loadSpatialAnalysis() {
  return getJson<any>("/api/spatial-contributions/analysis")
}

export function loadMhStations(): Promise<MhStationsPayload> {
  return getJson("/api/maharashtra/stations")
}

export function loadMhStation(locationId: number): Promise<MhStationDetail> {
  return getJson(`/api/maharashtra/stations/${locationId}`)
}

export function loadMhPoint(latitude: number, longitude: number): Promise<MhPointEstimate> {
  return getJson(`/api/maharashtra/point?lat=${latitude.toFixed(5)}&lon=${longitude.toFixed(5)}`)
}

