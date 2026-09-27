import { useState } from "react"
import type { ComparePayload, Environment, HistoryPoint, Intensity, Intervention, ScenarioRow } from "../types"
import { evidenceSentence, interventionLabel, pm25, publishedTime } from "../format"
import { StatusBadge } from "./StatusBadge"
import { Sparkline } from "./Sparkline"

const INTERVENTIONS: Intervention[] = ["traffic_restriction", "industrial_control", "dust_construction_control"]

type Props = {
  environment: Environment | null
  history: HistoryPoint[]
  loading: boolean
  section: string
  intensity: Intensity
  intervention: Intervention
  scenario: ScenarioRow | null
  comparison: ComparePayload | null
  scenarioError: string | null
  onIntensity: (value: Intensity) => void
  onIntervention: (value: Intervention) => void
  onSimulate: () => void
  onCompare: () => void
}

export function MunicipalPanel(props: Props) {
  const { environment } = props
  if (!environment) {
    return (
      <aside className="flex h-full flex-col justify-end bg-[#f4efe6] p-5 md:justify-between">
        <div>
          <p className="text-xs tracking-[0.16em] text-[#57534e]">OBSERVE</p>
          <h2 className="font-display text-3xl leading-tight">Where is pollution sitting?</h2>
          <p className="mt-3 text-sm leading-relaxed">
            Select a monitor. The map shows the station reading, the evidence around it, the persistence forecast, and what a scenario assumes.
          </p>
        </div>
        {props.loading && <p className="mt-4 text-sm">Loading the station…</p>}
      </aside>
    )
  }
  const quality = environment.data_quality
  return (
    <aside className="h-full overflow-y-auto bg-[#f4efe6] p-4 text-sm leading-relaxed">
      <p className="text-xs tracking-[0.16em] text-[#57534e]">{environment.station.station_id}</p>
      <h2 className="font-display text-3xl leading-none">{environment.station.station_name}</h2>
      <section className="mt-4 rounded-2xl bg-white/60 p-3" id="section-now">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium">Current PM2.5</h3>
          <StatusBadge status="OBSERVED" />
        </div>
        <p className="mt-1 text-3xl">{pm25(environment.current_observation.pm25)}</p>
        <p className="text-xs text-[#57534e]">{publishedTime(environment.current_observation.timestamp)}</p>
        <div className="mt-3">
          <p className="text-xs text-[#57534e]">Recent observed hours</p>
          <Sparkline points={props.history} />
        </div>
      </section>

      <section className={`mt-3 rounded-2xl p-3 ${props.section === "forecast" ? "bg-[#dbe7f5]" : "bg-white/60"}`} id="section-forecast">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium">24-hour forecast</h3>
          <StatusBadge status="MODELED" text="MODELED — PERSISTENCE BASELINE" />
        </div>
        <p className="mt-1 text-2xl">{pm25(environment.forecast.pm25)}</p>
        <p>Valid {publishedTime(environment.forecast.forecast_timestamp)}. This copies the latest observation. It is not an observed future hour.</p>
        {environment.forecast.stale && <p className="mt-1 text-xs">The latest hour is older than 48 hours on the network clock.</p>}
      </section>

      <section className="mt-3 rounded-2xl bg-white/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium">Hotspot</h3>
          <StatusBadge status={environment.hotspot.status} text={environment.hotspot.hotspot ? "HOTSPOT" : environment.hotspot.hotspot === false ? "NOT A HOTSPOT" : "DATA UNAVAILABLE"} />
        </div>
        <p className="mt-1">
          {environment.hotspot.hotspot
            ? `Latest hour ${pm25(environment.current_observation.pm25)} and the 24-hour mean ${pm25(environment.hotspot.rolling_24h_mean)} both clear the station rule.`
            : environment.hotspot.detail || "This monitor is not in the hotspot set."}
        </p>
      </section>

      <section className={`mt-3 rounded-2xl p-3 ${props.section === "evidence" || props.section === "contributions" ? "bg-[#e5ecd6]" : "bg-white/60"}`} id="section-evidence">
        <h3 className="font-medium">What evidence is around it?</h3>
        <p className="mt-1">{evidenceSentence(environment.source_contributions.categories)}</p>
        <ul className="mt-2 space-y-2">
          {environment.source_contributions.categories.map((row) => (
            <li key={row.category} className="rounded-xl bg-[#f4efe6] p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{row.category === "TRAFFIC" ? "Traffic" : row.category === "INDUSTRIAL" ? "Industrial activity" : "Dust and construction"}</span>
                <StatusBadge status={row.status} />
              </div>
              <p className="mt-1 text-xs text-[#57534e]">
                {row.score == null
                  ? "No evidence score. No pollution share is filled in."
                  : `Evidence score ${row.score.toFixed(2)}. Confidence ${row.confidence ?? "not stated"}. Not a percent of PM2.5.`}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[#57534e]">
          Road context: {environment.activity.traffic.context_layer.feature_count} major-road lines, {environment.activity.traffic.context_layer.measures_traffic ? "treated as volume" : "not a traffic count"}.
          Industrial proxy: {environment.activity.industrial.label ?? "not loaded"}. Dust records: not loaded.
        </p>
      </section>

      <section className="mt-3 rounded-2xl bg-white/60 p-3">
        <h3 className="font-medium">Data quality</h3>
        <ul className="mt-2 space-y-1 text-xs">
          <li className="flex items-center justify-between gap-2">
            <span>Archive coverage: a PM2.5 reading exists for {quality.pm25_coverage.hours_with_pm25.toLocaleString("en-IN")} of {quality.pm25_coverage.hours_in_table.toLocaleString("en-IN")} stored hours. This is not a concentration.</span>
            <StatusBadge status={quality.pm25_coverage.status} />
          </li>
          <li className="flex items-center justify-between gap-2">
            <span>Weather fields on the latest hour: {quality.weather_availability.fields_present_at_latest_hour} of 6</span>
            <StatusBadge status={quality.weather_availability.status} />
          </li>
          <li className="flex items-center justify-between gap-2">
            <span>{quality.coordinate_availability.available ? "Published coordinates" : "No coordinates stored"}</span>
            <StatusBadge status={quality.coordinate_availability.status} />
          </li>
          <li className="flex items-center justify-between gap-2">
            <span>Citizen reports on the server: {quality.citizen_report_availability.count}</span>
            <StatusBadge status={quality.citizen_report_availability.status} />
          </li>
        </ul>
      </section>

      <DecisionPanel {...props} />

      <Limitations items={environment.limitations} />
    </aside>
  )
}

function DecisionPanel(props: Props) {
  return (
    <section className={`mt-3 rounded-2xl p-3 ${props.section === "simulate" || props.section === "compare" ? "bg-[#ece4f8]" : "bg-white/60"}`} id="section-simulate">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">What happens under an intervention?</h3>
        <StatusBadge status="SCENARIO" text="MODELED SCENARIO" />
      </div>
      <p className="mt-1 text-xs text-[#57534e]">Intensity names an assumption. It is not an enforcement percentage.</p>
      <div className="mt-2 flex gap-1">
        {(["LOW", "MEDIUM", "HIGH"] as Intensity[]).map((level) => (
          <button key={level} type="button" onClick={() => props.onIntensity(level)} className={`rounded-full px-3 py-1 text-xs ${props.intensity === level ? "bg-[#5b21b6] text-white" : "bg-[#f4efe6]"}`}>
            {level}
          </button>
        ))}
      </div>
      <div className="mt-2 grid gap-1">
        {INTERVENTIONS.map((name) => (
          <button key={name} type="button" onClick={() => props.onIntervention(name)} className={`rounded-xl px-3 py-2 text-left text-sm ${props.intervention === name ? "bg-[#1c1915] text-[#f4efe6]" : "bg-[#f4efe6]"}`}>
            {interventionLabel(name)}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={props.onSimulate} className="rounded-full bg-[#5b21b6] px-3 py-1.5 text-xs text-white">Run scenario</button>
        <button type="button" onClick={props.onCompare} className="rounded-full border border-[#5b21b6] px-3 py-1.5 text-xs text-[#5b21b6]">Compare three</button>
      </div>
      {props.scenarioError && <p className="mt-2 text-xs text-[#9f1239]">{props.scenarioError}</p>}
      {props.scenario && <ScenarioCard row={props.scenario} />}
      {props.comparison && (
        <div className="mt-3 grid gap-2" id="section-compare">
          <p className="text-xs text-[#57534e]">Same baseline, three assumptions. Nothing here is ranked.</p>
          <div className="grid gap-2 md:grid-cols-1">
            {props.comparison.scenarios.map((row) => (
              <ScenarioCard key={row.scenario_id} row={row} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function ScenarioCard({ row }: { row: ScenarioRow }) {
  const [open, setOpen] = useState(false)
  return (
    <article className="rounded-xl bg-[#f4efe6] p-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-medium">{interventionLabel(row.intervention_type)}</h4>
        <StatusBadge status="SCENARIO" text="MODELED SCENARIO" />
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-[#57534e]">Baseline PM2.5</dt>
          <dd>{pm25(row.baseline_pm25)} <StatusBadge status="OBSERVED" /></dd>
        </div>
        <div>
          <dt className="text-[#57534e]">Scenario PM2.5</dt>
          <dd>{row.modeled_pm25 == null ? "Not calculated" : pm25(row.modeled_pm25)}</dd>
        </div>
        <div>
          <dt className="text-[#57534e]">Change</dt>
          <dd>{row.absolute_change == null ? "Not calculated" : `${row.absolute_change.toFixed(1)} µg/m³`}</dd>
        </div>
        <div>
          <dt className="text-[#57534e]">Confidence</dt>
          <dd>{row.confidence ?? "Not available"}</dd>
        </div>
        <div>
          <dt className="text-[#57534e]">Evidence available</dt>
          <dd><StatusBadge status={row.source_evidence_status} /></dd>
        </div>
        <div>
          <dt className="text-[#57534e]">Evidence score</dt>
          <dd>{row.baseline_contribution == null ? "None" : `${row.baseline_contribution.toFixed(2)} → ${row.modeled_contribution?.toFixed(2) ?? "—"}`}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs">{row.assumptions[0]?.statement}</p>
      <button type="button" className="mt-1 text-xs underline" onClick={() => setOpen((value) => !value)}>
        {open ? "Hide limitations" : "Limitations"}
      </button>
      {open && (
        <ul className="mt-1 list-disc pl-4 text-xs text-[#57534e]">
          {row.limitations.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
    </article>
  )
}

function Limitations({ items }: { items: string[] }) {
  const [open, setOpen] = useState(false)
  const shown = open ? items : items.slice(0, 2)
  return (
    <section className="mt-3 text-xs text-[#57534e]">
      <h3 className="font-medium text-[#1c1915]">Limitations</h3>
      <ul className="mt-1 list-disc pl-4">
        {shown.map((item) => <li key={item}>{item}</li>)}
      </ul>
      {items.length > 2 && (
        <button type="button" className="mt-1 underline" onClick={() => setOpen((value) => !value)}>
          {open ? "Show fewer" : "Show all limitations"}
        </button>
      )}
    </section>
  )
}
