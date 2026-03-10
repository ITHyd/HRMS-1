import { Fragment, useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/StatusBadge"
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronRight,
  Database,
  Copy,
  Download,
  Users,
} from "lucide-react"
import { triggerHrmsSync, triggerMasterDataSync, getHrmsSyncLogs } from "@/api/timesheets"
import { useAuthStore } from "@/store/authStore"
import type { HrmsSyncLog } from "@/types/timesheet"

interface HrmsSyncPanelProps {
  period: string
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function formatPeriod(period: string): string {
  const [year, month] = period.split("-")
  return `${MONTHS[parseInt(month) - 1]} ${year}`
}

function formatDuration(start: string, end?: string): string {
  if (!end) return "..."
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rem = seconds % 60
  return `${minutes}m ${rem}s`
}

function isMasterDataError(error: unknown): boolean {
  if (!error) return false
  const msg = typeof error === "string"
    ? error
    : (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || ""
  return msg.toLowerCase().includes("master mapping") || msg.toLowerCase().includes("master-data")
}

export function HrmsSyncPanel({ period }: HrmsSyncPanelProps) {
  const user = useAuthStore((s) => s.user)
  const [logs, setLogs] = useState<HrmsSyncLog[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncingMaster, setSyncingMaster] = useState(false)
  const [needsMasterData, setNeedsMasterData] = useState(false)
  const [syncResult, setSyncResult] = useState<{
    type: "success" | "error"
    message: string
    batch_id: string
    imported_count: number
    duplicate_count: number
    error_count: number
    total_records: number
  } | null>(null)
  const [masterResult, setMasterResult] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  const fetchLogs = useCallback(() => {
    if (!user) return
    setLoading(true)
    getHrmsSyncLogs()
      .then((data) => {
        setLogs(data.logs)
        // Check if any successful master-data sync exists
        const hasMasterSync = data.logs.some(
          (l) => l.period === "master-data" && l.status === "completed"
        )
        if (!hasMasterSync && data.logs.length === 0) {
          setNeedsMasterData(true)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs, period])

  const handleMasterSync = async () => {
    if (!user) return
    setSyncingMaster(true)
    setMasterResult(null)
    try {
      const result = await triggerMasterDataSync()
      setMasterResult({
        type: result.error_count > 0 ? "error" : "success",
        message: result.error_count > 0
          ? `Master data sync completed with ${result.error_count} errors. ${result.imported_count} records imported.`
          : `Master data synced successfully. ${result.imported_count} records imported (employees, projects, locations, etc.)`,
      })
      setNeedsMasterData(false)
      fetchLogs()
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setMasterResult({
        type: "error",
        message: detail || "Failed to sync master data. Please check HRMS credentials and try again.",
      })
    } finally {
      setSyncingMaster(false)
    }
  }

  const handleSync = async () => {
    if (!user) return
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await triggerHrmsSync(period)
      setSyncResult({
        type: result.error_count > 0 ? "error" : "success",
        message: result.error_count > 0
          ? "Sync completed with errors"
          : "Sync completed successfully",
        batch_id: result.batch_id,
        imported_count: result.imported_count,
        duplicate_count: result.duplicate_count,
        error_count: result.error_count,
        total_records: result.total_records,
      })
      setNeedsMasterData(false)
      fetchLogs()
    } catch (err) {
      if (isMasterDataError(err)) {
        setNeedsMasterData(true)
        setSyncResult({
          type: "error",
          message: "HRMS master data (employees, projects) must be synced before importing timesheets.",
          batch_id: "",
          imported_count: 0,
          duplicate_count: 0,
          error_count: 0,
          total_records: 0,
        })
      } else {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        setSyncResult({
          type: "error",
          message: detail || "Sync failed. Please try again.",
          batch_id: "",
          imported_count: 0,
          duplicate_count: 0,
          error_count: 0,
          total_records: 0,
        })
      }
    } finally {
      setSyncing(false)
    }
  }

  const latestLog = logs.length > 0 ? logs[0] : null

  return (
    <div className="space-y-4">
      {/* Master Data Required Banner */}
      {needsMasterData && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg p-2 bg-amber-100 shrink-0">
              <Database className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-amber-900">Master Data Sync Required</h3>
              <p className="text-xs text-amber-700 mt-1">
                Before importing timesheets, HRMS master data (employees, projects, locations, departments) must be synced first.
                This is a one-time setup that maps HRMS records to your local database.
              </p>
              <div className="mt-3">
                <Button
                  onClick={handleMasterSync}
                  disabled={syncingMaster}
                  size="sm"
                  className="cursor-pointer bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Users className={`mr-1.5 h-4 w-4 ${syncingMaster ? "animate-spin" : ""}`} />
                  {syncingMaster ? "Syncing Master Data..." : "Sync Master Data"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Master Data Result Banner */}
      {masterResult && (
        <div className={`rounded-lg border px-4 py-3 ${
          masterResult.type === "success"
            ? "border-green-200 bg-green-50"
            : "border-red-200 bg-red-50"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {masterResult.type === "success"
                ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                : <AlertCircle className="h-4 w-4 text-red-600" />
              }
              <span className="text-sm font-medium">
                {masterResult.message}
              </span>
            </div>
            <button onClick={() => setMasterResult(null)} className="cursor-pointer">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Sync Action Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-blue-50">
                <RefreshCw className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium">HRMS Synchronization</h3>
                <p className="text-xs text-muted-foreground">
                  Import timesheet data from HRMS for <strong>{formatPeriod(period)}</strong>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleMasterSync}
                disabled={syncingMaster || syncing}
                variant="outline"
                size="sm"
                className="cursor-pointer"
              >
                <Database className={`mr-1.5 h-4 w-4 ${syncingMaster ? "animate-spin" : ""}`} />
                {syncingMaster ? "Syncing..." : "Master Data"}
              </Button>
              <Button onClick={handleSync} disabled={syncing || syncingMaster} className="cursor-pointer">
                <RefreshCw className={`mr-1.5 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Trigger Sync"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Result Banner */}
      {syncResult && (
        <div className={`rounded-lg border px-4 py-3 ${
          syncResult.type === "success"
            ? "border-green-200 bg-green-50"
            : "border-red-200 bg-red-50"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {syncResult.type === "success"
                ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                : <AlertCircle className="h-4 w-4 text-red-600" />
              }
              <span className="text-sm font-medium">
                {syncResult.message}
              </span>
            </div>
            <button onClick={() => setSyncResult(null)} className="cursor-pointer">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          {syncResult.batch_id && (
            <div className="mt-2 flex items-center gap-4 text-xs">
              <span className="text-green-700 font-medium">
                {syncResult.imported_count} imported
              </span>
              <span className="text-amber-700 font-medium">
                {syncResult.duplicate_count} duplicates
              </span>
              {syncResult.error_count > 0 && (
                <span className="text-red-700 font-medium">
                  {syncResult.error_count} errors
                </span>
              )}
              <span className="text-muted-foreground">
                of {syncResult.total_records} total records
              </span>
            </div>
          )}
        </div>
      )}

      {/* Last Sync Summary Cards */}
      {latestLog && latestLog.status !== "running" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Records", value: latestLog.total_records, icon: Database, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Imported", value: latestLog.imported_count, icon: Download, color: "text-green-600", bg: "bg-green-50" },
            { label: "Duplicates", value: latestLog.duplicate_count, icon: Copy, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Errors", value: latestLog.error_count, icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
          ].map((card) => (
            <Card key={card.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${card.bg}`}>
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className="text-2xl font-semibold tabular-nums">{card.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sync History Table */}
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
            <div className="rounded-xl border bg-card p-8 text-center">
              <RefreshCw className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-40" />
              <p className="text-sm font-medium">No sync history</p>
              <p className="text-xs text-muted-foreground mt-1">
                Trigger your first HRMS sync to import timesheet data.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="w-8 px-2 py-2.5" />
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Batch ID</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Period</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Mode</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Imported</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Duplicates</th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Errors</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Duration</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Started At</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <Fragment key={log.batch_id}>
                      <tr className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-2 py-2.5">
                          {log.error_count > 0 && (
                            <button
                              onClick={() => setExpandedLogId(expandedLogId === log.batch_id ? null : log.batch_id)}
                              className="cursor-pointer p-0.5"
                            >
                              <ChevronRight className={`h-4 w-4 transition-transform ${
                                expandedLogId === log.batch_id ? "rotate-90" : ""
                              }`} />
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs">{log.batch_id.slice(0, 8)}...</td>
                        <td className="px-3 py-2.5">{log.period}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            log.mode === "live"
                              ? "bg-blue-100 text-blue-700"
                              : log.mode === "demo"
                                ? "bg-gray-100 text-gray-700"
                                : "bg-gray-50 text-gray-500"
                          }`}>
                            {log.mode || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5"><StatusBadge status={log.status} /></td>
                        <td className="px-3 py-2.5 text-right font-mono">{log.imported_count}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{log.duplicate_count}</td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          <span className={log.error_count > 0 ? "text-red-600 font-medium" : ""}>
                            {log.error_count}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {formatDuration(log.started_at, log.completed_at)}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {new Date(log.started_at).toLocaleString()}
                        </td>
                      </tr>
                      {expandedLogId === log.batch_id && log.errors?.length > 0 && (
                        <tr>
                          <td colSpan={10} className="px-6 py-3 bg-red-50/50">
                            <p className="text-xs font-medium text-red-700 mb-2">
                              Error Details ({log.errors.length})
                            </p>
                            <div className="space-y-1">
                              {log.errors.map((err, idx) => (
                                <div key={idx} className="text-xs text-red-600 flex items-start gap-2">
                                  <span className="shrink-0 font-mono">{err.employee_id || err.key || err.entity || "unknown"}</span>
                                  <span>{err.error || err.message || "Unknown sync error"}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
