import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { Calculator, Loader2 } from "lucide-react"
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
import { computeUtilisation } from "@/api/utilisation"
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
  const [computing, setComputing] = useState(false)

  // Executive tab state
  const [executiveData, setExecutiveData] = useState<ExecutiveDashboard | null>(null)

  // Resources tab state
  const [resourceEntries, setResourceEntries] = useState<ResourceDashboardEntry[]>([])
  const [resourceTotal, setResourceTotal] = useState(0)
  const [resourceSearch, setResourceSearch] = useState("")
  const [resourceClassification, setResourceClassification] = useState("")
  const [resourcePage, setResourcePage] = useState(1)

  // Projects tab state
  const [projectEntries, setProjectEntries] = useState<ProjectDashboardEntry[]>([])

  // Allocations tab state
  const [allocationEntries, setAllocationEntries] = useState<AllocationEntry[]>([])
  const [allocationTotal, setAllocationTotal] = useState(0)
  const [allocationSearch, setAllocationSearch] = useState("")
  const [allocationPage, setAllocationPage] = useState(1)

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
    async (period: string, search?: string, classification?: string, page?: number) => {
      setLoading(true)
      try {
        const data = await getResourceDashboard({
          period,
          search: search || undefined,
          classification: classification || undefined,
          page: page || 1,
          page_size: 20,
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
    async (period: string, search?: string, page?: number) => {
      setLoading(true)
      try {
        const data = await getAllocationDashboard({
          period,
          search: search || undefined,
          page: page || 1,
          page_size: 20,
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

  // Fetch data based on active tab
  useEffect(() => {
    switch (activeTab) {
      case "executive":
        fetchExecutiveData(selectedPeriod)
        break
      case "resources":
        fetchResourceData(selectedPeriod, resourceSearch, resourceClassification, resourcePage)
        break
      case "projects":
        fetchProjectData(selectedPeriod)
        break
      case "allocations":
        fetchAllocationData(selectedPeriod, allocationSearch, allocationPage)
        break
    }
  }, [
    activeTab,
    selectedPeriod,
    fetchExecutiveData,
    fetchResourceData,
    fetchProjectData,
    fetchAllocationData,
    resourceSearch,
    resourceClassification,
    resourcePage,
    allocationSearch,
    allocationPage,
  ])

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period)
    setResourcePage(1)
    setResourceSearch("")
    setResourceClassification("")
    setAllocationPage(1)
    setAllocationSearch("")
  }

  const handleComputeUtilisation = async () => {
    setComputing(true)
    try {
      await computeUtilisation(selectedPeriod)
      // Refresh current tab after computation
      switch (activeTab) {
        case "executive":
          await fetchExecutiveData(selectedPeriod)
          break
        case "resources":
          await fetchResourceData(selectedPeriod, resourceSearch, resourceClassification, resourcePage)
          break
        case "projects":
          await fetchProjectData(selectedPeriod)
          break
        case "allocations":
          await fetchAllocationData(selectedPeriod, allocationSearch, allocationPage)
          break
      }
    } catch (err) {
      console.error("Failed to compute utilisation:", err)
    } finally {
      setComputing(false)
    }
  }

  const handleResourceSearch = (query: string) => {
    setResourceSearch(query)
    setResourcePage(1)
  }

  const handleResourceClassification = (value: string) => {
    setResourceClassification(value)
    setResourcePage(1)
  }

  const handleResourcePageChange = (page: number) => {
    setResourcePage(page)
  }

  const handleAllocationSearch = (query: string) => {
    setAllocationSearch(query)
    setAllocationPage(1)
  }

  const handleAllocationPageChange = (page: number) => {
    setAllocationPage(page)
  }

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab)
    if (tab === "resources") {
      setResourcePage(1)
      setResourceSearch("")
      setResourceClassification("")
    }
    if (tab === "allocations") {
      setAllocationPage(1)
      setAllocationSearch("")
    }
  }

  // Resource availability chart data for executive tab
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
        <div className="flex items-center gap-4">
          <PeriodSelector value={selectedPeriod} onChange={handlePeriodChange} />
          <button
            onClick={handleComputeUtilisation}
            disabled={computing}
            className="cursor-pointer inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {computing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Calculator className="h-4 w-4" />
            )}
            Compute Utilisation
          </button>
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

      {/* Loading state */}
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
                          formatter={(value: number, name: string) => [
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
                  </CardContent>
                </Card>
              </div>

              <UtilisationTrendChart data={executiveData.trend} />

              <TopProjectsChart data={executiveData.top_consuming_projects} />
            </div>
          )}

          {activeTab === "executive" && !executiveData && (
            <div className="p-6 text-center text-muted-foreground">
              No executive data available. Try computing utilisation for this period first.
            </div>
          )}

          {/* Resources Tab */}
          {activeTab === "resources" && (
            <ResourceTable
              entries={resourceEntries}
              onSearch={handleResourceSearch}
              searchQuery={resourceSearch}
              classification={resourceClassification}
              onClassificationChange={handleResourceClassification}
              total={resourceTotal}
              page={resourcePage}
              pageSize={20}
              onPageChange={handleResourcePageChange}
            />
          )}

          {/* Projects Tab */}
          {activeTab === "projects" && (
            <ProjectHealthTable projects={projectEntries} />
          )}

          {/* Allocations Tab */}
          {activeTab === "allocations" && (
            <AllocationsTable
              entries={allocationEntries}
              onSearch={handleAllocationSearch}
              searchQuery={allocationSearch}
              total={allocationTotal}
              page={allocationPage}
              pageSize={20}
              onPageChange={handleAllocationPageChange}
            />
          )}
        </>
      )}
    </div>
  )
}
