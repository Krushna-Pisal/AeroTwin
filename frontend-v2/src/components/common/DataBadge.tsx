import { Activity, Beaker, Cpu, Radio, Users } from 'lucide-react'
import type { DataStatus } from '@/api/types'

interface DataBadgeProps {
  type: DataStatus
  className?: string
  showTooltip?: boolean
}

export function DataBadge({ type, className = '', showTooltip = false }: DataBadgeProps) {
  const config = {
    OBSERVED: { label: 'OBSERVED', color: 'bg-data-observed text-surface', icon: Radio, tooltip: 'Measured by physical sensors' },
    MODELED: { label: 'MODELED', color: 'bg-data-modeled text-surface', icon: Cpu, tooltip: 'Model-derived forecast or contribution' },
    PROXY: { label: 'PROXY', color: 'bg-data-proxy text-surface', icon: Activity, tooltip: 'Activity proxy, not measured emissions' },
    CITIZEN_REPORTED: { label: 'CITIZEN-REPORTED', color: 'bg-data-citizen text-surface', icon: Users, tooltip: 'Corroboration confidence from citizen reports' },
    SCENARIO: { label: 'MODELED SCENARIO', color: 'bg-data-scenario text-surface', icon: Beaker, tooltip: 'Modeled scenario, not observed outcomes' },
    DATA_UNAVAILABLE: { label: 'NO DATA', color: 'bg-missing text-surface', icon: Activity, tooltip: 'Data unavailable' }
  }

  const { label, color, icon: Icon, tooltip } = config[type] || config['DATA_UNAVAILABLE']

  return (
    <div 
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium tracking-wide uppercase shadow-sm ${color} ${className}`}
      title={showTooltip ? tooltip : undefined}
    >
      <Icon size={12} strokeWidth={2.5} />
      <span>{label}</span>
    </div>
  )
}
