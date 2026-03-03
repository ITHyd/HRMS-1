import { useState } from "react"
import { Search, Filter } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/shared/StatusBadge"
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
}: ResourceTableProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const selectEmployee = useOrgChartStore((s) => s.selectEmployee)
  const totalPages = Math.ceil(total / pageSize)

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(localSearch)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Resource Utilisation</CardTitle>
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
                    className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-2.5 pr-4">
                      <button
                        onClick={() => selectEmployee(entry.employee_id)}
                        className="cursor-pointer font-medium text-primary hover:underline text-left"
                      >
                        {entry.employee_name}
                      </button>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {entry.designation}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {entry.department}
                    </td>
                    <td className="py-2.5 pr-4 max-w-[200px]">
                      <span className="truncate block text-muted-foreground" title={
                        entry.projects.map((p) => p.project_name).join(", ")
                      }>
                        {entry.projects.map((p) => p.project_name).join(", ") || "-"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {entry.total_hours.toFixed(1)}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {entry.billable_hours.toFixed(1)}
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
                        {entry.utilisation_percent.toFixed(1)}%
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * pageSize + 1}-
              {Math.min(page * pageSize, total)} of {total} resources
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      pageNum === page
                        ? "bg-primary text-primary-foreground"
                        : "border hover:bg-accent"
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                className="cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
