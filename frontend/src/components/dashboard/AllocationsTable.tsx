import { useState } from "react"
import { Search } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/shared/Pagination"
import { useOrgChartStore } from "@/store/orgChartStore"
import type { AllocationEntry } from "@/types/dashboard"

interface AllocationsTableProps {
  entries: AllocationEntry[]
  onSearch: (query: string) => void
  searchQuery: string
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  hideInlineFilters?: boolean
}

export function AllocationsTable({
  entries,
  onSearch,
  searchQuery,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  hideInlineFilters = false,
}: AllocationsTableProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const selectEmployee = useOrgChartStore((s) => s.selectEmployee)

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(localSearch)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">HRMS Project Allocations</CardTitle>
          {!hideInlineFilters && (
            <form onSubmit={handleSearchSubmit} className="relative w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </form>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Employee</th>
                <th className="pb-2 pr-4 font-medium">Project</th>
                <th className="pb-2 pr-4 font-medium">Client</th>
                <th className="pb-2 pr-4 font-medium text-right">Allocation %</th>
                <th className="pb-2 pr-4 font-medium text-right">Allocated Days</th>
                <th className="pb-2 pr-4 font-medium text-right">Working Days</th>
                <th className="pb-2 pr-4 font-medium text-right">Total Allocated</th>
                <th className="pb-2 font-medium text-right">Available Days</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No allocation data found for this period
                  </td>
                </tr>
              ) : (
                entries.map((entry, idx) => (
                  <tr
                    key={`${entry.employee_id}-${entry.project_id}-${idx}`}
                    onClick={() => selectEmployee(entry.employee_id)}
                    className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 pr-4">
                      <span className="font-medium text-primary group-hover:underline">{entry.employee_name}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{entry.project_name}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{entry.client_name || "-"}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      <span
                        className={
                          entry.allocation_percentage >= 80
                            ? "text-green-600 font-medium"
                            : entry.allocation_percentage >= 40
                            ? "text-amber-600 font-medium"
                            : "text-red-600 font-medium"
                        }
                      >
                        {(entry.allocation_percentage ?? 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {(entry.allocated_days ?? 0).toFixed(1)}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {entry.total_working_days ?? 0}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {(entry.total_allocated_days ?? 0).toFixed(1)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {(entry.available_days ?? 0).toFixed(1)}
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
  )
}
