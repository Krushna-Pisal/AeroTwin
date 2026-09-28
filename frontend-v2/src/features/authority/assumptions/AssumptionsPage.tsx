import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react'

export function AssumptionsPage() {
  return (
    <div className="p-8 h-full overflow-y-auto w-full bg-slate-50">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">System Assumptions & Limitations</h1>
          <p className="text-text-secondary mt-1">Transparency on proxy methodologies, model constraints, and data reliability.</p>
        </div>

        <div className="bg-amber-50 border-l-4 border-amber-500 p-5 rounded-r-xl shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-amber-900 mb-1">Critical Disclaimer</h3>
              <p className="text-sm text-amber-800/90 leading-relaxed">
                AeroTwin uses ML to infer air quality between physical monitoring stations using proxy variables (traffic, weather, satellite imagery). <strong className="font-bold">Modeled inferences are not physical observations.</strong> Always defer to ground-truth CPCB stations for regulatory compliance.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-4">
              <CheckCircle2 className="text-data-observed" size={20} />
              Observed Data
            </h2>
            <div className="space-y-4 text-sm text-text-secondary">
              <p>
                <strong>Source:</strong> Direct readings from CPCB (Central Pollution Control Board) and SAFAR monitoring stations located within the Pune municipal boundary.
              </p>
              <p>
                <strong>Limitations:</strong> Subject to hardware calibration drift, power outages, and localized anomalies (e.g., a truck idling directly under the sensor). Missing data is imputed using temporal interpolation for gaps &lt; 2 hours.
              </p>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-4">
              <Info className="text-data-proxy" size={20} />
              Factor Proxies (Activity vs Emissions)
            </h2>
            <div className="space-y-4 text-sm text-text-secondary">
              <p>
                <strong>Traffic:</strong> Derived from real-time routing APIs indicating road speeds. <strong className="text-text-primary">Assumption:</strong> Slower speeds indicate congestion, which linearly scales localized tailpipe PM2.5 contributions. We do not measure actual vehicle counts or fleet emission standards.
              </p>
              <p>
                <strong>Industry:</strong> Based on zoning maps and generic operational hours. <strong className="text-text-primary">Assumption:</strong> Facilities operate uniformly between 8 AM and 6 PM. We do not have real-time stack emission telemetry from individual factories.
              </p>
              <p>
                <strong>Construction:</strong> Static map of registered sites. <strong className="text-text-primary">Assumption:</strong> Sites generate uniform dust during daylight hours without rain. We cannot verify if mitigation (like water sprinkling) is actively deployed.
              </p>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2 mb-4">
              <Info className="text-data-citizen" size={20} />
              Citizen Corroborations
            </h2>
            <div className="space-y-4 text-sm text-text-secondary">
              <p>
                <strong>Role:</strong> Citizen reports act as qualitative confidence boosters for the ML model's proxy variables (e.g., if the model predicts high dust, and 10 citizens report construction dust, confidence increases).
              </p>
              <p>
                <strong>Limitations:</strong> Subject to reporting bias (more reports in affluent/dense areas), malicious manipulation, and subjective categorization. They are explicitly excluded from direct PM2.5 calculation formulas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
