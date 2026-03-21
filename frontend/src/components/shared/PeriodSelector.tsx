import { ChevronLeft, ChevronRight } from "lucide-react"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export const MAX_PERIOD = "2026-02"

export function getCurrentPeriod(): string {
  const now = new Date()
  const p = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  return p > MAX_PERIOD ? MAX_PERIOD : p
}

interface PeriodSelectorProps {
  value: string // YYYY-MM
  onChange: (period: string) => void
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const [year, month] = value.split("-").map(Number)

  const prev = () => {
    const d = new Date(year, month - 2, 1)
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }

  const next = () => {
    const d = new Date(year, month, 1)
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (next <= MAX_PERIOD) onChange(next)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={prev}
        className="cursor-pointer rounded-md border p-1.5 hover:bg-accent transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[140px] text-center text-sm font-medium">
        {MONTHS[month - 1]} {year}
      </span>
      <button
        onClick={next}
        disabled={value >= MAX_PERIOD}
        className="cursor-pointer rounded-md border p-1.5 hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
