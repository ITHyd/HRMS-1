import { useEffect, useState, useCallback, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { PeriodSelector } from "@/components/shared/PeriodSelector"
import { DataSourceToggle } from "@/components/shared/DataSourceToggle"
import { Progress } from "@/components/ui/progress"
import { listProjects, listProjectClients } from "@/api/projects"
import { getExcelProjects } from "@/api/excelUtilisation"
import { useDataSourceStore } from "@/store/dataSourceStore"
import {
  FolderKanban,
  FolderCheck,
  FolderClock,
  Pause,
  SlidersHorizontal,
  Search,
  Users,
  X,
} from "lucide-react"
import { SelectDropdown } from "@/components/shared/SelectDropdown"
import { Pagination } from "@/components/shared/Pagination"
import type { ProjectBrief } from "@/types/project"

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export function ProjectListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const dataSource = useDataSourceStore((s) => s.dataSource)
  const [projects, setProjects] = useState<ProjectBrief[]>([])
  const [total, setTotal] = useState(0)
  const [activeCount, setActiveCount] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [onHoldCount, setOnHoldCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })

  // Filters
  const [showFilters, setShowFilters] = useState(() => !!searchParams.get("client_name"))
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [projectType, setProjectType] = useState("")
  const [status, setStatus] = useState("")
  const [clientFilter, setClientFilter] = useState(() => searchParams.get("client_name") ?? "")
  const [clients, setClients] = useState<string[]>([])

  // Reset filters when toggling data source
  useEffect(() => {
    setSearch(""); setSearchInput(""); setProjectType(""); setStatus(""); setClientFilter(""); setPage(1)
  }, [dataSource])

  useEffect(() => {
    if (dataSource === "hrms") {
      listProjectClients().then(setClients).catch(() => setClients([]))
    }
  }, [dataSource])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      if (dataSource === "excel") {
        const data = await getExcelProjects({
          search: search || undefined,
          client_name: clientFilter || undefined,
          page,
          page_size: pageSize,
        })
        setProjects(data.projects)
        setTotal(data.total)
        setActiveCount(data.active_count)
        setCompletedCount(0)
        setOnHoldCount(0)
        setClients(data.clients)
      } else {
        const data = await listProjects({
          search: search || undefined,
          project_type: projectType || undefined,
          status: status || undefined,
          client_name: clientFilter || undefined,
          period: selectedPeriod,
          page,
          page_size: pageSize,
        })
        setProjects(data.projects)
        setTotal(data.total)
        setActiveCount(data.active_count)
        setCompletedCount(data.completed_count)
        setOnHoldCount(data.on_hold_count)
      }
    } catch (err) {
      console.error("Failed to load projects:", err)
      setProjects([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [search, projectType, status, clientFilter, selectedPeriod, page, pageSize, dataSource])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchInput = (value: string) => {
    setSearchInput(value)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      setSearch(value)
      setPage(1)
    }, 300)
  }

  const resetFilters = () => {
    setSearchInput("")
    setSearch("")
    setProjectType("")
    setStatus("")
    setClientFilter("")
    setPage(1)
  }

  const handleCardFilter = (statusValue: string) => {
    setStatus((prev) => prev === statusValue ? "" : statusValue)
    setPage(1)
    setShowFilters(true)
  }

  const activeFilterCount = [search, projectType, status, clientFilter].filter(Boolean).length

  const summaryCards = [
    { title: "Total Projects", value: total, icon: FolderKanban, color: "text-blue-600", bgColor: "bg-blue-50", filterKey: "" },
    { title: "Active", value: activeCount, icon: FolderClock, color: "text-green-600", bgColor: "bg-green-50", filterKey: "ACTIVE" },
    { title: "Completed", value: completedCount, icon: FolderCheck, color: "text-gray-600", bgColor: "bg-gray-50", filterKey: "COMPLETED" },
    { title: "On Hold", value: onHoldCount, icon: Pause, color: "text-amber-600", bgColor: "bg-amber-50", filterKey: "ON_HOLD" },
  ]

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Project Master</h2>
          <p className="text-sm text-muted-foreground">
            {dataSource === "excel"
              ? "Inter-company projects · March 2026"
              : "View all projects assigned to your branch"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DataSourceToggle />
          {dataSource === "hrms" && (
            <PeriodSelector
              value={selectedPeriod}
              onChange={(p) => { setSelectedPeriod(p); setPage(1) }}
            />
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
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <Card
            key={card.title}
            className={`cursor-pointer transition-all hover:shadow-md ${
              status === card.filterKey && card.filterKey !== ""
                ? "ring-2 ring-primary"
                : ""
            }`}
            onClick={() => {
              if (card.filterKey === "") {
                resetFilters()
              } else {
                handleCardFilter(card.filterKey)
              }
            }}
          >
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
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  placeholder="Search project name..."
                  value={searchInput}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              {dataSource === "hrms" && (<>
              <SelectDropdown
                value={projectType}
                onChange={(v) => { setProjectType(v); setPage(1) }}
                options={[
                  { value: "", label: "All Types" },
                  { value: "client", label: "Client" },
                  { value: "internal", label: "Internal" },
                ]}
                placeholder="All Types"
                maxVisible={5}
              />
              <SelectDropdown
                value={status}
                onChange={(v) => { setStatus(v); setPage(1) }}
                options={[
                  { value: "", label: "All Status" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "COMPLETED", label: "Completed" },
                  { value: "ON_HOLD", label: "On Hold" },
                ]}
                placeholder="All Status"
                maxVisible={5}
              />
              </>)}              <SelectDropdown
                value={clientFilter}
                onChange={(v) => { setClientFilter(v); setPage(1) }}
                options={[
                  { value: "", label: "All Clients" },
                  ...clients.map((c) => ({ value: c, label: c })),
                ]}
                placeholder="All Clients"
                maxVisible={5}
              />
              {activeFilterCount > 0 && (
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

      {/* Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2.5 px-3 font-medium">Project Name</th>
                    <th className="py-2.5 px-3 font-medium border-l border-border">Client</th>
                    <th className="py-2.5 px-3 font-medium border-l border-border">Type</th>
                    <th className="py-2.5 px-3 font-medium border-l border-border">Status</th>
                    <th className="py-2.5 px-3 font-medium text-right border-l border-border">Planned Days</th>
                    <th className="py-2.5 px-3 font-medium text-right border-l border-border">Worked Days</th>
                    <th className="py-2.5 px-3 font-medium border-l border-border min-w-50">Progress</th>
                    <th className="py-2.5 px-3 font-medium text-right border-l border-border">Members</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        {activeFilterCount > 0
                          ? "No projects match the current filters"
                          : "No projects found"}
                      </td>
                    </tr>
                  ) : (
                    projects.map((proj) => (
                      <tr
                        key={proj.id}
                        onClick={() => navigate(`/projects/${proj.id}`)}
                        className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer group"
                      >
                        <td className="py-2.5 px-3">
                          <span className="font-medium text-foreground group-hover:underline">
                            {proj.name}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 border-l border-border text-sm">
                          <span className="font-medium">{proj.client_name}</span>
                        </td>
                        <td className="py-2.5 px-3 border-l border-border">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              proj.project_type === "client"
                                ? "border-blue-300 text-blue-700 bg-blue-50"
                                : "border-gray-300 text-gray-600 bg-gray-50"
                            }`}
                          >
                            {proj.project_type}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 border-l border-border">
                          <StatusBadge status={proj.status} />
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums border-l border-border">
                          {proj.planned_days > 0 ? proj.planned_days : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums border-l border-border">
                          {proj.worked_days > 0 ? proj.worked_days : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="py-2.5 px-3 border-l border-border">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Progress
                                value={proj.progress_percent}
                                className={`h-2 flex-1 ${
                                  proj.progress_percent >= 80
                                    ? "[&>div]:bg-green-500"
                                    : proj.progress_percent >= 40
                                      ? "[&>div]:bg-amber-500"
                                      : "[&>div]:bg-red-500"
                                }`}
                              />
                              <span className={`text-xs font-medium tabular-nums w-10 text-right ${
                                proj.progress_percent >= 80
                                  ? "text-green-700"
                                  : proj.progress_percent >= 40
                                    ? "text-amber-700"
                                    : "text-red-700"
                              }`}>
                                {proj.progress_percent.toFixed(0)}%
                              </span>
                            </div>
                            {proj.planned_days > 0 ? (
                              <p className="text-[11px] text-muted-foreground tabular-nums">
                                {proj.worked_days} / {proj.planned_days} days worked
                              </p>
                            ) : proj.start_date && proj.end_date ? (
                              <p className="text-[11px] text-muted-foreground tabular-nums">
                                {new Date(proj.start_date).toLocaleDateString()} → {new Date(proj.end_date).toLocaleDateString()}
                              </p>
                            ) : (
                              <p className="text-[11px] text-muted-foreground">Timeline based</p>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right border-l border-border">
                          <div className="flex items-center justify-end gap-1 text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            <span className="tabular-nums">{proj.member_count}</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
