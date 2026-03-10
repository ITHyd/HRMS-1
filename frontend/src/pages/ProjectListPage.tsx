import { useEffect, useState, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { PeriodSelector } from "@/components/shared/PeriodSelector"
import { Progress } from "@/components/ui/progress"
import { listProjects, listProjectClients } from "@/api/projects"
import {
  FolderKanban,
  FolderCheck,
  FolderClock,
  Pause,
  SlidersHorizontal,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Users,
} from "lucide-react"
import type { ProjectBrief } from "@/types/project"

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | "ellipsis")[] = [1]
  if (current <= 4) {
    for (let i = 2; i <= 5; i++) pages.push(i)
    pages.push("ellipsis", total)
  } else if (current >= total - 3) {
    pages.push("ellipsis")
    for (let i = total - 4; i <= total; i++) pages.push(i)
  } else {
    pages.push("ellipsis", current - 1, current, current + 1, "ellipsis", total)
  }
  return pages
}

export function ProjectListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
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
    now.setMonth(now.getMonth() - 1)
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })

  // Filters — pre-filled from URL params (e.g. ?client_name=ENWL from Match Projects)
  const [showFilters, setShowFilters] = useState(() => !!searchParams.get("client_name"))
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [projectType, setProjectType] = useState("")
  const [status, setStatus] = useState("")
  const [clientFilter, setClientFilter] = useState(() => searchParams.get("client_name") ?? "")
  const [clients, setClients] = useState<string[]>([])

  useEffect(() => {
    listProjectClients().then(setClients).catch(() => setClients([]))
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
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
    } catch (err) {
      console.error("Failed to load projects:", err)
      setProjects([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [search, projectType, status, clientFilter, selectedPeriod, page, pageSize])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const totalPages = Math.ceil(total / pageSize)

  const activeFilterCount = [search, projectType, status, clientFilter].filter(Boolean).length

  const summaryCards = [
    { title: "Total Projects", value: total, icon: FolderKanban, color: "text-blue-600", bgColor: "bg-blue-50" },
    { title: "Active", value: activeCount, icon: FolderClock, color: "text-green-600", bgColor: "bg-green-50" },
    { title: "Completed", value: completedCount, icon: FolderCheck, color: "text-gray-600", bgColor: "bg-gray-50" },
    { title: "On Hold", value: onHoldCount, icon: Pause, color: "text-amber-600", bgColor: "bg-amber-50" },
  ]

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Project Master</h2>
          <p className="text-sm text-muted-foreground">
            View all projects assigned to your branch
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector
            value={selectedPeriod}
            onChange={(p) => { setSelectedPeriod(p); setPage(1) }}
          />
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
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  placeholder="Search project name..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </form>
              <select
                value={projectType}
                onChange={(e) => { setProjectType(e.target.value); setPage(1) }}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Types</option>
                <option value="client">Client</option>
                <option value="internal">Internal</option>
              </select>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1) }}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
              <select
                value={clientFilter}
                onChange={(e) => { setClientFilter(e.target.value); setPage(1) }}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Clients</option>
                {clients.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
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
                    <th className="py-2.5 px-3 font-medium border-l border-border">Department</th>
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
                        className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-2.5 px-3">
                          <button
                            onClick={() => navigate(`/projects/${proj.id}`)}
                            className="font-medium text-primary hover:underline text-left"
                          >
                            {proj.name}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 border-l border-border text-sm">
                          {proj.client_name ? (
                            <span className="font-medium">{proj.client_name}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
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
                        <td className="py-2.5 px-3 text-muted-foreground border-l border-border">
                          {proj.department_name}
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
                            {proj.planned_days > 0 && (
                              <p className="text-[11px] text-muted-foreground tabular-nums">
                                {proj.worked_days} / {proj.planned_days} days
                              </p>
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

            {total > 0 && (
              <div className="flex items-center justify-between px-3 py-3 border-t">
                <p className="text-xs text-muted-foreground tabular-nums min-w-[140px]">
                  Showing {(page - 1) * pageSize + 1}&ndash;{Math.min(page * pageSize, total)} of{" "}
                  {total}
                </p>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page <= 1}
                    className="rounded-md border p-1 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    className="rounded-md border p-1 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>

                  {getPageNumbers(page, totalPages).map((item, idx) =>
                    item === "ellipsis" ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-1.5 text-xs text-muted-foreground select-none"
                      >
                        &hellip;
                      </span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setPage(item)}
                        className={`rounded-md min-w-7 px-1.5 py-1 text-xs font-medium transition-colors ${
                          item === page
                            ? "bg-primary text-primary-foreground"
                            : "border hover:bg-accent"
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}

                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                    className="rounded-md border p-1 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page >= totalPages}
                    className="rounded-md border p-1 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 min-w-[140px] justify-end">
                  <span className="text-xs text-muted-foreground">Rows</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                    className="h-7 rounded-md border border-input bg-transparent px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
