import { useState } from 'react'
import { CitizenMap } from '@/components/map/CitizenMap'
import { InspectorPanel } from './InspectorPanel'

export function CommandMapPage() {
  const [inspectorOpen, setInspectorOpen] = useState(true) // Open by default for demo

  return (
    <div className="flex flex-col w-full h-full relative">
      {/* KPI Strip */}
      <div className="h-14 bg-surface/80 backdrop-blur-md border-b border-border flex items-center px-6 gap-8 z-10 shrink-0">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Citywide PM2.5</span>
          <span className="text-sm font-mono font-bold text-text-primary">58 µg/m³</span>
        </div>
        <div className="w-px h-6 bg-border" />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Stations Online</span>
          <span className="text-sm font-mono font-bold text-emerald-600">8 / 10</span>
        </div>
        <div className="w-px h-6 bg-border" />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Active Hotspots</span>
          <span className="text-sm font-mono font-bold text-amber-600">3</span>
        </div>
        <div className="w-px h-6 bg-border" />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">24h Peak Forecast</span>
          <span className="text-sm font-mono font-bold text-data-modeled">82 µg/m³</span>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* We reuse the CitizenMap for now but we can call it AuthorityMap later if we need different layers */}
        <CitizenMap />
        
        {inspectorOpen && <InspectorPanel onClose={() => setInspectorOpen(false)} />}
      </div>

      {/* Timeline Scrubber */}
      <div className="h-16 bg-surface/90 backdrop-blur-md border-t border-border flex items-center px-6 shrink-0 z-10">
        <div className="flex-1 flex items-center gap-4">
          <span className="text-xs font-semibold text-text-secondary w-16 text-right">-24h</span>
          <input type="range" min="-24" max="24" defaultValue="0" className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-primary" />
          <span className="text-xs font-semibold text-text-secondary w-16">+24h</span>
        </div>
      </div>
    </div>
  )
}
