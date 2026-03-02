import { TimesheetStatusBadge } from "./TimesheetStatusBadge"
import type { TimesheetEntry } from "@/types/timesheet"

interface TimesheetTableProps {
  entries: TimesheetEntry[]
  onSelect: (id: string) => void
  selectedIds: Set<string>
  onSelectAll: () => void
}

export function TimesheetTable({
  entries,
  onSelect,
  selectedIds,
  onSelectAll,
}: TimesheetTableProps) {
  const allSelected = entries.length > 0 && entries.every((e) => selectedIds.has(e.id))

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
            <th className="w-10 px-3 py-2.5">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                className="h-4 w-4 rounded border-gray-300"
              />
            </th>
            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Date</th>
            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Employee</th>
            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Project</th>
            <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Hours</th>
            <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Billable</th>
            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Source</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isSelected = selectedIds.has(entry.id)
            return (
              <tr
                key={entry.id}
                onClick={() => onSelect(entry.id)}
                className={`border-b cursor-pointer transition-colors hover:bg-muted/30 ${
                  isSelected ? "bg-primary/5" : ""
                }`}
              >
                <td className="px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onSelect(entry.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {new Date(entry.date).toLocaleDateString()}
                </td>
                <td className="px-3 py-2.5">{entry.employee_name}</td>
                <td className="px-3 py-2.5">{entry.project_name}</td>
                <td className="px-3 py-2.5 text-right font-mono">{entry.hours.toFixed(1)}</td>
                <td className="px-3 py-2.5 text-center">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      entry.billable
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {entry.billable ? "Y" : "N"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <TimesheetStatusBadge status={entry.status} />
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {entry.source}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
