import { useEffect, useState, useCallback } from "react"
import { useAuthStore } from "@/store/authStore"
import { getAuditLog, exportAuditLog } from "@/api/audit"
import type { AuditEntry } from "@/types/api"
import type { AuditFilterParams } from "@/api/audit"
import { AuditLogTable } from "@/components/audit/AuditLogTable"
import { AuditFiltersBar, type AuditFilters } from "@/components/audit/AuditFilters"
import { AuditStats } from "@/components/audit/AuditStats"
import { ExportButton } from "@/components/shared/ExportButton"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

const PAGE_SIZE = 20

export function AuditPage() {
  const user = useAuthStore((s) => s.user)
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<AuditFilters>({
    action: "",
    entity_type: "",
    date_from: "",
    date_to: "",
    search: "",
  })

  const locationId = user?.branch_location_id ?? ""

  const fetchEntries = useCallback(
    async (currentPage: number, currentFilters: AuditFilters) => {
      if (!locationId) return
      setLoading(true)

      const params: AuditFilterParams = {}
      if (currentFilters.action) params.action = currentFilters.action
      if (currentFilters.entity_type) params.entity_type = currentFilters.entity_type
      if (currentFilters.date_from) params.date_from = currentFilters.date_from
      if (currentFilters.date_to) params.date_to = currentFilters.date_to
      if (currentFilters.search) params.search = currentFilters.search

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
    [locationId]
  )

  useEffect(() => {
    fetchEntries(page, filters)
  }, [page, filters, fetchEntries])

  const handleFiltersChange = (newFilters: AuditFilters) => {
    setFilters(newFilters)
    setPage(1)
  }

  const handleExport = () => {
    return exportAuditLog(locationId)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Audit Log</h2>
          <p className="text-sm text-muted-foreground">
            Track all changes made to your branch
          </p>
        </div>
        <ExportButton
          onExport={handleExport}
          filename="audit-log.csv"
          label="Export CSV"
        />
      </div>

      {/* Stats */}
      {locationId && <AuditStats locationId={locationId} />}

      {/* Filters */}
      <AuditFiltersBar filters={filters} onChange={handleFiltersChange} />

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
