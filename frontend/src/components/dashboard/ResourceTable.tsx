import { useState } from "react"
import { Search, Filter } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Pagination } from "@/components/shared/Pagination"
import { useOrgChartStore } from "@/store/orgChartStore"
import type { ResourceDashboardEntry } from "@/types/dashboard"

const CLASSIFICATION_OPTIONS = [
  { value: "", label: "All" },
  { value: "fully_billed", label: "Fully Billed" },
  { value: "partially_billed", label: "Partially Billed" },
  { value: "bench", label: "Bench" },
]

interface ResourceTableProps {
  entries: ResourceDashboardEntry[]
  onSearch: (query: string) => void
  searchQuery: string
  classification: string
  onClassificationChange: (value: string) => void
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  hideInlineFilters?: boolean
}

export function ResourceTable({
  entries,
  onSearch,
  searchQuery,
  classification,
  onClassificationChange,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  hideInlineFilters = false,
}: ResourceTableProps) {
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
          <CardTitle className="text-base">Resource Utilisation</CardTitle>
          {!hideInlineFilters && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="flex rounded-md border overflow-hidden">
                  {CLASSIFICATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => onClassificationChange(opt.value)}
                      className={`cursor-pointer px-2.5 py-1 text-xs font-medium transition-colors border-r last:border-r-0 ${
                        classification === opt.value
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <form onSubmit={handleSearchSubmit} className="relative w-60">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </form>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Name</th>
                <th className="pb-2 pr-4 font-medium">Designation</th>
                <th className="pb-2 pr-4 font-medium">Department</th>
                <th className="pb-2 pr-4 font-medium">Projects</th>
                <th className="pb-2 pr-4 font-medium text-right">Hours</th>
                <th className="pb-2 pr-4 font-medium text-right">Billable Hrs</th>
                <th className="pb-2 pr-4 font-medium text-right">Utilisation %</th>
                <th className="pb-2 pr-4 font-medium">Classification</th>
                <th className="pb-2 font-medium">Availability</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No resources found
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr
                    key={entry.employee_id}
                    onClick={() => selectEmployee(entry.employee_id)}
                    className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 pr-4">
                      <span className="font-medium text-primary group-hover:underline">
                        {entry.employee_name}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {entry.designation}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {entry.department}
                    </td>
                    <td className="py-2.5 pr-4 max-w-[200px]">
                      <span className="truncate block text-muted-foreground" title={
                        (entry.projects ?? []).map((p) => p.project_name).join(", ")
                      }>
                        {(entry.projects ?? []).map((p) => p.project_name).join(", ") || "-"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {(entry.total_hours ?? 0).toFixed(1)}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {(entry.billable_hours ?? 0).toFixed(1)}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      <span
                        className={
                          entry.utilisation_percent >= 80
                            ? "text-green-600 font-medium"
                            : entry.utilisation_percent >= 50
                            ? "text-amber-600 font-medium"
                            : "text-red-600 font-medium"
                        }
                      >
                        {(entry.utilisation_percent ?? 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge status={entry.classification} />
                    </td>
                    <td className="py-2.5">
                      <StatusBadge status={entry.availability} />
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
