import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/StatusBadge"
import type { FinanceBillableEntry } from "@/types/finance"

interface FinanceBillableTableProps {
  entries: FinanceBillableEntry[]
  period: string
}

export function FinanceBillableTable({
  entries,
  period,
}: FinanceBillableTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Billable Data</CardTitle>
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
            <table className="min-w-[700px] w-full text-sm table-fixed">
              <thead className="bg-muted sticky top-0 z-10">
                <tr>
                  <th className="w-[18%] px-3 py-2 text-left">Employee Name</th>
                  <th className="w-[14%] px-3 py-2 text-left">Billable Status</th>
                  <th className="w-[12%] px-3 py-2 text-right">Billable Hours</th>
                  <th className="w-[14%] px-3 py-2 text-right">Billed Amount</th>
                  <th className="w-[22%] px-3 py-2 text-left">Project</th>
                  <th className="w-[20%] px-3 py-2 text-left">Client</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium truncate">{entry.employee_name}</td>
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
                    <td className="px-3 py-2 truncate">{entry.project_name || "\u2014"}</td>
                    <td className="px-3 py-2 truncate">{entry.client_name || "\u2014"}</td>
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
