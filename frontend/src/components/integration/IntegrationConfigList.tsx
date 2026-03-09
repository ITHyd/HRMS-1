import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { RefreshCw, Link2, Loader2 } from "lucide-react"
import type { IntegrationConfig } from "@/types/integration"

interface IntegrationConfigListProps {
  configs: IntegrationConfig[]
  onSync: (configId: string) => void
  onToggle: (configId: string, status: string) => void
  syncingConfigId?: string | null
}

const TYPE_LABELS: Record<string, string> = {
  hrms: "HRMS",
  finance: "Finance",
  dynamics: "Dynamics",
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
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

export function IntegrationConfigList({
  configs,
  onSync,
  onToggle,
  syncingConfigId,
}: IntegrationConfigListProps) {
  if (configs.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        <Link2 className="mx-auto mb-3 h-8 w-8 opacity-40" />
        <p className="text-sm">No integration configurations found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Configurations
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {configs.map((config) => {
          const isSyncing = syncingConfigId === config.id
          return (
            <Card key={config.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-sm">{config.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {TYPE_LABELS[config.integration_type] || config.integration_type}
                      </Badge>
                      <StatusBadge status={config.status} />
                    </div>
                  </div>
                  <Link2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {config.last_sync_at ? (
                      <p>
                        Last sync: {formatDateTime(config.last_sync_at)}
                        {config.last_sync_status && (
                          <span className="ml-1.5">
                            <StatusBadge status={config.last_sync_status} />
                          </span>
                        )}
                      </p>
                    ) : (
                      <p>No syncs yet</p>
                    )}
                    <p>Created: {formatDate(config.created_at)}</p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSync(config.id)}
                      disabled={config.status !== "active" || isSyncing}
                    >
                      {isSyncing ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1.5 h-3 w-3" />
                      )}
                      {isSyncing ? "Syncing..." : "Sync Now"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onToggle(
                          config.id,
                          config.status === "active" ? "inactive" : "active"
                        )
                      }
                      disabled={isSyncing}
                    >
                      {config.status === "active" ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
