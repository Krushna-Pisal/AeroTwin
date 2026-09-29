import type { Role } from "./Login"

export type PageKey =
  | "maharashtra"
  | "dashboard"
  | "gis-map"
  | "report-issue"
  | "my-reports"
  | "spatial-contributions"
  | "my-contributions"
  | "notifications"
  | "profile"
  | "reports-management"
  | "spatial-contributions-review"
  | "analytics"
  | "data-sources"
  | "source-attribution"
  | "map-layers"
  | "departments"
  | "audit-logs"
  | "forecast"
  | "simulation"
  | "historical"

type Props = {
  role: Role
  page: PageKey
  onPage: (p: PageKey) => void
  onLogout: () => void
  pendingReportsCount?: number
  pendingSpatialCount?: number
}

interface NavItem {
  key: PageKey
  label: string
  icon: string
  badge?: number
}

const MAHARASHTRA_ITEM: NavItem = {
  key: "maharashtra",
  label: "Maharashtra Map",
  icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
}

const CITIZEN_NAV: NavItem[] = [
  MAHARASHTRA_ITEM,
  { key: "dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { key: "gis-map", label: "GIS Map", icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" },
  { key: "report-issue", label: "Report Civic Issue", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
  { key: "my-reports", label: "My Reports", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { key: "spatial-contributions", label: "Add Spatial Contribution", icon: "M12 4v16m8-8H4" },
  { key: "my-contributions", label: "My Contributions", icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" },
  { key: "notifications", label: "Notifications", icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
  { key: "profile", label: "Profile", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
]

const MUNICIPAL_NAV: NavItem[] = [
  MAHARASHTRA_ITEM,
  { key: "dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { key: "gis-map", label: "GIS Map", icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" },
  { key: "reports-management", label: "Citizen Reports", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { key: "spatial-contributions-review", label: "Review Queue", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "source-attribution", label: "Source Attribution", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { key: "analytics", label: "Analytics", icon: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" },
  { key: "data-sources", label: "Data Sources", icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" },
  { key: "departments", label: "Departments", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h6M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { key: "audit-logs", label: "Audit Logs", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "profile", label: "Profile", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
]

export function Sidebar({ role, page, onPage, onLogout, pendingReportsCount = 0, pendingSpatialCount = 0 }: Props) {
  const items = role === "citizen" ? CITIZEN_NAV : MUNICIPAL_NAV

  return (
    <aside
      className="flex h-full flex-col shrink-0"
      style={{ background: "#0d1117", borderRight: "1px solid #1e2432", width: "var(--sidebar-w, 240px)" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid #1e2432" }}>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-md"
          style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold leading-none text-white" style={{ fontFamily: "var(--font-display)" }}>AERIS</p>
          <p className="mt-1 text-[10px] leading-none text-slate-400">Urban Digital Twin</p>
        </div>
      </div>

      {/* User Role Badge */}
      <div className="px-4 py-2.5 bg-[#111827] border-b border-[#1e2432] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${role === "citizen" ? "bg-green-400" : "bg-purple-400"}`} />
          <span className="text-xs font-semibold text-slate-200 capitalize">
            {role === "citizen" ? "Citizen Portal" : "Municipal Corp"}
          </span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e2432] text-slate-300 font-mono">
          {role === "citizen" ? "USER" : "PMC_ADMIN"}
        </span>
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-1">
          {items.map(({ key, label, icon }) => {
            const active = page === key
            let badge = 0
            if (key === "reports-management") badge = pendingReportsCount
            if (key === "spatial-contributions-review") badge = pendingSpatialCount

            return (
              <li key={key}>
                <button
                  type="button"
                  id={`nav-${key}`}
                  onClick={() => onPage(key)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-all duration-150"
                  style={{
                    background: active ? "rgba(34,197,94,0.12)" : "transparent",
                    color: active ? "#22c55e" : "#9ca3af",
                    borderLeft: active ? "3px solid #22c55e" : "3px solid transparent",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className="h-4 w-4 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      viewBox="0 0 24 24"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={icon} />
                    </svg>
                    <span>{label}</span>
                  </div>
                  {badge > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {badge}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer & Logout */}
      <div className="p-3 border-t border-[#1e2432] space-y-2">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition"
        >
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout Session
        </button>
        <div className="flex items-center gap-2 px-1">
          <div className="h-1.5 w-1.5 rounded-full bg-green-400 live-dot" />
          <p className="text-[11px] text-slate-500">PMC Live Node · Swargate</p>
        </div>
      </div>
    </aside>
  )
}
