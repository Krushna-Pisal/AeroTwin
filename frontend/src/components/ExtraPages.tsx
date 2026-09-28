import type { Role } from "./Login"

export function AnalyticsPage() {
  return (
    <div className="h-full overflow-y-auto bg-[#0f1117] p-6 text-slate-100 space-y-6">
      <div className="border-b border-[#1e2432] pb-4">
        <span className="text-xs font-bold text-blue-400 tracking-wider uppercase">ADMINISTRATIVE ANALYTICS</span>
        <h1 className="text-2xl font-bold text-white mt-1" style={{ fontFamily: "var(--font-display)" }}>
          PMC Ward & Environmental Analytics
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Ward-level air quality distributions, complaint resolution SLAs, and activity correlation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[#1e2432] bg-[#111827] p-5">
          <span className="text-xs text-slate-400">Ward SLA Compliance</span>
          <div className="text-3xl font-extrabold text-green-400 mt-2">94.2%</div>
          <p className="text-[11px] text-slate-500 mt-1">Target SLA: &lt; 24 hrs for high severity</p>
        </div>

        <div className="rounded-2xl border border-[#1e2432] bg-[#111827] p-5">
          <span className="text-xs text-slate-400">Most Reported Issue</span>
          <div className="text-2xl font-bold text-white mt-2">Garbage Point</div>
          <p className="text-[11px] text-slate-500 mt-1">38% of all citizen reports</p>
        </div>

        <div className="rounded-2xl border border-[#1e2432] bg-[#111827] p-5">
          <span className="text-xs text-slate-400">Average PM2.5 Hotspot Duration</span>
          <div className="text-3xl font-extrabold text-amber-400 mt-2">3.4 hrs</div>
          <p className="text-[11px] text-slate-500 mt-1">Swargate & Hadapsar Wards</p>
        </div>
      </div>
    </div>
  )
}

export function DataSourcesPage() {
  return (
    <div className="h-full overflow-y-auto bg-[#0f1117] p-6 text-slate-100 space-y-6">
      <div className="border-b border-[#1e2432] pb-4">
        <span className="text-xs font-bold text-green-400 tracking-wider uppercase">DATA ARCHITECTURE</span>
        <h1 className="text-2xl font-bold text-white mt-1" style={{ fontFamily: "var(--font-display)" }}>
          Environmental Data Sources & Providers
        </h1>
      </div>

      <div className="space-y-4">
        <div className="p-5 rounded-2xl border border-[#1e2432] bg-[#111827] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-sm">CPCB Air Quality Serving Table</h3>
            <p className="text-xs text-slate-400 mt-1">Continuous ambient air quality monitoring station dataset (Pune archive table).</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-semibold border border-green-500/20">Active</span>
        </div>

        <div className="p-5 rounded-2xl border border-[#1e2432] bg-[#111827] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-sm">OpenStreetMap (OSM) Highway & Industrial Context</h3>
            <p className="text-xs text-slate-400 mt-1">Mapped road centerlines and industrial activity polygons context layers.</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold border border-blue-500/20">Loaded</span>
        </div>

        <div className="p-5 rounded-2xl border border-[#1e2432] bg-[#111827] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-sm">PMC Citizen & Spatial Contributions Store</h3>
            <p className="text-xs text-slate-400 mt-1">Real-time crowd-sourced civic reports and verified spatial GIS contributions.</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-semibold border border-purple-500/20">Real-time</span>
        </div>
      </div>
    </div>
  )
}

export function DepartmentsPage({ departments = [] }: { departments: any[] }) {
  const depts = departments.length ? departments : [
    { id: "dept_01", name: "Solid Waste Management", head: "Er. S. V. Kulkarni", active_complaints: 12, sla_hours: 24 },
    { id: "dept_02", name: "Roads & Infrastructure", head: "Er. M. K. Patil", active_complaints: 18, sla_hours: 48 },
    { id: "dept_03", name: "Environmental Cell", head: "Dr. R. N. Mehta", active_complaints: 7, sla_hours: 12 },
    { id: "dept_04", name: "Electrical & Streetlighting", head: "Er. A. P. Shinde", active_complaints: 5, sla_hours: 24 },
    { id: "dept_05", name: "Water Supply & Sewerage", head: "Er. G. B. Pawar", active_complaints: 14, sla_hours: 36 },
    { id: "dept_06", name: "Public Health & Sanitation", head: "Dr. S. T. More", active_complaints: 9, sla_hours: 12 },
  ]

  return (
    <div className="h-full overflow-y-auto bg-[#0f1117] p-6 text-slate-100 space-y-6">
      <div className="border-b border-[#1e2432] pb-4">
        <span className="text-xs font-bold text-blue-400 tracking-wider uppercase">PMC ADMINISTRATION</span>
        <h1 className="text-2xl font-bold text-white mt-1" style={{ fontFamily: "var(--font-display)" }}>
          Municipal Departments & SLA Management
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {depts.map((d: any) => (
          <div key={d.id || d.name} className="p-5 rounded-2xl border border-[#1e2432] bg-[#111827] space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">{d.name}</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold border border-blue-500/20">
                SLA: {d.sla_hours} hrs
              </span>
            </div>
            <p className="text-xs text-slate-400">Department Head: <strong className="text-white">{d.head}</strong></p>
            <div className="pt-2 border-t border-[#1e2432] flex items-center justify-between text-xs">
              <span className="text-slate-500">Active Complaints:</span>
              <strong className="text-amber-400 font-bold">{d.active_complaints}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AuditLogsPage({ logs = [] }: { logs: any[] }) {
  const auditList = logs.length ? logs : [
    { id: "log_101", actor: "Municipal Admin", action: "UPDATE_STATUS", target: "CIV-2026-1001", details: "Changed status to In Progress (Assigned: Solid Waste Management)", timestamp: "2026-09-28T09:00:00Z" },
    { id: "log_102", actor: "Municipal Officer", action: "VERIFY_SPATIAL", target: "SPC-2026-2001", details: "Approved spatial contribution: Construction Dust Control Buffer Zone", timestamp: "2026-09-27T09:00:00Z" },
    { id: "log_103", actor: "System", action: "CRITICAL_ALERT", target: "CIV-2026-1003", details: "High severity air pollution report flagged in Hadapsar Ward", timestamp: "2026-09-28T18:20:00Z" },
  ]

  return (
    <div className="h-full overflow-y-auto bg-[#0f1117] p-6 text-slate-100 space-y-6">
      <div className="border-b border-[#1e2432] pb-4">
        <span className="text-xs font-bold text-purple-400 tracking-wider uppercase">SYSTEM SECURITY</span>
        <h1 className="text-2xl font-bold text-white mt-1" style={{ fontFamily: "var(--font-display)" }}>
          Municipal Audit Trail Logs
        </h1>
      </div>

      <div className="rounded-2xl border border-[#1e2432] bg-[#111827] overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0d1117] text-slate-400 uppercase tracking-wider text-[10px] border-b border-[#1e2432]">
            <tr>
              <th className="p-4">Log ID</th>
              <th className="p-4">Actor</th>
              <th className="p-4">Action</th>
              <th className="p-4">Target ID</th>
              <th className="p-4">Details</th>
              <th className="p-4">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2432] text-slate-300">
            {auditList.map((log) => (
              <tr key={log.id} className="hover:bg-[#141e2e] transition">
                <td className="p-4 font-mono font-bold text-slate-400">{log.id}</td>
                <td className="p-4 font-semibold text-white">{log.actor}</td>
                <td className="p-4 font-mono text-purple-400">{log.action}</td>
                <td className="p-4 font-mono text-green-400">{log.target}</td>
                <td className="p-4 text-slate-300">{log.details}</td>
                <td className="p-4 text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ProfilePage({ role }: { role: Role }) {
  return (
    <div className="h-full overflow-y-auto bg-[#0f1117] p-6 text-slate-100 space-y-6">
      <div className="max-w-xl mx-auto rounded-2xl border border-[#1e2432] bg-[#111827] p-6 shadow-2xl space-y-6">
        <div className="flex items-center gap-4 border-b border-[#1e2432] pb-4">
          <div className="w-14 h-14 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center font-bold text-xl border border-green-500/30">
            {role === "citizen" ? "C" : "M"}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white capitalize">{role} User Account</h1>
            <p className="text-xs text-slate-400">Authenticated Role: <span className="font-mono text-green-400 uppercase">{role}</span></p>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-3 rounded-xl bg-[#0d1117] border border-[#1e2432] flex justify-between">
            <span className="text-slate-400">Username</span>
            <strong className="text-white">{role === "citizen" ? "citizen" : "municipal"}</strong>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1117] border border-[#1e2432] flex justify-between">
            <span className="text-slate-400">Access Scope</span>
            <strong className="text-green-400">{role === "citizen" ? "Public Citizen Portal" : "PMC Command & Review Board"}</strong>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1117] border border-[#1e2432] flex justify-between">
            <span className="text-slate-400">Session Status</span>
            <strong className="text-green-400">Active Authenticated Session</strong>
          </div>
        </div>
      </div>
    </div>
  )
}

export function NotificationsPage() {
  return (
    <div className="h-full overflow-y-auto bg-[#0f1117] p-6 text-slate-100 space-y-6">
      <div className="border-b border-[#1e2432] pb-4">
        <span className="text-xs font-bold text-green-400 tracking-wider uppercase">SYSTEM ALERTS</span>
        <h1 className="text-2xl font-bold text-white mt-1" style={{ fontFamily: "var(--font-display)" }}>
          Notifications & System Alerts
        </h1>
      </div>

      <div className="space-y-3">
        <div className="p-4 rounded-xl border border-[#1e2432] bg-[#111827] flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400 mt-1.5 shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-white">CPCB Network Status Normal</span>
            <p className="text-slate-400 mt-1">All 7 Continuous Ambient Air Quality Monitoring (CAAQM) stations in Pune are transmitting valid hourly observations.</p>
            <span className="text-[10px] text-slate-500 mt-1 block">10 mins ago</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[#1e2432] bg-[#111827] flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-white">Spatial Contribution Approved</span>
            <p className="text-slate-400 mt-1">Contribution #SPC-2026-2001 (JM Road Dust Buffer Zone) was verified and added to GIS map layer.</p>
            <span className="text-[10px] text-slate-500 mt-1 block">1 hour ago</span>
          </div>
        </div>
      </div>
    </div>
  )
}
