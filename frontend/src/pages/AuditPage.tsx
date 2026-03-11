import { useEffect, useState, useCallback } from "react"
import { useAuthStore } from "@/store/authStore"
import { getAuditLog, exportAuditLog } from "@/api/audit"
import type { AuditEntry } from "@/types/api"
import type { AuditFilterParams } from "@/api/audit"
import { AuditLogTable } from "@/components/audit/AuditLogTable"
import { AuditStats } from "@/components/audit/AuditStats"
import { ExportButton } from "@/components/shared/ExportButton"
import { SelectDropdown } from "@/components/shared/SelectDropdown"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, SlidersHorizontal, Search, X } from "lucide-react"

const PAGE_SIZE = 20

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "CREATE", label: "CREATE" },
  { value: "UPDATE", label: "UPDATE" },
  { value: "DELETE", label: "DELETE" },
  { value: "SYNC", label: "SYNC" },
  { value: "EXPORT", label: "EXPORT" },
  { value: "UPLOAD", label: "UPLOAD" },
  { value: "SKILL_TAG", label: "SKILL_TAG" },
  { value: "APPROVE", label: "APPROVE" },
  { value: "REJECT", label: "REJECT" },
  { value: "LOCK", label: "LOCK" },
  { value: "COMPUTE", label: "COMPUTE" },
]

const ENTITY_OPTIONS = [
  { value: "", label: "All Entities" },
  { value: "employee", label: "Employee" },
  { value: "relationship", label: "Relationship" },
  { value: "project", label: "Project" },
  { value: "timesheet", label: "Timesheet" },
  { value: "finance", label: "Finance" },
  { value: "utilisation", label: "Utilisation" },
  { value: "integration", label: "Integration" },
  { value: "skill", label: "Skill" },
]

export function AuditPage() {
  const user = useAuthStore((s) => s.user)
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const [action, setAction] = useState("")
  const [entityType, setEntityType] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [search, setSearch] = useState("")

  const locationId = user?.branch_location_id ?? ""

  const activeFilterCount = [action, entityType, dateFrom, dateTo, search].filter(Boolean).length

  const fetchEntries = useCallback(
    async (currentPage: number) => {
      if (!locationId) return
      setLoading(true)

      const params: AuditFilterParams = {}
      if (action) params.action = action
      if (entityType) params.entity_type = entityType
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      if (search) params.search = search

      try {
        const res = await getAuditLog(locationId, currentPage, PAGE_SIZE, params)
        setEntries(res.entries)
        setTotal(res.total)
      } catch (err) {
        console.error("Failed to fetch audit log:", err)
      } finally {
        setLoading(false)
      }
    },
    [locationId, action, entityType, dateFrom, dateTo, search]
  )

  useEffect(() => {
    fetchEntries(page)
  }, [page, fetchEntries])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [action, entityType, dateFrom, dateTo, search])

  const resetFilters = () => {
    setAction("")
    setEntityType("")
    setDateFrom("")
    setDateTo("")
    setSearch("")
  }

  const handleExport = () => {
    return exportAuditLog(locationId)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Audit Log</h2>
          <p className="text-sm text-muted-foreground">
            Track all changes made to your branch
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
            className="h-8 text-xs relative"
          >
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <ExportButton
            onExport={handleExport}
            filename="audit-log.csv"
            label="Export CSV"
          />
        </div>
      </div>

      {/* Stats */}
      {locationId && <AuditStats locationId={locationId} />}

      {/* Collapsible Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative w-52">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  placeholder="Search descriptions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <SelectDropdown
                options={ACTION_OPTIONS}
                value={action}
                onChange={setAction}
              />
              <SelectDropdown
                options={ENTITY_OPTIONS}
                value={entityType}
                onChange={setEntityType}
              />
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-8 rounded-md border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="From"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-8 rounded-md border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="cursor-pointer inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <AuditLogTable entries={entries} total={total} loading={loading} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
