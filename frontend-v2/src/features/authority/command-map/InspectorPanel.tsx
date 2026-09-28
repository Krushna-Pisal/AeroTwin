import { useState } from 'react'
import { Wind, Droplets, Thermometer, ArrowRight, X } from 'lucide-react'
import { DataBadge } from '@/components/common/DataBadge'

export function InspectorPanel({ onClose }: { onClose: () => void }) {
  // Mock data for the Inspector
  return (
    <div className="w-[420px] bg-surface/90 backdrop-blur-md border-l border-border h-full flex flex-col shadow-[-8px_0_24px_rgba(15,23,42,0.04)] absolute right-0 top-0 z-20">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Shivajinagar</h2>
          <p className="text-sm text-text-secondary mt-0.5">Pune Central • Station ID: ST-04</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-text-muted transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-5">
          {/* Main PM2.5 block */}
          <div className="flex items-end gap-4 mb-4">
            <div className="text-6xl font-mono font-bold tracking-tighter text-text-primary">65</div>
            <div className="pb-2">
              <span className="text-sm font-medium text-text-secondary block">µg/m³ PM2.5</span>
              <DataBadge type="OBSERVED" className="mt-1" />
            </div>
          </div>
          
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-chip)] bg-pm25-moderate/10 border border-pm25-moderate/20">
            <div className="w-2 h-2 rounded-full bg-[#B48500]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#B48500]">Moderate</span>
          </div>
        </div>

        <div className="border-t border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wider">Meteorology</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-border rounded-lg p-3">
              <Thermometer size={16} className="text-text-muted mb-1" />
              <div className="text-lg font-mono font-semibold">30°C</div>
              <div className="text-xs text-text-secondary">Temp</div>
            </div>
            <div className="bg-slate-50 border border-border rounded-lg p-3">
              <Droplets size={16} className="text-text-muted mb-1" />
              <div className="text-lg font-mono font-semibold">45%</div>
              <div className="text-xs text-text-secondary">Humidity</div>
            </div>
            <div className="bg-slate-50 border border-border rounded-lg p-3">
              <Wind size={16} className="text-text-muted mb-1" />
              <div className="text-lg font-mono font-semibold">12<span className="text-xs">km/h</span></div>
              <div className="text-xs text-text-secondary">Wind</div>
            </div>
          </div>
        </div>

        <div className="border-t border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wider">Factor Proxies</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">Traffic Congestion</span>
                <span className="text-sm font-mono font-semibold">0.76</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 mb-1">
                <div className="bg-amber-500 h-2 rounded-full" style={{ width: '76%' }} />
              </div>
              <DataBadge type="PROXY" />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">Industrial Activity</span>
                <span className="text-sm font-mono font-semibold">0.42</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 mb-1">
                <div className="bg-amber-500 h-2 rounded-full" style={{ width: '42%' }} />
              </div>
              <DataBadge type="PROXY" />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">Construction Dust</span>
                <span className="text-sm font-mono font-semibold">0.85</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 mb-1">
                <div className="bg-amber-500 h-2 rounded-full" style={{ width: '85%' }} />
              </div>
              <DataBadge type="PROXY" />
            </div>
          </div>
        </div>

        <div className="border-t border-border px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Citizen Corroboration</h3>
            <DataBadge type="CITIZEN_REPORTED" />
          </div>
          <p className="text-xs text-text-secondary mb-3">
            Citizen reports provide corroboration confidence to modeled proxy signals.
          </p>
          <div className="bg-data-citizen/5 border border-data-citizen/20 rounded-lg p-3 flex justify-between items-center">
            <div className="text-sm font-medium text-data-citizen">Dust / Construction</div>
            <div className="text-sm font-mono font-bold text-data-citizen">12 reports</div>
          </div>
          <div className="bg-data-citizen/5 border border-data-citizen/20 rounded-lg p-3 flex justify-between items-center mt-2">
            <div className="text-sm font-medium text-data-citizen">Traffic Congestion</div>
            <div className="text-sm font-mono font-bold text-data-citizen">7 reports</div>
          </div>
        </div>
      </div>
      
      <div className="p-4 border-t border-border bg-slate-50">
        <button className="w-full bg-surface border border-border hover:border-brand-primary text-brand-primary py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center justify-center gap-2">
          Open Full Analysis <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
