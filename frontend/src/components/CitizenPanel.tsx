import { useState } from "react"
import type { CitizenReport, Environment } from "../types"
import { pm25, publishedTime } from "../format"
import { LiveReading } from "./LiveReading"
import { StatusBadge } from "./StatusBadge"

const CATEGORIES = ["Traffic", "Dust/construction", "Smoke/burning", "Industrial activity", "Unusual odour"]

type Props = {
  environment: Environment | null
  reports: CitizenReport[]
  pin: { longitude: number; latitude: number } | null
  onPick: (picking: boolean) => void
  picking: boolean
  onSubmit: (report: CitizenReport) => void
}

export function CitizenPanel({ environment, reports, pin, onPick, picking, onSubmit }: Props) {
  const [category, setCategory] = useState(CATEGORIES[0])
  const [description, setDescription] = useState("")
  const [photoName, setPhotoName] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!pin || !description.trim()) return
    onSubmit({
      id: `${Date.now()}`,
      category,
      description: description.trim(),
      longitude: pin.longitude,
      latitude: pin.latitude,
      photoName,
      status: "CITIZEN_REPORTED",
    })
    setDescription("")
    setPhotoName(null)
    setNotice("Your observation has been recorded as CITIZEN_REPORTED evidence.")
  }

  return (
    <aside className="h-full overflow-y-auto bg-[#f4efe6] p-4 text-sm leading-relaxed">
      <p className="text-xs tracking-[0.16em] text-[#9f1239]">CITIZEN VIEW</p>
      <h2 className="font-display text-3xl leading-tight">What is in the air near this monitor?</h2>
      {!environment && <p className="mt-3">Choose a station on the map. The nearest reading is the monitor, not a street-level surface.</p>}
      {environment && (
        <>
          <section className="mt-4 rounded-2xl bg-white/70 p-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Last stored CPCB hour</h3>
              <StatusBadge status="OBSERVED" />
            </div>
            <p className="text-3xl">{pm25(environment.current_observation.pm25)}</p>
            <p className="text-xs text-[#57534e]">Nearby station: {environment.station.station_name}</p>
            <p className="text-xs text-[#57534e]">{publishedTime(environment.current_observation.timestamp)}</p>
            <p className="mt-1 text-xs">This hour is in the project archive. It is not a live reading.</p>
          </section>
          <LiveReading environment={environment} />
          <section className="mt-3 rounded-2xl bg-[#dbe7f5] p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">Next 24 hours</h3>
              <StatusBadge status="MODELED" text="MODELED — PERSISTENCE BASELINE" />
            </div>
            <p className="text-2xl">{pm25(environment.forecast.pm25)}</p>
            <p className="text-xs">The forecast copies the stored CPCB hour. A live neighborhood reading does not replace it.</p>
          </section>
          <section className="mt-3 rounded-2xl bg-white/70 p-3">
            <h3 className="font-medium">Why was that stored hour high?</h3>
            <p className="mt-1">
              {environment.hotspot.hotspot
                ? `On the stored hours, this monitor is a hotspot. That hour is ${pm25(environment.current_observation.pm25)} and the last 24 stored hours averaged ${pm25(environment.hotspot.rolling_24h_mean)}.`
                : environment.hotspot.hotspot === false
                  ? `On the stored hours, this monitor is not a hotspot. That hour is ${pm25(environment.current_observation.pm25)}. The last 24 stored hours averaged ${pm25(environment.hotspot.rolling_24h_mean)}, and other stations are higher.`
                  : "Hotspot status is not available for this station."}
            </p>
          </section>
        </>
      )}

      <form id="citizen-report" className="mt-4 rounded-2xl bg-white/70 p-3" onSubmit={submit}>
        <h3 className="font-medium">Report an observation</h3>
        <label className="mt-2 block text-xs">
          Category
          <select className="mt-1 w-full rounded-xl border border-[#d9d0c1] bg-white px-2 py-2" value={category} onChange={(event) => setCategory(event.target.value)}>
            {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="mt-2 block text-xs">
          Description
          <textarea className="mt-1 w-full rounded-xl border border-[#d9d0c1] bg-white px-2 py-2" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} required />
        </label>
        <div className="mt-2 text-xs">
          <p>Location {pin ? `${pin.latitude.toFixed(4)}, ${pin.longitude.toFixed(4)}` : "not set"}</p>
          <button type="button" className="mt-1 rounded-full border border-[#9f1239] px-3 py-1 text-[#9f1239]" onClick={() => onPick(!picking)}>
            {picking ? "Click the map to drop a pin" : "Set location on the map"}
          </button>
        </div>
        <label className="mt-2 block text-xs">
          Optional photo
          <input className="mt-1 block w-full text-xs" type="file" accept="image/*" onChange={(event) => setPhotoName(event.target.files?.[0]?.name ?? null)} />
        </label>
        <button type="submit" disabled={!pin || !description.trim()} className="mt-3 rounded-full bg-[#9f1239] px-3 py-1.5 text-xs text-white disabled:opacity-40">
          Record observation
        </button>
        {notice && (
          <div className="mt-3 rounded-xl bg-[#f8e1e6] p-2">
            <p>{notice}</p>
            <p className="mt-1 text-xs">This does not change the 24-hour forecast. It stays in this browser session.</p>
            <StatusBadge status="CITIZEN_REPORTED" />
          </div>
        )}
      </form>

      {reports.length > 0 && (
        <ul className="mt-3 space-y-2">
          {reports.map((report) => (
            <li key={report.id} className="rounded-xl bg-white/70 p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium">{report.category}</span>
                <StatusBadge status="CITIZEN_REPORTED" />
              </div>
              <p className="mt-1">{report.description}</p>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
