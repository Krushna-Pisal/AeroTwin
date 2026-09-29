import type { Environment } from "../types"
import { pm25, publishedTime } from "../format"
import { LiveReading } from "./LiveReading"

export function StationPopup({ environment }: { environment: Environment }) {
  const hotspot = environment.hotspot.hotspot
  const mean = environment.hotspot.rolling_24h_mean
  return (
    <div className="w-[260px] rounded-2xl bg-[#f4efe6] p-3 text-[#1c1915] shadow-lg">
      <p className="font-display text-lg leading-tight">{shortName(environment.station.station_name)}</p>
      <p className="mt-2 text-xs tracking-[0.12em] text-[#57534e]">LAST STORED CPCB HOUR</p>
      {environment.current_observation.archive_stale && (
        <div className="mb-1 rounded p-1 text-[10px] leading-tight" style={{ background: "#fef3c7", color: "#92400e" }}>
          ⚠ <strong>Stale archive data.</strong> ~{
            environment.current_observation.archive_age_hours != null && environment.current_observation.archive_age_hours >= 24
            ? `${Math.round(environment.current_observation.archive_age_hours / 24)} days`
            : `${Math.round(environment.current_observation.archive_age_hours ?? 0)} hours`
          } old. Not current conditions.
        </div>
      )}
      <p className="text-3xl">{pm25(environment.current_observation.pm25)}</p>
      <p className="text-xs text-[#57534e]">{publishedTime(environment.current_observation.timestamp)}. Archive hour, not a live reading.</p>
      <LiveReading environment={environment} />
      <p className="mt-3 text-sm">24-hour outlook: {pm25(environment.forecast.pm25)}</p>
      <p className="text-xs text-[#1e3a5f]">Modeled persistence of the stored hour. A live reading does not change it.</p>
      <p className="mt-3 text-sm">
        {hotspot
          ? `Hotspot on the stored hours. Those 24 hours averaged ${pm25(mean)}.`
          : hotspot === false
            ? `Not a hotspot on the stored hours. Those 24 hours averaged ${pm25(mean)}.`
            : "Hotspot status is not available for this station."}
      </p>
    </div>
  )
}

function shortName(name: string): string {
  return name.replace(", Pune - IITM", "").replace(", Pune - MPCB", "")
}
