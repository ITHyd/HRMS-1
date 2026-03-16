import { useEffect, useState } from "react"
import { AlertTriangle, BellRing, CheckCircle2, ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react"
import { generateAlerts } from "@/api/alerts"
import type { Alert } from "@/api/alerts"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const SEVERITY_CONFIG = {
  high:   { label: "High",   border: "#ef4444", bg: "#fef2f2", text: "#b91c1c", icon: AlertTriangle,  iconColor: "#ef4444", badge: "bg-red-100 text-red-700"   },
  medium: { label: "Medium", border: "#f59e0b", bg: "#fffbeb", text: "#92400e", icon: AlertTriangle,  iconColor: "#f59e0b", badge: "bg-amber-100 text-amber-700" },
  low:    { label: "Low",    border: "#22c55e", bg: "#f0fdf4", text: "#15803d", icon: CheckCircle2,   iconColor: "#22c55e", badge: "bg-green-100 text-green-700" },
} as const

function AlertCard({ alert }: { alert: Alert }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = SEVERITY_CONFIG[alert.severity]
  const Icon = cfg.icon

  return (
    <div
      className="rounded-xl border shadow-sm transition-all"
      style={{ borderLeft: `4px solid ${cfg.border}`, background: cfg.bg }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        <Icon className="h-5 w-5 mt-0.5 shrink-0" style={{ color: cfg.iconColor }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold" style={{ color: cfg.text }}>{alert.title}</p>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", cfg.badge)}>
              {cfg.label}
            </span>
          </div>
          {alert.details && (
            <p className="text-xs mt-0.5 text-muted-foreground line-clamp-1">{alert.details}</p>
          )}
        </div>
        {alert.details && (
          expanded
            ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
            : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
        )}
      </button>
      {expanded && alert.details && (
        <div className="px-4 pb-4 pt-0">
          <p className="text-xs leading-relaxed border-t pt-3" style={{ color: cfg.text + "cc", borderColor: cfg.border + "33" }}>
            {alert.details}
          </p>
        </div>
      )}
    </div>
  )
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [lastRun, setLastRun] = useState<Date | null>(null)

  const loadAlerts = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await generateAlerts()
      setAlerts(data)
      setLastRun(new Date())
    } catch {
      setError("Failed to generate alerts. Make sure the backend is running.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAlerts() }, [])

  const highCount   = alerts.filter((a) => a.severity === "high").length
  const medCount    = alerts.filter((a) => a.severity === "medium").length
  const lowCount    = alerts.filter((a) => a.severity === "low").length

  const ordered = [
    ...alerts.filter((a) => a.severity === "high"),
    ...alerts.filter((a) => a.severity === "medium"),
    ...alerts.filter((a) => a.severity === "low"),
  ]

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            Automated Alerts
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Generated from bench data, project end dates, and billable utilisation
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Daily email toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
            <div
              onClick={() => setEmailEnabled((v) => !v)}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                emailEnabled ? "bg-primary" : "bg-muted-foreground/30"
              )}
            >
              <span
                className={cn(
                  "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                  emailEnabled ? "translate-x-4" : "translate-x-1"
                )}
              />
            </div>
            <span className="text-muted-foreground">Daily email digest</span>
          </label>

          <Button
            variant="outline"
            size="sm"
            onClick={loadAlerts}
            disabled={loading}
            className="h-8 text-xs gap-1.5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Regenerate
          </Button>
        </div>
      </div>

      {/* Summary pills */}
      {!loading && !error && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="rounded-full bg-red-100 text-red-700 px-3 py-1 text-xs font-semibold">
            {highCount} High
          </span>
          <span className="rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-xs font-semibold">
            {medCount} Medium
          </span>
          <span className="rounded-full bg-green-100 text-green-700 px-3 py-1 text-xs font-semibold">
            {lowCount} Low
          </span>
          {lastRun && (
            <span className="text-xs text-muted-foreground ml-auto">
              Last run: {lastRun.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex h-64 items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Generating alerts…</span>
        </div>
      ) : error ? (
        <div className="flex h-48 items-center justify-center text-destructive text-sm">{error}</div>
      ) : ordered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <CheckCircle2 className="h-12 w-12 text-green-500 opacity-70" />
          <p className="text-base font-semibold text-foreground">All clear — no alerts</p>
          <p className="text-sm text-muted-foreground">
            No bench issues, ending projects, or billable drops detected right now.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ordered.map((alert, i) => (
            <AlertCard key={`${alert.type}-${i}`} alert={alert} />
          ))}
        </div>
      )}

      {/* Email toggle info */}
      {emailEnabled && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-primary">
          Daily email digest enabled — alerts will be sent each morning to the branch head on record.
        </div>
      )}
    </div>
  )
}
