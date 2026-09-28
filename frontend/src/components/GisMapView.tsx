import { useState } from "react"
import type { Environment } from "../types"
import { MapCanvas } from "./MapCanvas"

type Props = {
  mapData: any
  environment: Environment | null
  reports: any[]
  spatialContributions: any[]
  onSelectStation: (id: string) => void
  onPickLocation?: (longitude: number, latitude: number) => void
  pickLocation?: boolean
  pickedLocation?: { longitude: number; latitude: number } | null
}

export function GisMapView({
  mapData,
  environment,
  reports = [],
  spatialContributions = [],
  onSelectStation,
  onPickLocation,
  pickLocation = false,
  pickedLocation = null,
}: Props) {
  // Layer visibility state
  const [layers, setLayers] = useState<Record<string, boolean>>({
    stations: true,
    current: true,
    hotspots: true,
    forecast: true,
    industrial: true,
    roads: true,
    citizen: true,
    reports: true,
    spatial: true,
    verified: true,
    h3: true,
    heatmap: true,
    critical: true,
  })

  // H3 Opacity slider state (default 22%)
  const [h3Opacity, setH3Opacity] = useState<number>(0.22)

  // Map Filter states
  const [filterSeverity, setFilterSeverity] = useState<string>("All")
  const [filterStatus, setFilterStatus] = useState<string>("All")
  const [filterCategory, setFilterCategory] = useState<string>("All")

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [searchOpen, setSearchOpen] = useState<boolean>(false)

  // H3 selected cell state
  const [selectedCell, setSelectedCell] = useState<{ cellId: string; pm25: number; centroid: [number, number] } | null>(null)

  // Control drawer visibility
  const [controlsOpen, setControlsOpen] = useState<boolean>(true)

  // Toggle layer helper
  function toggleLayer(key: string) {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Filter reports
  const filteredReports = reports.filter((r) => {
    if (filterSeverity !== "All" && r.severity !== filterSeverity) return false
    if (filterStatus !== "All" && r.status !== filterStatus) return false
    if (filterCategory !== "All" && r.category !== filterCategory) return false
    return true
  })

  // Filter spatial contributions
  const filteredSpatial = spatialContributions.filter((s) => {
    if (filterStatus !== "All" && s.status !== filterStatus) return false
    return true
  })

  // Search items list
  const stationItems = [
    { id: "site_5409", name: "Swargate, Pune", type: "Monitoring Station", lat: 18.5018, lng: 73.8584 },
    { id: "site_5411", name: "Shivajinagar, Pune", type: "Monitoring Station", lat: 18.5308, lng: 73.8475 },
    { id: "site_5410", name: "Pashan, Pune", type: "Monitoring Station", lat: 18.5580, lng: 73.8070 },
    { id: "site_5412", name: "Hadapsar, Pune", type: "Monitoring Station", lat: 18.5018, lng: 73.9275 },
    { id: "site_5413", name: "Viman Nagar, Pune", type: "Monitoring Station", lat: 18.5679, lng: 73.9143 },
    { id: "site_5414", name: "Kothrud, Pune", type: "Monitoring Station", lat: 18.5074, lng: 73.8077 },
    { id: "site_5415", name: "Hinjewadi Phase 1, Pune", type: "Monitoring Station", lat: 18.6058, lng: 73.7500 },
  ]

  const searchResults = searchQuery.trim()
    ? [
        ...stationItems.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.id.toLowerCase().includes(searchQuery.toLowerCase())),
        ...reports.filter((r) => r.id.toLowerCase().includes(searchQuery.toLowerCase()) || (r.title || r.category).toLowerCase().includes(searchQuery.toLowerCase()))
          .map((r) => ({ id: r.id, name: `${r.id}: ${r.title || r.category}`, type: "Citizen Report", lat: r.latitude || 18.52, lng: r.longitude || 73.85 })),
        ...spatialContributions.filter((s) => s.id.toLowerCase().includes(searchQuery.toLowerCase()) || (s.title || s.contribution_type).toLowerCase().includes(searchQuery.toLowerCase()))
          .map((s) => ({ id: s.id, name: `${s.id}: ${s.title || s.contribution_type}`, type: "Spatial Item", lat: s.latitude || 18.52, lng: s.longitude || 73.85 })),
      ]
    : []

  function handleSelectSearchResult(item: any) {
    setSearchQuery("")
    setSearchOpen(false)
    if (item.type === "Monitoring Station") {
      onSelectStation(item.id)
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0f1117]">
      {/* Map Canvas */}
      <MapCanvas
        stations={mapData?.collections?.stations || { type: "FeatureCollection", features: [] }}
        current={mapData?.collections?.current_pm25 || { type: "FeatureCollection", features: [] }}
        hotspots={mapData?.collections?.hotspots || { type: "FeatureCollection", features: [] }}
        forecast={mapData?.collections?.forecast || { type: "FeatureCollection", features: [] }}
        industrial={mapData?.collections?.industrial_proxy || { type: "FeatureCollection", features: [] }}
        roads={mapData?.collections?.road_context || { type: "FeatureCollection", features: [] }}
        reports={filteredReports}
        spatialContributions={filteredSpatial}
        visible={layers}
        environment={environment}
        h3Opacity={h3Opacity}
        onSelect={onSelectStation}
        onPickLocation={onPickLocation}
        pickLocation={pickLocation}
        pickedLocation={pickedLocation}
        onSelectCell={setSelectedCell}
      />

      {/* Floating Header Controls: Search Bar & Quick Toggles */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-3 max-w-xl w-full">
        <div className="relative flex-1">
          <div className="flex items-center gap-2 rounded-xl border border-[#1e2432] bg-[#0d1117]/90 px-3.5 py-2.5 backdrop-blur-xl shadow-2xl">
            <svg className="h-4 w-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search station, complaint ID (CIV-2026-1001), spatial ID, or location..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setSearchOpen(true)
              }}
              onFocus={() => setSearchOpen(true)}
              className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-white text-xs font-bold">&times;</button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-[#1e2432] bg-[#0d1117]/95 p-2 backdrop-blur-xl shadow-2xl space-y-1 max-h-60 overflow-y-auto z-30">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectSearchResult(item)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#1f293d] transition text-left text-xs"
                >
                  <div>
                    <span className="font-semibold text-white">{item.name}</span>
                    <span className="text-[10px] text-slate-400 block">{item.type}</span>
                  </div>
                  <span className="text-[10px] font-mono text-green-400">Jump &rarr;</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setControlsOpen(!controlsOpen)}
          className="px-3.5 py-2.5 rounded-xl border border-[#1e2432] bg-[#0d1117]/90 text-xs font-semibold text-white backdrop-blur-xl shadow-xl hover:bg-[#1a2332] transition flex items-center gap-2 shrink-0"
        >
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 010 4m-6 8a2 2 0 100-4m0 4a2 2 0 010-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 010-4m0 4v2m0-6V4" />
          </svg>
          Layers & Filters
        </button>
      </div>

      {/* Slide-out Layer Controls & Filters Panel */}
      {controlsOpen && (
        <div className="absolute top-20 left-4 z-20 max-w-sm w-full rounded-2xl border border-[#1e2432] bg-[#0d1117]/95 p-4 backdrop-blur-xl shadow-2xl text-slate-100 space-y-4 max-h-[calc(100vh-120px)] overflow-y-auto">
          {/* Section 1: H3 Heatmap Opacity Control */}
          <div className="p-3 rounded-xl border border-[#1e2432] bg-[#111827] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                H3 Heatmap Opacity
              </span>
              <span className="font-mono text-green-400 font-bold">{Math.round(h3Opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.50"
              step="0.05"
              value={h3Opacity}
              onChange={(e) => setH3Opacity(parseFloat(e.target.value))}
              className="w-full accent-green-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>10% (Clear Map)</span>
              <span>25% (Default)</span>
              <span>50% (Strong)</span>
            </div>
          </div>

          {/* Section 2: Real Map Layer Toggles */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Map Layer Toggles</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { key: "stations", label: "Stations", color: "bg-white" },
                { key: "current", label: "PM2.5 Heatmap", color: "bg-green-400" },
                { key: "hotspots", label: "Hotspot Rings", color: "bg-amber-400" },
                { key: "forecast", label: "Forecast Rings", color: "bg-blue-400" },
                { key: "roads", label: "Road Centerlines", color: "bg-slate-400" },
                { key: "industrial", label: "Industrial Polygons", color: "bg-yellow-500" },
                { key: "citizen", label: "Citizen Reports", color: "bg-red-400" },
                { key: "spatial", label: "Spatial Contributions", color: "bg-purple-400" },
                { key: "verified", label: "Verified GIS Layer", color: "bg-green-500" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleLayer(item.key)}
                  className={`flex items-center justify-between p-2 rounded-lg border text-[11px] font-medium transition ${
                    layers[item.key] !== false
                      ? "border-green-500/30 bg-[#141d2e] text-white"
                      : "border-[#1e2432] bg-[#111827] text-slate-500 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${item.color}`} />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[10px] font-bold">{layers[item.key] !== false ? "ON" : "OFF"}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Marker Filters */}
          <div className="space-y-2 pt-2 border-t border-[#1e2432]">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Map Marker Filters</span>

            <div className="space-y-2">
              <div>
                <label className="block text-[11px] text-slate-400">Severity</label>
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#1e2432] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none"
                >
                  <option value="All">All Severities</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#1e2432] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="VERIFIED">VERIFIED</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#1e2432] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none"
                >
                  <option value="All">All Categories</option>
                  <option value="Garbage">Garbage</option>
                  <option value="Road Damage">Road Damage</option>
                  <option value="Air Pollution">Air Pollution</option>
                  <option value="Street Light">Street Light</option>
                  <option value="Water Supply">Water Supply</option>
                  <option value="Traffic">Traffic</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* H3 Clicked Cell Information Panel */}
      {selectedCell && (
        <div className="absolute bottom-6 left-4 z-20 max-w-sm w-full rounded-2xl border border-green-500/30 bg-[#0d1117]/95 p-4 backdrop-blur-xl shadow-2xl text-slate-100 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1e2432] pb-2">
            <div>
              <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">H3 HEX CELL DETAILS</span>
              <h3 className="font-mono text-sm font-bold text-white">#{selectedCell.cellId.slice(-8).toUpperCase()}</h3>
            </div>
            <button onClick={() => setSelectedCell(null)} className="text-slate-400 hover:text-white text-base font-bold">&times;</button>
          </div>

          <div className="p-3 rounded-xl bg-[#111827] border border-[#1e2432] text-center">
            <span className="text-xs text-slate-400">IDW Interpolated PM2.5</span>
            <div className="text-3xl font-extrabold text-green-400 mt-1">{selectedCell.pm25.toFixed(1)} µg/m³</div>
            <span className="text-[10px] text-slate-500">Centroid: {selectedCell.centroid[1].toFixed(4)}, {selectedCell.centroid[0].toFixed(4)}</span>
          </div>

          <div className="text-[11px] text-slate-400 space-y-1">
            <div className="flex justify-between"><span>Resolution:</span> <strong className="text-white">H3 Res 8 (~460m edge)</strong></div>
            <div className="flex justify-between"><span>Interpolation:</span> <strong className="text-white">IDW (Power=2, Radius 25km)</strong></div>
            <div className="flex justify-between"><span>Spatial Status:</span> <strong className="text-green-400">Valid Surface Tile</strong></div>
          </div>
        </div>
      )}
    </div>
  )
}
