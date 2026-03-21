import { useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Users, UserMinus, UserCheck, SlidersHorizontal, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ExportButton } from "@/components/shared/ExportButton"
import { DataSourceToggle } from "@/components/shared/DataSourceToggle"
import { PeriodSelector } from "@/components/shared/PeriodSelector"
import { BenchFilters } from "@/components/availability/BenchFilters"
import { BenchPoolTable } from "@/components/availability/BenchPoolTable"
import { getBenchPool, exportBenchPool } from "@/api/availability"
import { useDataSourceStore } from "@/store/dataSourceStore"
import { useOrgChartStore } from "@/store/orgChartStore"
import { useReportPeriodStore } from "@/store/reportPeriodStore"
import type { AvailableEmployee } from "@/types/availability"

export function AvailabilityPage() {
  const dataSource = useDataSourceStore((s) => s.dataSource)
  const selectedPeriod = useReportPeriodStore((s) => s.selectedPeriod)
  const setSelectedPeriod = useReportPeriodStore((s) => s.setSelectedPeriod)
  const setDrawerPeriod = useOrgChartStore((s) => s.setDrawerPeriod)
  const setDrawerDataSource = useOrgChartStore((s) => s.setDrawerDataSource)
  const [searchQuery, setSearchQuery] = useState("")
  const [skillFilter, setSkillFilter] = useState("")
  const [classificationFilter, setClassificationFilter] = useState("")
  const [locationFilter, setLocationFilter] = useState("")
  const [designationFilter, setDesignationFilter] = useState("")
  const [utilisationMin, setUtilisationMin] = useState<number | undefined>()
  const [utilisationMax, setUtilisationMax] = useState<number | undefined>()
  const [employees, setEmployees] = useState<AvailableEmployee[]>([])
  const [total, setTotal] = useState(0)
  const [benchCount, setBenchCount] = useState(0)
  const [partialCount, setPartialCount] = useState(0)
  const [avgBenchDays, setAvgBenchDays] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    setDrawerDataSource(dataSource)
  }, [dataSource, setDrawerDataSource])

  useEffect(() => {
    return () => setDrawerPeriod(null)
  }, [setDrawerPeriod])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getBenchPool({
        period: dataSource === "excel" ? selectedPeriod : undefined,
        search: searchQuery || undefined,
        skill: skillFilter || undefined,
        classification: classificationFilter || undefined,
        location: locationFilter || undefined,
        designation: designationFilter || undefined,
        utilisation_min: utilisationMin,
        utilisation_max: utilisationMax,
        data_source: dataSource,
        page,
        page_size: pageSize,
      })
      setEmployees(data.employees)
      setTotal(data.total)
      setBenchCount(data.bench_count)
      setPartialCount(data.partial_count)
      setAvgBenchDays(data.avg_bench_days ?? null)
      setDrawerPeriod(dataSource === "excel" ? data.period ?? selectedPeriod : null)
    } catch (err) {
      console.error("Failed to load standby team:", err)
      setEmployees([])
      setTotal(0)
      setBenchCount(0)
      setPartialCount(0)
      setAvgBenchDays(null)
    } finally {
      setLoading(false)
    }
  }, [
    searchQuery,
    skillFilter,
    classificationFilter,
    locationFilter,
    designationFilter,
    utilisationMin,
    utilisationMax,
    page,
    pageSize,
    dataSource,
    selectedPeriod,
    setDrawerPeriod,
  ])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setPage(1)
  }, [selectedPeriod, dataSource])

  const handleSearch = (query: string) => { setSearchQuery(query); setPage(1) }
  const handleSkillFilter = (skill: string) => { setSkillFilter(skill); setPage(1) }
  const handleClassificationFilter = (c: string) => { setClassificationFilter(c); setPage(1) }
  const handleLocationFilter = (loc: string) => { setLocationFilter(loc); setPage(1) }
  const handleDesignationFilter = (d: string) => { setDesignationFilter(d); setPage(1) }
  const handleUtilisationRange = (min: number | undefined, max: number | undefined) => {
    setUtilisationMin(min)
    setUtilisationMax(max)
    setPage(1)
  }
  const handlePageChange = (newPage: number) => setPage(newPage)
  const handlePageSizeChange = (size: number) => { setPageSize(size); setPage(1) }

  const hasActiveFilters = !!(
    searchQuery || skillFilter || classificationFilter || locationFilter ||
    designationFilter || utilisationMin !== undefined || utilisationMax !== undefined
  )

  const activeFilterCount = [
    searchQuery, skillFilter, classificationFilter, locationFilter, designationFilter,
    utilisationMin !== undefined || utilisationMax !== undefined ? "range" : "",
  ].filter(Boolean).length

  /** Format average bench days as "Xmo Yd" or "Xd" */
  function fmtAvgDays(days: number | null): string {
    if (days == null) return "—"
    if (days < 30) return `${days}d`
    const mo = Math.floor(days / 30)
    const rem = days % 30
    return rem > 0 ? `${mo}mo ${rem}d` : `${mo}mo`
  }

  const summaryCards = [
    {
      title: "Total Available",
      value: loading ? "—" : String(total),
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      sub: null,
    },
    {
      title: "On Standby Period",
      value: loading ? "—" : String(benchCount),
      icon: UserMinus,
      color: "text-red-600",
      bgColor: "bg-red-50",
      sub: avgBenchDays != null ? `Avg ${fmtAvgDays(avgBenchDays)} on standby period` : null,
    },
    {
      title: "Partially Billed",
      value: loading ? "—" : String(partialCount),
      icon: UserCheck,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      sub: null,
    },
    {
      title: "Avg. Standby Period Duration",
      value: loading ? "—" : fmtAvgDays(avgBenchDays),
      icon: Clock,
      color: avgBenchDays != null && avgBenchDays > 45 ? "text-red-600" : "text-violet-600",
      bgColor: avgBenchDays != null && avgBenchDays > 45 ? "bg-red-50" : "bg-violet-50",
      sub: avgBenchDays != null && avgBenchDays > 45 ? "Action needed" : null,
    },
  ]

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Standby Team</h2>
          <p className="text-sm text-muted-foreground">
            {dataSource === "excel"
              ? "Excel-driven standby status with HRMS enrichment for skills and project history"
              : "Track bench status, project history, and resource availability"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DataSourceToggle />
          {dataSource === "excel" && (
            <PeriodSelector value={selectedPeriod} onChange={setSelectedPeriod} />
          )}
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
            className="h-8 text-xs relative"
          >
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
          {dataSource === "hrms" && (
            <ExportButton
              onExport={exportBenchPool}
              filename="standby-team.csv"
              label="Export CSV"
            />
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${card.bgColor}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-semibold tabular-nums">{card.value}</p>
                  {card.sub && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{card.sub}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Collapsible Filters */}
      {showFilters && (
        <BenchFilters
          dataSource={dataSource}
          period={dataSource === "excel" ? selectedPeriod : undefined}
          onSearch={handleSearch}
          onSkillFilter={handleSkillFilter}
          onClassificationFilter={handleClassificationFilter}
          onLocationFilter={handleLocationFilter}
          onDesignationFilter={handleDesignationFilter}
          onUtilisationRange={handleUtilisationRange}
          searchQuery={searchQuery}
          skillFilter={skillFilter}
          classificationFilter={classificationFilter}
          locationFilter={locationFilter}
          designationFilter={designationFilter}
          utilisationMin={utilisationMin}
          utilisationMax={utilisationMax}
        />
      )}

      {/* Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <BenchPoolTable
          employees={employees}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onRefresh={fetchData}
          hasActiveFilters={hasActiveFilters}
        />
      )}
    </div>
  )
}
