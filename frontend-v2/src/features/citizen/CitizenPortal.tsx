import { Routes, Route, useNavigate } from 'react-router-dom'
import { MapPin, Search, AlertCircle, TrendingUp, Info, Activity, Camera, CheckCircle2, ChevronDown, ChevronRight, Maximize2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { DataBadge } from '@/components/common/DataBadge'
import { CitizenMap } from '@/components/map/CitizenMap'

function SearchBar() {
  return (
    <div className="relative mb-6">
      <input 
        type="text" 
        placeholder="Search locality in Pune..." 
        className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-surface shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-accent text-sm"
      />
      <Search size={18} className="absolute left-3.5 top-3.5 text-text-muted" />
      <button className="absolute right-3.5 top-3.5 text-brand-primary font-medium text-xs hover:underline">
        Use my location
      </button>
    </div>
  )
}

function HeroCard() {
  return (
    <div className="bg-surface rounded-[var(--radius-card)] p-5 border border-border shadow-soft mb-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Shivajinagar</h2>
          <p className="text-xs text-text-muted">updated 12 min ago</p>
        </div>
        <DataBadge type="OBSERVED" />
      </div>
      <div className="flex items-end gap-3 mt-4">
        <div className="text-5xl font-mono font-bold tracking-tighter text-text-primary">65</div>
        <div className="pb-1 text-sm font-medium text-text-secondary">µg/m³ PM2.5</div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className="px-2.5 py-1 rounded-[var(--radius-chip)] bg-pm25-moderate/10 text-[#B48500] text-xs font-bold uppercase tracking-wider border border-pm25-moderate/20">
          Moderate
        </span>
        <span className="text-sm text-text-secondary">Air quality is acceptable.</span>
      </div>
    </div>
  )
}

function HotspotCard() {
  return (
    <div className="bg-amber-50/50 rounded-[var(--radius-card)] p-4 border border-amber-100 mb-4 flex gap-3 items-start">
      <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
      <div>
        <h3 className="text-sm font-semibold text-amber-900">Nearest Hotspot</h3>
        <p className="text-xs text-amber-700/80 mt-1">High PM2.5 (112 µg/m³) detected 1.2km away at Wakdewadi junction.</p>
      </div>
    </div>
  )
}

function ForecastCard() {
  return (
    <div className="bg-surface rounded-[var(--radius-card)] p-5 border border-border shadow-soft mb-4">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm font-semibold text-text-primary">24h Forecast</h3>
        <DataBadge type="MODELED" />
      </div>
      {/* Chart placeholder */}
      <div className="h-24 w-full bg-slate-50 border border-slate-100 rounded flex items-center justify-center relative overflow-hidden">
        <TrendingUp size={24} className="text-data-modeled/40" />
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-data-modeled/10 to-transparent" />
      </div>
      <div className="flex justify-between mt-3 text-xs text-text-muted font-medium">
        <span>Now</span>
        <span>+12h</span>
        <span>+24h</span>
      </div>
    </div>
  )
}

function FactorsCard() {
  const [expanded, setExpanded] = useState(false)
  const [voted, setVoted] = useState(false)

  return (
    <div className="bg-surface rounded-[var(--radius-card)] border border-border shadow-soft overflow-hidden mb-4">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex justify-between items-center bg-slate-50/50 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info size={18} className="text-brand-primary" />
          <h3 className="text-sm font-semibold text-text-primary">Why is pollution high?</h3>
        </div>
        {expanded ? <ChevronDown size={18} className="text-text-muted" /> : <ChevronRight size={18} className="text-text-muted" />}
      </button>
      
      {expanded && (
        <div className="p-4 border-t border-border">
          <p className="text-xs text-text-secondary mb-3">Likely contributing factors (model-based):</p>
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium">Traffic Congestion</span>
            <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium">Dust/Construction</span>
            <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium">Low Wind Speed</span>
          </div>

          <div className="pt-4 border-t border-dashed border-border">
            <h4 className="text-xs font-semibold text-text-primary mb-3">What do you think is causing this?</h4>
            {!voted ? (
              <div className="grid grid-cols-2 gap-2">
                {['Traffic', 'Construction', 'Burning', 'Industry'].map(cause => (
                  <button 
                    key={cause}
                    onClick={() => setVoted(true)}
                    className="py-1.5 px-3 rounded border border-border text-xs font-medium text-text-secondary hover:border-brand-primary hover:text-brand-primary transition-colors"
                  >
                    {cause}
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-data-citizen/10 text-data-citizen p-3 rounded text-xs font-medium flex gap-2">
                <CheckCircle2 size={16} />
                Thank you! Your vote helps corroborate the model.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ReportFAB({ onClick }: { onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="absolute bottom-8 right-8 bg-data-citizen hover:bg-[#0d8777] text-white px-5 py-3.5 rounded-full shadow-lg flex items-center gap-2 transition-transform hover:scale-105"
    >
      <Camera size={20} />
      <span className="font-semibold text-sm">Report Issue</span>
    </button>
  )
}

function ReportModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1)
  const [ticketId, setTicketId] = useState('')

  const next = () => setStep(s => s + 1)
  
  const submit = async () => {
    // Simulated API call leveraging the mock client logic
    setTicketId(`TICKET-${Math.floor(Math.random() * 10000)}`)
    setStep(4)
  }

  return (
    <div className="absolute inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-[var(--radius-card)] p-6 max-w-md w-full shadow-xl">
        {step < 4 && (
          <>
            <h2 className="text-xl font-semibold mb-2">Report Observation</h2>
            <p className="text-sm text-text-secondary mb-6">Citizen reports supplement sensor data; they are not measurements.</p>
          </>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Select issue type:</h3>
            {['Dust/Construction', 'Traffic Congestion', 'Smoke/Burning'].map(type => (
              <button key={type} onClick={next} className="w-full p-4 border border-border rounded-lg text-left hover:border-brand-primary transition-colors text-sm font-medium">
                {type}
              </button>
            ))}
            <div className="flex justify-end pt-4">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary">Cancel</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Location detected</h3>
            <div className="w-full h-32 bg-slate-100 rounded-lg border border-border flex items-center justify-center relative">
              <MapPin className="text-data-citizen" size={24} />
              <span className="absolute bottom-2 left-2 bg-white/80 px-2 py-1 rounded text-xs">Pune, Maharashtra</span>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setStep(1)} className="px-4 py-2 text-sm font-medium text-text-secondary">Back</button>
              <button onClick={next} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-[var(--radius-input)]">Confirm Location</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Add Photo (Optional)</h3>
            <div className="w-full p-8 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center text-text-muted hover:bg-slate-50 transition-colors cursor-pointer">
              <Camera size={32} className="mb-2" />
              <span className="text-sm">Click to upload photo</span>
            </div>
            <textarea placeholder="Additional description..." className="w-full p-3 border border-border rounded-lg text-sm" rows={3}></textarea>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setStep(2)} className="px-4 py-2 text-sm font-medium text-text-secondary">Back</button>
              <button onClick={submit} className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-[var(--radius-input)]">Submit Report</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-data-citizen/10 text-data-citizen rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-xl font-semibold mb-2">Report Submitted</h2>
            <p className="text-sm text-text-secondary mb-6">Thank you for contributing to Pune's environmental data.</p>
            <div className="bg-slate-50 p-4 rounded-lg border border-border mb-6 inline-block">
              <span className="text-xs text-text-secondary block mb-1">Your Ticket ID</span>
              <span className="text-lg font-mono font-bold text-brand-primary">{ticketId}</span>
            </div>
            <div className="flex justify-center">
              <button onClick={onClose} className="px-6 py-2 text-sm font-medium text-white bg-brand-primary rounded-[var(--radius-input)]">Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CitizenDashboard() {
  const [showReportModal, setShowReportModal] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="relative w-full h-[calc(100vh-32px)] overflow-hidden">
      {/* Map Background */}
      <CitizenMap />

      {/* Left Panel */}
      <div className="absolute top-0 left-0 h-full w-[420px] p-6 overflow-y-auto pointer-events-none z-10">
        <div className="pointer-events-auto">
          <SearchBar />
          <HeroCard />
          <HotspotCard />
          <ForecastCard />
          <FactorsCard />
          
          <button 
            onClick={() => navigate('/citizen/complaints')}
            className="w-full mt-4 text-center text-xs font-medium text-brand-primary hover:underline bg-surface py-3 rounded-[var(--radius-card)] border border-border shadow-sm"
          >
            Track an existing complaint
          </button>
        </div>
      </div>

      <ReportFAB onClick={() => setShowReportModal(true)} />

      {showReportModal && <ReportModal onClose={() => setShowReportModal(false)} />}
    </div>
  )
}

function ComplaintTracking() {
  const navigate = useNavigate()
  
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <button onClick={() => navigate('/citizen')} className="text-sm font-medium text-brand-primary mb-6 flex items-center hover:underline">
        ← Back to Map
      </button>
      <h1 className="text-2xl font-bold text-text-primary mb-6">Track Complaint</h1>
      <div className="bg-surface rounded-[var(--radius-card)] p-6 border border-border shadow-sm">
        <input type="text" placeholder="Enter Ticket ID (e.g. TICKET-123)" className="w-full px-4 py-3 border border-border rounded-[var(--radius-input)] text-sm mb-4" />
        <button className="w-full bg-brand-primary text-white py-3 rounded-[var(--radius-input)] font-medium text-sm">Track Status</button>
      </div>
    </div>
  )
}

export function CitizenPortal() {
  return (
    <Routes>
      <Route path="/" element={<CitizenDashboard />} />
      <Route path="/complaints" element={<ComplaintTracking />} />
    </Routes>
  )
}
