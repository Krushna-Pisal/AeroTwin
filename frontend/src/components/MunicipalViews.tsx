import { useState } from "react"
import type { Environment } from "../types"
import { ageLabel, pm25 } from "../format"
import { StatusBadge } from "./StatusBadge"
import { CIVIC_CATEGORIES } from "./CitizenViews"

// ── MUNICIPAL DASHBOARD ──────────────────────────────────────────────────────
export function MunicipalDashboard({
  environment,
  reports = [],
  spatialContributions = [],
  departments = [],
  onNavigate,
}: {
  environment: Environment | null
  reports: any[]
  spatialContributions: any[]
  departments: any[]
  onNavigate: (page: any) => void
}) {
  const pendingReports = reports.filter((r) => r.status === "Submitted" || r.status === "Under Review")
  const pendingSpatial = spatialContributions.filter((s) => s.status === "Pending Verification")
  const recent = environment?.recent_cpcb_reading
  const recentOk = recent?.status === "OBSERVED" && recent.pm25 != null

  return (
    <div className="h-full overflow-y-auto bg-[#0f1117] p-6 text-slate-100 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-purple-500/20 bg-gradient-to-r from-[#111827] via-[#141529] to-[#0d1117] p-6 shadow-xl">
        <div>
          <span className="text-xs font-bold text-purple-400 tracking-wider uppercase">PUNE MUNICIPAL CORPORATION</span>
          <h1 className="text-2xl font-bold text-white mt-1" style={{ fontFamily: "var(--font-display)" }}>
            Municipal Command & Operations Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Real-time urban environmental intelligence, citizen report dispatching, and crowd-sourced GIS verification queue.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate("reports-management")}
            className="rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-lg bg-blue-600 hover:bg-blue-500 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Citizen Reports ({pendingReports.length})
          </button>

          <button
            onClick={() => onNavigate("spatial-contributions-review")}
            className="rounded-xl px-4 py-2.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Review Queue ({pendingSpatial.length})
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#1e2432] bg-[#111827] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Citizen Reports</span>
            <span className="text-xs font-bold text-amber-400">{pendingReports.length} Pending</span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-white">{reports.length}</div>
          <p className="text-[11px] text-slate-500 mt-1">Across all PMC municipal wards</p>
        </div>

        <div className="rounded-2xl border border-[#1e2432] bg-[#111827] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Spatial Review Queue</span>
            <span className="text-xs font-bold text-purple-400">{pendingSpatial.length} Awaiting Review</span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-white">{spatialContributions.length}</div>
          <p className="text-[11px] text-slate-500 mt-1">Crowd-sourced GIS items submitted</p>
        </div>

        <div className="rounded-2xl border border-[#1e2432] bg-[#111827] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active PMC Departments</span>
            <span className="text-xs font-bold text-green-400">6 Depts</span>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-white">{departments.length || 6}</div>
          <p className="text-[11px] text-slate-500 mt-1">SLA Response window: 12-48 hrs</p>
        </div>

        <div className="rounded-2xl border border-[#1e2432] bg-[#111827] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Recent CPCB PM2.5</span>
            <StatusBadge status={recent?.status ?? "DATA_UNAVAILABLE"} />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-white">
            {recentOk ? pm25(recent.pm25) : environment ? "Not available" : "Loading…"}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {environment ? environment.station.station_name : "Select a station"}
            {recentOk ? ` · ${ageLabel(recent.age_hours)}` : ""}
          </p>
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Reports Queue */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-[#1e2432] bg-[#111827] p-5">
            <div className="flex items-center justify-between border-b border-[#1e2432] pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Pending Citizen Reports Management
              </h2>
              <button onClick={() => onNavigate("reports-management")} className="text-xs font-medium text-blue-400 hover:underline">
                Manage All &rarr;
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {reports.slice(0, 4).map((r) => (
                <div key={r.id} className="rounded-xl border border-[#1e2432] bg-[#0d1117] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-green-400">{r.id}</span>
                      <span className="text-xs font-bold text-white">{r.title || r.category}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">{r.severity}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">{r.description}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Ward: {r.ward || "Swargate / Kasba Peth"} | Citizen: {r.citizen_name || "Rahul Sharma"}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                      r.status === "Resolved" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                      r.status === "In Progress" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                      "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}>
                      {r.status}
                    </span>
                    <button
                      onClick={() => onNavigate("reports-management")}
                      className="px-3 py-1 text-xs rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30"
                    >
                      Action
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Spatial Review Queue & Quick Tools */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#1e2432] bg-[#111827] p-5">
            <div className="flex items-center justify-between border-b border-[#1e2432] pb-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                GIS Review Queue
              </h2>
              <button onClick={() => onNavigate("spatial-contributions-review")} className="text-xs font-medium text-purple-400 hover:underline">
                Review All &rarr;
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {pendingSpatial.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">No pending spatial reviews.</div>
              ) : (
                pendingSpatial.slice(0, 3).map((s) => (
                  <div key={s.id} className="rounded-xl border border-[#1e2432] bg-[#0d1117] p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-purple-400 font-bold">{s.id}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">{s.geometry_type || "Point"}</span>
                    </div>
                    <p className="font-semibold text-white">{s.title || s.contribution_type}</p>
                    <p className="text-slate-400 text-[11px] line-clamp-1">{s.description}</p>
                    <button
                      onClick={() => onNavigate("spatial-contributions-review")}
                      className="w-full py-1.5 text-[11px] font-semibold text-white rounded-lg bg-purple-600 hover:bg-purple-500 transition text-center"
                    >
                      Review Item
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── CITIZEN REPORTS MANAGEMENT (MUNICIPAL) ──────────────────────────────────
export function ReportsManagementView({
  reports = [],
  departments = [],
  onUpdateReport,
}: {
  reports: any[]
  departments: any[]
  onUpdateReport: (id: string, updates: any) => Promise<any>
}) {
  const [filterCategory, setFilterCategory] = useState("All")
  const [filterSeverity, setFilterSeverity] = useState("All")
  const [filterStatus, setFilterStatus] = useState("All")
  const [selectedReport, setSelectedReport] = useState<any>(null)
  const [assignedDept, setAssignedDept] = useState("")
  const [remarks, setRemarks] = useState("")
  const [resolutionEvidence, setResolutionEvidence] = useState("")
  const [updating, setUpdating] = useState(false)

  const filtered = reports.filter((r) => {
    if (filterCategory !== "All" && r.category !== filterCategory) return false
    if (filterSeverity !== "All" && r.severity !== filterSeverity) return false
    if (filterStatus !== "All" && r.status !== filterStatus) return false
    return true
  })

  async function handleApplyUpdate(newStatus?: string) {
    if (!selectedReport) return
    setUpdating(true)
    try {
      const updates: any = {}
      if (newStatus) updates.status = newStatus
      if (assignedDept) updates.assigned_department = assignedDept
      if (remarks.trim()) updates.official_remarks = remarks.trim()
      if (resolutionEvidence.trim()) updates.resolution_evidence = resolutionEvidence.trim()

      const updated = await onUpdateReport(selectedReport.id, updates)
      setSelectedReport(updated)
    } catch (err: any) {
      alert("Failed to update report: " + err.message)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#0f1117] p-6 text-slate-100 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e2432] pb-4">
        <div>
          <span className="text-xs font-bold text-blue-400 tracking-wider uppercase">PMC DISPATCH CENTER</span>
          <h1 className="text-2xl font-bold text-white mt-1" style={{ fontFamily: "var(--font-display)" }}>
            Citizen Reports Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Filter, assign PMC departments, update resolution statuses, and add official remarks.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-xl border border-[#1e2432] bg-[#111827] px-3 py-1.5 text-xs text-white outline-none"
          >
            <option value="All">All Categories</option>
            {CIVIC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="rounded-xl border border-[#1e2432] bg-[#111827] px-3 py-1.5 text-xs text-white outline-none"
          >
            <option value="All">All Severities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-[#1e2432] bg-[#111827] px-3 py-1.5 text-xs text-white outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Under Review">Under Review</option>
            <option value="Assigned">Assigned</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Reports Table */}
      <div className="rounded-2xl border border-[#1e2432] bg-[#111827] overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0d1117] text-slate-400 uppercase tracking-wider text-[10px] border-b border-[#1e2432]">
            <tr>
              <th className="p-4">Complaint ID</th>
              <th className="p-4">Title / Category</th>
              <th className="p-4">Severity</th>
              <th className="p-4">Ward</th>
              <th className="p-4">Status</th>
              <th className="p-4">Department</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2432] text-slate-300">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-[#141e2e] transition">
                <td className="p-4 font-mono font-bold text-green-400">{r.id}</td>
                <td className="p-4">
                  <div className="font-bold text-white">{r.title || r.category}</div>
                  <div className="text-[11px] text-slate-500 line-clamp-1">{r.description}</div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    r.severity === "Critical" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                    r.severity === "High" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                    "bg-slate-800 text-slate-300"
                  }`}>
                    {r.severity}
                  </span>
                </td>
                <td className="p-4">{r.ward || "Central Ward"}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full font-semibold border ${
                    r.status === "Resolved" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                    r.status === "In Progress" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                    r.status === "Assigned" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                    "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td className="p-4 text-slate-400">{r.assigned_department || "Unassigned"}</td>
                <td className="p-4">
                  <button
                    onClick={() => {
                      setSelectedReport(r)
                      setAssignedDept(r.assigned_department || "")
                      setRemarks(r.official_remarks || "")
                      setResolutionEvidence(r.resolution_evidence || "")
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 transition shadow"
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Action Drawer Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-w-2xl w-full rounded-2xl border border-[#1e2432] bg-[#111827] p-6 text-slate-100 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e2432] pb-3">
              <div>
                <span className="font-mono text-xs text-green-400 font-bold">{selectedReport.id}</span>
                <h2 className="text-lg font-bold text-white mt-0.5">{selectedReport.title || selectedReport.category}</h2>
              </div>
              <button onClick={() => setSelectedReport(null)} className="text-slate-400 hover:text-white text-lg font-bold">&times;</button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#0d1117] border border-[#1e2432] text-xs">
              <div><span className="text-slate-500">Citizen Name:</span> <p className="font-semibold text-white">{selectedReport.citizen_name || "Rahul Sharma"}</p></div>
              <div><span className="text-slate-500">Ward:</span> <p className="font-semibold text-white">{selectedReport.ward || "Swargate"}</p></div>
              <div><span className="text-slate-500">Current Status:</span> <p className="font-semibold text-amber-400">{selectedReport.status}</p></div>
              <div><span className="text-slate-500">Location:</span> <p className="font-semibold text-slate-300">{selectedReport.location_name || "Pune"}</p></div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">Assign Department</label>
              <select
                value={assignedDept}
                onChange={(e) => setAssignedDept(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#1e2432] bg-[#0d1117] px-3 py-2 text-xs text-white outline-none"
              >
                <option value="">-- Select Department --</option>
                {(departments.length ? departments : [
                  { name: "Solid Waste Management" },
                  { name: "Roads & Infrastructure" },
                  { name: "Environmental Cell" },
                  { name: "Electrical & Streetlighting" },
                  { name: "Water Supply & Sewerage" },
                  { name: "Public Health & Sanitation" },
                ]).map((d: any) => (
                  <option key={d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">Official Remarks</label>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter official PMC action remarks..."
                className="mt-1 w-full rounded-xl border border-[#1e2432] bg-[#0d1117] px-3 py-2 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">Resolution Evidence URL (Optional)</label>
              <input
                type="text"
                value={resolutionEvidence}
                onChange={(e) => setResolutionEvidence(e.target.value)}
                placeholder="https://..."
                className="mt-1 w-full rounded-xl border border-[#1e2432] bg-[#0d1117] px-3 py-2 text-xs text-white outline-none"
              />
            </div>

            {/* Status Change Buttons */}
            <div className="pt-3 border-t border-[#1e2432] flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => handleApplyUpdate("In Progress")}
                  disabled={updating}
                  className="px-3 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-500"
                >
                  Set In Progress
                </button>
                <button
                  onClick={() => handleApplyUpdate("Resolved")}
                  disabled={updating}
                  className="px-3 py-2 text-xs font-semibold rounded-xl bg-green-600 text-white hover:bg-green-500"
                >
                  Mark Resolved
                </button>
                <button
                  onClick={() => handleApplyUpdate("Rejected")}
                  disabled={updating}
                  className="px-3 py-2 text-xs font-semibold rounded-xl bg-red-600 text-white hover:bg-red-500"
                >
                  Reject Complaint
                </button>
              </div>

              <button
                onClick={() => handleApplyUpdate()}
                disabled={updating}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-600 text-slate-300 hover:text-white"
              >
                Save Details Only
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SPATIAL CONTRIBUTION REVIEW QUEUE (MUNICIPAL) ───────────────────────────
export function SpatialReviewQueueView({
  spatialContributions = [],
  onReviewContribution,
}: {
  spatialContributions: any[]
  onReviewContribution: (id: string, action: string, remarks?: string, rejection_reason?: string) => Promise<any>
}) {
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [remarks, setRemarks] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [reviewing, setReviewing] = useState(false)

  async function handleAction(action: string) {
    if (!selectedItem) return
    setReviewing(true)
    try {
      await onReviewContribution(selectedItem.id, action, remarks, rejectionReason)
      setSelectedItem(null)
      setRemarks("")
      setRejectionReason("")
    } catch (err: any) {
      alert("Review failed: " + err.message)
    } finally {
      setReviewing(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#0f1117] p-6 text-slate-100 space-y-6">
      <div className="border-b border-[#1e2432] pb-4">
        <span className="text-xs font-bold text-purple-400 tracking-wider uppercase">GIS BOARD REVIEW</span>
        <h1 className="text-2xl font-bold text-white mt-1" style={{ fontFamily: "var(--font-display)" }}>
          Spatial Contribution Review Queue
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Review crowd-sourced spatial geometries. Approved items become VERIFIED layers on the city GIS map.
        </p>
      </div>

      <div className="rounded-2xl border border-[#1e2432] bg-[#111827] overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0d1117] text-slate-400 uppercase tracking-wider text-[10px] border-b border-[#1e2432]">
            <tr>
              <th className="p-4">Contribution ID</th>
              <th className="p-4">Title / Type</th>
              <th className="p-4">Geometry</th>
              <th className="p-4">Contributor</th>
              <th className="p-4">Source</th>
              <th className="p-4">Status</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2432] text-slate-300">
            {spatialContributions.map((s) => (
              <tr key={s.id} className="hover:bg-[#141e2e] transition">
                <td className="p-4 font-mono font-bold text-purple-400">{s.id}</td>
                <td className="p-4">
                  <div className="font-bold text-white">{s.title || s.contribution_type}</div>
                  <div className="text-[11px] text-slate-500 line-clamp-1">{s.description}</div>
                </td>
                <td className="p-4">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-purple-300 border border-purple-500/20">
                    {s.geometry_type || "Point"}
                  </span>
                </td>
                <td className="p-4">{s.submitted_by || "Citizen"}</td>
                <td className="p-4 text-slate-400">{s.source || "Personally Observed"}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full font-semibold border ${
                    s.status === "VERIFIED" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                    s.status === "Rejected" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                    "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  }`}>
                    {s.status}
                  </span>
                </td>
                <td className="p-4">
                  <button
                    onClick={() => setSelectedItem(s)}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-500 transition shadow"
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Review Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-w-xl w-full rounded-2xl border border-[#1e2432] bg-[#111827] p-6 text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e2432] pb-3">
              <div>
                <span className="font-mono text-xs text-purple-400 font-bold">{selectedItem.id}</span>
                <h2 className="text-lg font-bold text-white mt-0.5">{selectedItem.title || selectedItem.contribution_type}</h2>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-white text-lg font-bold">&times;</button>
            </div>

            <div className="p-4 rounded-xl bg-[#0d1117] border border-[#1e2432] space-y-2 text-xs">
              <div><span className="text-slate-500">Geometry Type:</span> <strong className="text-purple-400">{selectedItem.geometry_type || "Point"}</strong></div>
              <div><span className="text-slate-500">Description:</span> <p className="text-slate-300 mt-1">{selectedItem.description}</p></div>
              <div><span className="text-slate-500">Source:</span> <strong className="text-white">{selectedItem.source}</strong></div>
              <div><span className="text-slate-500">Submitted By:</span> <strong className="text-white">{selectedItem.submitted_by}</strong></div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">GIS Reviewer Remarks</label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter review decision notes..."
                className="mt-1 w-full rounded-xl border border-[#1e2432] bg-[#0d1117] px-3 py-2 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">Rejection Reason (If rejecting)</label>
              <input
                type="text"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason for rejection..."
                className="mt-1 w-full rounded-xl border border-[#1e2432] bg-[#0d1117] px-3 py-2 text-xs text-white outline-none"
              />
            </div>

            <div className="pt-3 border-t border-[#1e2432] flex items-center justify-between gap-3">
              <button
                onClick={() => handleAction("reject")}
                disabled={reviewing}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-red-600 text-white hover:bg-red-500"
              >
                Reject Item
              </button>
              <button
                onClick={() => handleAction("approve")}
                disabled={reviewing}
                className="px-6 py-2 text-xs font-semibold rounded-xl bg-green-600 text-white hover:bg-green-500 shadow-lg"
              >
                Approve & Add to GIS Map
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── FUNCTIONAL SOURCE ATTRIBUTION PAGE ──────────────────────────────────────
export function SourceAttributionPage({ environment }: { environment: Environment | null }) {
  const [selectedSource, setSelectedSource] = useState<string>("CPCB")

  const sourcesList = [
    {
      name: "CPCB Air Quality Stations",
      id: "CPCB",
      type: "Official Government Network",
      coverage: "7 Automated Continuous Stations",
      updated: "Live hourly stream",
      status: "VERIFIED",
      influenceScore: "40%",
      detail: "Official monitoring stations operated by Central & Maharashtra State Pollution Control Boards.",
    },
    {
      name: "PMC Municipal Corporation Field Data",
      id: "PMC",
      type: "Municipal Sensor Network",
      coverage: "15 Ward Monitoring Sensors",
      updated: "Updated 15 mins ago",
      status: "OBSERVED",
      influenceScore: "35%",
      detail: "Street-level environmental sensors and mobile misting unit Telemetry.",
    },
    {
      name: "Citizen Crowd-Sourced Contributions",
      id: "CITIZEN",
      type: "Citizen Science & Spatial Items",
      coverage: "Citywide Verified Crowd Submissions",
      updated: "Real-time stream",
      status: "CITIZEN_REPORTED",
      influenceScore: "25%",
      detail: "Spatial contributions, unmapped dust barriers, pedestrian green belts, and verified citizen complaints.",
    },
    {
      name: "OpenStreetMap (OSM) Context",
      id: "OSM",
      type: "Open Geospatial Infrastructure",
      coverage: "Road Centerlines & Industrial Polygons",
      updated: "Weekly synchronization",
      status: "PROXY",
      influenceScore: "Context Only",
      detail: "Road network proximity centerlines and industrial activity proxy geometries.",
    },
  ]

  const selected = sourcesList.find((s) => s.id === selectedSource) || sourcesList[0]

  return (
    <div className="h-full overflow-y-auto bg-[#0f1117] p-6 text-slate-100 space-y-6">
      <div className="border-b border-[#1e2432] pb-4">
        <span className="text-xs font-bold text-green-400 tracking-wider uppercase">DATA INTELLIGENCE</span>
        <h1 className="text-2xl font-bold text-white mt-1" style={{ fontFamily: "var(--font-display)" }}>
          Functional Source Attribution & Spatial Analysis
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Evidence-weighted source attribution combining CPCB stations, PMC sensors, citizen contributions, and OSM context.
        </p>
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {sourcesList.map((s) => (
          <div
            key={s.id}
            onClick={() => setSelectedSource(s.id)}
            className={`p-5 rounded-2xl border cursor-pointer transition ${
              selectedSource === s.id
                ? "border-green-500 bg-[#141e2e] shadow-lg shadow-green-500/5"
                : "border-[#1e2432] bg-[#111827] hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase">{s.type}</span>
              <StatusBadge status={s.status} />
            </div>
            <h3 className="text-sm font-bold text-white mt-2">{s.name}</h3>
            <div className="mt-3 text-2xl font-extrabold text-green-400">{s.influenceScore}</div>
            <p className="text-[11px] text-slate-500 mt-1">{s.coverage}</p>
          </div>
        ))}
      </div>

      {/* Source Details Drawer & Spatial Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-[#1e2432] bg-[#111827] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1e2432] pb-3">
            <div>
              <span className="text-xs font-bold text-green-400">SELECTED SOURCE ATTRIBUTION</span>
              <h2 className="text-lg font-bold text-white mt-0.5">{selected.name}</h2>
            </div>
            <StatusBadge status={selected.status} />
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">{selected.detail}</p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 rounded-xl bg-[#0d1117] border border-[#1e2432] text-xs">
            <div><span className="text-slate-500">Coverage:</span> <p className="font-semibold text-white">{selected.coverage}</p></div>
            <div><span className="text-slate-500">Last Updated:</span> <p className="font-semibold text-green-400">{selected.updated}</p></div>
            <div><span className="text-slate-500">Influence Score:</span> <p className="font-semibold text-purple-400">{selected.influenceScore}</p></div>
          </div>

          {/* Categories breakdown from environment */}
          {environment && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Station Evidence Breakdown</h3>
              <div className="space-y-2">
                {environment.source_contributions.categories.map((c) => (
                  <div key={c.category} className="p-3 rounded-xl bg-[#0d1117] border border-[#1e2432] flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white">{c.category}</span>
                      <p className="text-[11px] text-slate-500">Score: {c.score ? c.score.toFixed(2) : "Data unavailable"}</p>
                    </div>
                    <span className="font-mono font-bold text-green-400">
                      {c.normalized_share ? `${(c.normalized_share * 100).toFixed(1)}% Share` : "Data unavailable"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Spatial Contribution Analysis Box */}
        <div className="rounded-2xl border border-[#1e2432] bg-[#111827] p-6 space-y-4">
          <h2 className="text-sm font-bold text-white border-b border-[#1e2432] pb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            Spatial Contribution Metrics
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between p-3 rounded-xl bg-[#0d1117] border border-[#1e2432]">
              <span className="text-slate-400">Spatial Influence Radius</span>
              <strong className="text-white">25.0 km</strong>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-[#0d1117] border border-[#1e2432]">
              <span className="text-slate-400">Affected Area</span>
              <strong className="text-white">450.0 km²</strong>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-[#0d1117] border border-[#1e2432]">
              <span className="text-slate-400">Total Observations</span>
              <strong className="text-green-400">1,680 hours</strong>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-[#0d1117] border border-[#1e2432]">
              <span className="text-slate-400">Verified Contributions</span>
              <strong className="text-purple-400">1 Verified Item</strong>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-[#0d1117] border border-[#1e2432]">
              <span className="text-slate-400">Dust & Construction Index</span>
              <strong className="text-slate-500">Data unavailable</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
