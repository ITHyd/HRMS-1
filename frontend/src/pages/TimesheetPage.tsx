import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PeriodSelector } from "@/components/shared/PeriodSelector"
import { PeriodLockBanner } from "@/components/timesheet/PeriodLockBanner"
import { TimesheetTable } from "@/components/timesheet/TimesheetTable"
import { TimesheetApprovalPanel } from "@/components/timesheet/TimesheetApprovalPanel"
import { WorkloadHeatmap } from "@/components/timesheet/WorkloadHeatmap"
import { useAuthStore } from "@/store/authStore"
import { useOrgChartStore } from "@/store/orgChartStore"
import { useToastStore } from "@/store/toastStore"
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
import { SelectDropdown } from "@/components/shared/SelectDropdown"
import { Pagination } from "@/components/shared/Pagination"
import {
  ClipboardList,
  LayoutGrid,
  Clock,
  DollarSign,
  Percent,
  UserCheck,
  SlidersHorizontal,
  X,
} from "lucide-react"

type Tab = "my" | "heatmap"

const TAB_CONFIG: { key: Tab; label: string; icon: typeof ClipboardList }[] = [
  { key: "my", label: "Timesheets", icon: ClipboardList },
  { key: "heatmap", label: "Workload Heatmap", icon: LayoutGrid },
]

const PAGE_SIZE_OPTIONS = [20, 50, 100]

function getCurrentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function TimesheetPage() {
  const user = useAuthStore((s) => s.user)
  const setDrawerPeriod = useOrgChartStore((s) => s.setDrawerPeriod)

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

  // Sync drawer period
  useEffect(() => {
    setDrawerPeriod(selectedPeriod)
    return () => setDrawerPeriod(null)
  }, [selectedPeriod, setDrawerPeriod])

  // Filters
  const [showFilters, setShowFilters] = useState(false)
  const [filterEmployee, setFilterEmployee] = useState("")
  const [filterProject, setFilterProject] = useState("")
  const [filterStatus, setFilterStatus] = useState("")

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Inline approval state (merged into main Timesheets tab)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const addToast = useToastStore((s) => s.addToast)

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

  // Clear selection when period or filters change
  useEffect(() => {
    setSelectedIds(new Set())
  }, [selectedPeriod, filterStatus, filterEmployee, filterProject])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [filterEmployee, filterProject, filterStatus, selectedPeriod])



  // Derived data
  const activeFilterCount = [filterEmployee, filterProject, filterStatus].filter(Boolean).length

  // Submitted entries in current page (for inline approval)
  const submittedEntries = entries.filter((e) => e.status === "submitted")
  const showApprovalBar = filterStatus === "submitted" && submittedEntries.length > 0

  // --- Inline approval handlers ---
  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id)))
    }
  }

  const handleApprovalAction = async (action: "approve" | "reject", reason?: string) => {
    const targetIds = selectedIds.size > 0
      ? entries.filter((e) => selectedIds.has(e.id) && e.status === "submitted").map((e) => e.id)
      : submittedEntries.map((e) => e.id)
    if (targetIds.length === 0) return
    try {
      if (action === "approve") {
        await approveTimesheetEntries(targetIds)
        addToast({ type: "success", title: `Approved ${targetIds.length} entries` })
      } else {
        await rejectTimesheetEntries(targetIds, reason!)
        addToast({ type: "success", title: `Rejected ${targetIds.length} entries` })
      }
      setSelectedIds(new Set())
      fetchTimesheets()
    } catch {
      addToast({ type: "error", title: "Failed to process entries", message: "Please try again." })
    }
  }

  const resetFilters = () => {
    setFilterEmployee("")
    setFilterProject("")
    setFilterStatus("")
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
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Timesheets</h2>
          <p className="text-sm text-muted-foreground">
            Manage timesheet entries, workload overview, and HRMS sync
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodSelector value={selectedPeriod} onChange={setSelectedPeriod} />
          {activeTab === "my" && (
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
          )}
        </div>
      </div>

      {/* Period Lock Banner */}
      <PeriodLockBanner
        isLocked={periodLocked}
        onToggle={handleToggleLock}
        period={selectedPeriod}
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`cursor-pointer flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "my" && (
        <div className="space-y-4">
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
                <div className="flex items-center gap-4 flex-wrap">
                  <SelectDropdown
                    value={filterEmployee}
                    onChange={setFilterEmployee}
                    options={[
                      { value: "", label: "All Employees" },
                      ...filterOptions.employees.map((emp) => ({ value: emp.id, label: emp.name })),
                    ]}
                    placeholder="All Employees"
                    maxVisible={5}
                  />
                  <SelectDropdown
                    value={filterProject}
                    onChange={setFilterProject}
                    options={[
                      { value: "", label: "All Projects" },
                      ...filterOptions.projects.map((proj) => ({ value: proj.id, label: proj.name })),
                    ]}
                    placeholder="All Projects"
                    maxVisible={5}
                  />
                  <SelectDropdown
                    value={filterStatus}
                    onChange={setFilterStatus}
                    options={[
                      { value: "", label: "All Status" },
                      { value: "draft", label: "Draft" },
                      { value: "submitted", label: "Submitted" },
                      { value: "approved", label: "Approved" },
                      { value: "rejected", label: "Rejected" },
                    ]}
                    placeholder="All Status"
                    maxVisible={5}
                  />
                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetFilters}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <X className="mr-1 h-3 w-3" />
                      Clear
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Inline Approval Bar (shown when filtering by "submitted") */}
          {showApprovalBar && (
            <TimesheetApprovalPanel
              count={
                selectedIds.size > 0
                  ? entries.filter((e) => selectedIds.has(e.id) && e.status === "submitted").length
                  : submittedEntries.length
              }
              onApprove={() => handleApprovalAction("approve")}
              onReject={(reason) => handleApprovalAction("reject", reason)}
            />
          )}

          {/* Timesheet Table */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-6 w-6 rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              <TimesheetTable
                entries={entries}
                selectable={filterStatus === "submitted"}
                onSelect={handleSelect}
                selectedIds={selectedIds}
                onSelectAll={handleSelectAll}
              />

              {/* Pagination */}
              <Pagination
                total={total}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
              />
            </>
          )}
        </div>
      )}

      {activeTab === "heatmap" && <WorkloadHeatmap period={selectedPeriod} />}
    </div>
  )
}
