import { Card, CardContent } from "@/components/ui/card"
import { Users, TrendingUp, TrendingDown, UserX, Percent, PoundSterling } from "lucide-react"
import type { ExecutiveDashboard } from "@/types/dashboard"
import { useNotificationStore } from "@/store/notificationStore"

interface ExecutiveOverviewProps {
  data: ExecutiveDashboard
  onStatClick?: (statKey: string) => void
}

export function ExecutiveOverview({ data, onStatClick }: ExecutiveOverviewProps) {
  const dismissed = useNotificationStore((s) => s.dismissed)
  const summary = useNotificationStore((s) => s.summary)
  const dismiss = useNotificationStore((s) => s.dismiss)

  const billableLow = summary?.details.billable_low ?? []
  const showBillableBadge =
    billableLow.length > 0 && !dismissed.has("billable_low:branch")

  const stats = [
    {
      key: "total_active",
      label: "Total Active",
      value: data.total_active_employees,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
      clickable: true,
    },
    {
      key: "billable",
      label: "Billable",
      value: data.billable_count,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
      clickable: true,
    },
    {
      key: "non_billable",
      label: "Non-Billable",
      value: data.non_billable_count,
      icon: TrendingDown,
      color: "text-amber-600",
      bg: "bg-amber-50",
      clickable: data.non_billable_count > 0,
    },
    {
      key: "standby",
      label: "Standby Period",
      value: data.bench_count,
      icon: UserX,
      color: "text-red-600",
      bg: "bg-red-50",
      clickable: true,
    },
    {
      key: "overall_utilisation",
      label: "Overall Utilisation",
      value: `${(data.overall_utilisation_percent ?? 0).toFixed(1)}%`,
      icon: Percent,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      clickable: false,
    },
    {
      key: "billable_percent",
      label: "Billable %",
      value: `${(data.overall_billable_percent ?? 0).toFixed(1)}%`,
      icon: PoundSterling,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      clickable: false,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          onClick={() => stat.clickable && onStatClick?.(stat.key)}
          className={stat.clickable ? "cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md" : ""}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
                {stat.clickable
                }
                {stat.label === "Billable %" && showBillableBadge && (
                  <span
                    title={`Below ${billableLow[0]?.target_pct ?? 75}% target · Right-click to dismiss`}
                    onContextMenu={(e) => { e.preventDefault(); dismiss("billable_low", "branch") }}
                    className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 cursor-context-menu select-none"
                  >
                    📉 Below target
                  </span>
                )}
              </div>
              <div className={`rounded-lg p-2 ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
