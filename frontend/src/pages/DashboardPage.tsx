import { useEffect, useState, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { SlidersHorizontal, Search, X, Upload } from "lucide-react"
import { PeriodSelector } from "@/components/shared/PeriodSelector"
import { ExecutiveOverview } from "@/components/dashboard/ExecutiveOverview"
import { ClassificationDonut } from "@/components/dashboard/ClassificationDonut"
import { UtilisationTrendChart } from "@/components/dashboard/UtilisationTrendChart"
import { TopProjectsChart } from "@/components/dashboard/TopProjectsChart"
import { ResourceAllocationTable } from "@/components/dashboard/ResourceAllocationTable"
import { ExcelUploadModal } from "@/components/dashboard/ExcelUploadModal"
import { DataSourceToggle } from "@/components/shared/DataSourceToggle"
import { SelectDropdown } from "@/components/shared/SelectDropdown"
import {
  getExecutiveDashboard,
  getResourceAllocationDashboard,
} from "@/api/dashboard"
import { getExcelDashboard, getExcelResources } from "@/api/excelUtilisation"
import { listProjectClients } from "@/api/projects"
import { useDataSourceStore } from "@/store/dataSourceStore"
import { useOrgChartStore } from "@/store/orgChartStore"
import { useReportPeriodStore } from "@/store/reportPeriodStore"
import type { ExecutiveDashboard, ResourceAllocationEntry } from "@/types/dashboard"

type TabKey = "executive" | "resources"

const TABS: { key: TabKey; label: string }[] = [
  { key: "executive", label: "Executive" },
  { key: "resources", label: "Resources" },
]

const CLASSIFICATION_OPTIONS = [
  { value: "", label: "All Classifications" },
  { value: "fully_billed", label: "Fully Billed" },
  { value: "partially_billed", label: "Partially Billed" },
  { value: "bench", label: "Standby Period" },
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


export function DashboardPage() {
  const dataSource = useDataSourceStore((s) => s.dataSource)
  const selectedPeriod = useReportPeriodStore((s) => s.selectedPeriod)
  const setSelectedPeriod = useReportPeriodStore((s) => s.setSelectedPeriod)
  const setDrawerPeriod = useOrgChartStore((s) => s.setDrawerPeriod)
  const setDrawerDataSource = useOrgChartStore((s) => s.setDrawerDataSource)
  const [activeTab, setActiveTab] = useState<TabKey>("executive")
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)

  // Keep drawer period in sync with dashboard period
  useEffect(() => {
    setDrawerPeriod(selectedPeriod)
    return () => setDrawerPeriod(null)
  }, [selectedPeriod, setDrawerPeriod])

  useEffect(() => {
    setDrawerDataSource(dataSource)
  }, [dataSource, setDrawerDataSource])

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

  const fetchExecutiveData = useCallback(async (period: string, client?: string, source: "hrms" | "excel" = "hrms") => {
    setLoading(true)
    try {
      let data: ExecutiveDashboard
      if (source === "excel") {
        data = await getExcelDashboard(period)
      } else {
        data = await getExecutiveDashboard({ period, client_name: client || undefined })
      }
      setExecutiveData(data)
    } catch (err: any) {
      if (source === "excel" && err?.response?.status === 404) {
        setExecutiveData(null)
      } else {
        console.error("Failed to load executive dashboard:", err)
        setExecutiveData(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchResourceData = useCallback(
    async (period: string, search?: string, classification?: string, client?: string, page?: number, pageSize?: number, source: "hrms" | "excel" = "hrms") => {
      setLoading(true)
      try {
        let data
        if (source === "excel") {
          data = await getExcelResources({
            period,
            search: search || undefined,
            classification: classification || undefined,
            page: page || 1,
            page_size: pageSize || 20,
          })
        } else {
          data = await getResourceAllocationDashboard({
            period,
            search: search || undefined,
            classification: classification || undefined,
            client_name: client || undefined,
            page: page || 1,
            page_size: pageSize || 20,
          })
        }
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

  useEffect(() => {
    switch (activeTab) {
      case "executive":
        fetchExecutiveData(selectedPeriod, clientFilter, dataSource)
        break
      case "resources":
        fetchResourceData(selectedPeriod, searchQuery, classificationFilter, clientFilter, resourcePage, resourcePageSize, dataSource)
        break
    }
  }, [
    activeTab,
    selectedPeriod,
    fetchExecutiveData,
    fetchResourceData,
    searchQuery,
    classificationFilter,
    clientFilter,
    resourcePage,
    resourcePageSize,
    dataSource,
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
    <>
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
          <DataSourceToggle />
          {dataSource === "excel" && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="cursor-pointer inline-flex items-center gap-1.5 h-8 rounded-md border px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload
            </button>
          )}
          {clientOptions.length > 0 && dataSource === "hrms" && (
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
                ? "border-primary text-foreground"
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
                  placeholder="Search name, project, client..."
                  value={searchInput}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* Classification filter — inline pills, resources tab only */}
              {activeTab === "resources" && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {CLASSIFICATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setClassificationFilter(opt.value); setResourcePage(1) }}
                      className={`cursor-pointer px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                        classificationFilter === opt.value
                          ? "bg-foreground text-background border-foreground"
                          : "bg-transparent text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
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
              {dataSource === "excel" ? (
                <div className="space-y-3">
                  <p>No Excel data for this period.</p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Excel Report
                  </button>
                </div>
              ) : (
                "No executive data available for this period. Run an HRMS sync first."
              )}
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
        </>
      )}
    </div>
    {showUploadModal && (
      <ExcelUploadModal
        onClose={() => setShowUploadModal(false)}
        onUploaded={() => {
          if (dataSource === "excel") {
            if (activeTab === "resources") {
              fetchResourceData(
                selectedPeriod,
                searchQuery,
                classificationFilter,
                clientFilter,
                resourcePage,
                resourcePageSize,
                "excel"
              )
            } else {
              fetchExecutiveData(selectedPeriod, clientFilter, "excel")
            }
          }
        }}
      />
    )}
    </>
  )
}
