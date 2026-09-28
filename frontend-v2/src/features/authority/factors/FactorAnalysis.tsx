import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import { Info } from 'lucide-react'
import { DataBadge } from '@/components/common/DataBadge'

const shapData = [
  { feature: 'Traffic Congestion', group: 'Traffic', value: +14.2 },
  { feature: 'Wind Speed', group: 'Weather', value: -8.5 },
  { feature: 'Industrial Proxies', group: 'Industry', value: +6.1 },
  { feature: 'Construction Dust', group: 'Dust', value: +4.8 },
  { feature: 'Temperature', group: 'Weather', value: +2.3 },
  { feature: 'Humidity', group: 'Weather', value: -1.2 },
]

export function FactorAnalysis() {
  return (
    <div className="p-8 h-full overflow-y-auto w-full bg-slate-50">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Factor Analysis</h1>
          <p className="text-text-secondary mt-1">Model-derived feature contributions indicating likely contributing factors (not causal emissions).</p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-surface border border-border rounded-[var(--radius-card)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-text-primary mb-6">Model-derived feature contributions (SHAP)</h2>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shapData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E8EE" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="feature" type="category" width={120} tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E5E8EE', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <ReferenceLine x={0} stroke="#94A3B8" />
                  <Bar dataKey="value" barSize={24} radius={[0, 4, 4, 0]}>
                    {shapData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.value > 0 ? '#E53935' : '#2FA84F'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex justify-between text-xs text-text-muted">
              <span>← Decreases PM2.5</span>
              <span>Increases PM2.5 →</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-surface border border-border rounded-[var(--radius-card)] p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Info size={18} className="text-brand-primary" />
                <h3 className="font-semibold text-text-primary">Assumptions: Traffic</h3>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                Traffic congestion proxies indicate reduced speed and volume buildup, which the model associates with higher PM2.5. This is an activity proxy, not directly measured tailpipe emissions.
              </p>
            </div>
            
            <div className="bg-surface border border-border rounded-[var(--radius-card)] p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Info size={18} className="text-brand-primary" />
                <h3 className="font-semibold text-text-primary">Assumptions: Industry</h3>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                Industrial proxy assumes location proximity to industrial zones affects local air quality; it does not measure active stack emissions.
              </p>
            </div>

            <div className="bg-surface border border-border rounded-[var(--radius-card)] p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Info size={18} className="text-brand-primary" />
                <h3 className="font-semibold text-text-primary">Assumptions: Dust</h3>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                A mapped construction site does not guarantee active dust generation on any given day.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
