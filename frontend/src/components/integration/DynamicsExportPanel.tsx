import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Database, FileJson, Download, Loader2 } from "lucide-react"
import type { DynamicsExport } from "@/types/integration"

interface DynamicsExportPanelProps {
  exports: DynamicsExport[]
  onExport: (type: string) => void
  onDownload: (exportId: string, format: "json" | "csv") => void
  exporting: boolean
}

const EXPORT_TYPES = [
  { type: "employee", label: "Export Employees", icon: Database },
  { type: "project", label: "Export Projects", icon: Database },
  { type: "timesheet", label: "Export Timesheets", icon: Database },
] as const

const TYPE_LABELS: Record<string, string> = {
  employee: "Employee",
  project: "Project",
  timesheet: "Timesheet",
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function DynamicsExportPanel({
  exports,
  onExport,
  onDownload,
  exporting,
}: DynamicsExportPanelProps) {
  return (
    <div className="space-y-6">
      {/* Export actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Dynamics 365 Export</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Export data for import into Dynamics 365. Each export generates a
            downloadable file.
          </p>
          <div className="flex flex-wrap gap-3">
            {EXPORT_TYPES.map(({ type, label, icon: Icon }) => (
              <Button
                key={type}
                variant="outline"
                onClick={() => onExport(type)}
                disabled={exporting}
              >
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="mr-2 h-4 w-4" />
                )}
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent exports table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Recent Exports</CardTitle>
        </CardHeader>
        <CardContent>
          {exports.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <FileJson className="mx-auto mb-3 h-8 w-8 opacity-40" />
              <p>No exports yet. Use the buttons above to create one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Records</th>
                    <th className="pb-2 pr-4">Created</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {exports.map((exp) => (
                    <tr key={exp.id}>
                      <td className="py-2.5 pr-4 font-medium">
                        {TYPE_LABELS[exp.export_type] || exp.export_type}
                      </td>
                      <td className="py-2.5 pr-4">
                        <StatusBadge status={exp.status} />
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {exp.record_count}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground text-xs">
                        {formatDateTime(exp.created_at)}
                      </td>
                      <td className="py-2.5 text-right">
                        {exp.status === "completed" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDownload(exp.id, "json")}
                            >
                              <FileJson className="mr-1 h-3 w-3" />
                              JSON
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDownload(exp.id, "csv")}
                            >
                              <Download className="mr-1 h-3 w-3" />
                              CSV
                            </Button>
                          </div>
                        ) : exp.error_message ? (
                          <span className="text-xs text-red-500 truncate max-w-[200px] inline-block">
                            {exp.error_message}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
