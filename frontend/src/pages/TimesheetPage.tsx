import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { PeriodSelector } from "@/components/shared/PeriodSelector"
import { PeriodLockBanner } from "@/components/timesheet/PeriodLockBanner"
import { TimesheetTable } from "@/components/timesheet/TimesheetTable"
import { TimesheetApprovalPanel } from "@/components/timesheet/TimesheetApprovalPanel"
import { HrmsSyncPanel } from "@/components/timesheet/HrmsSyncPanel"
import { useAuthStore } from "@/store/authStore"
import {
  getTimesheets,
  approveTimesheetEntries,
  rejectTimesheetEntries,
  getPeriodLockStatus,
  togglePeriodLock,
} from "@/api/timesheets"
import type {
  TimesheetEntry,
  TimesheetSummary,
  TimesheetFilterOptions,
} from "@/types/timesheet"
import {
  ClipboardList,
  Users,
  RefreshCw,
  Clock,
  DollarSign,
  Percent,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
} from "lucide-react"

type Tab = "my" | "approval" | "sync"

const TAB_CONFIG: { key: Tab; label: string; icon: typeof ClipboardList }[] = [
  { key: "my", label: "Timesheets", icon: ClipboardList },
  { key: "approval", label: "Team Approval", icon: Users },
  { key: "sync", label: "HRMS Sync", icon: RefreshCw },
]

const PAGE_SIZE_OPTIONS = [20, 50, 100]

function getCurrentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function TimesheetPage() {
  const user = useAuthStore((s) => s.user)

  // State
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriod)
  const [activeTab, setActiveTab] = useState<Tab>("my")
  const [entries, setEntries] = useState<TimesheetEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [periodLocked, setPeriodLocked] = useState(false)
  const [summary, setSummary] = useState<TimesheetSummary | null>(null)
  const [filterOptions, setFilterOptions] = useState<TimesheetFilterOptions | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Filters
  const [showFilters, setShowFilters] = useState(false)
  const [filterEmployee, setFilterEmployee] = useState("")
  const [filterProject, setFilterProject] = useState("")
  const [filterStatus, setFilterStatus] = useState("")

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Approval tab state
  const [approvalEntries, setApprovalEntries] = useState<TimesheetEntry[]>([])
  const [approvalTotal, setApprovalTotal] = useState(0)
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [approvalStatusFilter, setApprovalStatusFilter] = useState("submitted")
  const [approvalPage, setApprovalPage] = useState(1)
  const [approvalSelectedIds, setApprovalSelectedIds] = useState<Set<string>>(new Set())
  const [approvalFeedback, setApprovalFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [approvalSummary, setApprovalSummary] = useState<{ submitted: number; approved: number; rejected: number } | null>(null)

  // Detect initial period on mount (runs once)
  useEffect(() => {
    if (!user || initialized) return
    let active = true
    ;(async () => {
      try {
        const currentPeriod = getCurrentPeriod()
        const data = await getTimesheets({ period: currentPeriod, page: 1, page_size: 1 })
        if (active && data.entries.length === 0 && data.latest_period && data.latest_period !== currentPeriod) {
          setSelectedPeriod(data.latest_period)
        }
      } catch { /* ignore */ }
      if (active) setInitialized(true)
    })()
    return () => { active = false }
  }, [user, initialized])

  // Fetch timesheets (only after init)
  const fetchTimesheets = useCallback(async () => {
    if (!user || !initialized) return
    setLoading(true)
    try {
      const data = await getTimesheets({
        period: selectedPeriod,
        employee_id: filterEmployee || undefined,
        project_id: filterProject || undefined,
        status: filterStatus || undefined,
        page,
        page_size: pageSize,
      })
      setEntries(data.entries)
      setTotal(data.total)
      setSummary(data.summary)
      setFilterOptions(data.filter_options)
    } catch (err) {
      console.error("Failed to fetch timesheets:", err)
    } finally {
      setLoading(false)
    }
  }, [user, initialized, selectedPeriod, filterEmployee, filterProject, filterStatus, page, pageSize])

  // Fetch period lock status
  const fetchLockStatus = useCallback(async () => {
    if (!user) return
    try {
      const status = await getPeriodLockStatus(user.branch_location_id, selectedPeriod)
      setPeriodLocked(status.locked)
    } catch (err) {
      console.error("Failed to fetch lock status:", err)
    }
  }, [user, selectedPeriod])

  useEffect(() => {
    fetchTimesheets()
    fetchLockStatus()
  }, [fetchTimesheets, fetchLockStatus])

  // Clear approval selection when period or tab changes
  useEffect(() => {
    setApprovalSelectedIds(new Set())
  }, [selectedPeriod, activeTab])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [filterEmployee, filterProject, filterStatus, selectedPeriod])

  // Derived data
  const totalPages = Math.ceil(total / pageSize)
  const approvalTotalPages = Math.ceil(approvalTotal / 50)
  const activeFilterCount = [filterEmployee, filterProject, filterStatus].filter(Boolean).length

  // --- Approval tab fetching ---
  const fetchApprovalEntries = useCallback(async () => {
    if (!user || !initialized) return
    setApprovalLoading(true)
    try {
      const data = await getTimesheets({
        period: selectedPeriod,
        status: approvalStatusFilter || undefined,
        page: approvalPage,
        page_size: 50,
      })
      setApprovalEntries(data.entries)
      setApprovalTotal(data.total)
    } catch (err) {
      console.error("Failed to fetch approval entries:", err)
    } finally {
      setApprovalLoading(false)
    }
  }, [user, initialized, selectedPeriod, approvalStatusFilter, approvalPage])

  const fetchApprovalSummary = useCallback(async () => {
    if (!user || !initialized) return
    try {
      const [sub, app, rej] = await Promise.all([
        getTimesheets({ period: selectedPeriod, status: "submitted", page: 1, page_size: 1 }),
        getTimesheets({ period: selectedPeriod, status: "approved", page: 1, page_size: 1 }),
        getTimesheets({ period: selectedPeriod, status: "rejected", page: 1, page_size: 1 }),
      ])
      setApprovalSummary({ submitted: sub.total, approved: app.total, rejected: rej.total })
    } catch (err) {
      console.error("Failed to fetch approval summary:", err)
    }
  }, [user, initialized, selectedPeriod])

  // Fetch approval summary on every period change (for tab badge)
  useEffect(() => {
    fetchApprovalSummary()
  }, [fetchApprovalSummary])

  // Fetch approval entries when tab is active
  useEffect(() => {
    if (activeTab === "approval") fetchApprovalEntries()
  }, [activeTab, fetchApprovalEntries])

  // Reset approval page on filter change
  useEffect(() => {
    setApprovalPage(1)
  }, [approvalStatusFilter, selectedPeriod])

  // Auto-dismiss approval feedback
  useEffect(() => {
    if (approvalFeedback) {
      const timer = setTimeout(() => setApprovalFeedback(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [approvalFeedback])

  // --- Approval handlers ---
  const handleApprovalSelect = (id: string) => {
    setApprovalSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleApprovalSelectAll = () => {
    if (approvalSelectedIds.size === approvalEntries.length) {
      setApprovalSelectedIds(new Set())
    } else {
      setApprovalSelectedIds(new Set(approvalEntries.map((e) => e.id)))
    }
  }

  const handleApprovalAction = async (action: "approve" | "reject", reason?: string) => {
    const targetIds = approvalSelectedIds.size > 0
      ? approvalEntries.filter((e) => approvalSelectedIds.has(e.id) && e.status === "submitted").map((e) => e.id)
      : approvalEntries.filter((e) => e.status === "submitted").map((e) => e.id)
    if (targetIds.length === 0) return
    setApprovalFeedback(null)
    try {
      if (action === "approve") {
        await approveTimesheetEntries(targetIds)
        setApprovalFeedback({ type: "success", message: `Successfully approved ${targetIds.length} entries.` })
      } else {
        await rejectTimesheetEntries(targetIds, reason!)
        setApprovalFeedback({ type: "success", message: `Rejected ${targetIds.length} entries.` })
      }
      setApprovalSelectedIds(new Set())
      fetchApprovalEntries()
      fetchApprovalSummary()
      fetchTimesheets()
    } catch {
      setApprovalFeedback({ type: "error", message: "Failed to process entries. Please try again." })
    }
  }

  const handleToggleLock = async () => {
    if (!user) return
    try {
      await togglePeriodLock(selectedPeriod, !periodLocked)
      fetchLockStatus()
    } catch (err) {
      console.error("Failed to toggle period lock:", err)
    }
  }

  const summaryCards = summary
    ? [
        {
          title: "Total Hours",
          value: summary.total_hours.toLocaleString(),
          icon: Clock,
          color: "text-blue-600",
          bgColor: "bg-blue-50",
        },
        {
          title: "Billable Hours",
          value: summary.billable_hours.toLocaleString(),
          icon: DollarSign,
          color: "text-green-600",
          bgColor: "bg-green-50",
        },
        {
          title: "Billable %",
          value: `${summary.billable_percent}%`,
          icon: Percent,
          color: "text-amber-600",
          bgColor: "bg-amber-50",
        },
        {
          title: "Employees",
          value: summary.employee_count,
          icon: UserCheck,
          color: "text-purple-600",
          bgColor: "bg-purple-50",
        },
      ]
    : []

  return (
    <div className="p-6 space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Timesheets</h2>
          <p className="text-sm text-muted-foreground">
            Manage timesheet entries, approvals, and HRMS sync
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              showFilters
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-accent border-input"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <PeriodSelector value={selectedPeriod} onChange={setSelectedPeriod} />
        </div>
      </div>

      {/* Period Lock Banner */}
      <PeriodLockBanner
        isLocked={periodLocked}
        onToggle={handleToggleLock}
        period={selectedPeriod}
      />

      {/* Summary Cards */}
      {summary && (
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
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      {showFilters && filterOptions && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Employee</label>
                <select
                  value={filterEmployee}
                  onChange={(e) => setFilterEmployee(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">All Employees</option>
                  {filterOptions.employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Project</label>
                <select
                  value={filterProject}
                  onChange={(e) => setFilterProject(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">All Projects</option>
                  {filterOptions.projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`cursor-pointer flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {key === "approval" && approvalSummary && approvalSummary.submitted > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[10px] font-medium">
                {approvalSummary.submitted}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "my" && (
        <div className="space-y-4">
          {/* Timesheet Table */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-6 w-6 rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              <TimesheetTable entries={entries} />

              {/* Pagination */}
              {total > 0 && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Showing {(page - 1) * pageSize + 1}&ndash;{Math.min(page * pageSize, total)} of{" "}
                    {total}
                  </p>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={page <= 1}
                      className="rounded-md border p-1 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="px-2 text-xs font-medium tabular-nums">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages}
                      className="rounded-md border p-1 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Rows</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value))
                        setPage(1)
                      }}
                      className="h-7 rounded-md border border-input bg-transparent px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "approval" && (
        <div className="space-y-4">
          {/* Approval Summary Cards */}
          {approvalSummary && (
            <div className="grid grid-cols-3 gap-4">
              {([
                { key: "submitted", label: "Pending Approval", count: approvalSummary.submitted, icon: Clock, color: "text-blue-600", bg: "bg-blue-50", ring: "ring-blue-300" },
                { key: "approved", label: "Approved", count: approvalSummary.approved, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", ring: "ring-green-300" },
                { key: "rejected", label: "Rejected", count: approvalSummary.rejected, icon: XCircle, color: "text-red-600", bg: "bg-red-50", ring: "ring-red-300" },
              ] as const).map((card) => (
                <Card
                  key={card.key}
                  className={`cursor-pointer transition-all hover:shadow-sm ${
                    approvalStatusFilter === card.key ? `ring-2 ${card.ring}` : ""
                  }`}
                  onClick={() => { setApprovalStatusFilter(card.key); setApprovalPage(1) }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${card.bg}`}>
                        <card.icon className={`h-5 w-5 ${card.color}`} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{card.label}</p>
                        <p className="text-2xl font-semibold tabular-nums">{card.count}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Feedback Banner */}
          {approvalFeedback && (
            <div className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
              approvalFeedback.type === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}>
              <div className="flex items-center gap-2">
                {approvalFeedback.type === "success"
                  ? <CheckCircle2 className="h-4 w-4" />
                  : <AlertCircle className="h-4 w-4" />}
                <span className="text-sm">{approvalFeedback.message}</span>
              </div>
              <button onClick={() => setApprovalFeedback(null)} className="cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Status Filter Pills */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Filter:</span>
            {(["submitted", "approved", "rejected"] as const).map((status) => (
              <button
                key={status}
                onClick={() => { setApprovalStatusFilter(status); setApprovalPage(1) }}
                className={`cursor-pointer px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                  approvalStatusFilter === status
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent border-input"
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
            <button
              onClick={() => { setApprovalStatusFilter(""); setApprovalPage(1) }}
              className={`cursor-pointer px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                approvalStatusFilter === ""
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-accent border-input"
              }`}
            >
              All
            </button>
          </div>

          {/* Action Bar (only for submitted entries) */}
          {approvalStatusFilter === "submitted" && approvalEntries.length > 0 && (
            <TimesheetApprovalPanel
              count={
                approvalSelectedIds.size > 0
                  ? approvalEntries.filter((e) => approvalSelectedIds.has(e.id)).length
                  : approvalEntries.length
              }
              onApprove={() => handleApprovalAction("approve")}
              onReject={(reason) => handleApprovalAction("reject", reason)}
            />
          )}

          {/* Table */}
          {approvalLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-6 w-6 rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : approvalEntries.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center">
              {approvalStatusFilter === "submitted" ? (
                <>
                  <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-green-500 opacity-60" />
                  <p className="text-sm font-medium">No entries pending approval</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All timesheet entries for this period have been reviewed.
                    {approvalSummary && approvalSummary.approved > 0 && (
                      <> View the{" "}
                        <button
                          onClick={() => setApprovalStatusFilter("approved")}
                          className="text-primary underline cursor-pointer"
                        >
                          {approvalSummary.approved} approved entries
                        </button>{" "}
                        instead.
                      </>
                    )}
                  </p>
                </>
              ) : approvalStatusFilter === "rejected" ? (
                <>
                  <XCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-40" />
                  <p className="text-sm font-medium">No rejected entries</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No timesheet entries have been rejected for this period.
                  </p>
                </>
              ) : (
                <>
                  <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-40" />
                  <p className="text-sm font-medium">No entries found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No timesheet entries match the selected filter for this period.
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              <TimesheetTable
                entries={approvalEntries}
                selectable={approvalStatusFilter === "submitted"}
                onSelect={handleApprovalSelect}
                selectedIds={approvalSelectedIds}
                onSelectAll={handleApprovalSelectAll}
              />
              {/* Pagination */}
              {approvalTotal > 50 && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Showing {(approvalPage - 1) * 50 + 1}&ndash;{Math.min(approvalPage * 50, approvalTotal)} of {approvalTotal}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setApprovalPage(approvalPage - 1)}
                      disabled={approvalPage <= 1}
                      className="rounded-md border p-1 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="px-2 text-xs font-medium tabular-nums">
                      {approvalPage} / {approvalTotalPages}
                    </span>
                    <button
                      onClick={() => setApprovalPage(approvalPage + 1)}
                      disabled={approvalPage >= approvalTotalPages}
                      className="rounded-md border p-1 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "sync" && <HrmsSyncPanel period={selectedPeriod} />}
    </div>
  )
}
