import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { Map, Users, Building, ArrowRight } from 'lucide-react'

export function Login() {
  const setRole = useAppStore((s) => s.setRole)
  const navigate = useNavigate()

  const handleLogin = (role: 'citizen' | 'municipal') => {
    setRole(role)
    navigate(role === 'citizen' ? '/citizen' : '/authority')
  }

  return (
    <div className="flex w-full h-screen bg-background">
      {/* Left Panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-brand-primary p-12 text-white overflow-hidden relative">
        <div className="z-10">
          <div className="flex items-center gap-3 mb-6">
            <Map size={32} className="text-brand-accent" />
            <h1 className="text-3xl font-bold tracking-tight">AeroTwin</h1>
          </div>
          <p className="text-xl font-medium text-white/90 max-w-md leading-relaxed">
            Observe → Understand → Predict → Simulate → Decide
          </p>
        </div>
        
        {/* Abstract Map Illustration (CSS generated) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-10 pointer-events-none">
          <div className="w-full h-full border-[1px] border-white/20 rounded-full" />
          <div className="absolute top-10 left-10 w-[720px] h-[720px] border-[1px] border-white/20 rounded-full" />
          <div className="absolute top-24 left-24 w-[608px] h-[608px] border-[1px] border-white/30 rounded-full" />
        </div>

        <div className="z-10 mt-auto">
          <p className="text-sm text-white/70 font-medium">
            Pune Urban Environmental Digital Twin for PM2.5
            <br />
            <span className="opacity-75">Note: Decision-support system, not causal attribution.</span>
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-surface">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-text-primary">Welcome to AeroTwin</h2>
            <p className="mt-2 text-text-secondary">Select your portal to continue</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => handleLogin('citizen')}
              className="w-full group flex items-start p-5 border border-border rounded-[var(--radius-card)] bg-surface hover:border-brand-primary hover:shadow-soft transition-all text-left"
            >
              <div className="flex-shrink-0 w-12 h-12 bg-data-citizen/10 text-data-citizen rounded-full flex items-center justify-center group-hover:bg-data-citizen group-hover:text-white transition-colors">
                <Users size={24} />
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-semibold text-text-primary">Citizen Portal</h3>
                <p className="text-sm text-text-secondary mt-1">Explore air quality & report environmental issues.</p>
                <div className="flex items-center text-brand-primary text-sm font-medium mt-3">
                  Continue as citizen <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>

            <button
              onClick={() => handleLogin('municipal')}
              className="w-full group flex items-start p-5 border border-border rounded-[var(--radius-card)] bg-surface hover:border-brand-primary hover:shadow-soft transition-all text-left"
            >
              <div className="flex-shrink-0 w-12 h-12 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center group-hover:bg-brand-primary group-hover:text-white transition-colors">
                <Building size={24} />
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-semibold text-text-primary">Municipal Authority</h3>
                <p className="text-sm text-text-secondary mt-1">Command center for analysis and intervention simulation.</p>
                <div className="flex items-center text-brand-primary text-sm font-medium mt-3">
                  Sign in to dashboard <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
