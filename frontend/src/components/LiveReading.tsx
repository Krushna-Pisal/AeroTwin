import type { Environment } from "../types"
import { pm25 } from "../format"
import { StatusBadge } from "./StatusBadge"

export function LiveReading({ environment }: { environment: Environment }) {
  const live = environment.live_reading
  if (!live) return null
  const city = live.city
  return (
    <section className="mt-3 rounded-2xl bg-white/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Live reading</h3>
        <StatusBadge status={live.status} />
      </div>
      {live.status === "OBSERVED" && live.pm25 != null ? (
        <>
          <p className="text-3xl">{pm25(live.pm25)}</p>
          <p className="text-xs text-[#57534e]">
            {live.source_station} on aqi.in
            {live.page_updated_local ? `, page updated ${live.page_updated_local} local time` : ""}.
          </p>
          <p className="mt-1 text-xs">{live.detail}</p>
        </>
      ) : (
        <>
          <p className="mt-1">No live reading for this CPCB monitor.</p>
          <p className="mt-1 text-xs">{live.detail}</p>
          {city?.pm25 != null && (
            <p className="mt-1 text-xs">
              Pune on the same page: {pm25(city.pm25)}
              {city.page_updated_local ? `, updated ${city.page_updated_local} local time` : ""}. That city figure is not this monitor.
            </p>
          )}
        </>
      )}
    </section>
  )
}
