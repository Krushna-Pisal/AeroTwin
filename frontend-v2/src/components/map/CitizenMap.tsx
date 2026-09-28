import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || ''

const PUNE_BOUNDS: mapboxgl.LngLatBoundsLike = [
  [73.6, 18.3], // Southwest coordinates
  [74.1, 18.8], // Northeast coordinates
]

export function CitizenMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const globalMode = useAppStore(s => s.globalMode)

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [73.856, 18.520], // Pune center
      zoom: 11,
      minZoom: 10,
      maxZoom: 18,
      maxBounds: PUNE_BOUNDS, // Restrict map to Pune area only!
      attributionControl: false // Will add custom later if needed
    })

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')
    
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div 
      className={`w-full h-full transition-colors duration-300 ${globalMode === 'Scenario' ? 'border-[6px] border-data-scenario/30' : ''}`}
    >
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  )
}
