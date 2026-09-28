import { useAppStore } from '@/store/useAppStore'

export function ModeBanner() {
  const mode = useAppStore((s) => s.globalMode)

  if (mode === 'Observed') {
    return null
  }
  if (mode === 'Forecast') {
    return (
      <div className="w-full bg-data-modeled/10 border-b border-data-modeled/20 text-data-modeled px-4 py-1.5 text-xs text-center font-medium">
        Showing MODELED forecast
      </div>
    )
  }
  if (mode === 'Scenario') {
    return (
      <div className="w-full bg-data-scenario/10 border-b border-data-scenario/20 text-data-scenario px-4 py-1.5 text-xs text-center font-medium">
        MODELED SCENARIO: not observed outcomes
      </div>
    )
  }
  return null
}
