import { Card, CardContent } from "@/components/ui/card"
import { Users, Building2, Layers, GitBranch } from "lucide-react"
import type { BranchAnalytics } from "@/types/analytics"

export function WorkforceOverview({ data }: { data: BranchAnalytics }) {
  const stats = [
    { label: "Total Headcount", value: data.total_headcount, icon: Users, color: "text-blue-600" },
    { label: "Clients", value: data.client_breakdown.length, icon: Building2, color: "text-green-600" },
    { label: "Hierarchy Depth", value: data.hierarchy_depth, icon: Layers, color: "text-amber-600" },
    { label: "Cross Reports", value: data.cross_reports.length, icon: GitBranch, color: "text-purple-600" },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              <stat.icon className={`h-8 w-8 ${stat.color} opacity-70`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
