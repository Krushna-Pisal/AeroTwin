import type { DataStatus } from "../types"
import { statusLabel } from "../format"

const TONE: Record<string, string> = {
  OBSERVED: "bg-[#f3e0d4] text-[#7c2d12]",
  MODELED: "bg-[#dbe7f5] text-[#1e3a5f]",
  PROXY: "bg-[#e5ecd6] text-[#3f4f2a]",
  CITIZEN_REPORTED: "bg-[#f8e1e6] text-[#9f1239]",
  SCENARIO: "bg-[#ece4f8] text-[#5b21b6]",
  DATA_UNAVAILABLE: "border border-dashed border-[#a8a29e] bg-transparent text-[#57534e]",
}

export function StatusBadge({ status, text }: { status: DataStatus | string | null | undefined; text?: string }) {
  const key = status && status in TONE ? status : "DATA_UNAVAILABLE"
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-[0.08em] ${TONE[key]}`}>
      {text ?? statusLabel(status)}
    </span>
  )
}
