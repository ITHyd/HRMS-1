import { TimesheetStatusBadge } from "./TimesheetStatusBadge"
import { useOrgChartStore } from "@/store/orgChartStore"
import type { TimesheetEntry } from "@/types/timesheet"

interface TimesheetTableProps {
  entries: TimesheetEntry[]
  onSelect?: (id: string) => void
  selectedIds?: Set<string>
  onSelectAll?: () => void
  selectable?: boolean
}

export function TimesheetTable({
  entries,
  onSelect,
  selectedIds,
  onSelectAll,
  selectable = false,
}: TimesheetTableProps) {
  const selectEmployee = useOrgChartStore((s) => s.selectEmployee)
  const allSelected =
    selectable && entries.length > 0 && entries.every((e) => selectedIds?.has(e.id))

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No timesheet entries found for this period.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {selectable && (
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onSelectAll}
                  className="cursor-pointer h-4 w-4 rounded border-gray-300"
                />
              </th>
            )}
            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Date</th>
            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Employee</th>
            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Project</th>
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Hours</th>
            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Description</th>
            <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Billable</th>
            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isSelected = selectable && selectedIds?.has(entry.id)
            return (
              <tr
                key={entry.id}
                onClick={selectable ? () => onSelect?.(entry.id) : undefined}
                className={`border-b transition-colors hover:bg-muted/30 ${
                  selectable ? "cursor-pointer" : ""
                } ${isSelected ? "bg-primary/5" : ""}`}
              >
                {selectable && (
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={!!isSelected}
                      onChange={() => onSelect?.(entry.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-pointer h-4 w-4 rounded border-gray-300"
                    />
                  </td>
                )}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {new Date(entry.date + "T00:00:00").toLocaleDateString()}
                </td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); selectEmployee(entry.employee_id) }}
                    className="cursor-pointer font-medium text-primary hover:underline text-left"
                  >
                    {entry.employee_name}
                  </button>
                </td>
                <td className="px-3 py-2.5">{entry.project_name}</td>
                <td className="px-3 py-2.5 text-right font-mono">{entry.hours.toFixed(1)}</td>
                <td className="px-3 py-2.5 text-muted-foreground max-w-[200px] truncate">
                  {entry.description || "-"}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      entry.is_billable
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {entry.is_billable ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <TimesheetStatusBadge status={entry.status} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
