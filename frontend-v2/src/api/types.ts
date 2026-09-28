export type DataStatus = 'OBSERVED' | 'MODELED' | 'PROXY' | 'CITIZEN_REPORTED' | 'SCENARIO' | 'DATA_UNAVAILABLE'

export interface Environment {
  station: {
    station_id: string
    station_name: string
    latitude: number
    longitude: number
    status: DataStatus
  }
  current_observation: {
    pm25: number | null
    unit: string
    timestamp: string | null
    status: DataStatus
  }
  forecast: {
    pm25: number | null
    method: string
    status: DataStatus
  }
  activity: {
    traffic: { volume: number | null; score: number | null; volume_status: DataStatus }
    industrial: { value: number | null; status: DataStatus }
    dust_construction: { value: number | null; status: DataStatus }
  }
  source_contributions: {
    categories: any[]
    limitations: string[]
  }
  weather: {
    fields: Record<string, { value: number | null; status: DataStatus }>
  }
}
