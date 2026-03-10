import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getWorkloadHeatmap } from "@/api/timesheets"
import type {
  WorkloadHeatmapResponse,
  HeatmapDateMeta,
  HeatmapDayCell,
  HeatmapEmployeeRow,
} from "@/types/timesheet"
import { Users, Clock, DollarSign, Percent, Search } from "lucide-react"

interface WorkloadHeatmapProps {
  period: string
}

/* ------------------------------------------------------------------ */
/*  Color helpers                                                      */
/* ------------------------------------------------------------------ */

function getCellStyle(hours: number | null, isOff: boolean): React.CSSProperties {
  // Weekend / holiday with no work
  if (isOff && (hours === null || hours === 0))
    return { backgroundColor: "#f8f9fa", border: "1px solid #f1f3f5" }

  // Worked on off-day
  if (isOff && hours !== null && hours > 0)
    return { backgroundColor: "#fff3e0", border: "1px solid #ffe0b2" }

  if (hours === null || hours === 0)
    return { backgroundColor: "#fff0f0", border: "1px solid #fecaca" }
  if (hours < 4)
    return { backgroundColor: "#fef3c7", border: "1px solid #fde68a" }
  if (hours < 6)
    return { backgroundColor: "#d9f99d", border: "1px solid #bef264" }
  if (hours < 8)
    return { backgroundColor: "#86efac", border: "1px solid #4ade80" }
  if (hours <= 9)
    return { backgroundColor: "#34d399", border: "1px solid #10b981" }
  if (hours <= 10)
    return { backgroundColor: "#059669", border: "1px solid #047857" }
  // Overwork
  return { backgroundColor: "#ef4444", border: "1px solid #dc2626" }
}

function getAvgColor(avg: number): string {
  if (avg === 0) return "text-red-500"
  if (avg < 4) return "text-amber-600"
  if (avg < 7) return "text-yellow-600"
  if (avg < 9) return "text-emerald-600"
  return "text-red-500"
}

/* ------------------------------------------------------------------ */
/*  Tooltip                                                            */
/* ------------------------------------------------------------------ */

function TooltipPopover({
  cell,
  dateMeta,
  employeeName,
  x,
  y,
  containerWidth,
}: {
  cell: HeatmapDayCell | null
  dateMeta: HeatmapDateMeta
  employeeName: string
  x: number
  y: number
  containerWidth: number
}) {
  const flipped = x > containerWidth - 240
  return (
    <div
      className="absolute z-50 pointer-events-none"
      style={{
        left: flipped ? x - 220 : x + 16,
        top: Math.max(y - 60, 8),
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-[210px] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-3 py-2 border-b border-gray-100">
          <p className="text-[11px] font-semibold text-gray-900 truncate">{employeeName}</p>
          <p className="text-[10px] text-gray-500">
            {dateMeta.weekday}, {dateMeta.day} {new Date(dateMeta.date).toLocaleDateString("en-US", { month: "short" })}
            {dateMeta.is_holiday && (
              <span className="ml-1 text-amber-600 font-medium">- {dateMeta.holiday_name}</span>
            )}
            {dateMeta.is_weekend && <span className="ml-1 text-gray-400">- Weekend</span>}
          </p>
        </div>
        {/* Body */}
        <div className="px-3 py-2 space-y-1.5">
          {cell ? (
            <>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-500 uppercase tracking-wide">Hours</span>
                <span className="text-sm font-bold text-gray-900 tabular-nums">{cell.hours}h</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-500 uppercase tracking-wide">Billable</span>
                <span className="text-sm font-semibold text-emerald-600 tabular-nums">{cell.billable_hours}h</span>
              </div>
              {Object.keys(cell.projects).length > 0 && (
                <div className="pt-1.5 mt-1 border-t border-gray-100 space-y-1">
                  {Object.entries(cell.projects).map(([name, hrs]) => (
                    <div key={name} className="flex justify-between items-center gap-2">
                      <span className="text-[10px] text-gray-600 truncate">{name}</span>
                      <span className="text-[10px] font-semibold text-gray-700 tabular-nums shrink-0">{hrs}h</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-[11px] text-gray-400 italic py-1">No hours logged</p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  iconBg,
  iconColor,
}: {
  icon: typeof Users
  label: string
  value: string | number
  sub?: string
  iconBg: string
  iconColor: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-white px-4 py-3">
      <div className={`rounded-lg p-2.5 ${iconBg}`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div>
        <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-gray-900 tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend                                                              */
/* ------------------------------------------------------------------ */

function Legend() {
  const items = [
    { style: { backgroundColor: "#fff0f0", border: "1px solid #fecaca" }, label: "0h" },
    { style: { backgroundColor: "#fef3c7", border: "1px solid #fde68a" }, label: "<4h" },
    { style: { backgroundColor: "#d9f99d", border: "1px solid #bef264" }, label: "4-6h" },
    { style: { backgroundColor: "#86efac", border: "1px solid #4ade80" }, label: "6-8h" },
    { style: { backgroundColor: "#34d399", border: "1px solid #10b981" }, label: "8-9h" },
    { style: { backgroundColor: "#059669", border: "1px solid #047857" }, label: "9-10h" },
    { style: { backgroundColor: "#ef4444", border: "1px solid #dc2626" }, label: ">10h" },
  ]
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-gray-400 mr-1">Less</span>
      {items.map((item) => (
        <div
          key={item.label}
          className="w-4 h-4 rounded-[3px] cursor-default"
          style={item.style}
          title={item.label}
        />
      ))}
      <span className="text-[10px] text-gray-400 ml-1">More</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function WorkloadHeatmap({ period }: WorkloadHeatmapProps) {
  const [data, setData] = useState<WorkloadHeatmapResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [tooltip, setTooltip] = useState<{
    cell: HeatmapDayCell | null
    dateMeta: HeatmapDateMeta
    employeeName: string
    x: number
    y: number
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getWorkloadHeatmap(period)
      setData(result)
    } catch (err) {
      setError("Failed to load heatmap data")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter employees by search
  const filtered = useMemo(() => {
    if (!data) return []
    if (!search.trim()) return data.employees
    const q = search.toLowerCase()
    return data.employees.filter((e) => e.employee_name.toLowerCase().includes(q))
  }, [data, search])

  const handleCellHover = (
    e: React.MouseEvent,
    cell: HeatmapDayCell | null,
    dateMeta: HeatmapDateMeta,
    employeeName: string
  ) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip({
      cell,
      dateMeta,
      employeeName,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  const handleCellLeave = () => setTooltip(null)

  // Compute working-day average per employee
  const workingDaysCount = useMemo(() => {
    if (!data) return 0
    return data.dates.filter((d) => !d.is_weekend && !d.is_holiday).length
  }, [data])

  const getAvg = (emp: HeatmapEmployeeRow) =>
    workingDaysCount > 0 ? Math.round((emp.total_hours / workingDaysCount) * 10) / 10 : 0

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="animate-spin h-7 w-7 rounded-full border-[3px] border-emerald-500 border-t-transparent" />
        <p className="text-xs text-gray-500">Loading heatmap...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border-2 border-dashed border-red-200 bg-red-50/50 p-8 text-center">
        <p className="text-sm text-red-600 font-medium">{error}</p>
        <button
          onClick={fetchData}
          className="mt-3 px-4 py-1.5 text-xs font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (!data || data.employees.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
        <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <p className="text-sm font-medium text-gray-600">No timesheet data</p>
        <p className="text-xs text-gray-400 mt-1">
          No entries found for this period. Sync from HRMS first.
        </p>
      </div>
    )
  }

  const { dates, summary } = data
  const billablePercent = summary.total_hours > 0
    ? Math.round((summary.billable_hours / summary.total_hours) * 1000) / 10
    : 0

  return (
    <div className="space-y-5">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Users}
          label="Employees"
          value={summary.total_employees}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
        />
        <StatCard
          icon={Clock}
          label="Total Hours"
          value={summary.total_hours.toLocaleString()}
          sub={`${workingDaysCount} working days`}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          icon={DollarSign}
          label="Billable Hours"
          value={summary.billable_hours.toLocaleString()}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          icon={Percent}
          label="Billable Rate"
          value={`${billablePercent}%`}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>

      {/* Toolbar: Search + Legend */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search employee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-56 rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
          />
        </div>
        <Legend />
      </div>

      {/* Heatmap Grid */}
      <div className="relative rounded-xl border border-gray-200 bg-white shadow-sm" ref={containerRef}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: dates.length * 30 + 240 }}>
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-gray-50 px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider min-w-[180px] border-b border-r border-gray-100">
                  Employee
                </th>
                {dates.map((d) => {
                  const isOff = d.is_weekend || d.is_holiday
                  return (
                    <th
                      key={d.date}
                      className={`px-0 py-2 text-center border-b border-gray-100 min-w-[30px] ${
                        isOff ? "bg-gray-50/80" : "bg-gray-50"
                      }`}
                    >
                      <div className={`text-[9px] leading-none font-medium ${isOff ? "text-gray-300" : "text-gray-400"}`}>
                        {d.weekday.slice(0, 2)}
                      </div>
                      <div className={`text-[11px] leading-none mt-0.5 font-bold ${isOff ? "text-gray-300" : "text-gray-600"}`}>
                        {d.day}
                      </div>
                    </th>
                  )
                })}
                <th className="sticky right-0 z-20 bg-gray-50 px-3 py-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider min-w-[52px] border-b border-l border-gray-100">
                  Avg
                </th>
                <th className="sticky z-20 bg-gray-50 px-3 py-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider min-w-[56px] border-b border-gray-100"
                  style={{ right: 52 }}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp, idx) => {
                const avg = getAvg(emp)
                return (
                  <tr
                    key={emp.employee_id}
                    className="group transition-colors hover:bg-gray-50/60"
                  >
                    <td className={`sticky left-0 z-10 px-4 py-[7px] text-[12px] font-medium text-gray-700 truncate max-w-[180px] border-r border-gray-100 ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                    } group-hover:bg-gray-50/60`}>
                      {emp.employee_name}
                    </td>
                    {dates.map((d) => {
                      const cell = emp.days[d.date]
                      const hours = cell?.hours ?? null
                      const isOff = d.is_weekend || d.is_holiday
                      return (
                        <td
                          key={d.date}
                          className="px-[2px] py-[3px] text-center"
                          onMouseEnter={(e) => handleCellHover(e, cell, d, emp.employee_name)}
                          onMouseMove={(e) => handleCellHover(e, cell, d, emp.employee_name)}
                          onMouseLeave={handleCellLeave}
                        >
                          <div
                            className="mx-auto w-[26px] h-[26px] rounded-[4px] transition-transform hover:scale-125 hover:z-10 hover:shadow-md cursor-default"
                            style={getCellStyle(hours, isOff)}
                          />
                        </td>
                      )
                    })}
                    <td className={`sticky z-10 px-3 py-[7px] text-center text-[11px] font-bold tabular-nums border-l border-gray-100 ${getAvgColor(avg)} ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                    } group-hover:bg-gray-50/60`}
                      style={{ right: 52 }}
                    >
                      {avg}h
                    </td>
                    <td className={`sticky right-0 z-10 px-3 py-[7px] text-right text-[11px] font-bold text-gray-800 tabular-nums border-gray-100 ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                    } group-hover:bg-gray-50/60`}>
                      {emp.total_hours}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Empty search state */}
        {filtered.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400">No employees match &quot;{search}&quot;</p>
          </div>
        )}

        {/* Floating Tooltip */}
        {tooltip && (
          <TooltipPopover
            cell={tooltip.cell}
            dateMeta={tooltip.dateMeta}
            employeeName={tooltip.employeeName}
            x={tooltip.x}
            y={tooltip.y}
            containerWidth={containerRef.current?.clientWidth ?? 800}
          />
        )}
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-between text-[10px] text-gray-400">
        <span>{filtered.length} of {data.employees.length} employees shown</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: "#f8f9fa", border: "1px solid #f1f3f5" }} />
            Weekend / Holiday
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: "#fff3e0", border: "1px solid #ffe0b2" }} />
            Off-day worked
          </span>
        </div>
      </div>
    </div>
  )
}
