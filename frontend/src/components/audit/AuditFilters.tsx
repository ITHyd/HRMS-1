import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { X, Search } from "lucide-react"

export interface AuditFilters {
  action?: string
  entity_type?: string
  date_from?: string
  date_to?: string
  search?: string
}

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "CREATE", label: "CREATE" },
  { value: "UPDATE", label: "UPDATE" },
  { value: "DELETE", label: "DELETE" },
  { value: "IMPORT", label: "IMPORT" },
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

interface AuditFiltersBarProps {
  filters: AuditFilters
  onChange: (filters: AuditFilters) => void
}

export function AuditFiltersBar({ filters, onChange }: AuditFiltersBarProps) {
  const update = (patch: Partial<AuditFilters>) => {
    onChange({ ...filters, ...patch })
  }

  const hasActiveFilters =
    filters.action ||
    filters.entity_type ||
    filters.date_from ||
    filters.date_to ||
    filters.search

  const clearAll = () => {
    onChange({
      action: "",
      entity_type: "",
      date_from: "",
      date_to: "",
      search: "",
    })
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Action
          </label>
          <Select
            options={ACTION_OPTIONS}
            value={filters.action || ""}
            onChange={(e) => update({ action: e.target.value })}
            className="w-[160px]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Entity Type
          </label>
          <Select
            options={ENTITY_OPTIONS}
            value={filters.entity_type || ""}
            onChange={(e) => update({ entity_type: e.target.value })}
            className="w-[160px]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            From
          </label>
          <Input
            type="date"
            value={filters.date_from || ""}
            onChange={(e) => update({ date_from: e.target.value })}
            className="w-[150px]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            To
          </label>
          <Input
            type="date"
            value={filters.date_to || ""}
            onChange={(e) => update({ date_to: e.target.value })}
            className="w-[150px]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search descriptions..."
              value={filters.search || ""}
              onChange={(e) => update({ search: e.target.value })}
              className="w-[200px] pl-8"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-muted-foreground"
          >
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
