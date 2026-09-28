import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { useEffect, useRef } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { CitizenReport, Environment, FeatureCollection, LayerKey } from "../types"
import { StationPopup } from "./StationPopup"

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] }

type Props = {
  stations: FeatureCollection
  current: FeatureCollection
  hotspots: FeatureCollection
  forecast: FeatureCollection
  industrial: FeatureCollection
  roads: FeatureCollection
  reports: CitizenReport[]
  visible: Record<LayerKey, boolean>
  environment: Environment | null
  onSelect: (stationId: string) => void
  onPickLocation: (longitude: number, latitude: number) => void
  pickLocation: boolean
}

export function MapCanvas({
  stations,
  current,
  hotspots,
  forecast,
  industrial,
  roads,
  reports,
  visible,
  environment,
  onSelect,
  onPickLocation,
  pickLocation,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const rootRef = useRef<Root | null>(null)
  const handlers = useRef({ onSelect, onPickLocation, pickLocation })
  handlers.current = { onSelect, onPickLocation, pickLocation }
  const dataRef = useRef({ stations, current, hotspots, forecast, industrial, roads, reports, visible })
  dataRef.current = { stations, current, hotspots, forecast, industrial, roads, reports, visible }

  function paint(map: mapboxgl.Map) {
    const data = dataRef.current
    if (!map.getSource("stations")) return
    const show = (id: string, on: boolean) => map.setLayoutProperty(id, "visibility", on ? "visible" : "none")
    setSource(map, "stations", pointOnly(data.stations))
    setSource(map, "current", pointOnly(data.current))
    setSource(map, "hotspots", pointOnly(data.hotspots))
    setSource(map, "forecast", pointOnly(data.forecast))
    setSource(map, "roads", data.roads.features?.length ? data.roads : EMPTY)
    setSource(map, "industrial", data.industrial.features?.length ? data.industrial : EMPTY)
    const citizenFeatures = data.reports.map((report) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [report.longitude, report.latitude] },
      properties: { status: report.status, category: report.category },
    }))
    setSource(map, "citizen", { type: "FeatureCollection", features: citizenFeatures })
    show("stations", data.visible.stations)
    show("current", data.visible.current)
    show("hotspots", data.visible.hotspots)
    show("forecast", data.visible.forecast)
    show("industrial", data.visible.industrial)
    show("industrial-line", data.visible.industrial)
    show("roads", data.visible.roads)
    show("citizen", data.visible.citizen)
  }

  useEffect(() => {
    if (!container.current || mapRef.current) return
    
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: container.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [73.856, 18.52],
      zoom: 10.6,
      attributionControl: {},
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right")
    map.on("load", () => {
      map.addSource("roads", { type: "geojson", data: asGeo(EMPTY) })
      map.addSource("industrial", { type: "geojson", data: asGeo(EMPTY) })
      map.addSource("stations", { type: "geojson", data: asGeo(EMPTY) })
      map.addSource("forecast", { type: "geojson", data: asGeo(EMPTY) })
      map.addSource("hotspots", { type: "geojson", data: asGeo(EMPTY) })
      map.addSource("current", { type: "geojson", data: asGeo(EMPTY) })
      map.addSource("citizen", { type: "geojson", data: asGeo(EMPTY) })

      map.addLayer({
        id: "roads",
        type: "line",
        source: "roads",
        layout: { visibility: "none" },
        paint: { "line-color": "#b7c4b0", "line-width": 1.25, "line-opacity": 0.75 },
      })
      map.addLayer({
        id: "industrial",
        type: "fill",
        source: "industrial",
        layout: { visibility: "none" },
        paint: { "fill-color": "#d6c48a", "fill-opacity": 0.28 },
      })
      map.addLayer({
        id: "industrial-line",
        type: "line",
        source: "industrial",
        layout: { visibility: "none" },
        paint: { "line-color": "#d6c48a", "line-width": 1 },
      })
      map.addLayer({
        id: "stations",
        type: "circle",
        source: "stations",
        layout: { visibility: "none" },
        paint: { "circle-radius": 4, "circle-color": "#efe7da", "circle-opacity": 0.9 },
      })
      map.addLayer({
        id: "forecast",
        type: "circle",
        source: "forecast",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 16,
          "circle-color": "transparent",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#8eb7e8",
        },
      })
      map.addLayer({
        id: "hotspots",
        type: "circle",
        source: "hotspots",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 22,
          "circle-color": "transparent",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#f0b429",
        },
      })
      map.addLayer({
        id: "current",
        type: "circle",
        source: "current",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 14,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#1c1915",
          "circle-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "pm25"], 0],
            0, "#7dcea0",
            30, "#f4d35e",
            60, "#ee964b",
            90, "#e85d04",
            150, "#c1121f",
          ],
        },
      })
      map.addLayer({
        id: "citizen",
        type: "circle",
        source: "citizen",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 7,
          "circle-color": "#fda4af",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#9f1239",
        },
      })

      const clickable = ["current", "stations", "hotspots", "forecast"]
      map.on("click", (event) => {
        if (handlers.current.pickLocation) {
          handlers.current.onPickLocation(event.lngLat.lng, event.lngLat.lat)
        }
        const present = clickable.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, "visibility") === "visible")
        const hits = map.queryRenderedFeatures(event.point, { layers: present })
        const stationId = hits.map((hit) => hit.properties?.station_id).find((id) => typeof id === "string")
        if (typeof stationId === "string") handlers.current.onSelect(stationId)
      })
      map.getCanvas().style.cursor = "pointer"
      paint(map)
    })
    mapRef.current = map
    return () => {
      rootRef.current?.unmount()
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (map?.getSource("stations")) paint(map)
  }, [stations, current, hotspots, forecast, roads, industrial, reports, visible])

  useEffect(() => {
    const map = mapRef.current
    const longitude = environment?.station.longitude
    const latitude = environment?.station.latitude
    if (!map || environment == null || longitude == null || latitude == null) {
      popupRef.current?.remove()
      return
    }
    map.flyTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), 12), essential: true })
    const host = document.createElement("div")
    rootRef.current?.unmount()
    const root = createRoot(host)
    root.render(<StationPopup environment={environment} />)
    rootRef.current = root
    popupRef.current?.remove()
    popupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, maxWidth: "320px", offset: 18 })
      .setLngLat([longitude, latitude])
      .setDOMContent(host)
      .addTo(map)
  }, [environment])

  return <div ref={container} className="h-full w-full" />
}

function asGeo(data: unknown): GeoJSON.FeatureCollection {
  return data as GeoJSON.FeatureCollection
}

function setSource(map: mapboxgl.Map, id: string, data: unknown) {
  const source = map.getSource(id) as mapboxgl.GeoJSONSource | undefined
  source?.setData(asGeo(data))
}

function pointOnly(collection: FeatureCollection): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: (collection.features ?? []).filter((feature) => feature.geometry?.type === "Point"),
  }
}
