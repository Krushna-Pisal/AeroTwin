import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { DataBadge } from '@/components/common/DataBadge'

const mockForecastData = Array.from({ length: 24 }).map((_, i) => {
  const actual = 50 + Math.sin(i / 3) * 20 + Math.random() * 5
  return {
    time: `${i}:00`,
    actual: i < 16 ? actual : null,
    predicted: actual + (Math.random() - 0.5) * 8
  }
})

const modelProgression = [
  { version: 'V0 Baseline', mae: 14.2, rmse: 18.5, r2: 0.42, delta: '-' },
  { version: 'V1 Environmental', mae: 10.5, rmse: 13.8, r2: 0.65, delta: '+23%' },
  { version: 'V2 + Traffic', mae: 8.2, rmse: 11.1, r2: 0.78, delta: '+13%' },
  { version: 'V3 Full (Current)', mae: 6.8, rmse: 9.4, r2: 0.84, delta: '+6%', highlight: true }
]

export function ForecastValidation() {
  return (
    <div className="p-8 h-full overflow-y-auto w-full bg-slate-50">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Forecast & Validation</h1>
          <p className="text-text-secondary mt-1">Assess the predictive performance of the PM2.5 model against observed ground truth.</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface border border-border rounded-[var(--radius-card)] p-5 shadow-sm">
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Mean Absolute Error (MAE)</div>
            <div className="text-3xl font-mono font-bold text-text-primary">6.8 <span className="text-sm font-medium text-text-secondary">µg/m³</span></div>
          </div>
          <div className="bg-surface border border-border rounded-[var(--radius-card)] p-5 shadow-sm">
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Root Mean Square Error (RMSE)</div>
            <div className="text-3xl font-mono font-bold text-text-primary">9.4 <span className="text-sm font-medium text-text-secondary">µg/m³</span></div>
          </div>
          <div className="bg-surface border border-border rounded-[var(--radius-card)] p-5 shadow-sm">
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">R² Score</div>
            <div className="text-3xl font-mono font-bold text-text-primary">0.84</div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-[var(--radius-card)] p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-text-primary">Actual vs Predicted (24h Window)</h2>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-data-observed"></div>
                <span className="text-sm font-medium text-text-secondary">OBSERVED</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-data-modeled"></div>
                <span className="text-sm font-medium text-text-secondary">MODELED</span>
              </div>
            </div>
          </div>
          
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockForecastData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E8EE" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E8EE', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontFamily: 'var(--font-mono)' }}
                />
                <Line type="monotone" dataKey="actual" stroke="var(--color-data-observed)" strokeWidth={3} dot={false} name="Observed" />
                <Line type="monotone" dataKey="predicted" stroke="var(--color-data-modeled)" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Modeled" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-[var(--radius-card)] overflow-hidden shadow-sm">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-semibold text-text-primary">Model Progression</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="px-6 py-3 font-semibold text-text-secondary">Model Version</th>
                <th className="px-6 py-3 font-semibold text-text-secondary">MAE</th>
                <th className="px-6 py-3 font-semibold text-text-secondary">RMSE</th>
                <th className="px-6 py-3 font-semibold text-text-secondary">R²</th>
                <th className="px-6 py-3 font-semibold text-text-secondary">Improvement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {modelProgression.map((row) => (
                <tr key={row.version} className={row.highlight ? 'bg-brand-primary/5' : ''}>
                  <td className={`px-6 py-4 ${row.highlight ? 'font-semibold text-brand-primary' : 'text-text-primary'}`}>{row.version}</td>
                  <td className="px-6 py-4 font-mono">{row.mae}</td>
                  <td className="px-6 py-4 font-mono">{row.rmse}</td>
                  <td className="px-6 py-4 font-mono">{row.r2}</td>
                  <td className="px-6 py-4 text-emerald-600 font-medium">{row.delta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
