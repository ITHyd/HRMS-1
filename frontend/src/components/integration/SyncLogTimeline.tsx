import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ArrowDown, ArrowUp, RefreshCw, Loader2, Clock } from "lucide-react"
import type { SyncLogEntry } from "@/types/integration"

interface SyncLogTimelineProps {
  logs: SyncLogEntry[]
  onRetry: (syncLogId: string) => void
  retryingLogId?: string | null
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function formatDuration(startedAt: string, completedAt?: string): string | null {
  if (!completedAt) return null
  const start = new Date(startedAt).getTime()
  const end = new Date(completedAt).getTime()
  const diffMs = end - start
  if (diffMs < 0) return null
  if (diffMs < 1000) return `${diffMs}ms`
  const secs = diffMs / 1000
  if (secs < 60) return `${secs.toFixed(1)}s`
  const mins = Math.floor(secs / 60)
  const remainSecs = Math.round(secs % 60)
  return `${mins}m ${remainSecs}s`
}

const TYPE_LABELS: Record<string, string> = {
  hrms: "HRMS",
  finance: "Finance",
  dynamics: "Dynamics",
}

export function SyncLogTimeline({ logs, onRetry, retryingLogId }: SyncLogTimelineProps) {
  if (logs.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        <RefreshCw className="mx-auto mb-3 h-8 w-8 opacity-40" />
        <p className="text-sm">No sync logs recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Sync History
      </h3>
      <div className="space-y-2">
        {logs.map((log) => {
          const duration = formatDuration(log.started_at, log.completed_at)
          const isRetrying = retryingLogId === log.id
          return (
            <div
              key={log.id}
              className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3"
            >
              {/* Direction icon */}
              <div className="shrink-0">
                {log.direction === "inbound" ? (
                  <ArrowDown className="h-4 w-4 text-blue-500" />
                ) : (
                  <ArrowUp className="h-4 w-4 text-orange-500" />
                )}
              </div>

              {/* Timestamp and type */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {TYPE_LABELS[log.integration_type] || log.integration_type}
                  </span>
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {log.direction}
                  </span>
                  <StatusBadge status={log.status} />
                  {duration && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                      <Clock className="h-2.5 w-2.5" />
                      {duration}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDateTime(log.started_at)}
                  {log.triggered_by && (
                    <span className="ml-1.5">by {log.triggered_by}</span>
                  )}
                </p>
              </div>

              {/* Record counts */}
              <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                <span title="Processed">
                  {log.records_processed} processed
                </span>
                <span className="text-green-600" title="Succeeded">
                  {log.records_succeeded} ok
                </span>
                {log.records_failed > 0 && (
                  <span className="text-red-600" title="Failed">
                    {log.records_failed} failed
                  </span>
                )}
                {log.retry_count > 0 && (
                  <span className="text-amber-600" title="Retries">
                    {log.retry_count} retries
                  </span>
                )}
              </div>

              {/* Retry button for failed entries */}
              {log.status === "failed" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRetry(log.id)}
                  disabled={isRetrying}
                  className="shrink-0"
                >
                  {isRetrying ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-3 w-3" />
                  )}
                  {isRetrying ? "Retrying..." : "Retry"}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
