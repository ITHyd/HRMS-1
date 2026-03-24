import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Pagination } from "@/components/shared/Pagination"
import { useOrgChartStore } from "@/store/orgChartStore"
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react"
import type { ResourceAllocationEntry } from "@/types/dashboard"

interface ResourceAllocationTableProps {
  entries: ResourceAllocationEntry[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
}

type SortKey =
  | "employee_name"
  | "line_manager"
  | "project_name"
  | "client_name"
  | "allocation_percentage"
  | "billable_hours"
  | "non_billable_hours"
  | "classification"
  | "available_days"

type SortDir = "asc" | "desc"

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey | null; sortDir: SortDir }) {
  if (sortKey !== col) return <ChevronsUpDown className="ml-1 inline h-3 w-3 opacity-30" />
  return sortDir === "asc"
    ? <ChevronUp className="ml-1 inline h-3 w-3 opacity-80" />
    : <ChevronDown className="ml-1 inline h-3 w-3 opacity-80" />
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
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  function handleSort(col: SortKey) {
    if (sortKey === col) {
      setSortDir((direction) => (direction === "asc" ? "desc" : "asc"))
      return
    }
    setSortKey(col)
    setSortDir("asc")
  }

  const sorted = sortKey
    ? [...entries].sort((a, b) => {
        const av = a[sortKey] ?? ""
        const bv = b[sortKey] ?? ""
        const comparison =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv))
        return sortDir === "asc" ? comparison : -comparison
      })
    : entries

  const employeeGroupMeta = useMemo(() => {
    const meta = new Map<number, { rowSpan: number; projectCount: number }>()
    let index = 0
    while (index < sorted.length) {
      const employeeId = sorted[index].employee_id
      let nextIndex = index + 1
      while (nextIndex < sorted.length && sorted[nextIndex].employee_id === employeeId) {
        nextIndex += 1
      }
      meta.set(index, {
        rowSpan: nextIndex - index,
        projectCount: nextIndex - index,
      })
      index = nextIndex
    }
    return meta
  }, [sorted])

  function thClass(align?: "right") {
    return `cursor-pointer select-none whitespace-nowrap pb-2 pr-4 font-medium transition-colors hover:text-foreground${align === "right" ? " text-right" : ""}`
  }

  return (
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
                <th
                  className="cursor-pointer select-none whitespace-nowrap pb-2 text-right font-medium transition-colors hover:text-foreground"
                  onClick={() => handleSort("available_days")}
                >
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
                sorted.map((entry, idx) => {
                  const group = employeeGroupMeta.get(idx)
                  return (
                    <tr
                      key={`${entry.employee_id}-${entry.project_name ?? "bench"}-${idx}`}
                      onClick={() => selectEmployee(entry.employee_id)}
                      className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/50 group"
                    >
                      {group && (
                        <td className="py-2.5 pr-4 align-top" rowSpan={group.rowSpan}>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-foreground group-hover:underline">
                              {entry.employee_name}
                            </span>
                            {group.projectCount > 1 && (
                              <span className="inline-flex w-fit items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {group.projectCount} projects
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      {group && (
                        <td className="py-2.5 pr-4 align-top text-muted-foreground" rowSpan={group.rowSpan}>
                          {entry.line_manager || "No Manager"}
                        </td>
                      )}
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
                                ? "font-medium text-green-600"
                                : entry.allocation_percentage >= 40
                                  ? "font-medium text-amber-600"
                                  : "font-medium text-red-600"
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
                        {typeof entry.available_days === "number" ? entry.available_days.toFixed(1) : "-"}
                      </td>
                    </tr>
                  )
                })
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
  )
}
