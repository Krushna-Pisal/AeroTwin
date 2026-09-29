import React, { useState } from "react"
import type { Environment } from "../types"
import { ageLabel, pm25, publishedTime, utcTime } from "../format"
import { StatusBadge } from "./StatusBadge"

// Categories for Civic Reports
export const CIVIC_CATEGORIES = [
  "Garbage",
  "Road Damage",
  "Water Supply",
  "Drainage",
  "Street Light",
  "Air Pollution",
  "Traffic",
  "Public Facility",
  "Other",
]

// Contribution Types for Spatial Contributions
export const SPATIAL_TYPES = [
  "Missing Road",
  "Road Damage",
  "Street Light",
  "Garbage Point",
  "Water Issue",
  "Drainage",
  "Public Facility",
  "Other",
]

export const SOURCES = [
  "Personally Observed",
  "Community Source",
  "Municipal Source",
  "Other",
]

// ── CITIZEN DASHBOARD ────────────────────────────────────────────────────────
export function CitizenDashboard({
  environment,
  reports = [],
  spatialContributions = [],
  onNavigate,
}: {
  environment: Environment | null
  reports: any[]
  spatialContributions: any[]
  onNavigate: (page: any) => void
}) {
  const activeReports = reports.filter((r) => r.status !== "Resolved" && r.status !== "Rejected")
  const verifiedSpatial = spatialContributions.filter((s) => s.status === "VERIFIED")
  const pendingSpatial = spatialContributions.filter((s) => s.status === "Pending Verification")
  const recent = environment?.recent_cpcb_reading
  const recentOk = recent?.status === "OBSERVED" && recent.pm25 != null

  return (
    <div className="h-full overflow-y-auto bg-[#0f1117] p-6 text-slate-100 space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-[#1e2432] bg-gradient-to-r from-[#111827] via-[#0d1117] to-[#141e2e] p-6 shadow-xl">
        <div>
          <span className="text-xs font-bold text-green-400 tracking-wider uppercase">CITIZEN PORTAL</span>
          <h1 className="text-2xl font-bold text-white mt-1" style={{ fontFamily: "var(--font-display)" }}>
            Pune Environmental & Civic Overview
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Track air quality readings, report infrastructure issues, and contribute crowd-sourced spatial data to the Pune Municipal Digital Twin.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate("report-issue")}
            className="rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-lg bg-green-600 hover:bg-green-500 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Report Civic Issue
          </button>
          <button
            onClick={() => onNavigate("spatial-contributions")}
            className="rounded-xl px-4 py-2.5 text-xs font-semibold text-white border border-[#1e2432] bg-[#111827] hover:bg-[#1a2332] transition flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            Spatial Contribution
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric 1: Air Quality */}
        <div className="rounded-2xl border border-[#1e2432] bg-[#111827] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Recent CPCB PM2.5</span>
            <StatusBadge status={recent?.status ?? "DATA_UNAVAILABLE"} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {recentOk ? pm25(recent.pm25) : environment ? "Not available" : "Loading…"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 truncate">
            {environment ? environment.station.station_name : "Select a station"}
          </p>
          {recentOk && (
            <p className="text-[11px] text-slate-500">{utcTime(recent.timestamp_utc)}, {ageLabel(recent.age_hours)}</p>
          )}
        </div>

        {/* Metric 2: Active Reports */}
        <div className="rounded-2xl border border-[#1e2432] bg-[#111827] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">My Active Reports</span>
            <span className="text-xs font-bold text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              {activeReports.length} Active
            </span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-white">{reports.length}</div>
          <p className="mt-1 text-[11px] text-slate-500">Total complaints filed by you</p>
        </div>

        {/* Metric 3: Spatial Contributions */}
        <div className="rounded-2xl border border-[#1e2432] bg-[#111827] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Spatial Contributions</span>
            <span className="text-xs font-bold text-purple-400 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
              {verifiedSpatial.length} Verified
            </span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-white">{spatialContributions.length}</div>
          <p className="mt-1 text-[11px] text-slate-500">{pendingSpatial.length} pending PMC review</p>
        </div>

        {/* Metric 4: PMC SLA Status */}
        <div className="rounded-2xl border border-[#1e2432] bg-[#111827] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Average Resolution Time</span>
            <span className="text-xs font-bold text-green-400">24-48 hrs</span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-white">92.4%</div>
          <p className="mt-1 text-[11px] text-slate-500">PMC Ward SLA Compliance</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Recent Active Reports & Contributions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Reports */}
          <div className="rounded-2xl border border-[#1e2432] bg-[#111827] p-5">
            <div className="flex items-center justify-between border-b border-[#1e2432] pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                My Civic Reports
              </h2>
              <button onClick={() => onNavigate("my-reports")} className="text-xs font-medium text-green-400 hover:underline">
                View All ({reports.length}) &rarr;
              </button>
            </div>

            {reports.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">No civic reports filed yet. Click "Report Civic Issue" to file one.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {reports.slice(0, 3).map((r) => (
                  <div key={r.id} className="rounded-xl border border-[#1e2432] bg-[#0d1117] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-slate-700 transition">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-semibold text-green-400">{r.id}</span>
                        <span className="text-xs font-bold text-white">{r.title || r.category}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">{r.severity}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">{r.description}</p>
                      <p className="text-[10px] text-slate-500 mt-1">Location: {r.location_name || `${r.latitude?.toFixed(3)}, ${r.longitude?.toFixed(3)}`}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                        r.status === "Resolved" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                        r.status === "In Progress" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                        r.status === "Assigned" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                        "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}>
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Spatial Contributions Overview */}
          <div className="rounded-2xl border border-[#1e2432] bg-[#111827] p-5">
            <div className="flex items-center justify-between border-b border-[#1e2432] pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                My Spatial Contributions
              </h2>
              <button onClick={() => onNavigate("my-contributions")} className="text-xs font-medium text-purple-400 hover:underline">
                View All ({spatialContributions.length}) &rarr;
              </button>
            </div>

            {spatialContributions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">No spatial contributions submitted yet.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {spatialContributions.slice(0, 3).map((s) => (
                  <div key={s.id} className="rounded-xl border border-[#1e2432] bg-[#0d1117] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-semibold text-purple-400">{s.id}</span>
                        <span className="text-xs font-bold text-white">{s.title || s.contribution_type}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{s.geometry_type || "Point"}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">{s.description}</p>
                    </div>
                    <div className="shrink-0">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                        s.status === "VERIFIED" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                        s.status === "Rejected" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                        "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}>
                        {s.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Notifications & Environmental Station Card */}
        <div className="space-y-6">
          {/* Environmental Station Status */}
          {environment && (
            <div className="rounded-2xl border border-[#1e2432] bg-[#111827] p-5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">NEAREST CPCB MONITOR</span>
              <h3 className="text-lg font-bold text-white mt-1">{environment.station.station_name}</h3>

              <div className="mt-4 p-4 rounded-xl bg-[#0d1117] border border-[#1e2432] text-center">
                <span className="text-xs text-slate-400">Recent CPCB hour (OpenAQ)</span>
                <div className="text-4xl font-extrabold text-green-400 mt-1">
                  {recentOk ? pm25(recent.pm25) : "Not available"}
                </div>
                <span className="text-[11px] text-slate-500">
                  {recentOk ? `${utcTime(recent.timestamp_utc)}, ${ageLabel(recent.age_hours)}` : recent?.detail}
                </span>
              </div>

              <div className="mt-3 p-3 rounded-xl bg-[#0d1117] border border-[#1e2432] text-xs text-slate-400">
                <p>
                  Stored archive hour: <strong className="text-white">{pm25(environment.current_observation.pm25)}</strong>
                </p>
                <p className="text-[11px] text-slate-500">{publishedTime(environment.current_observation.timestamp)}</p>
                <p className="text-[11px] text-slate-500 mt-1">24-hour persistence forecast: {pm25(environment.forecast.pm25)} (copies the archive hour)</p>
              </div>
            </div>
          )}

          {/* Important Notifications */}
          <div className="rounded-2xl border border-[#1e2432] bg-[#111827] p-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#1e2432] pb-3">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Important Notifications
            </h3>
            <div className="mt-3 space-y-3">
              <div className="rounded-xl p-3 bg-[#0d1117] border border-[#1e2432] text-xs">
                <span className="font-semibold text-green-400">PMC Air Quality Alert</span>
                <p className="text-slate-300 mt-1">Moderate PM2.5 levels detected across Swargate ward. Dust suppression misting units activated.</p>
                <span className="text-[10px] text-slate-500 mt-1 block">Today at 10:15 AM</span>
              </div>
              <div className="rounded-xl p-3 bg-[#0d1117] border border-[#1e2432] text-xs">
                <span className="font-semibold text-purple-400">Spatial Contribution Update</span>
                <p className="text-slate-300 mt-1">Your spatial contribution "JM Road Misting cannons" was verified by PMC GIS Board.</p>
                <span className="text-[10px] text-slate-500 mt-1 block">Yesterday at 04:30 PM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── REPORT CIVIC ISSUE FORM ──────────────────────────────────────────────────
export function ReportCivicIssueForm({
  onSubmitReport,
  onPickMapLocation,
  pickedLocation,
  onCancel,
}: {
  onSubmitReport: (data: any) => Promise<any>
  onPickMapLocation: () => void
  pickedLocation: { longitude: number; latitude: number } | null
  onCancel: () => void
}) {
  const [category, setCategory] = useState(CIVIC_CATEGORIES[0])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [severity, setSeverity] = useState("Medium")
  const [locationName, setLocationName] = useState("Swargate, Pune")
  const [photoUrl, setPhotoUrl] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submittedReport, setSubmittedReport] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) {
      setError("Please provide a description of the civic issue.")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        title: title.trim() || `${category} Issue`,
        category,
        severity,
        description: description.trim(),
        latitude: pickedLocation?.latitude || 18.5204,
        longitude: pickedLocation?.longitude || 73.8567,
        location_name: locationName,
        ward: "Central Ward",
        citizen_name: "Rahul Sharma",
        citizen_contact: "rahul.s@aerotwin.org",
        photo_url: photoUrl.trim() || "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=600&q=80",
      }

      const created = await onSubmitReport(payload)
      setSubmittedReport(created)
    } catch (err: any) {
      setError(err.message || "Failed to submit civic report. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submittedReport) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0f1117] p-6 text-slate-100">
        <div className="max-w-md w-full rounded-2xl border border-green-500/30 bg-[#111827] p-8 text-center shadow-2xl space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Complaint Submitted Successfully!</h2>
          <div className="p-4 rounded-xl bg-[#0d1117] border border-[#1e2432] space-y-1">
            <p className="text-xs text-slate-400">Complaint Reference ID</p>
            <p className="text-xl font-mono font-bold text-green-400">{submittedReport.id}</p>
          </div>
          <p className="text-xs text-slate-400">
            Your complaint has been logged in the PMC Municipal Dispatcher queue and assigned to the relevant department.
          </p>
          <div className="pt-2">
            <button
              onClick={onCancel}
              className="w-full rounded-xl py-3 text-xs font-semibold text-white bg-green-600 hover:bg-green-500 transition shadow-lg"
            >
              View in My Reports
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-[#0f1117] p-6 text-slate-100">
      <div className="max-w-2xl mx-auto rounded-2xl border border-[#1e2432] bg-[#111827] p-6 shadow-2xl space-y-6">
        <div className="border-b border-[#1e2432] pb-4">
          <span className="text-xs font-bold text-green-400 tracking-wider uppercase">CITIZEN WORKFLOW</span>
          <h1 className="text-2xl font-bold text-white mt-1" style={{ fontFamily: "var(--font-display)" }}>
            Report a Civic & Environmental Issue
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Submit an observation to PMC Municipal Corporation. Submissions are stored and tracked in real-time.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category & Severity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300">Issue Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#1e2432] bg-[#0d1117] px-3 py-2.5 text-xs text-white outline-none focus:border-green-500"
              >
                {CIVIC_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">Severity *</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#1e2432] bg-[#0d1117] px-3 py-2.5 text-xs text-white outline-none focus:border-green-500"
              >
                <option value="Low">Low (Minor nuisance)</option>
                <option value="Medium">Medium (Moderate impact)</option>
                <option value="High">High (Health / Traffic hazard)</option>
                <option value="Critical">Critical (Emergency attention needed)</option>
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-300">Issue Title</label>
            <input
              type="text"
              placeholder="e.g. Uncollected garbage dump near Swargate bus stand"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#1e2432] bg-[#0d1117] px-3 py-2.5 text-xs text-white outline-none focus:border-green-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300">Detailed Description *</label>
            <textarea
              rows={4}
              placeholder="Provide exact details of the civic issue, odors, hazards, or affected area..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#1e2432] bg-[#0d1117] px-3 py-2.5 text-xs text-white outline-none focus:border-green-500"
              required
            />
          </div>

          {/* Location Selection */}
          <div className="p-4 rounded-xl border border-[#1e2432] bg-[#0d1117] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">Location Coordinates</span>
              <button
                type="button"
                onClick={onPickMapLocation}
                className="px-3 py-1 text-xs rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 transition flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                Select on GIS Map
              </button>
            </div>
            <p className="text-xs text-slate-400">
              {pickedLocation
                ? `Selected: Latitude ${pickedLocation.latitude.toFixed(4)}, Longitude ${pickedLocation.longitude.toFixed(4)}`
                : "Default: Pune Central (Click map to adjust location pin)"}
            </p>
            <input
              type="text"
              placeholder="Location Landmark / Address"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className="w-full rounded-xl border border-[#1e2432] bg-[#111827] px-3 py-2 text-xs text-white outline-none"
            />
          </div>

          {/* Photo Evidence URL */}
          <div>
            <label className="block text-xs font-medium text-slate-300">Photo / Evidence URL (Optional)</label>
            <input
              type="text"
              placeholder="https://images.unsplash.com/..."
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#1e2432] bg-[#0d1117] px-3 py-2.5 text-xs text-white outline-none focus:border-green-500"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 text-xs font-semibold text-white rounded-xl bg-green-600 hover:bg-green-500 transition shadow-lg disabled:opacity-50"
            >
              {submitting ? "Submitting Report..." : "Submit Complaint"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── MY REPORTS VIEW ──────────────────────────────────────────────────────────
export function MyReportsView({
  reports = [],
}: {
  reports: any[]
}) {
  const [filterStatus, setFilterStatus] = useState<string>("All")
  const [selectedReport, setSelectedReport] = useState<any>(null)

  const filtered = reports.filter((r) => filterStatus === "All" || r.status === filterStatus)

  return (
    <div className="h-full overflow-y-auto bg-[#0f1117] p-6 text-slate-100 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e2432] pb-4">
        <div>
          <span className="text-xs font-bold text-green-400 tracking-wider uppercase">MY SUBMISSIONS</span>
          <h1 className="text-2xl font-bold text-white mt-1" style={{ fontFamily: "var(--font-display)" }}>
            Civic Issue Reports History
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track real-time resolution workflow, assigned PMC departments, and official remarks.
          </p>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {["All", "Submitted", "Under Review", "Assigned", "In Progress", "Resolved", "Rejected"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition whitespace-nowrap ${
                filterStatus === st
                  ? "bg-green-600 text-white border-green-500 shadow-md"
                  : "bg-[#111827] text-slate-400 border-[#1e2432] hover:text-white"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* List / Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#1e2432] bg-[#111827] p-12 text-center text-xs text-slate-500">
          No reports found matching status "{filterStatus}".
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((r) => (
            <div
              key={r.id}
              onClick={() => setSelectedReport(r)}
              className="rounded-2xl border border-[#1e2432] bg-[#111827] p-5 cursor-pointer hover:border-green-500/50 hover:bg-[#141d2e] transition space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-green-400">{r.id}</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                  r.status === "Resolved" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                  r.status === "In Progress" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                  r.status === "Assigned" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                  r.status === "Rejected" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                  "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }`}>
                  {r.status}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">{r.title || r.category}</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{r.description}</p>
              </div>

              <div className="pt-2 border-t border-[#1e2432] flex items-center justify-between text-[11px] text-slate-500">
                <span>Category: <strong className="text-slate-300">{r.category}</strong></span>
                <span>Severity: <strong className="text-slate-300">{r.severity}</strong></span>
                <span>{r.reported_date ? new Date(r.reported_date).toLocaleDateString() : "Recent"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-w-xl w-full rounded-2xl border border-[#1e2432] bg-[#111827] p-6 text-slate-100 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e2432] pb-3">
              <div>
                <span className="font-mono text-xs text-green-400 font-bold">{selectedReport.id}</span>
                <h2 className="text-lg font-bold text-white mt-0.5">{selectedReport.title || selectedReport.category}</h2>
              </div>
              <button onClick={() => setSelectedReport(null)} className="text-slate-400 hover:text-white text-lg font-bold">&times;</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#0d1117] border border-[#1e2432]">
                <div><span className="text-slate-500">Category:</span> <p className="font-semibold text-white">{selectedReport.category}</p></div>
                <div><span className="text-slate-500">Severity:</span> <p className="font-semibold text-amber-400">{selectedReport.severity}</p></div>
                <div><span className="text-slate-500">Status:</span> <p className="font-semibold text-green-400">{selectedReport.status}</p></div>
                <div><span className="text-slate-500">Assigned Dept:</span> <p className="font-semibold text-blue-400">{selectedReport.assigned_department || "Pending Assignment"}</p></div>
              </div>

              <div>
                <span className="text-slate-500 font-medium">Description:</span>
                <p className="mt-1 text-slate-200 bg-[#0d1117] p-3 rounded-xl border border-[#1e2432]">{selectedReport.description}</p>
              </div>

              {selectedReport.official_remarks && (
                <div>
                  <span className="text-slate-500 font-medium">Official PMC Remarks:</span>
                  <p className="mt-1 text-amber-300 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">{selectedReport.official_remarks}</p>
                </div>
              )}

              {selectedReport.photo_url && (
                <div>
                  <span className="text-slate-500 font-medium">Evidence Photo:</span>
                  <img src={selectedReport.photo_url} alt="Evidence" className="mt-1 rounded-xl w-full h-40 object-cover border border-[#1e2432]" />
                </div>
              )}

              {/* Timeline */}
              <div>
                <span className="text-slate-500 font-medium">Progress Timeline:</span>
                <div className="mt-2 space-y-2">
                  {(selectedReport.timeline || [
                    { status: selectedReport.status, timestamp: selectedReport.reported_date, note: "Status recorded." }
                  ]).map((t: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 text-[11px] p-2 rounded-lg bg-[#0d1117] border border-[#1e2432]">
                      <div className="w-2 h-2 rounded-full bg-green-400 mt-1" />
                      <div>
                        <span className="font-semibold text-white">{t.status}</span>
                        <span className="text-slate-500 ml-2">{t.timestamp ? new Date(t.timestamp).toLocaleString() : ""}</span>
                        <p className="text-slate-400 mt-0.5">{t.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#1e2432] text-right">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#1e2432] text-white hover:bg-[#2e3748]"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ADD SPATIAL CONTRIBUTION FORM ────────────────────────────────────────────
export function AddSpatialContributionForm({
  onSubmitContribution,
  onPickMapLocation,
  pickedLocation,
  onCancel,
}: {
  onSubmitContribution: (data: any) => Promise<any>
  onPickMapLocation: () => void
  pickedLocation: { longitude: number; latitude: number } | null
  onCancel: () => void
}) {
  const [step, setStep] = useState<number>(1)
  const [contribType, setContribType] = useState<string>(SPATIAL_TYPES[0])
  const [geometryType, setGeometryType] = useState<string>("Point")
  const [title, setTitle] = useState<string>("")
  const [description, setDescription] = useState<string>("")
  const [category, setCategory] = useState<string>("Green Infrastructure")
  const [source, setSource] = useState<string>("Personally Observed")
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!description.trim()) {
      setError("Please enter a description.")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        title: title.trim() || `${contribType} Item`,
        contribution_type: contribType,
        category,
        geometry_type: geometryType,
        latitude: pickedLocation?.latitude || 18.5204,
        longitude: pickedLocation?.longitude || 73.8567,
        coordinates: geometryType === "Point"
          ? [pickedLocation?.longitude || 73.8567, pickedLocation?.latitude || 18.5204]
          : geometryType === "LineString"
          ? [[73.850, 18.520], [73.855, 18.525], [73.860, 18.530]]
          : [[73.845, 18.530], [73.848, 18.530], [73.848, 18.532], [73.845, 18.532], [73.845, 18.530]],
        description: description.trim(),
        source,
        submitted_by: "Citizen Scientist",
      }

      const res = await onSubmitContribution(payload)
      setResult(res)
    } catch (err: any) {
      setError(err.message || "Failed to submit spatial contribution.")
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0f1117] p-6 text-slate-100">
        <div className="max-w-md w-full rounded-2xl border border-purple-500/30 bg-[#111827] p-8 text-center shadow-2xl space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Spatial Contribution Logged!</h2>
          <div className="p-4 rounded-xl bg-[#0d1117] border border-[#1e2432] space-y-1">
            <p className="text-xs text-slate-400">Contribution ID</p>
            <p className="text-xl font-mono font-bold text-purple-400">{result.id}</p>
            <p className="text-xs text-amber-400 font-medium">Status: Pending Verification</p>
          </div>
          <p className="text-xs text-slate-400">
            Your spatial geometry has been sent to the PMC Municipal GIS Review Queue. Once approved, it will render live on the city GIS map.
          </p>
          <div className="pt-2">
            <button onClick={onCancel} className="w-full rounded-xl py-3 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 transition shadow-lg">
              View in My Contributions
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-[#0f1117] p-6 text-slate-100">
      <div className="max-w-2xl mx-auto rounded-2xl border border-[#1e2432] bg-[#111827] p-6 shadow-2xl space-y-6">
        {/* Wizard Progress */}
        <div className="border-b border-[#1e2432] pb-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-purple-400 tracking-wider uppercase">CROWD-SOURCED GIS</span>
            <h1 className="text-2xl font-bold text-white mt-1" style={{ fontFamily: "var(--font-display)" }}>
              Add Spatial Contribution
            </h1>
          </div>
          <div className="text-xs font-semibold px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
            Step {step} of 5
          </div>
        </div>

        {/* Step 1: Contribution Type */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">Step 1 — Select Contribution Type</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {SPATIAL_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setContribType(t)}
                  className={`p-4 rounded-xl border text-left text-xs font-semibold transition ${
                    contribType === t
                      ? "border-purple-500 bg-purple-500/10 text-white shadow-md"
                      : "border-[#1e2432] bg-[#0d1117] text-slate-400 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="pt-4 flex justify-end">
              <button onClick={() => setStep(2)} className="px-6 py-2.5 text-xs font-semibold text-white rounded-xl bg-purple-600 hover:bg-purple-500 transition">
                Next: Geometry &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Geometry */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">Step 2 — Select Geometry Type & Location</h3>
            <div className="grid grid-cols-3 gap-3">
              {["Point", "Line", "Polygon"].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGeometryType(g === "Line" ? "LineString" : g)}
                  className={`p-3 rounded-xl border text-center text-xs font-semibold transition ${
                    (geometryType === g || (g === "Line" && geometryType === "LineString"))
                      ? "border-purple-500 bg-purple-500/10 text-white"
                      : "border-[#1e2432] bg-[#0d1117] text-slate-400"
                  }`}
                >
                  {g} Geometry
                </button>
              ))}
            </div>

            <div className="p-4 rounded-xl border border-[#1e2432] bg-[#0d1117] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">GIS Location Coordinates</span>
                <button
                  type="button"
                  onClick={onPickMapLocation}
                  className="px-3 py-1.5 text-xs rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition"
                >
                  Click Location on GIS Map
                </button>
              </div>
              <p className="text-xs text-slate-400">
                {pickedLocation
                  ? `Selected: ${pickedLocation.latitude.toFixed(4)}, ${pickedLocation.longitude.toFixed(4)}`
                  : "Click map to set point or geometry centroid"}
              </p>
            </div>

            <div className="pt-4 flex justify-between">
              <button onClick={() => setStep(1)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white">
                &larr; Back
              </button>
              <button onClick={() => setStep(3)} className="px-6 py-2.5 text-xs font-semibold text-white rounded-xl bg-purple-600 hover:bg-purple-500">
                Next: Details &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Details */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">Step 3 — Title & Description</h3>
            <div>
              <label className="block text-xs font-medium text-slate-300">Title</label>
              <input
                type="text"
                placeholder="e.g. Unmapped water misting cannons buffer zone"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#1e2432] bg-[#0d1117] px-3 py-2.5 text-xs text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#1e2432] bg-[#0d1117] px-3 py-2.5 text-xs text-white outline-none"
              >
                <option value="Green Infrastructure">Green Infrastructure</option>
                <option value="Dust Control Zone">Dust Control Zone</option>
                <option value="Point Emissions Source">Point Emissions Source</option>
                <option value="Traffic Corridor">Traffic Corridor</option>
                <option value="General">General</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300">Detailed Description *</label>
              <textarea
                rows={4}
                placeholder="Describe the spatial infrastructure, buffer zone, or feature details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#1e2432] bg-[#0d1117] px-3 py-2.5 text-xs text-white outline-none"
                required
              />
            </div>
            <div className="pt-4 flex justify-between">
              <button onClick={() => setStep(2)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white">
                &larr; Back
              </button>
              <button onClick={() => setStep(4)} className="px-6 py-2.5 text-xs font-semibold text-white rounded-xl bg-purple-600 hover:bg-purple-500">
                Next: Data Source &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Source */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">Step 4 — Select Information Source</h3>
            <div className="grid grid-cols-2 gap-3">
              {SOURCES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSource(s)}
                  className={`p-3 rounded-xl border text-left text-xs font-semibold transition ${
                    source === s ? "border-purple-500 bg-purple-500/10 text-white" : "border-[#1e2432] bg-[#0d1117] text-slate-400"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="pt-4 flex justify-between">
              <button onClick={() => setStep(3)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white">
                &larr; Back
              </button>
              <button onClick={() => setStep(5)} className="px-6 py-2.5 text-xs font-semibold text-white rounded-xl bg-purple-600 hover:bg-purple-500">
                Next: Review & Submit &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Summary & Submit */}
        {step === 5 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">Step 5 — Summary & Submission</h3>
            <div className="p-4 rounded-xl border border-[#1e2432] bg-[#0d1117] space-y-2 text-xs">
              <div><span className="text-slate-500">Contribution Type:</span> <strong className="text-white">{contribType}</strong></div>
              <div><span className="text-slate-500">Geometry Type:</span> <strong className="text-purple-400">{geometryType}</strong></div>
              <div><span className="text-slate-500">Title:</span> <strong className="text-white">{title || "(Untitled)"}</strong></div>
              <div><span className="text-slate-500">Description:</span> <p className="text-slate-300 mt-0.5">{description}</p></div>
              <div><span className="text-slate-500">Source:</span> <strong className="text-white">{source}</strong></div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                {error}
              </div>
            )}

            <div className="pt-4 flex justify-between">
              <button onClick={() => setStep(4)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white">
                &larr; Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2.5 text-xs font-semibold text-white rounded-xl bg-purple-600 hover:bg-purple-500 shadow-lg disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Spatial Contribution"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── MY CONTRIBUTIONS VIEW ───────────────────────────────────────────────────
export function MyContributionsView({ spatialContributions = [] }: { spatialContributions: any[] }) {
  return (
    <div className="h-full overflow-y-auto bg-[#0f1117] p-6 text-slate-100 space-y-6">
      <div className="border-b border-[#1e2432] pb-4">
        <span className="text-xs font-bold text-purple-400 tracking-wider uppercase">MY CROWD-SOURCED GIS</span>
        <h1 className="text-2xl font-bold text-white mt-1" style={{ fontFamily: "var(--font-display)" }}>
          My Spatial Contributions
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Review crowd-sourced spatial items, verification status by PMC GIS Board, and reviewer remarks.
        </p>
      </div>

      {spatialContributions.length === 0 ? (
        <div className="rounded-2xl border border-[#1e2432] bg-[#111827] p-12 text-center text-xs text-slate-500">
          No spatial contributions submitted yet. Click "Add Spatial Contribution" to contribute.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {spatialContributions.map((s) => (
            <div key={s.id} className="rounded-2xl border border-[#1e2432] bg-[#111827] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-purple-400">{s.id}</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                  s.status === "VERIFIED" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                  s.status === "Rejected" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                  "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }`}>
                  {s.status}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">{s.title || s.contribution_type}</h3>
                <p className="text-xs text-slate-400 mt-1">{s.description}</p>
              </div>

              {s.reviewer_remarks && (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
                  <strong>PMC Reviewer Remarks:</strong> {s.reviewer_remarks}
                </div>
              )}

              {s.rejection_reason && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  <strong>Rejection Reason:</strong> {s.rejection_reason}
                </div>
              )}

              <div className="pt-2 border-t border-[#1e2432] flex items-center justify-between text-[11px] text-slate-500">
                <span>Type: <strong className="text-slate-300">{s.contribution_type}</strong></span>
                <span>Geometry: <strong className="text-purple-400">{s.geometry_type || "Point"}</strong></span>
                <span>{s.submitted_date ? new Date(s.submitted_date).toLocaleDateString() : "Recent"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
