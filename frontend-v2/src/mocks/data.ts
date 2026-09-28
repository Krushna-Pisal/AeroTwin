export const mockEnvironment = {
  station: {
    station_id: 'mock-1',
    station_name: 'Pune Mock Station',
    latitude: 18.5204,
    longitude: 73.8567,
    status: 'OBSERVED'
  },
  current_observation: {
    pm25: 65,
    unit: 'µg/m³',
    timestamp: new Date().toISOString(),
    status: 'OBSERVED'
  },
  forecast: {
    pm25: 70,
    method: 'persistence',
    status: 'MODELED'
  },
  activity: {
    traffic: { volume: null, score: 0.6, volume_status: 'DATA_UNAVAILABLE' },
    industrial: { value: 0.4, status: 'PROXY' },
    dust_construction: { value: 0.8, status: 'PROXY' }
  },
  source_contributions: {
    categories: [],
    limitations: []
  },
  weather: {
    fields: {
      temperature: { value: 30, status: 'OBSERVED' },
      humidity: { value: 45, status: 'OBSERVED' }
    }
  }
}
