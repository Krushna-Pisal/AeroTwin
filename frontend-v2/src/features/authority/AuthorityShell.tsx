import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Map, BarChart2, Activity, Settings, AlertTriangle, FileText, User, Bell, LogOut } from 'lucide-react'
import { CommandMapPage } from './command-map/CommandMapPage'
import { ForecastValidation } from './forecast/ForecastValidation'
import { FactorAnalysis } from './factors/FactorAnalysis'
import { InterventionSimulator } from './simulator/InterventionSimulator'
import { ComplaintsDashboard } from './complaints/ComplaintsDashboard'
import { AssumptionsPage } from './assumptions/AssumptionsPage'
import { useAppStore } from '@/store/useAppStore'

function TopBar() {
  const { globalMode, setGlobalMode, logout } = useAppStore()
  
  return (
    <header className="h-14 bg-surface/90 backdrop-blur-md border-b border-border flex items-center justify-between px-4 sticky top-0 z-20 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 mr-4">
          <Map className="text-brand-primary" size={20} />
          <span className="font-semibold text-text-primary tracking-tight">Pune Command Center</span>
        </div>
        
        {/* Mode Switch (Segmented Control) */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          {(['Observed', 'Forecast', 'Scenario'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setGlobalMode(mode)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                globalMode === mode 
                  ? 'bg-white text-brand-primary shadow-sm ring-1 ring-slate-900/5' 
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-medium text-text-secondary bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live · Updated 10:45 IST
        </div>
        <button className="text-text-muted hover:text-text-primary transition-colors">
          <Bell size={18} />
        </button>
        <div className="h-4 w-px bg-border mx-1" />
        <button onClick={logout} className="flex items-center gap-2 text-xs font-medium text-text-secondary hover:text-red-600 transition-colors">
          <LogOut size={16} /> Logout
        </button>
      </div>
    </header>
  )
}

function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  
  const navItems = [
    { path: '/authority', icon: Map, label: 'Command Map' },
    { path: '/authority/forecast', icon: BarChart2, label: 'Forecast Validation' },
    { path: '/authority/factors', icon: Activity, label: 'Factor Analysis' },
    { path: '/authority/simulator', icon: Settings, label: 'Simulator' },
    { path: '/authority/complaints', icon: AlertTriangle, label: 'Complaints' },
    { path: '/authority/assumptions', icon: FileText, label: 'Assumptions' }
  ]

  return (
    <aside className="w-16 hover:w-56 bg-surface border-r border-border flex flex-col py-4 transition-all duration-300 overflow-hidden group z-10 shrink-0">
      <nav className="flex-1 px-2 space-y-1">
        {navItems.map(item => {
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg whitespace-nowrap transition-colors ${
                isActive 
                  ? 'bg-brand-primary/10 text-brand-primary font-semibold' 
                  : 'text-text-secondary hover:bg-slate-50 hover:text-text-primary'
              }`}
            >
              <item.icon size={20} className="shrink-0" />
              <span className="text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>
      <div className="px-4 mt-auto">
        <div className="w-8 h-8 rounded-full bg-slate-100 border border-border flex items-center justify-center shrink-0">
          <User size={16} className="text-text-secondary" />
        </div>
      </div>
    </aside>
  )
}

export function AuthorityShell() {
  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar />
        <main className="flex-1 overflow-hidden relative">
          <Routes>
            <Route path="/" element={<CommandMapPage />} />
            <Route path="/forecast" element={<ForecastValidation />} />
            <Route path="/factors" element={<FactorAnalysis />} />
            <Route path="/simulator" element={<InterventionSimulator />} />
            <Route path="/complaints" element={<ComplaintsDashboard />} />
            <Route path="/assumptions" element={<AssumptionsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
