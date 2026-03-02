import { useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Users, UserMinus, UserCheck } from "lucide-react"
import { ExportButton } from "@/components/shared/ExportButton"
import { BenchFilters } from "@/components/availability/BenchFilters"
import { BenchPoolTable } from "@/components/availability/BenchPoolTable"
import { getBenchPool, exportBenchPool } from "@/api/availability"
import type { AvailableEmployee } from "@/types/availability"

const PAGE_SIZE = 20

export function AvailabilityPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [skillFilter, setSkillFilter] = useState("")
  const [classificationFilter, setClassificationFilter] = useState("")
  const [employees, setEmployees] = useState<AvailableEmployee[]>([])
  const [total, setTotal] = useState(0)
  const [benchCount, setBenchCount] = useState(0)
  const [partialCount, setPartialCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getBenchPool({
        search: searchQuery || undefined,
        skill: skillFilter || undefined,
        classification: classificationFilter || undefined,
        page,
        page_size: PAGE_SIZE,
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
  }, [searchQuery, skillFilter, classificationFilter, page])

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

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

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
        <ExportButton
          onExport={exportBenchPool}
          filename="bench-pool.csv"
          label="Export Bench CSV"
        />
      </div>

      {/* Filters */}
      <BenchFilters
        onSearch={handleSearch}
        onSkillFilter={handleSkillFilter}
        onClassificationFilter={handleClassificationFilter}
        searchQuery={searchQuery}
        skillFilter={skillFilter}
        classificationFilter={classificationFilter}
      />

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
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
          onRefresh={fetchData}
        />
      )}
    </div>
  )
}
