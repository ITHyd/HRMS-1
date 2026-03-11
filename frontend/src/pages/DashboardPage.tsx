import { useEffect, useState, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { SlidersHorizontal, Search, X } from "lucide-react"
import { PeriodSelector } from "@/components/shared/PeriodSelector"
import { ExecutiveOverview } from "@/components/dashboard/ExecutiveOverview"
import { ClassificationDonut } from "@/components/dashboard/ClassificationDonut"
import { UtilisationTrendChart } from "@/components/dashboard/UtilisationTrendChart"
import { TopProjectsChart } from "@/components/dashboard/TopProjectsChart"
import { ResourceTable } from "@/components/dashboard/ResourceTable"
import { ProjectHealthTable } from "@/components/dashboard/ProjectHealthTable"
import { AllocationsTable } from "@/components/dashboard/AllocationsTable"
import {
  getExecutiveDashboard,
  getResourceDashboard,
  getProjectDashboard,
  getAllocationDashboard,
} from "@/api/dashboard"
import type { ExecutiveDashboard, AllocationEntry } from "@/types/dashboard"
import type { ResourceDashboardEntry, ProjectDashboardEntry } from "@/types/dashboard"

type TabKey = "executive" | "resources" | "projects" | "allocations"

const TABS: { key: TabKey; label: string }[] = [
  { key: "executive", label: "Executive" },
  { key: "resources", label: "Resources" },
  { key: "projects", label: "Projects" },
  { key: "allocations", label: "Allocations" },
]

const AVAILABILITY_COLORS: Record<string, string> = {
  available: "#22c55e",
  fully_allocated: "#3b82f6",
  over_allocated: "#ef4444",
}

const AVAILABILITY_LABELS: Record<string, string> = {
  available: "Available",
  fully_allocated: "Fully Allocated",
  over_allocated: "Over Allocated",
}

function getCurrentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}


export function DashboardPage() {
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriod())
  const [activeTab, setActiveTab] = useState<TabKey>("executive")
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  // Filter state
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchInput = (value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchQuery(value)
      setResourcePage(1)
      setAllocationPage(1)
    }, 300)
  }

  // Executive tab state
  const [executiveData, setExecutiveData] = useState<ExecutiveDashboard | null>(null)

  // Resources tab state
  const [resourceEntries, setResourceEntries] = useState<ResourceDashboardEntry[]>([])
  const [resourceTotal, setResourceTotal] = useState(0)
  const [resourcePage, setResourcePage] = useState(1)
  const [resourcePageSize, setResourcePageSize] = useState(20)

  // Projects tab state
  const [projectEntries, setProjectEntries] = useState<ProjectDashboardEntry[]>([])

  // Allocations tab state
  const [allocationEntries, setAllocationEntries] = useState<AllocationEntry[]>([])
  const [allocationTotal, setAllocationTotal] = useState(0)
  const [allocationPage, setAllocationPage] = useState(1)
  const [allocationPageSize, setAllocationPageSize] = useState(20)

  const fetchExecutiveData = useCallback(async (period: string) => {
    setLoading(true)
    try {
      const data = await getExecutiveDashboard(period)
      setExecutiveData(data)
    } catch (err) {
      console.error("Failed to load executive dashboard:", err)
      setExecutiveData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchResourceData = useCallback(
    async (period: string, search?: string, classification?: string, page?: number, pageSize?: number) => {
      setLoading(true)
      try {
        const data = await getResourceDashboard({
          period,
          search: search || undefined,
          classification: classification || undefined,
          page: page || 1,
          page_size: pageSize || 20,
        })
        setResourceEntries(data.entries)
        setResourceTotal(data.total)
      } catch (err) {
        console.error("Failed to load resource dashboard:", err)
        setResourceEntries([])
        setResourceTotal(0)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const fetchProjectData = useCallback(async (period: string) => {
    setLoading(true)
    try {
      const data = await getProjectDashboard({ period, page_size: 100 })
      setProjectEntries(data.projects)
    } catch (err) {
      console.error("Failed to load project dashboard:", err)
      setProjectEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchAllocationData = useCallback(
    async (period: string, search?: string, page?: number, pageSize?: number) => {
      setLoading(true)
      try {
        const data = await getAllocationDashboard({
          period,
          search: search || undefined,
          page: page || 1,
          page_size: pageSize || 20,
        })
        setAllocationEntries(data.allocations)
        setAllocationTotal(data.total)
      } catch (err) {
        console.error("Failed to load allocation dashboard:", err)
        setAllocationEntries([])
        setAllocationTotal(0)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    switch (activeTab) {
      case "executive":
        fetchExecutiveData(selectedPeriod)
        break
      case "resources":
        fetchResourceData(selectedPeriod, searchQuery, undefined, resourcePage, resourcePageSize)
        break
      case "projects":
        fetchProjectData(selectedPeriod)
        break
      case "allocations":
        fetchAllocationData(selectedPeriod, searchQuery, allocationPage, allocationPageSize)
        break
    }
  }, [
    activeTab,
    selectedPeriod,
    fetchExecutiveData,
    fetchResourceData,
    fetchProjectData,
    fetchAllocationData,
    searchQuery,
    resourcePage,
    resourcePageSize,
    allocationPage,
    allocationPageSize,
  ])

  const resetFilters = () => {
    setSearchInput("")
    setSearchQuery("")
    setResourcePage(1)
    setAllocationPage(1)
  }

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period)
    resetFilters()
  }

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab)
    resetFilters()
    setShowFilters(false)
  }

  // Client-side filtered projects (search is client-side for this tab)
  const filteredProjects = searchQuery
    ? projectEntries.filter((p) => {
        const q = searchQuery.toLowerCase()
        return (
          p.project_name.toLowerCase().includes(q) ||
          (p.department || "").toLowerCase().includes(q) ||
          (p.members || []).some((m) => m.employee_name.toLowerCase().includes(q))
        )
      })
    : projectEntries

  // Resource availability chart
  const availabilityData = executiveData
    ? [
        {
          name: AVAILABILITY_LABELS.available,
          value: executiveData.resource_availability.available,
          fill: AVAILABILITY_COLORS.available,
        },
        {
          name: AVAILABILITY_LABELS.fully_allocated,
          value: executiveData.resource_availability.fully_allocated,
          fill: AVAILABILITY_COLORS.fully_allocated,
        },
        {
          name: AVAILABILITY_LABELS.over_allocated,
          value: executiveData.resource_availability.over_allocated,
          fill: AVAILABILITY_COLORS.over_allocated,
        },
      ].filter((d) => d.value > 0)
    : []

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Commercial Visibility Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Utilisation and billing insights across the branch
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector value={selectedPeriod} onChange={handlePeriodChange} />
          {activeTab !== "executive" && (
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`cursor-pointer inline-flex items-center gap-1.5 h-8 rounded-md border px-3 text-xs font-medium transition-colors ${
                showFilters
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input hover:bg-muted text-muted-foreground"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`cursor-pointer px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters Panel */}
      {activeTab !== "executive" && showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Search — all non-executive tabs */}
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  placeholder={
                    activeTab === "resources"
                      ? "Search name, designation, dept..."
                      : activeTab === "projects"
                      ? "Search project, department, member..."
                      : "Search employee, project, client..."
                  }
                  value={searchInput}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* Clear */}
              {searchQuery && (
                <button
                  onClick={resetFilters}
                  className="cursor-pointer inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Executive Tab */}
          {activeTab === "executive" && executiveData && (
            <div className="space-y-6">
              <ExecutiveOverview data={executiveData} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ClassificationDonut data={executiveData.classification_breakdown} />
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Resource Availability</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {availabilityData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={availabilityData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {availabilityData.map((entry, index) => (
                              <Cell key={index} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value, name) => [
                              `${value} employees`,
                              name,
                            ]}
                          />
                          <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            formatter={(value: string) => (
                              <span className="text-xs text-muted-foreground">{value}</span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                        No availability data for this period
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <UtilisationTrendChart data={executiveData.trend} />

              <TopProjectsChart data={executiveData.top_consuming_projects} />
            </div>
          )}

          {activeTab === "executive" && !executiveData && (
            <div className="p-6 text-center text-muted-foreground">
              No executive data available for this period. Run an HRMS sync first.
            </div>
          )}

          {/* Resources Tab */}
          {activeTab === "resources" && (
            <ResourceTable
              entries={resourceEntries}
              onSearch={() => {}}
              searchQuery=""
              classification=""
              onClassificationChange={() => {}}
              total={resourceTotal}
              page={resourcePage}
              pageSize={resourcePageSize}
              onPageChange={setResourcePage}
              onPageSizeChange={(size) => { setResourcePageSize(size); setResourcePage(1) }}
              hideInlineFilters
            />
          )}

          {/* Projects Tab */}
          {activeTab === "projects" && (
            <ProjectHealthTable projects={filteredProjects} />
          )}

          {/* Allocations Tab */}
          {activeTab === "allocations" && (
            <AllocationsTable
              entries={allocationEntries}
              onSearch={() => {}}
              searchQuery=""
              total={allocationTotal}
              page={allocationPage}
              pageSize={allocationPageSize}
              onPageChange={setAllocationPage}
              onPageSizeChange={(size) => { setAllocationPageSize(size); setAllocationPage(1) }}
              hideInlineFilters
            />
          )}
        </>
      )}
    </div>
  )
}
