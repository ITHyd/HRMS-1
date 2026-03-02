import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { RefreshCw } from "lucide-react"
import { triggerHrmsSync, getHrmsSyncLogs } from "@/api/timesheets"
import { useAuthStore } from "@/store/authStore"
import type { HrmsSyncLog } from "@/types/timesheet"

interface HrmsSyncPanelProps {
  period: string
}

export function HrmsSyncPanel({ period }: HrmsSyncPanelProps) {
  const user = useAuthStore((s) => s.user)
  const [logs, setLogs] = useState<HrmsSyncLog[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const fetchLogs = () => {
    if (!user) return
    setLoading(true)
    getHrmsSyncLogs()
      .then((data) => setLogs(data.logs))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchLogs()
  }, [user, period])

  const handleSync = async () => {
    if (!user) return
    setSyncing(true)
    try {
      await triggerHrmsSync(period)
      fetchLogs()
    } catch (err) {
      console.error("HRMS sync failed:", err)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Sync Action */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">HRMS Synchronization</h3>
          <p className="text-xs text-muted-foreground">
            Import timesheet data from HRMS for the selected period
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Trigger HRMS Sync"}
        </Button>
      </div>

      {/* Sync Logs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sync History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-6 w-6 rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No sync logs for this period.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                      Batch ID
                    </th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                      Period
                    </th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                      Imported
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                      Duplicates
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                      Errors
                    </th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                      Started At
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.batch_id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {log.batch_id.slice(0, 8)}...
                      </td>
                      <td className="px-3 py-2.5">{log.period}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {log.imported_count}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {log.duplicate_count}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {log.error_count}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {new Date(log.started_at).toLocaleString()}
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
