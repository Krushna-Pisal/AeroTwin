import { useEffect, useState } from "react"
import {
  createReport,
  createSpatialContribution,
  loadAuditLogs,
  loadDepartments,
  loadEnvironment,
  loadHistory,
  loadMap,
  loadReports,
  loadSpatialContributions,
  reviewSpatialContribution,
  updateReport,
} from "./api"
import { nowFormatted } from "./aqi"
import { Sidebar, type PageKey } from "./components/Sidebar"
import { Login, type Role } from "./components/Login"
import { ForecastPage } from "./components/ForecastPage"
import { SimulationPage } from "./components/SimulationPage"
import { HistoricalPage } from "./components/HistoricalPage"
import {
  AddSpatialContributionForm,
  CitizenDashboard,
  MyContributionsView,
  MyReportsView,
  ReportCivicIssueForm,
} from "./components/CitizenViews"
import {
  MunicipalDashboard,
  ReportsManagementView,
  SourceAttributionPage,
  SpatialReviewQueueView,
} from "./components/MunicipalViews"
import { GisMapView } from "./components/GisMapView"
import { MaharashtraMap } from "./components/MaharashtraMap"
import {
  AnalyticsPage,
  AuditLogsPage,
  DataSourcesPage,
  DepartmentsPage,
  NotificationsPage,
  ProfilePage,
} from "./components/ExtraPages"
import type { Environment, MapPayload } from "./types"

export function App() {
  // Authentication & Session
  const [role, setRole] = useState<Role | null>(() => {
    const saved = localStorage.getItem("aerotwin_role")
    return (saved === "citizen" || saved === "municipal") ? (saved as Role) : null
  })

  // Current active page
  const [page, setPage] = useState<PageKey>("maharashtra")

  // Core Data State
  const [mapData, setMapData] = useState<MapPayload | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [stationId, setStationId] = useState<string | null>("site_5409")
  const [environment, setEnvironment] = useState<Environment | null>(null)

  // Submissions State
  const [reports, setReports] = useState<any[]>([])
  const [spatialContributions, setSpatialContributions] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [now] = useState(nowFormatted())

  // Location Picking State for Forms
  const [pickLocation, setPickLocation] = useState<boolean>(false)
  const [pickedLocation, setPickedLocation] = useState<{ longitude: number; latitude: number } | null>(null)

  // Save session role
  function handleLogin(selectedRole: Role) {
    setRole(selectedRole)
    localStorage.setItem("aerotwin_role", selectedRole)
    setPage("maharashtra")
  }

  function handleLogout() {
    setRole(null)
    localStorage.removeItem("aerotwin_role")
    setPage("dashboard")
  }

  // Load backend map data on mount
  useEffect(() => {
    loadMap()
      .then(setMapData)
      .catch(() => setMapError("Map API unavailable. Start FastAPI on port 8000, then refresh."))
  }, [])

  // Load backend reports & spatial contributions
  useEffect(() => {
    loadReports().then(setReports).catch(console.error)
    loadSpatialContributions().then(setSpatialContributions).catch(console.error)
    loadDepartments().then(setDepartments).catch(console.error)
    loadAuditLogs().then(setAuditLogs).catch(console.error)
  }, [])

  // Load station detail
  useEffect(() => {
    if (!stationId) return
    Promise.all([loadEnvironment(stationId), loadHistory(stationId)])
      .then(([env]) => {
        setEnvironment(env)
      })
      .catch(() =>
        setMapError((prev) => prev ?? "Station data failed to load. Start FastAPI on port 8000, then refresh."),
      )
  }, [stationId])

  // Protect Municipal routes from Citizen users
  useEffect(() => {
    if (role === "citizen") {
      const municipalOnly: PageKey[] = [
        "reports-management",
        "spatial-contributions-review",
        "analytics",
        "departments",
        "audit-logs",
      ]
      if (municipalOnly.includes(page)) {
        setPage("dashboard")
      }
    }
  }, [role, page])

  // Handlers for Submissions
  async function handleCreateReport(payload: any) {
    const created = await createReport(payload)
    const refreshed = await loadReports()
    setReports(refreshed)
    loadMap().then(setMapData).catch(console.error)
    return created
  }

  async function handleUpdateReport(id: string, updates: any) {
    const updated = await updateReport(id, updates)
    const refreshed = await loadReports()
    setReports(refreshed)
    return updated
  }

  async function handleCreateSpatialContribution(payload: any) {
    const created = await createSpatialContribution(payload)
    const refreshed = await loadSpatialContributions()
    setSpatialContributions(refreshed)
    loadMap().then(setMapData).catch(console.error)
    return created
  }

  async function handleReviewSpatialContribution(id: string, action: string, remarks?: string, rejection_reason?: string) {
    const res = await reviewSpatialContribution(id, action, remarks, rejection_reason)
    const refreshed = await loadSpatialContributions()
    setSpatialContributions(refreshed)
    loadMap().then(setMapData).catch(console.error)
    return res
  }

  // Handle map click location pick
  function handlePickLocationOnMap(longitude: number, latitude: number) {
    setPickedLocation({ longitude, latitude })
    setPickLocation(false)
  }

  // If not logged in, render Login Gate
  if (!role) {
    return <Login onEnter={handleLogin} />
  }

  const pendingReportsCount = reports.filter((r) => r.status === "Submitted" || r.status === "Under Review").length
  const pendingSpatialCount = spatialContributions.filter((s) => s.status === "Pending Verification").length

  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-100" style={{ background: "#0f1117" }}>
      {/* Sidebar */}
      <Sidebar
        role={role}
        page={page}
        onPage={setPage}
        onLogout={handleLogout}
        pendingReportsCount={pendingReportsCount}
        pendingSpatialCount={pendingSpatialCount}
      />

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header
          className="flex shrink-0 items-center justify-between gap-4 px-6 border-b border-[#1e2432]"
          style={{ height: "60px", background: "#0d1117" }}
        >
          {/* Status Title / Quick Path */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-green-400">
              {role === "citizen" ? "Citizen Portal" : "Municipal Corporation"}
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-semibold text-slate-200 capitalize">{page.replace("-", " ")}</span>
          </div>

          {/* Right Header Info */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-green-400 live-dot" />
              <span className="text-xs font-semibold text-green-400">Live Network</span>
            </div>
            <p className="text-xs text-slate-400 font-mono">{now}</p>

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg border border-[#1e2432] bg-[#111827] text-xs font-medium text-slate-300 hover:text-white transition"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Error Banner */}
        {mapError && (
          <div className="shrink-0 flex items-center justify-between px-6 py-2 text-xs bg-red-950 text-red-300 border-b border-red-900">
            <span>{mapError}</span>
            <button onClick={() => setMapError(null)} className="font-bold">&times;</button>
          </div>
        )}

        {/* Page Views Router */}
        <main className="min-h-0 flex-1 overflow-hidden">
          {/* COMMON & GIS MAP PAGES */}
          {page === "maharashtra" && <MaharashtraMap />}
          {page === "gis-map" && (
            <GisMapView
              mapData={mapData}
              environment={environment}
              reports={reports}
              spatialContributions={spatialContributions}
              onSelectStation={(id) => setStationId(id)}
              onPickLocation={handlePickLocationOnMap}
              pickLocation={pickLocation}
              pickedLocation={pickedLocation}
            />
          )}

          {/* CITIZEN SPECIFIC PAGES */}
          {role === "citizen" && (
            <>
              {page === "dashboard" && (
                <CitizenDashboard
                  environment={environment}
                  reports={reports}
                  spatialContributions={spatialContributions}
                  onNavigate={setPage}
                />
              )}
              {page === "report-issue" && (
                <ReportCivicIssueForm
                  onSubmitReport={handleCreateReport}
                  onPickMapLocation={() => {
                    setPickLocation(true)
                    setPage("gis-map")
                  }}
                  pickedLocation={pickedLocation}
                  onCancel={() => setPage("my-reports")}
                />
              )}
              {page === "my-reports" && (
                <MyReportsView reports={reports} />
              )}
              {page === "spatial-contributions" && (
                <AddSpatialContributionForm
                  onSubmitContribution={handleCreateSpatialContribution}
                  onPickMapLocation={() => {
                    setPickLocation(true)
                    setPage("gis-map")
                  }}
                  pickedLocation={pickedLocation}
                  onCancel={() => setPage("my-contributions")}
                />
              )}
              {page === "my-contributions" && (
                <MyContributionsView spatialContributions={spatialContributions} />
              )}
            </>
          )}

          {/* MUNICIPAL SPECIFIC PAGES */}
          {role === "municipal" && (
            <>
              {page === "dashboard" && (
                <MunicipalDashboard
                  environment={environment}
                  reports={reports}
                  spatialContributions={spatialContributions}
                  departments={departments}
                  onNavigate={setPage}
                />
              )}
              {page === "reports-management" && (
                <ReportsManagementView
                  reports={reports}
                  departments={departments}
                  onUpdateReport={handleUpdateReport}
                />
              )}
              {page === "spatial-contributions-review" && (
                <SpatialReviewQueueView
                  spatialContributions={spatialContributions}
                  onReviewContribution={handleReviewSpatialContribution}
                />
              )}
              {page === "source-attribution" && (
                <SourceAttributionPage environment={environment} />
              )}
            </>
          )}

          {/* AUXILIARY & SHARED PAGES */}
          {page === "analytics" && <AnalyticsPage />}
          {page === "data-sources" && <DataSourcesPage />}
          {page === "departments" && <DepartmentsPage departments={departments} />}
          {page === "audit-logs" && <AuditLogsPage logs={auditLogs} />}
          {page === "profile" && <ProfilePage role={role} />}
          {page === "notifications" && <NotificationsPage />}
          {page === "forecast" && <ForecastPage />}
          {page === "simulation" && <SimulationPage />}
          {page === "historical" && <HistoricalPage />}
        </main>
      </div>
    </div>
  )
}
