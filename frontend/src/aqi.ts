/** AQI helpers – PM2.5 μg/m³ thresholds (India NAQI) */

export type AqiLevel = "Good" | "Moderate" | "Sensitive" | "Unhealthy" | "Very Unhealthy" | "Hazardous" | "N/A"

export interface AqiInfo {
  level: AqiLevel
  color: string
  bg: string
  text: string
}

export function getAqiInfo(pm25: number | null | undefined): AqiInfo {
  if (pm25 == null || Number.isNaN(pm25)) {
    return { level: "N/A", color: "#6b7280", bg: "rgba(107,114,128,0.15)", text: "#9ca3af" }
  }
  if (pm25 <= 30)  return { level: "Good",          color: "#22c55e", bg: "rgba(34,197,94,0.15)",   text: "#4ade80" }
  if (pm25 <= 60)  return { level: "Moderate",       color: "#eab308", bg: "rgba(234,179,8,0.15)",   text: "#facc15" }
  if (pm25 <= 90)  return { level: "Sensitive",      color: "#f97316", bg: "rgba(249,115,22,0.15)",  text: "#fb923c" }
  if (pm25 <= 120) return { level: "Unhealthy",      color: "#ef4444", bg: "rgba(239,68,68,0.15)",   text: "#f87171" }
  if (pm25 <= 250) return { level: "Very Unhealthy", color: "#a855f7", bg: "rgba(168,85,247,0.15)",  text: "#c084fc" }
  return                   { level: "Hazardous",     color: "#7f1d1d", bg: "rgba(127,29,29,0.25)",   text: "#fca5a5" }
}

export function fmt(value: number | null | undefined, unit = "μg/m³", digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—"
  return `${value.toFixed(digits)} ${unit}`
}

export function fmtInt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—"
  return Math.round(value).toString()
}

export function shortTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
}

export function nowFormatted(): string {
  return new Date().toLocaleDateString("en-IN", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  })
}
