import type { Environment } from "../types"
import { ageLabel, pm25, utcTime } from "../format"
import { StatusBadge } from "./StatusBadge"

export function LiveReading({ environment }: { environment: Environment }) {
  const recent = environment.recent_cpcb_reading
  const live = environment.live_reading
  const city = live?.city
  return (
    <>
      {recent && (
        <section className="mt-3 rounded-2xl bg-white/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium">Recent CPCB hour</h3>
            <StatusBadge status={recent.status} />
          </div>
          {recent.status === "OBSERVED" && recent.pm25 != null ? (
            <>
              <p className="text-3xl">{pm25(recent.pm25)}</p>
              <p className="text-xs text-[#57534e]">
                {utcTime(recent.timestamp_utc)}, {ageLabel(recent.age_hours)}. Same monitor, via OpenAQ.
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs">{recent.detail}</p>
          )}
        </section>
      )}
      {live && (
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
      )}
    </>
  )
}
