import type { Environment } from "../types"
import { pm25, publishedTime } from "../format"

export function StationPopup({ environment }: { environment: Environment }) {
  const hotspot = environment.hotspot.hotspot
  const mean = environment.hotspot.rolling_24h_mean
  return (
    <div className="w-[260px] rounded-2xl bg-[#f4efe6] p-3 text-[#1c1915] shadow-lg">
      <p className="font-display text-lg leading-tight">{shortName(environment.station.station_name)}</p>
      <p className="mt-2 text-3xl">{pm25(environment.current_observation.pm25)}</p>
      <p className="text-xs text-[#57534e]">Observed at the monitor. {publishedTime(environment.current_observation.timestamp)}.</p>
      <p className="mt-3 text-sm">24-hour outlook: {pm25(environment.forecast.pm25)}</p>
      <p className="text-xs text-[#1e3a5f]">Modeled persistence. Same number as the latest hour, not a new measurement.</p>
      <p className="mt-3 text-sm">
        {hotspot
          ? `Hotspot. The last 24 hours averaged ${pm25(mean)}.`
          : hotspot === false
            ? `Not a hotspot. The last 24 hours averaged ${pm25(mean)}. This station is not among the highest in the city.`
            : "Hotspot status is not available for this station."}
      </p>
    </div>
  )
}

function shortName(name: string): string {
  return name.replace(", Pune - IITM", "").replace(", Pune - MPCB", "")
}
