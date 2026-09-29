/**
 * MapCanvas — MapLibre map with H3 hexagonal PM2.5 heatmap, layer toggles, H3 interaction, and spatial contributions.
 */

import maplibregl from "maplibre-gl"
import { useEffect, useRef } from "react"
import { createRoot, type Root } from "react-dom/client"
import { cellToBoundary, polygonToCells } from "h3-js"
import type { Environment, FeatureCollection } from "../types"
import { StationPopup } from "./StationPopup"

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] }

// Pune bounding box
const PUNE_BBOX = {
  minLat: 18.38,
  maxLat: 18.75,
  minLng: 73.68,
  maxLng: 74.05,
}

const H3_RES = 8
const IDW_POWER = 2
const MAX_RADIUS_DEG = 0.25

type StationPoint = { lat: number; lng: number; pm25: number; stationId?: string }

export type MapCanvasProps = {
  stations: FeatureCollection
  current: FeatureCollection
  hotspots: FeatureCollection
  forecast: FeatureCollection
  industrial: FeatureCollection
  roads: FeatureCollection
  reports?: any[]
  spatialContributions?: any[]
  verifiedContributions?: any[]
  visible: Record<string, boolean>
  environment: Environment | null
  h3Opacity?: number
  onSelect: (stationId: string) => void
  onPickLocation?: (longitude: number, latitude: number) => void
  pickLocation?: boolean
  pickedLocation?: { longitude: number; latitude: number } | null
  onSelectCell?: (cell: { cellId: string; pm25: number; centroid: [number, number] } | null) => void
  selectedCellId?: string | null
  drawnGeometry?: { type: "Point" | "LineString" | "Polygon"; coordinates: any } | null
  onDrawGeometry?: (geom: { type: "Point" | "LineString" | "Polygon"; coordinates: any }) => void
  drawingType?: "Point" | "Line" | "Polygon" | null
  /** When set, overrides live PM2.5 per station for simulation heatmap rendering */
  simulatedPm25?: Record<string, number> | null
  simulationLabel?: string | null
  simViewMode?: "baseline" | "simulated" | "compare"
  simulationBaselineMap?: Record<string, number> | null
  simulationDiffMap?: Record<string, number> | null
}

function idw(lat: number, lng: number, stations: StationPoint[]): number | null {
  let weightedSum = 0
  let weightTotal = 0
  let anyNear = false

  for (const st of stations) {
    const dLat = lat - st.lat
    const dLng = lng - st.lng
    const dist = Math.sqrt(dLat * dLat + dLng * dLng)

    if (dist < 0.0001) return st.pm25
    if (dist > MAX_RADIUS_DEG) continue

    anyNear = true
    const w = 1 / Math.pow(dist, IDW_POWER)
    weightedSum += w * st.pm25
    weightTotal += w
  }

  if (!anyNear || weightTotal === 0) return null
  return weightedSum / weightTotal
}

function buildHexGeoJSON(
  stationPoints: StationPoint[],
  simulatedPm25?: Record<string, number> | null,
  baselineStationPoints?: StationPoint[],
  simViewMode: "baseline" | "simulated" | "compare" = "simulated",
): GeoJSON.FeatureCollection {
  if (stationPoints.length === 0) {
    return { type: "FeatureCollection", features: [] }
  }

  // When simulation mode is active, locate the specific simulated station(s)
  const isSimulation = Boolean(simulatedPm25 && Object.keys(simulatedPm25).length > 0)
  const simStationCoords: [number, number][] = []
  if (isSimulation && simulatedPm25) {
    const simIds = new Set(Object.keys(simulatedPm25))
    for (const pt of stationPoints) {
      if (pt.stationId && simIds.has(pt.stationId)) {
        simStationCoords.push([pt.lat, pt.lng])
      }
    }
  }

  // Localized intervention zone radius (~4.5 km / 0.042 degrees)
  const LOCAL_ZONE_RADIUS_DEG = 0.042

  const bboxPoly: [number, number][] = [
    [PUNE_BBOX.minLat, PUNE_BBOX.minLng],
    [PUNE_BBOX.minLat, PUNE_BBOX.maxLng],
    [PUNE_BBOX.maxLat, PUNE_BBOX.maxLng],
    [PUNE_BBOX.maxLat, PUNE_BBOX.minLng],
    [PUNE_BBOX.minLat, PUNE_BBOX.minLng],
  ]
  const cells = polygonToCells([bboxPoly], H3_RES)
  const features: GeoJSON.Feature[] = []

  for (const cell of cells) {
    const boundary = cellToBoundary(cell)
    const centroid = boundary.reduce(
      (acc, [la, lo]) => [acc[0] + la / boundary.length, acc[1] + lo / boundary.length],
      [0, 0],
    )

    // When in simulation mode and localized to 1 or 2 stations, only color the target intervention area
    if (isSimulation && simStationCoords.length > 0 && simStationCoords.length <= 2) {
      const inZone = simStationCoords.some(([sLat, sLng]) => {
        const dLat = centroid[0] - sLat
        const dLng = centroid[1] - sLng
        return Math.sqrt(dLat * dLat + dLng * dLng) <= LOCAL_ZONE_RADIUS_DEG
      })
      if (!inZone) continue
    }

    const pm25 = idw(centroid[0], centroid[1], stationPoints)
    if (pm25 === null) continue

    let baseVal: number | null = null
    let diff = 0
    if (baselineStationPoints && baselineStationPoints.length > 0) {
      baseVal = idw(centroid[0], centroid[1], baselineStationPoints)
      if (baseVal !== null) {
        diff = pm25 - baseVal
      }
    }

    const ring = boundary.map(([la, lo]) => [lo, la] as [number, number])
    ring.push(ring[0])

    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [ring] },
      properties: {
        cell,
        pm25: Math.round(pm25 * 10) / 10,
        baseline: baseVal !== null ? Math.round(baseVal * 10) / 10 : Math.round(pm25 * 10) / 10,
        diff: Math.round(diff * 10) / 10,
        simViewMode,
        centroidLat: centroid[0],
        centroidLng: centroid[1],
      },
    })
  }

  return { type: "FeatureCollection", features }
}

function toStationPoints(
  currentFc: FeatureCollection,
  stationsFc: FeatureCollection,
  simulatedPm25?: Record<string, number> | null,
): StationPoint[] {
  const pts: StationPoint[] = []
  const pm25Map = new Map<string, number>()

  for (const f of currentFc.features ?? []) {
    const id = f.properties?.station_id
    const val = f.properties?.pm25 ?? f.properties?.pm25_value
    if (id && val != null) {
      pm25Map.set(String(id), Number(val))
    }
  }

  for (const f of stationsFc.features ?? []) {
    const coords = f.geometry?.coordinates as [number, number] | undefined
    if (!coords) continue
    const id = f.properties?.station_id
    // Use simulated override if available, otherwise fall back to live
    const simVal = id && simulatedPm25 ? simulatedPm25[String(id)] : undefined
    const pm25 = simVal ?? (id ? pm25Map.get(String(id)) : null) ?? f.properties?.pm25 ?? 120.0
    const [lng, lat] = coords
    pts.push({ lat, lng, pm25: Number(pm25), stationId: id ? String(id) : undefined })
  }

  if (pts.length === 0) {
    for (const f of currentFc.features ?? []) {
      const coords = f.geometry?.coordinates as [number, number] | undefined
      const rawPm25 = f.properties?.pm25 ?? f.properties?.pm25_value
      const id = f.properties?.station_id
      const simVal = id && simulatedPm25 ? simulatedPm25[String(id)] : undefined
      const pm25 = simVal ?? rawPm25
      if (coords && pm25 != null) {
        pts.push({ lat: coords[1], lng: coords[0], pm25: Number(pm25), stationId: id ? String(id) : undefined })
      }
    }
  }

  return pts
}

function asGeo(data: unknown): GeoJSON.FeatureCollection {
  return data as GeoJSON.FeatureCollection
}

function setSource(map: maplibregl.Map, id: string, data: unknown) {
  const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined
  src?.setData(asGeo(data))
}

function pointOnly(collection: FeatureCollection): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: (collection.features ?? []).filter((f) => f.geometry?.type === "Point"),
  }
}

export function MapCanvas({
  stations,
  current,
  hotspots,
  forecast,
  industrial,
  roads,
  reports = [],
  spatialContributions = [],
  verifiedContributions = [],
  visible,
  environment,
  h3Opacity = 0.22,
  onSelect,
  onPickLocation,
  pickLocation = false,
  pickedLocation = null,
  onSelectCell,
  selectedCellId: _selectedCellId,
  drawnGeometry = null,
  onDrawGeometry,
  drawingType = null,
  simulatedPm25 = null,
  simulationLabel: _simulationLabel = null,
  simViewMode = "simulated",
  simulationBaselineMap = null,
  simulationDiffMap = null,
}: MapCanvasProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const rootRef = useRef<Root | null>(null)
  const pinMarkerRef = useRef<maplibregl.Marker | null>(null)

  const handlers = useRef({ onSelect, onPickLocation, pickLocation, onSelectCell, onDrawGeometry, drawingType })
  handlers.current = { onSelect, onPickLocation, pickLocation, onSelectCell, onDrawGeometry, drawingType }

  const dataRef = useRef({
    stations,
    current,
    hotspots,
    forecast,
    industrial,
    roads,
    reports,
    spatialContributions,
    verifiedContributions,
    visible,
    h3Opacity,
    drawnGeometry,
    simulatedPm25,
    simViewMode,
    simulationBaselineMap,
    simulationDiffMap,
  })
  dataRef.current = {
    stations,
    current,
    hotspots,
    forecast,
    industrial,
    roads,
    reports,
    spatialContributions,
    verifiedContributions,
    visible,
    h3Opacity,
    drawnGeometry,
    simulatedPm25,
    simViewMode,
    simulationBaselineMap,
    simulationDiffMap,
  }

  function paint(map: maplibregl.Map) {
    const data = dataRef.current
    if (!map.getSource("stations")) return

    const show = (id: string, on: boolean) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", on ? "visible" : "none")
      }
    }

    // Build baseline and simulated station point arrays
    const baselinePts = toStationPoints(data.current, data.stations, data.simulationBaselineMap)
    const simulatedPts = toStationPoints(data.current, data.stations, data.simulatedPm25)

    const activePts = data.simViewMode === "baseline" ? baselinePts : simulatedPts
    const hexGeo = buildHexGeoJSON(activePts, data.simulatedPm25, baselinePts, data.simViewMode)
    setSource(map, "hex-pm25", hexGeo)

    // Update current observations — update station properties so markers reflect active mode
    const currentFc = pointOnly(data.current)
    const currentFeatures = (currentFc.features ?? []).map((f) => {
      const id = f.properties?.station_id
      const baseNum = Number(id && data.simulationBaselineMap ? data.simulationBaselineMap[String(id)] : (f.properties?.pm25 ?? f.properties?.pm25_value ?? 100))
      const simNum = Number(id && data.simulatedPm25 ? data.simulatedPm25[String(id)] : baseNum)
      const diffVal = simNum - baseNum

      let displayVal = simNum
      if (data.simViewMode === "baseline") displayVal = baseNum

      return {
        ...f,
        properties: {
          ...f.properties,
          pm25: displayVal,
          pm25_value: displayVal,
          baseline_pm25: baseNum,
          simulated_pm25: simNum,
          diff_pm25: Math.round(diffVal * 10) / 10,
          simulated: data.simViewMode === "simulated" || data.simViewMode === "compare",
          simViewMode: data.simViewMode,
        },
      }
    })
    setSource(map, "stations", pointOnly(data.stations))
    setSource(map, "current", { type: "FeatureCollection", features: currentFeatures })
    setSource(map, "hotspots", pointOnly(data.hotspots))
    setSource(map, "forecast", pointOnly(data.forecast))
    setSource(map, "roads", data.roads.features?.length ? data.roads : EMPTY)
    setSource(map, "industrial", data.industrial.features?.length ? data.industrial : EMPTY)

    // Citizen reports
    const citizenFeatures = data.reports.map((r) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [r.longitude || r.lng || 73.856, r.latitude || r.lat || 18.52] },
      properties: { id: r.id, title: r.title, category: r.category, severity: r.severity, status: r.status },
    }))
    setSource(map, "citizen", { type: "FeatureCollection", features: citizenFeatures })

    // Spatial contributions
    const spatialFeatures = data.spatialContributions.map((s) => ({
      type: "Feature" as const,
      geometry: s.coordinates && Array.isArray(s.coordinates) && s.coordinates.length > 0
        ? { type: s.geometry_type || "Point", coordinates: s.coordinates }
        : { type: "Point" as const, coordinates: [s.longitude || 73.856, s.latitude || 18.52] },
      properties: { id: s.id, title: s.title, contribution_type: s.contribution_type, status: s.status },
    }))
    setSource(map, "spatial-contributions", { type: "FeatureCollection", features: spatialFeatures })

    // Verified contributions
    const verifiedList = data.verifiedContributions.length > 0
      ? data.verifiedContributions
      : data.spatialContributions.filter((s) => s.status === "VERIFIED")
    const verifiedFeatures = verifiedList.map((v) => ({
      type: "Feature" as const,
      geometry: v.coordinates && Array.isArray(v.coordinates) && v.coordinates.length > 0
        ? { type: v.geometry_type || "Point", coordinates: v.coordinates }
        : { type: "Point" as const, coordinates: [v.longitude || 73.856, v.latitude || 18.52] },
      properties: { id: v.id, title: v.title, contribution_type: v.contribution_type, status: "VERIFIED" },
    }))
    setSource(map, "verified-contributions", { type: "FeatureCollection", features: verifiedFeatures })

    // Drawn geometry preview
    if (data.drawnGeometry) {
      setSource(map, "drawn-geometry", {
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: data.drawnGeometry, properties: {} }],
      })
    } else {
      setSource(map, "drawn-geometry", EMPTY)
    }

    // Visibility toggles
    show("hex-pm25", visible.current !== false && visible.h3 !== false && visible.heatmap !== false)
    show("hex-pm25-border", visible.current !== false && visible.h3 !== false && visible.heatmap !== false)
    show("stations", visible.stations !== false)
    show("current", visible.current !== false)
    show("hotspots", visible.hotspots !== false && visible.critical !== false)
    show("forecast", visible.forecast !== false)
    show("industrial", visible.industrial !== false && visible.buildings !== false)
    show("industrial-line", visible.industrial !== false && visible.buildings !== false)
    show("roads", visible.roads !== false)
    show("citizen", visible.citizen !== false && visible.reports !== false)
    show("spatial-contributions", visible.spatial !== false && visible.contributions !== false)
    show("verified-contributions", visible.verified !== false)
    show("drawn-geometry-line", true)
    show("drawn-geometry-fill", true)
    show("drawn-geometry-point", true)

    // Dynamic fill colors & opacities
    if (map.getLayer("hex-pm25")) {
      if (data.simViewMode === "compare") {
        map.setPaintProperty("hex-pm25", "fill-color", [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "diff"], 0],
          -35, "#047857",
          -20, "#10b981",
          -8,  "#34d399",
          -1,  "#86efac",
          0,   "#475569",
          1,   "#fed7aa",
          8,   "#fb923c",
          20,  "#ef4444",
          35,  "#991b1b",
        ])
      } else {
        map.setPaintProperty("hex-pm25", "fill-color", [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "pm25"], 0],
          0, "#00e400",
          30, "#92d050",
          60, "#ffff00",
          90, "#ff7e00",
          120, "#ff0000",
          200, "#7e0023",
        ])
      }
      map.setPaintProperty("hex-pm25", "fill-opacity", data.h3Opacity)
    }

    if (map.getLayer("current")) {
      if (data.simViewMode === "compare") {
        map.setPaintProperty("current", "circle-color", [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "diff_pm25"], 0],
          -30, "#059669",
          -15, "#10b981",
          -5,  "#34d399",
          0,   "#64748b",
          5,   "#fb923c",
          20,  "#ef4444",
        ])
      } else {
        map.setPaintProperty("current", "circle-color", [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "pm25"], 0],
          0, "#00e400",
          30, "#92d050",
          60, "#ffff00",
          90, "#ff7e00",
          120, "#ff0000",
          200, "#7e0023",
        ])
      }
    }
  }

  // Handle picked location pin marker
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (pickedLocation) {
      if (!pinMarkerRef.current) {
        const el = document.createElement("div")
        el.className = "w-6 h-6 bg-red-500 border-2 border-white rounded-full shadow-lg animate-bounce cursor-pointer flex items-center justify-center text-white text-xs font-bold"
        el.innerHTML = "📍"
        pinMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([pickedLocation.longitude, pickedLocation.latitude])
          .addTo(map)
      } else {
        pinMarkerRef.current.setLngLat([pickedLocation.longitude, pickedLocation.latitude])
      }
    } else if (pinMarkerRef.current) {
      pinMarkerRef.current.remove()
      pinMarkerRef.current = null
    }
  }, [pickedLocation])

  // Mount map
  useEffect(() => {
    if (!container.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: container.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: [73.856, 18.52],
      zoom: 10.6,
      attributionControl: {},
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right")

    map.on("load", () => {
      map.addSource("hex-pm25", { type: "geojson", data: asGeo(EMPTY) })
      map.addSource("roads", { type: "geojson", data: asGeo(EMPTY) })
      map.addSource("industrial", { type: "geojson", data: asGeo(EMPTY) })
      map.addSource("stations", { type: "geojson", data: asGeo(EMPTY) })
      map.addSource("forecast", { type: "geojson", data: asGeo(EMPTY) })
      map.addSource("hotspots", { type: "geojson", data: asGeo(EMPTY) })
      map.addSource("current", { type: "geojson", data: asGeo(EMPTY) })
      map.addSource("citizen", { type: "geojson", data: asGeo(EMPTY) })
      map.addSource("spatial-contributions", { type: "geojson", data: asGeo(EMPTY) })
      map.addSource("verified-contributions", { type: "geojson", data: asGeo(EMPTY) })
      map.addSource("drawn-geometry", { type: "geojson", data: asGeo(EMPTY) })

      // Road context
      map.addLayer({
        id: "roads",
        type: "line",
        source: "roads",
        layout: { visibility: "none" },
        paint: { "line-color": "#4b5563", "line-width": 1.5, "line-opacity": 0.8 },
      })

      // Industrial proxy
      map.addLayer({
        id: "industrial",
        type: "fill",
        source: "industrial",
        layout: { visibility: "none" },
        paint: { "fill-color": "#d6c48a", "fill-opacity": 0.2 },
      })
      map.addLayer({
        id: "industrial-line",
        type: "line",
        source: "industrial",
        layout: { visibility: "none" },
        paint: { "line-color": "#eab308", "line-width": 1 },
      })

      // H3 Hexagonal PM2.5 heatmap fill (transparent default ~22%)
      map.addLayer({
        id: "hex-pm25",
        type: "fill",
        source: "hex-pm25",
        layout: { visibility: "none" },
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "pm25"], 0],
            0, "#00e400",
            30, "#92d050",
            60, "#ffff00",
            90, "#ff7e00",
            120, "#ff0000",
            200, "#7e0023",
          ],
          "fill-opacity": 0.22,
        },
      })

      // Hexagon subtle borders
      map.addLayer({
        id: "hex-pm25-border",
        type: "line",
        source: "hex-pm25",
        layout: { visibility: "none" },
        paint: {
          "line-color": "#000000",
          "line-width": 0.4,
          "line-opacity": 0.2,
        },
      })

      // Hotspot rings
      map.addLayer({
        id: "hotspots",
        type: "circle",
        source: "hotspots",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 22,
          "circle-color": "transparent",
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#f59e0b",
        },
      })

      // Forecast rings
      map.addLayer({
        id: "forecast",
        type: "circle",
        source: "forecast",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 16,
          "circle-color": "transparent",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#3b82f6",
        },
      })

      // Station dots (white circle with dark stroke)
      map.addLayer({
        id: "stations",
        type: "circle",
        source: "stations",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 6,
          "circle-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0f172a",
          "circle-opacity": 0.95,
        },
      })

      // Current PM2.5 dots
      map.addLayer({
        id: "current",
        type: "circle",
        source: "current",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 11,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.95,
          "circle-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "pm25"], 0],
            0, "#00e400",
            30, "#92d050",
            60, "#ffff00",
            90, "#ff7e00",
            120, "#ff0000",
            200, "#7e0023",
          ],
        },
      })

      // Citizen reports markers
      map.addLayer({
        id: "citizen",
        type: "circle",
        source: "citizen",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 8,
          "circle-color": "#ef4444",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      })

      // Spatial contributions layer
      map.addLayer({
        id: "spatial-contributions",
        type: "circle",
        source: "spatial-contributions",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 8,
          "circle-color": "#a855f7",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      })

      // Verified contributions layer
      map.addLayer({
        id: "verified-contributions",
        type: "circle",
        source: "verified-contributions",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 10,
          "circle-color": "#22c55e",
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff",
        },
      })

      // Drawn geometry preview layers
      map.addLayer({
        id: "drawn-geometry-fill",
        type: "fill",
        source: "drawn-geometry",
        paint: { "fill-color": "#22c55e", "fill-opacity": 0.3 },
      })
      map.addLayer({
        id: "drawn-geometry-line",
        type: "line",
        source: "drawn-geometry",
        paint: { "line-color": "#22c55e", "line-width": 3, "line-dasharray": [2, 2] },
      })
      map.addLayer({
        id: "drawn-geometry-point",
        type: "circle",
        source: "drawn-geometry",
        paint: { "circle-radius": 8, "circle-color": "#22c55e", "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" },
      })

      // Click handling
      const clickable = ["current", "stations", "hotspots", "forecast", "citizen", "spatial-contributions", "verified-contributions"]

      map.on("click", (event) => {
        if (handlers.current.pickLocation) {
          if (!pinMarkerRef.current) {
            const el = document.createElement("div")
            el.className = "w-7 h-7 bg-red-500 border-2 border-white rounded-full shadow-2xl animate-bounce flex items-center justify-center text-white text-xs font-bold pointer-events-none"
            el.innerHTML = "📍"
            pinMarkerRef.current = new maplibregl.Marker({ element: el })
              .setLngLat([event.lngLat.lng, event.lngLat.lat])
              .addTo(map)
          } else {
            pinMarkerRef.current.setLngLat([event.lngLat.lng, event.lngLat.lat])
          }
          handlers.current.onPickLocation?.(event.lngLat.lng, event.lngLat.lat)
          return
        }

        const present = clickable.filter(
          (id) => map.getLayer(id) && map.getLayoutProperty(id, "visibility") === "visible",
        )
        const hits = map.queryRenderedFeatures(event.point, { layers: present })

        const stationId = hits
          .map((h) => h.properties?.station_id)
          .find((id) => typeof id === "string")
        if (typeof stationId === "string") {
          handlers.current.onSelect(stationId)
          return
        }

        // Check if H3 cell clicked
        const hexHits = map.queryRenderedFeatures(event.point, { layers: ["hex-pm25"] })
        if (hexHits.length > 0 && hexHits[0].properties?.cell) {
          const props = hexHits[0].properties
          handlers.current.onSelectCell?.({
            cellId: String(props.cell),
            pm25: Number(props.pm25),
            centroid: [Number(props.centroidLng || event.lngLat.lng), Number(props.centroidLat || event.lngLat.lat)],
          })
        } else {
          handlers.current.onSelectCell?.(null)
        }
      })

      // Hover tooltip on H3 cells
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: "240px",
        offset: 10,
      })

      map.on("mousemove", "hex-pm25", (e) => {
        const props = e.features?.[0]?.properties
        if (!props?.pm25) return
        map.getCanvas().style.cursor = "pointer"

        const mode = dataRef.current.simViewMode
        const isCompare = mode === "compare"
        const isSim = Boolean(dataRef.current.simulatedPm25) && mode === "simulated"

        if (isCompare && props.diff != null) {
          const diffVal = Number(props.diff)
          const improved = diffVal <= 0
          const sign = diffVal <= 0 ? "↓" : "↑"
          const base = Number(props.baseline ?? props.pm25)
          const sim = Number(props.pm25)

          popup
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="background:#0d1117;color:#f3f4f6;padding:10px 14px;border-radius:10px;font-size:12px;border:1px solid #334155;box-shadow:0 6px 20px rgba(0,0,0,0.6)">
                <div style="color:#a78bfa;font-size:10px;font-weight:700;letter-spacing:0.05em">WHAT-IF IMPACT COMPARISON</div>
                <div style="display:flex;align-items:baseline;gap:6px;margin-top:4px">
                  <span style="font-size:22px;font-weight:800;color:${improved ? '#10b981' : '#ef4444'}">${sign} ${Math.abs(diffVal).toFixed(1)}</span>
                  <span style="color:#94a3b8;font-size:11px">μg/m³ PM2.5</span>
                </div>
                <div style="font-size:10px;color:${improved ? '#34d399' : '#f87171'};font-weight:600;margin-top:2px">
                  ${improved ? "Predicted Air Quality Improvement" : "Predicted Air Quality Degradation"}
                </div>
                <div style="margin-top:6px;padding-top:6px;border-top:1px solid #1e293b;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between">
                  <span>Baseline: <b>${base.toFixed(1)}</b></span>
                  <span>Simulated: <b>${sim.toFixed(1)}</b></span>
                </div>
              </div>`
            )
            .addTo(map)
        } else {
          const val = Number(props.pm25)
          popup
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="background:#0d1117;color:#f3f4f6;padding:8px 12px;border-radius:8px;font-size:12px;border:1px solid #1e2432;box-shadow:0 4px 12px rgba(0,0,0,0.5)">
                <div style="color:#9ca3af;font-size:10px;font-weight:600;letter-spacing:0.05em">
                  ${isSim ? "SIMULATED H3 CELL" : "H3 CELL #" + String(props.cell).slice(-6).toUpperCase()}
                </div>
                <div style="display:flex;align-items:baseline;gap:4px;margin-top:2px">
                  <span style="font-size:20px;font-weight:700;color:${pm25Color(val)}">${val.toFixed(1)}</span>
                  <span style="color:#9ca3af;font-size:11px">μg/m³</span>
                </div>
                <div style="margin-top:4px;font-size:10px;color:#6b7280">
                  ${isSim ? "Hypothetical Scenario Surface" : "IDW Surface Estimate"} · Click for details
                </div>
              </div>`
            )
            .addTo(map)
        }
      })

      map.on("mouseleave", "hex-pm25", () => {
        map.getCanvas().style.cursor = ""
        popup.remove()
      })

      paint(map)
    })

    const ro = new ResizeObserver(() => {
      map.resize()
    })
    if (container.current) {
      ro.observe(container.current)
    }

    mapRef.current = map
    return () => {
      ro.disconnect()
      rootRef.current?.unmount()
      popupRef.current?.remove()
      pinMarkerRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Cursor style when in location picking mode
  useEffect(() => {
    if (!container.current) return
    container.current.style.cursor = pickLocation ? "crosshair" : ""
  }, [pickLocation])

  // Repaint when props change
  useEffect(() => {
    const map = mapRef.current
    if (map?.getSource("stations")) {
      map.resize()
      paint(map)
    }
  }, [
    stations,
    current,
    hotspots,
    forecast,
    roads,
    industrial,
    reports,
    spatialContributions,
    verifiedContributions,
    visible,
    h3Opacity,
    drawnGeometry,
    simulatedPm25,
    simViewMode,
    simulationBaselineMap,
    simulationDiffMap,
  ])

  // Fly to selected station
  useEffect(() => {
    const map = mapRef.current
    const lng = environment?.station.longitude
    const lat = environment?.station.latitude
    if (!map || environment == null || lng == null || lat == null) {
      popupRef.current?.remove()
      return
    }
    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 12), essential: true })
    const host = document.createElement("div")
    rootRef.current?.unmount()
    const root = createRoot(host)
    root.render(<StationPopup environment={environment} />)
    rootRef.current = root
    popupRef.current?.remove()
    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: "320px",
      offset: 18,
    })
      .setLngLat([lng, lat])
      .setDOMContent(host)
      .addTo(map)
  }, [environment])

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" />
    </div>
  )
}

function pm25Color(pm25: number): string {
  if (pm25 <= 30) return "#92d050"
  if (pm25 <= 60) return "#ffff00"
  if (pm25 <= 90) return "#ff7e00"
  if (pm25 <= 120) return "#ff0000"
  if (pm25 <= 200) return "#9b1c1c"
  return "#7e0023"
}
