import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { getBranchAnalytics } from "@/api/analytics"
import type { BranchAnalytics } from "@/types/analytics"
import { WorkforceOverview } from "@/components/analytics/WorkforceOverview"
import { DeptBreakdownChart } from "@/components/analytics/DeptBreakdownChart"
import { LevelPyramid } from "@/components/analytics/LevelPyramid"
import { TrendLineChart } from "@/components/analytics/TrendLineChart"
import { SpanOfControl } from "@/components/analytics/SpanOfControl"
import { CrossReportingView } from "@/components/analytics/CrossReportingView"
import { ProjectOverview } from "@/components/analytics/ProjectOverview"

export function AnalyticsPage() {
  const user = useAuthStore((s) => s.user)
  const [data, setData] = useState<BranchAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getBranchAnalytics(user.branch_location_id)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Failed to load analytics
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold">Branch Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Workforce insights for {user?.branch_code} branch
        </p>
      </div>

      <WorkforceOverview data={data} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DeptBreakdownChart data={data.department_breakdown} />
        <LevelPyramid data={data.level_breakdown} />
      </div>

      <TrendLineChart data={data.monthly_trend} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SpanOfControl data={data.span_of_control} />
        <CrossReportingView data={data.cross_reports} />
      </div>

      <ProjectOverview
        projects={data.projects}
        orphaned={data.orphaned_projects}
      />

      {data.departments_without_manager.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-700 mb-2">
            Departments Without Manager
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.departments_without_manager.map((dept) => (
              <span
                key={dept}
                className="rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-700"
              >
                {dept}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
