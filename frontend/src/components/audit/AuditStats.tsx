import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getAuditStats, type AuditStatsResponse } from "@/api/audit"
import { Activity, TrendingUp } from "lucide-react"

interface AuditStatsProps {
  locationId: string
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  IMPORT: "bg-purple-100 text-purple-700",
  SYNC: "bg-cyan-100 text-cyan-700",
  EXPORT: "bg-amber-100 text-amber-700",
  UPLOAD: "bg-indigo-100 text-indigo-700",
  APPROVE: "bg-emerald-100 text-emerald-700",
  REJECT: "bg-rose-100 text-rose-700",
  LOCK: "bg-orange-100 text-orange-700",
  COMPUTE: "bg-teal-100 text-teal-700",
  SKILL_TAG: "bg-violet-100 text-violet-700",
}

export function AuditStats({ locationId }: AuditStatsProps) {
  const [stats, setStats] = useState<AuditStatsResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!locationId) return
    setLoading(true)
    getAuditStats(locationId)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [locationId])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) return null

  const sortedActions = Object.entries(stats.by_action)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Total Events ({stats.period})
              </p>
              <p className="text-2xl font-bold">{stats.total_events}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Top Actions</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {sortedActions.map(([action, count]) => (
              <Badge
                key={action}
                className={`${ACTION_COLORS[action] || "bg-gray-100 text-gray-700"} text-xs`}
              >
                {action}: {count}
              </Badge>
            ))}
            {sortedActions.length === 0 && (
              <span className="text-sm text-muted-foreground">
                No activity this week
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
