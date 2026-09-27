import type { ComparePayload, Environment, HistoryPoint, Intensity, Intervention, MapPayload, ScenarioRow } from "./types"

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`${response.status} ${path}`)
  }
  return response.json() as Promise<T>
}

export function loadMap(): Promise<MapPayload> {
  return getJson("/api/map/layers")
}

export function loadEnvironment(stationId: string): Promise<Environment> {
  return getJson(`/api/environment/${stationId}`)
}

export async function loadHistory(stationId: string): Promise<HistoryPoint[]> {
  const body = await getJson<{ observations: HistoryPoint[] }>(
    `/api/observations/history?station_id=${encodeURIComponent(stationId)}&limit=72`,
  )
  return body.observations ?? []
}

export function simulate(stationId: string, intervention: Intervention, intensity: Intensity): Promise<{ scenario: ScenarioRow; limitations: string[] }> {
  return postJson("/api/scenarios/simulate", {
    station_id: stationId,
    intervention,
    intensity,
  })
}

export function compare(stationId: string, intensity: Intensity): Promise<ComparePayload> {
  return postJson("/api/scenarios/compare", {
    station_id: stationId,
    interventions: [
      { intervention: "traffic_restriction", intensity },
      { intervention: "industrial_control", intensity },
      { intervention: "dust_construction_control", intensity },
    ],
  })
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`${response.status} ${path}`)
  }
  return response.json() as Promise<T>
}
