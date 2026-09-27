import type { CategoryRow, DataStatus } from "./types"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function pm25(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "Not available"
  return `${value.toFixed(1)} µg/m³`
}

export function publishedTime(iso: string | null | undefined): string {
  if (!iso) return "Not available"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const day = date.getUTCDate()
  const hour = String(date.getUTCHours()).padStart(2, "0")
  const minute = String(date.getUTCMinutes()).padStart(2, "0")
  return `${day} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${hour}:${minute} published +0000`
}

export function statusLabel(status: DataStatus | string | null | undefined): string {
  switch (status) {
    case "OBSERVED":
      return "OBSERVED"
    case "MODELED":
      return "MODELED"
    case "PROXY":
      return "PROXY"
    case "CITIZEN_REPORTED":
      return "CITIZEN REPORTED"
    case "SCENARIO":
      return "SCENARIO"
    default:
      return "DATA UNAVAILABLE"
  }
}

const CATEGORY: Record<string, string> = {
  TRAFFIC: "Traffic",
  INDUSTRIAL: "Industrial activity",
  DUST_CONSTRUCTION: "Dust and construction",
}

export function evidenceSentence(categories: CategoryRow[]): string {
  const scored = categories.filter((row) => row.score != null)
  if (scored.length === 0) {
    return "No map evidence is available here for traffic, industry, or dust. No share of the measured PM2.5 is estimated."
  }
  if (scored.length === 1) {
    const name = CATEGORY[scored[0].category] ?? scored[0].category
    return `${name} has supporting map evidence near this station. The other categories have no loaded record, so this is not a share of the pollution.`
  }
  const ranked = [...scored].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const first = CATEGORY[ranked[0].category] ?? ranked[0].category
  const second = CATEGORY[ranked[1].category] ?? ranked[1].category
  return `${first} has stronger supporting evidence near this station than ${second}. These are evidence scores, not a split of the measured PM2.5.`
}

export function interventionLabel(name: string): string {
  switch (name) {
    case "traffic_restriction":
      return "Traffic restriction"
    case "industrial_control":
      return "Industrial control"
    case "dust_construction_control":
      return "Dust / construction control"
    default:
      return name
  }
}

export function whyHigh(hotspot: boolean | null, categories: CategoryRow[]): string {
  const place = hotspot
    ? "This station is a hotspot: the latest hour and the recent 24-hour average are both elevated compared with other stations. That describes the measurement. It does not name a cause."
    : hotspot === false
      ? "This station is not a hotspot on the current hour. The number is the measured concentration at the monitor."
      : "Hotspot status is not available for this station."
  return `${place} ${evidenceSentence(categories)}`
}
