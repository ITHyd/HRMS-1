import { useEffect, useState, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { SlidersHorizontal, Search, X } from "lucide-react"
import { PeriodSelector } from "@/components/shared/PeriodSelector"
import { ExecutiveOverview } from "@/components/dashboard/ExecutiveOverview"
import { ClassificationDonut } from "@/components/dashboard/ClassificationDonut"
import { UtilisationTrendChart } from "@/components/dashboard/UtilisationTrendChart"
import { TopProjectsChart } from "@/components/dashboard/TopProjectsChart"
import { ProjectHealthTable } from "@/components/dashboard/ProjectHealthTable"
import { ResourceAllocationTable } from "@/components/dashboard/ResourceAllocationTable"
import { SelectDropdown } from "@/components/shared/SelectDropdown"
import {
  getExecutiveDashboard,
  getProjectDashboard,
  getResourceAllocationDashboard,
} from "@/api/dashboard"
import { listProjectClients } from "@/api/projects"
import { useOrgChartStore } from "@/store/orgChartStore"
import type { ExecutiveDashboard, ResourceAllocationEntry, ProjectDashboardEntry } from "@/types/dashboard"

type TabKey = "executive" | "resources" | "projects"

const TABS: { key: TabKey; label: string }[] = [
  { key: "executive", label: "Executive" },
  { key: "resources", label: "Resources" },
  { key: "projects", label: "Projects" },
]

const CLASSIFICATION_OPTIONS = [
  { value: "", label: "All Classifications" },
  { value: "fully_billed", label: "Fully Billed" },
  { value: "partially_billed", label: "Partially Billed" },
  { value: "bench", label: "Bench" },
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
  const setDrawerPeriod = useOrgChartStore((s) => s.setDrawerPeriod)
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const p = getCurrentPeriod()
    return p
  })
  const [activeTab, setActiveTab] = useState<TabKey>("executive")
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  // Keep drawer period in sync with dashboard period
  useEffect(() => {
    setDrawerPeriod(selectedPeriod)
    return () => setDrawerPeriod(null)
  }, [selectedPeriod, setDrawerPeriod])

  // Filter state
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [classificationFilter, setClassificationFilter] = useState("")
  const [clientFilter, setClientFilter] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchInput = (value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchQuery(value)
      setResourcePage(1)
    }, 300)
  }

  // Executive tab state
  const [executiveData, setExecutiveData] = useState<ExecutiveDashboard | null>(null)

  // Resources tab state (combined resource + allocation)
  const [resourceEntries, setResourceEntries] = useState<ResourceAllocationEntry[]>([])
  const [resourceTotal, setResourceTotal] = useState(0)
  const [resourcePage, setResourcePage] = useState(1)
  const [resourcePageSize, setResourcePageSize] = useState(20)
  const [clientOptions, setClientOptions] = useState<string[]>([])

  // Load client list for global filter
  useEffect(() => {
    listProjectClients().then(setClientOptions).catch(() => {})
  }, [])

  // Projects tab state
  const [projectEntries, setProjectEntries] = useState<ProjectDashboardEntry[]>([])

  const fetchExecutiveData = useCallback(async (period: string, client?: string) => {
    setLoading(true)
    try {
      const data = await getExecutiveDashboard({ period, client_name: client || undefined })
      setExecutiveData(data)
    } catch (err) {
      console.error("Failed to load executive dashboard:", err)
      setExecutiveData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchResourceData = useCallback(
    async (period: string, search?: string, classification?: string, client?: string, page?: number, pageSize?: number) => {
      setLoading(true)
      try {
        const data = await getResourceAllocationDashboard({
          period,
          search: search || undefined,
          classification: classification || undefined,
          client_name: client || undefined,
          page: page || 1,
          page_size: pageSize || 20,
        })
        setResourceEntries(data.entries)
        setResourceTotal(data.total)
      } catch (err) {
        console.error("Failed to load resource allocation dashboard:", err)
        setResourceEntries([])
        setResourceTotal(0)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const fetchProjectData = useCallback(async (period: string, client?: string) => {
    setLoading(true)
    try {
      const data = await getProjectDashboard({ period, client_name: client || undefined, page_size: 100 })
      setProjectEntries(data.projects)
    } catch (err) {
      console.error("Failed to load project dashboard:", err)
      setProjectEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    switch (activeTab) {
      case "executive":
        fetchExecutiveData(selectedPeriod, clientFilter)
        break
      case "resources":
        fetchResourceData(selectedPeriod, searchQuery, classificationFilter, clientFilter, resourcePage, resourcePageSize)
        break
      case "projects":
        fetchProjectData(selectedPeriod, clientFilter)
        break
    }
  }, [
    activeTab,
    selectedPeriod,
    fetchExecutiveData,
    fetchResourceData,
    fetchProjectData,
    searchQuery,
    classificationFilter,
    clientFilter,
    resourcePage,
    resourcePageSize,
  ])

  const resetFilters = () => {
    setSearchInput("")
    setSearchQuery("")
    setClassificationFilter("")
    setResourcePage(1)
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
          (p.client_name || "").toLowerCase().includes(q) ||
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
          {clientOptions.length > 0 && (
            <SelectDropdown
              value={clientFilter}
              onChange={(v) => { setClientFilter(v); setResourcePage(1) }}
              options={[
                { value: "", label: "All Clients" },
                ...clientOptions.map((c) => ({ value: c, label: c })),
              ]}
              placeholder="All Clients"
              maxVisible={8}
            />
          )}
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
              {/* Search */}
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  placeholder={
                    activeTab === "resources"
                      ? "Search name, project, client..."
                      : "Search project, client, member..."
                  }
                  value={searchInput}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* Classification filter — resources tab only */}
              {activeTab === "resources" && (
                <SelectDropdown
                  value={classificationFilter}
                  onChange={(v) => { setClassificationFilter(v); setResourcePage(1) }}
                  options={CLASSIFICATION_OPTIONS}
                  placeholder="All Classifications"
                  maxVisible={5}
                />
              )}

              {/* Clear */}
              {(searchQuery || classificationFilter) && (
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

          {/* Resources Tab (combined resource + allocation) */}
          {activeTab === "resources" && (
            <ResourceAllocationTable
              entries={resourceEntries}
              total={resourceTotal}
              page={resourcePage}
              pageSize={resourcePageSize}
              onPageChange={setResourcePage}
              onPageSizeChange={(size) => { setResourcePageSize(size); setResourcePage(1) }}
            />
          )}

          {/* Projects Tab */}
          {activeTab === "projects" && (
            <ProjectHealthTable projects={filteredProjects} />
          )}
        </>
      )}
    </div>
  )
}
