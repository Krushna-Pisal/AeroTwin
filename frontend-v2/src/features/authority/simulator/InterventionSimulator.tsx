import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'
import { AlertCircle, Play } from 'lucide-react'
import { DataBadge } from '@/components/common/DataBadge'

const scenarioData = [
  { name: 'Baseline', value: 82 },
  { name: 'Traffic -30%', value: 74, scenario: true },
  { name: 'Industry -30%', value: 78, scenario: true },
  { name: 'Dust -30%', value: 79, scenario: true },
  { name: 'Combined', value: 68, scenario: true },
]

export function InterventionSimulator() {
  const [traffic, setTraffic] = useState(100)
  const [industry, setIndustry] = useState(100)
  const [dust, setDust] = useState(100)

  return (
    <div className="p-8 h-full overflow-y-auto w-full bg-slate-50 flex flex-col">
      <div className="max-w-6xl mx-auto w-full space-y-6 flex-1">
        
        <div className="bg-data-scenario/10 border-l-4 border-data-scenario p-4 rounded-r-lg flex gap-3">
          <AlertCircle className="text-data-scenario shrink-0" size={24} />
          <div>
            <h3 className="font-semibold text-data-scenario">Scenario outputs are modeled estimates from user-set assumptions.</h3>
            <p className="text-sm text-data-scenario/80">They are not observed outcomes.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Controls */}
          <div className="col-span-1 bg-surface border border-border rounded-[var(--radius-card)] p-6 shadow-sm space-y-8">
            <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-4">Configure Scenario</h2>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-text-primary">Traffic Proxy</label>
                  <span className="text-sm font-mono text-text-secondary">{traffic}%</span>
                </div>
                <input type="range" min="0" max="100" value={traffic} onChange={(e) => setTraffic(Number(e.target.value))} className="w-full accent-brand-primary h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
              </div>
              
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-text-primary">Industrial Proxy</label>
                  <span className="text-sm font-mono text-text-secondary">{industry}%</span>
                </div>
                <input type="range" min="0" max="100" value={industry} onChange={(e) => setIndustry(Number(e.target.value))} className="w-full accent-brand-primary h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-text-primary">Dust/Construction</label>
                  <span className="text-sm font-mono text-text-secondary">{dust}%</span>
                </div>
                <input type="range" min="0" max="100" value={dust} onChange={(e) => setDust(Number(e.target.value))} className="w-full accent-brand-primary h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>

            <div className="pt-6 border-t border-border">
              <button className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors">
                <Play size={18} /> Run Simulation
              </button>
              <button onClick={() => { setTraffic(100); setIndustry(100); setDust(100) }} className="w-full mt-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
                Reset to Baseline
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="col-span-2 bg-surface border border-border rounded-[var(--radius-card)] p-6 shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-text-primary">Scenario Comparison (PM2.5)</h2>
              <DataBadge type="SCENARIO" />
            </div>

            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scenarioData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <defs>
                    <pattern id="diagonalHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="0" x2="0" y2="8" stroke="var(--color-data-scenario)" strokeWidth="4" opacity="0.5" />
                    </pattern>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E8EE" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#475569' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                  <Tooltip cursor={{ fill: '#F7F8FA' }} contentStyle={{ borderRadius: '8px', border: '1px solid #E5E8EE' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {scenarioData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.scenario ? "url(#diagonalHatch)" : "var(--color-data-modeled)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-8 border-t border-border pt-6 grid grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="text-xs font-semibold text-text-secondary uppercase mb-1">Baseline</div>
                <div className="text-xl font-mono font-bold">82 <span className="text-xs font-sans">µg/m³</span></div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-data-scenario/20">
                <div className="text-xs font-semibold text-text-secondary uppercase mb-1">Traffic Control</div>
                <div className="text-xl font-mono font-bold text-data-scenario">-8 <span className="text-xs font-sans">µg/m³</span></div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-data-scenario/20">
                <div className="text-xs font-semibold text-text-secondary uppercase mb-1">Industry Control</div>
                <div className="text-xl font-mono font-bold text-data-scenario">-4 <span className="text-xs font-sans">µg/m³</span></div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-data-scenario/20">
                <div className="text-xs font-semibold text-text-secondary uppercase mb-1">Combined</div>
                <div className="text-xl font-mono font-bold text-data-scenario">-14 <span className="text-xs font-sans">µg/m³</span></div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
