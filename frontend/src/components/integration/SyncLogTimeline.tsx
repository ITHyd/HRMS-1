import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ArrowDown, ArrowUp, RefreshCw } from "lucide-react"
import type { SyncLogEntry } from "@/types/integration"

interface SyncLogTimelineProps {
  logs: SyncLogEntry[]
  onRetry: (syncLogId: string) => void
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

const TYPE_LABELS: Record<string, string> = {
  hrms: "HRMS",
  finance: "Finance",
  dynamics: "Dynamics",
}

export function SyncLogTimeline({ logs, onRetry }: SyncLogTimelineProps) {
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
        {logs.map((log) => (
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
                className="shrink-0"
              >
                <RefreshCw className="mr-1.5 h-3 w-3" />
                Retry
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
