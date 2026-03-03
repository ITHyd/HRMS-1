import { useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Users, UserMinus, UserCheck, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ExportButton } from "@/components/shared/ExportButton"
import { BenchFilters } from "@/components/availability/BenchFilters"
import { BenchPoolTable } from "@/components/availability/BenchPoolTable"
import { getBenchPool, exportBenchPool } from "@/api/availability"
import type { AvailableEmployee } from "@/types/availability"

export function AvailabilityPage() {
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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getBenchPool({
        search: searchQuery || undefined,
        skill: skillFilter || undefined,
        classification: classificationFilter || undefined,
        location: locationFilter || undefined,
        designation: designationFilter || undefined,
        utilisation_min: utilisationMin,
        utilisation_max: utilisationMax,
        page,
        page_size: pageSize,
      })
      setEmployees(data.employees)
      setTotal(data.total)
      setBenchCount(data.bench_count)
      setPartialCount(data.partial_count)
    } catch (err) {
      console.error("Failed to load bench pool:", err)
      setEmployees([])
      setTotal(0)
      setBenchCount(0)
      setPartialCount(0)
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
  ])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setPage(1)
  }

  const handleSkillFilter = (skill: string) => {
    setSkillFilter(skill)
    setPage(1)
  }

  const handleClassificationFilter = (classification: string) => {
    setClassificationFilter(classification)
    setPage(1)
  }

  const handleLocationFilter = (location: string) => {
    setLocationFilter(location)
    setPage(1)
  }

  const handleDesignationFilter = (designation: string) => {
    setDesignationFilter(designation)
    setPage(1)
  }

  const handleUtilisationRange = (
    min: number | undefined,
    max: number | undefined
  ) => {
    setUtilisationMin(min)
    setUtilisationMax(max)
    setPage(1)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setPage(1)
  }

  const hasActiveFilters = !!(
    searchQuery ||
    skillFilter ||
    classificationFilter ||
    locationFilter ||
    designationFilter ||
    utilisationMin !== undefined ||
    utilisationMax !== undefined
  )

  const activeFilterCount = [
    searchQuery,
    skillFilter,
    classificationFilter,
    locationFilter,
    designationFilter,
    utilisationMin !== undefined || utilisationMax !== undefined ? "range" : "",
  ].filter(Boolean).length

  const summaryCards = [
    {
      title: "Total Available",
      value: total,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Bench",
      value: benchCount,
      icon: UserMinus,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Partially Billed",
      value: partialCount,
      icon: UserCheck,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
  ]

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Bench Pool &amp; Availability</h2>
          <p className="text-sm text-muted-foreground">
            View and manage available employees, skills, and bench status
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <ExportButton
            onExport={exportBenchPool}
            filename="bench-pool.csv"
            label="Export Bench CSV"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${card.bgColor}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {loading ? "-" : card.value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Collapsible Filters */}
      {showFilters && (
        <BenchFilters
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
