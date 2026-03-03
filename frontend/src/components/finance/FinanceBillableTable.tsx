import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/StatusBadge"
import type { FinanceBillableEntry } from "@/types/finance"

interface FinanceBillableTableProps {
  entries: FinanceBillableEntry[]
  period: string
  latestVersion: number
  selectedVersion: number | null
  onVersionChange: (version: number) => void
}

export function FinanceBillableTable({
  entries,
  period,
  latestVersion,
  selectedVersion,
  onVersionChange,
}: FinanceBillableTableProps) {
  const versions = Array.from({ length: latestVersion }, (_, i) => i + 1).reverse()
  const currentVersion = selectedVersion ?? latestVersion

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Billable Data</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Version:</span>
            <select
              value={currentVersion}
              onChange={(e) => onVersionChange(Number(e.target.value))}
              className="cursor-pointer rounded-md border bg-background px-2 py-1 text-xs"
            >
              {versions.map((v) => (
                <option key={v} value={v}>
                  v{v}
                  {v === latestVersion ? " (latest)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {period} &middot; {entries.length} record{entries.length !== 1 ? "s" : ""}
        </p>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No billable data for this period and version.
          </div>
        ) : (
          <div className="max-h-[500px] overflow-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Employee Name</th>
                  <th className="px-3 py-2 text-left">Billable Status</th>
                  <th className="px-3 py-2 text-right">Billable Hours</th>
                  <th className="px-3 py-2 text-right">Billed Amount</th>
                  <th className="px-3 py-2 text-left">Project</th>
                  <th className="px-3 py-2 text-left">Client</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{entry.employee_name}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={entry.billable_status} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {entry.billable_hours.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {entry.billed_amount != null
                        ? `$${entry.billed_amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : "\u2014"}
                    </td>
                    <td className="px-3 py-2">{entry.project_name || "\u2014"}</td>
                    <td className="px-3 py-2">{entry.client_name || "\u2014"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
