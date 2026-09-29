export type DataStatus =
  | "OBSERVED"
  | "MODELED"
  | "PROXY"
  | "CITIZEN_REPORTED"
  | "SCENARIO"
  | "DATA_UNAVAILABLE"

export type Intensity = "LOW" | "MEDIUM" | "HIGH"

export type Intervention = "traffic_restriction" | "industrial_control" | "dust_construction_control"

export type LayerKey = "stations" | "current" | "hotspots" | "forecast" | "industrial" | "roads" | "citizen"

export type FeatureCollection = {
  type: "FeatureCollection"
  features: GeoFeature[]
  status?: string
  note?: string
}

export type GeoFeature = {
  type: "Feature"
  geometry: { type: string; coordinates: number[] | number[][] | number[][][] } | null
  properties: Record<string, unknown>
}

export type MapPayload = {
  layers: { id: string; status?: string; feature_count?: number; note?: string }[]
  collections: {
    stations: FeatureCollection
    current_pm25: FeatureCollection
    hotspots: FeatureCollection
    forecast: FeatureCollection
    industrial_proxy: FeatureCollection
    road_context: FeatureCollection
    citizen_reports: FeatureCollection
    scenario_results: FeatureCollection
  }
  interpolation: null
  note?: string
}

export type CategoryRow = {
  category: "TRAFFIC" | "INDUSTRIAL" | "DUST_CONSTRUCTION"
  score: number | null
  normalized_share: number | null
  confidence: string | null
  status: DataStatus
  evidence: { name: string; value: number | null; unit: string | null; status: string; detail?: string }[]
  limitations: string[]
}

export type Environment = {
  station: {
    station_id: string
    station_name: string
    latitude: number | null
    longitude: number | null
    coordinate_status: string
    status: DataStatus
  }
  timestamp: string | null
  current_observation: {
    pm25: number | null
    unit: string
    timestamp: string | null
    status: DataStatus
    detail?: string
    archive_age_hours?: number | null
    archive_stale?: boolean | null
  }
  recent_cpcb_reading?: {
    status: DataStatus
    same_monitor: boolean
    source: string
    source_station: string | null
    pm25: number | null
    unit: string
    timestamp_utc: string | null
    timestamp_local: string | null
    age_hours: number | null
    detail: string
  }
  live_reading?: {
    status: DataStatus
    same_monitor: boolean
    pm25: number | null
    unit: string
    source: string
    source_url: string
    source_station: string | null
    page_updated_local: string | null
    detail: string
    city: {
      name: string
      pm25: number | null
      page_updated_local: string | null
      status: DataStatus
      detail: string
    } | null
  }
  forecast: {
    pm25: number | null
    observed_pm25?: number | null
    unit?: string
    timestamp?: string
    forecast_timestamp?: string
    method?: string
    status: DataStatus
    forecast_status?: string | null
    stale?: boolean
    note?: string
    detail?: string
  }
  hotspot: {
    hotspot: boolean | null
    rolling_24h_mean?: number | null
    rolling_24h_hours?: number
    percentile?: number | null
    status: DataStatus
    detail?: string
  }
  activity: {
    traffic: {
      volume: number | null
      volume_status: DataStatus
      context_layer: { status: DataStatus; measures_traffic: boolean; feature_count: number }
      evidence_status: DataStatus | null
      score: number | null
    }
    industrial: { label: string | null; value: number | null; status: DataStatus; score: number | null }
    dust_construction: { value: number | null; status: DataStatus; score: number | null }
  }
  source_contributions: {
    methodology: string
    categories: CategoryRow[]
    limitations: string[]
  }
  citizen_reports: { status: DataStatus; count: number; reports: unknown[]; detail: string }
  weather: {
    status: DataStatus
    fields_present: number
    fields: Record<string, { value: number | null; status: DataStatus }>
  }
  data_quality: {
    pm25_coverage: {
      hours_in_table: number
      hours_with_pm25: number
      coverage_fraction: number | null
      status: DataStatus
    }
    weather_availability: { fields_present_at_latest_hour: number; status: DataStatus }
    coordinate_availability: { available: boolean; coordinate_status: string; status: DataStatus }
    activity_evidence_availability: Record<string, DataStatus>
    citizen_report_availability: { count: number; status: DataStatus }
  }
  scenario_availability: {
    status: DataStatus
    results_included: boolean
    interventions: Intervention[]
    intensities: Intensity[]
    note: string
  }
  limitations: string[]
  interpolation: null
}

export type HistoryPoint = { timestamp: string; pm25: number | null }

export type ScenarioRow = {
  scenario_id: string
  intervention_type: Intervention
  intervention_intensity: Intensity
  baseline_pm25: number | null
  modeled_pm25: number | null
  absolute_change: number | null
  percentage_change: number | null
  baseline_contribution: number | null
  modeled_contribution: number | null
  reduction_assumption: number
  reduction_assumption_label: string
  confidence: string | null
  status: DataStatus
  source_evidence_status: DataStatus
  assumptions: { label: string; statement: string; value: number }[]
  limitations: string[]
}

export type ComparePayload = {
  baseline: { pm25: number | null; pm25_status: DataStatus | null }
  scenarios: ScenarioRow[]
  assumptions: { statement: string; label: string }[]
  limitations: string[]
}

export type CitizenReport = {
  id: string
  category: string
  description: string
  longitude: number
  latitude: number
  photoName: string | null
  status: "CITIZEN_REPORTED"
}

export type MhStation = {
  location_id: number
  name: string
  locality: string | null
  provider: string | null
  owner: string | null
  longitude: number
  latitude: number
  unit: string
  last_pm25: number | null
  last_utc: string | null
  age_hours: number | null
  now_pm25: number | null
  now_status: DataStatus
  now_basis: string
}

export type MhStationsPayload = {
  source: string
  generated_utc: string
  api_key_set: boolean
  listing_utc: string | null
  last_refresh_utc: string | null
  stations_read: number
  stations_listed: number
  counts: Record<"OBSERVED" | "MODELED" | "DATA_UNAVAILABLE", number>
  observed_max_age_hours: number
  type: "FeatureCollection"
  features: { type: "Feature"; geometry: { type: "Point"; coordinates: [number, number] }; properties: MhStation }[]
}

export type MhForecastRow = {
  hours_ahead: number
  valid_utc: string
  pm25: number | null
  status: DataStatus
  typical_error: number | null
}

export type MhStationDetail = {
  kind: "station"
  source: string
  generated_utc: string
  station: MhStation
  recent_hours: { utc: string; pm25: number; status: DataStatus }[]
  forecast_method: string
  forecast_note: string
  forecast: MhForecastRow[]
}

export type MhNeighbour = {
  location_id: number
  name: string
  distance_km: number
  now_pm25: number
  now_status: DataStatus
  age_hours: number | null
  weight: number
}

export type MhPointEstimate = {
  kind: "point"
  source: string
  generated_utc: string
  latitude: number
  longitude: number
  unit: string
  inside_maharashtra: boolean
  now_pm25: number | null
  now_status: DataStatus
  confidence: "HIGH" | "MEDIUM" | "LOW" | null
  nearest_km: number | null
  neighbours: MhNeighbour[]
  forecast_method: string
  forecast_note: string
  forecast: MhForecastRow[]
  detail?: string
}
