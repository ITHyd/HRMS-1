import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PlannedVsActualData } from "@/api/excelUtilisation"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

export function PlannedVsActualCard({ data }: { data: PlannedVsActualData }) {
  const variance = data.variance_pct
  const VarianceIcon = variance > 2 ? TrendingUp : variance < -2 ? TrendingDown : Minus
  const varianceColor = variance > 2 ? "text-green-600" : variance < -2 ? "text-red-600" : "text-muted-foreground"
  const maxPct = Math.max(data.planned_utilisation_pct, data.actual_utilisation_pct, 1)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Planned vs Actual Utilisation</CardTitle>
        <p className="text-xs text-muted-foreground">{data.period}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-blue-50 p-3 text-center">
            <p className="text-[11px] text-blue-600 font-medium">Planned</p>
            <p className="text-xl font-bold text-blue-700 tabular-nums">{data.planned_utilisation_pct}%</p>
            <p className="text-[10px] text-blue-500 tabular-nums">{data.total_planned_days}d</p>
          </div>
          <div className="rounded-lg bg-green-50 p-3 text-center">
            <p className="text-[11px] text-green-600 font-medium">Actual</p>
            <p className="text-xl font-bold text-green-700 tabular-nums">{data.actual_utilisation_pct}%</p>
            <p className="text-[10px] text-green-500 tabular-nums">{data.total_worked_days}d</p>
          </div>
          <div className={`rounded-lg p-3 text-center ${variance >= 0 ? "bg-green-50" : "bg-red-50"}`}>
            <p className={`text-[11px] font-medium ${varianceColor}`}>Variance</p>
            <div className={`flex items-center justify-center gap-0.5 ${varianceColor}`}>
              <VarianceIcon className="h-4 w-4" />
              <p className="text-xl font-bold tabular-nums">{variance > 0 ? "+" : ""}{variance}%</p>
            </div>
            <p className={`text-[10px] tabular-nums ${varianceColor}`}>
              {variance >= 0 ? "on track" : "behind plan"}
            </p>
          </div>
        </div>

        {/* Visual bars */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-14 shrink-0">Planned</span>
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-400 transition-all"
                style={{ width: `${(data.planned_utilisation_pct / maxPct) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium tabular-nums w-10 text-right">{data.planned_utilisation_pct}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-14 shrink-0">Actual</span>
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${variance >= 0 ? "bg-green-400" : "bg-red-400"}`}
                style={{ width: `${(data.actual_utilisation_pct / maxPct) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium tabular-nums w-10 text-right">{data.actual_utilisation_pct}%</span>
          </div>
        </div>


      </CardContent>
    </Card>
  )
}
