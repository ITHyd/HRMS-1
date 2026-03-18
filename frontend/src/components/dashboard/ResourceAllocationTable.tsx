import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Pagination } from "@/components/shared/Pagination"
import { useOrgChartStore } from "@/store/orgChartStore"
import { useNotificationStore } from "@/store/notificationStore"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import type { ResourceAllocationEntry } from "@/types/dashboard"

interface ResourceAllocationTableProps {
  entries: ResourceAllocationEntry[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
}

type SortKey = "employee_name" | "line_manager" | "project_name" | "client_name" | "allocation_percentage" | "billable_hours" | "non_billable_hours" | "classification" | "available_days"
type SortDir = "asc" | "desc"

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey | null; sortDir: SortDir }) {
  if (sortKey !== col) return <ChevronsUpDown className="inline h-3 w-3 ml-1 opacity-30" />
  return sortDir === "asc"
    ? <ChevronUp className="inline h-3 w-3 ml-1 opacity-80" />
    : <ChevronDown className="inline h-3 w-3 ml-1 opacity-80" />
}

export function ResourceAllocationTable({
  entries,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: ResourceAllocationTableProps) {
  const selectEmployee = useOrgChartStore((s) => s.selectEmployee)
  const summary = useNotificationStore((s) => s.summary)
  const dismissed = useNotificationStore((s) => s.dismissed)
  const dismiss = useNotificationStore((s) => s.dismiss)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; empId: string } | null>(null)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const longBenchMap = useMemo(
    () => new Map(summary?.details.bench_long.map((e) => [e.employee_id, e]) ?? []),
    [summary]
  )

  function handleSort(col: SortKey) {
    if (sortKey === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(col)
      setSortDir("asc")
    }
  }

  const sorted = sortKey
    ? [...entries].sort((a, b) => {
        const av = a[sortKey] ?? ""
        const bv = b[sortKey] ?? ""
        const cmp = typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv))
        return sortDir === "asc" ? cmp : -cmp
      })
    : entries

  function thClass(align?: "right") {
    return `pb-2 pr-4 font-medium cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap${align === "right" ? " text-right" : ""}`
  }

  return (
    <>
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Resource Allocations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className={thClass()} onClick={() => handleSort("employee_name")}>
                  Name <SortIcon col="employee_name" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className={thClass()} onClick={() => handleSort("line_manager")}>
                  Line Manager <SortIcon col="line_manager" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className={thClass()} onClick={() => handleSort("project_name")}>
                  Project <SortIcon col="project_name" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className={thClass()} onClick={() => handleSort("client_name")}>
                  Client <SortIcon col="client_name" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className={thClass("right")} onClick={() => handleSort("allocation_percentage")}>
                  Allocation % <SortIcon col="allocation_percentage" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className={thClass("right")} onClick={() => handleSort("billable_hours")}>
                  Billable Hrs <SortIcon col="billable_hours" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className={thClass("right")} onClick={() => handleSort("non_billable_hours")}>
                  Non-Billable Hrs <SortIcon col="non_billable_hours" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className={thClass()} onClick={() => handleSort("classification")}>
                  Classification <SortIcon col="classification" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className={`pb-2 font-medium cursor-pointer select-none hover:text-foreground transition-colors text-right whitespace-nowrap`} onClick={() => handleSort("available_days")}>
                  Available Days <SortIcon col="available_days" sortKey={sortKey} sortDir={sortDir} />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No resource allocation data found for this period
                  </td>
                </tr>
              ) : (
                sorted.map((entry, idx) => (
                  <tr
                    key={`${entry.employee_id}-${entry.project_name ?? "bench"}-${idx}`}
                    onClick={() => selectEmployee(entry.employee_id)}
                    className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-foreground group-hover:underline">
                          {entry.employee_name}
                        </span>
                        {(() => {
                          const info = longBenchMap.get(entry.employee_id)
                          if (!info || dismissed.has(`bench_long:${entry.employee_id}`)) return null
                          return (
                            <span
                              title={`Benched ${info.bench_days}+ days · Right-click to dismiss`}
                              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, empId: entry.employee_id }) }}
                              className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 cursor-context-menu select-none"
                            >
                              ⚠ Long bench
                            </span>
                          )
                        })()}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {entry.line_manager || "No Manager"}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {entry.project_name || "-"}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {entry.client_name || "-"}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {entry.allocation_percentage > 0 ? (
                        <span
                          className={
                            entry.allocation_percentage >= 80
                              ? "text-green-600 font-medium"
                              : entry.allocation_percentage >= 40
                              ? "text-amber-600 font-medium"
                              : "text-red-600 font-medium"
                          }
                        >
                          {entry.allocation_percentage.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {entry.billable_hours > 0 ? entry.billable_hours.toFixed(1) : "-"}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {entry.non_billable_hours > 0 ? entry.non_billable_hours.toFixed(1) : "-"}
                    </td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge status={entry.classification} />
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {entry.available_days.toFixed(1)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </CardContent>
    </Card>

    {ctxMenu && (
      <div
        className="fixed z-[200] rounded-md border bg-popover shadow-md py-1 min-w-[90px]"
        style={{ left: ctxMenu.x, top: ctxMenu.y }}
        onMouseLeave={() => setCtxMenu(null)}
      >
        <button
          onClick={() => { dismiss("bench_long", ctxMenu.empId); setCtxMenu(null) }}
          className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted transition-colors cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    )}
  </>
  )
}
