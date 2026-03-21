import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { getBranchAnalytics } from "@/api/analytics"
import { DataSourceToggle } from "@/components/shared/DataSourceToggle"
import type { BranchAnalytics } from "@/types/analytics"
import { WorkforceOverview } from "@/components/analytics/WorkforceOverview"
import { ClientBreakdownChart } from "@/components/analytics/DeptBreakdownChart"
import { LevelPyramid } from "@/components/analytics/LevelPyramid"
import { TrendLineChart } from "@/components/analytics/TrendLineChart"
import { SpanOfControl } from "@/components/analytics/SpanOfControl"
import { CrossReportingView } from "@/components/analytics/CrossReportingView"
import { ProjectOverview } from "@/components/analytics/ProjectOverview"
import { useDataSourceStore } from "@/store/dataSourceStore"
import { useOrgChartStore } from "@/store/orgChartStore"
import { useReportPeriodStore } from "@/store/reportPeriodStore"
import { PeriodSelector } from "@/components/shared/PeriodSelector"

export function AnalyticsPage() {
  const user = useAuthStore((s) => s.user)
  const dataSource = useDataSourceStore((s) => s.dataSource)
  const selectedPeriod = useReportPeriodStore((s) => s.selectedPeriod)
  const setSelectedPeriod = useReportPeriodStore((s) => s.setSelectedPeriod)
  const setDrawerPeriod = useOrgChartStore((s) => s.setDrawerPeriod)
  const setDrawerDataSource = useOrgChartStore((s) => s.setDrawerDataSource)
  const [data, setData] = useState<BranchAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setDrawerDataSource(dataSource)
  }, [dataSource, setDrawerDataSource])

  useEffect(() => {
    setDrawerPeriod(dataSource === "excel" ? data?.period ?? null : null)
    return () => setDrawerPeriod(null)
  }, [data?.period, dataSource, setDrawerPeriod])

  useEffect(() => {
    if (!user) return
    let isActive = true
    queueMicrotask(() => {
      if (!isActive) return
      setLoading(true)
      getBranchAnalytics(
        user.branch_location_id,
        dataSource,
        dataSource === "excel" ? selectedPeriod : undefined
      )
        .then((result) => {
          if (isActive) setData(result)
        })
        .catch(console.error)
        .finally(() => {
          if (isActive) setLoading(false)
        })
    })
    return () => {
      isActive = false
    }
  }, [dataSource, selectedPeriod, user])

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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Branch Analytics</h2>
          <p className="text-sm text-muted-foreground">
            {dataSource === "excel" && data?.period
              ? `Excel-enriched workforce insights for ${user?.branch_code} branch (${data.period})`
              : `Workforce insights for ${user?.branch_code} branch`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DataSourceToggle />
          {dataSource === "excel" && (
            <PeriodSelector value={selectedPeriod} onChange={setSelectedPeriod} />
          )}
        </div>
      </div>

      <WorkforceOverview data={data} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClientBreakdownChart data={data.client_breakdown} />
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
