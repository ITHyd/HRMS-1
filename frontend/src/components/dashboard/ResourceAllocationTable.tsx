import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Pagination } from "@/components/shared/Pagination"
import { useOrgChartStore } from "@/store/orgChartStore"
import { useNotificationStore } from "@/store/notificationStore"
import type { ResourceAllocationEntry } from "@/types/dashboard"

interface ResourceAllocationTableProps {
  entries: ResourceAllocationEntry[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
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

  const longBenchMap = new Map(
    summary?.details.bench_long.map((e) => [e.employee_id, e]) ?? []
  )

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
                <th className="pb-2 pr-4 font-medium">Name</th>
                <th className="pb-2 pr-4 font-medium">Line Manager</th>
                <th className="pb-2 pr-4 font-medium">Project</th>
                <th className="pb-2 pr-4 font-medium">Client</th>
                <th className="pb-2 pr-4 font-medium text-right">Allocation %</th>
                <th className="pb-2 pr-4 font-medium text-right">Billable Hrs</th>
                <th className="pb-2 pr-4 font-medium text-right">Non-Billable Hrs</th>
                <th className="pb-2 pr-4 font-medium">Classification</th>
                <th className="pb-2 font-medium text-right">Available Days</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No resource allocation data found for this period
                  </td>
                </tr>
              ) : (
                entries.map((entry, idx) => (
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
