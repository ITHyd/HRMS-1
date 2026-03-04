import { useState } from "react"
import { Search } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { AllocationEntry } from "@/types/dashboard"

interface AllocationsTableProps {
  entries: AllocationEntry[]
  onSearch: (query: string) => void
  searchQuery: string
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
}

export function AllocationsTable({
  entries,
  onSearch,
  searchQuery,
  total,
  page,
  pageSize,
  onPageChange,
}: AllocationsTableProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const totalPages = Math.ceil(total / pageSize)

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(localSearch)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">HRMS Project Allocations</CardTitle>
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
                    className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-2.5 pr-4 font-medium">{entry.employee_name}</td>
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
                        {entry.allocation_percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {entry.allocated_days.toFixed(1)}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {entry.total_working_days}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {entry.total_allocated_days.toFixed(1)}
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * pageSize + 1}-
              {Math.min(page * pageSize, total)} of {total} allocations
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
