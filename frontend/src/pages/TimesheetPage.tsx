import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PeriodSelector, getCurrentPeriod } from "@/components/shared/PeriodSelector"
import { DataSourceToggle } from "@/components/shared/DataSourceToggle"
import { PeriodLockBanner } from "@/components/timesheet/PeriodLockBanner"
import { TimesheetTable } from "@/components/timesheet/TimesheetTable"
import { TimesheetApprovalPanel } from "@/components/timesheet/TimesheetApprovalPanel"
import { WorkloadHeatmap } from "@/components/timesheet/WorkloadHeatmap"
import { useAuthStore } from "@/store/authStore"
import { useDataSourceStore } from "@/store/dataSourceStore"
import { useOrgChartStore } from "@/store/orgChartStore"
import { useReportPeriodStore } from "@/store/reportPeriodStore"
import { useToastStore } from "@/store/toastStore"
import {
  getTimesheets,
  approveTimesheetEntries,
  rejectTimesheetEntries,
  getPeriodLockStatus,
  togglePeriodLock,
} from "@/api/timesheets"
import { getExcelTimesheets } from "@/api/excelUtilisation"
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
  PoundSterling,
  Percent,
  UserCheck,
  SlidersHorizontal,
  X,
  FileSpreadsheet,
} from "lucide-react"

type Tab = "my" | "heatmap"

const TAB_CONFIG: { key: Tab; label: string; icon: typeof ClipboardList }[] = [
  { key: "my", label: "Timesheets", icon: ClipboardList },
  { key: "heatmap", label: "Workload Heatmap", icon: LayoutGrid },
]

const PAGE_SIZE_OPTIONS = [20, 50, 100]

export function TimesheetPage() {
  const user = useAuthStore((s) => s.user)
  const dataSource = useDataSourceStore((s) => s.dataSource)
  const selectedPeriod = useReportPeriodStore((s) => s.selectedPeriod)
  const setSelectedPeriod = useReportPeriodStore((s) => s.setSelectedPeriod)
  const setDrawerPeriod = useOrgChartStore((s) => s.setDrawerPeriod)
  const setDrawerDataSource = useOrgChartStore((s) => s.setDrawerDataSource)

  // State
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

  useEffect(() => {
    setDrawerDataSource(dataSource)
  }, [dataSource, setDrawerDataSource])

  // Filters
  const [showFilters, setShowFilters] = useState(false)
  const [filterEmployee, setFilterEmployee] = useState("")
  const [filterProject, setFilterProject] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterBillable, setFilterBillable] = useState<boolean | null>(null)

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Inline approval state (merged into main Timesheets tab)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const addToast = useToastStore((s) => s.addToast)

  // Detect initial period on mount (runs once)
  useEffect(() => {
    if (!user || initialized || dataSource !== "hrms") return
    let active = true
    ;(async () => {
      try {
        const currentPeriod = getCurrentPeriod()
        if (selectedPeriod !== currentPeriod) {
          if (active) setInitialized(true)
          return
        }
        const data = await getTimesheets({ period: currentPeriod, page: 1, page_size: 1 })
        if (active && data.entries.length === 0 && data.latest_period && data.latest_period !== currentPeriod) {
          setSelectedPeriod(data.latest_period)
        }
      } catch { /* ignore */ }
      if (active) setInitialized(true)
    })()
    return () => { active = false }
  }, [user, initialized, dataSource, selectedPeriod, setSelectedPeriod])

  // Fetch timesheets (only after init)
  const fetchTimesheets = useCallback(async () => {
    if (!user || !initialized) return
    setLoading(true)
    try {
      const params = {
        period: selectedPeriod,
        employee_id: filterEmployee || undefined,
        project_id: filterProject || undefined,
        status: filterStatus || undefined,
        is_billable: filterBillable ?? undefined,
        page,
        page_size: pageSize,
      }
      const data = dataSource === "excel"
        ? await getExcelTimesheets(params)
        : await getTimesheets(params)
      setEntries(data.entries)
      setTotal(data.total)
      setSummary(data.summary)
      setFilterOptions(data.filter_options)
      if (dataSource === "excel") {
        setPeriodLocked(false)
      }
    } catch (err) {
      console.error("Failed to fetch timesheets:", err)
    } finally {
      setLoading(false)
    }
  }, [user, initialized, selectedPeriod, filterEmployee, filterProject, filterStatus, filterBillable, page, pageSize, dataSource])

  // Fetch period lock status
  const fetchLockStatus = useCallback(async () => {
    if (!user || dataSource === "excel") return
    try {
      const status = await getPeriodLockStatus(user.branch_location_id, selectedPeriod)
      setPeriodLocked(status.locked)
    } catch (err) {
      console.error("Failed to fetch lock status:", err)
    }
  }, [user, selectedPeriod, dataSource])

  useEffect(() => {
    fetchTimesheets()
    fetchLockStatus()
  }, [fetchTimesheets, fetchLockStatus])

  // Clear selection when period or filters change
  useEffect(() => {
    setSelectedIds(new Set())
  }, [selectedPeriod, filterStatus, filterEmployee, filterProject, filterBillable, dataSource])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [filterEmployee, filterProject, filterStatus, filterBillable, selectedPeriod, dataSource])

  useEffect(() => {
    setFilterEmployee("")
    setFilterProject("")
    setFilterStatus("")
    setFilterBillable(null)
    setShowFilters(false)
  }, [dataSource])



  // Derived data
  const activeFilterCount = [filterEmployee, filterProject, filterStatus, filterBillable !== null ? "billable" : ""].filter(Boolean).length

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
    setFilterBillable(null)
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
          sub: `${summary.employee_count} employees`,
          icon: Clock,
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          filterKey: null as boolean | null,
        },
        {
          title: "Billable Employees",
          value: summary.billable_employee_count,
          sub: `${summary.billable_hours.toLocaleString()} hrs`,
          icon: PoundSterling,
          color: "text-green-600",
          bgColor: "bg-green-50",
          filterKey: true as boolean | null,
        },
        {
          title: "Non-Billable Employees",
          value: summary.non_billable_employee_count,
          sub: `${(summary.total_hours - summary.billable_hours).toLocaleString()} hrs`,
          icon: PoundSterling,
          color: "text-red-600",
          bgColor: "bg-red-50",
          filterKey: false as boolean | null,
        },
        {
          title: "Billable %",
          value: `${summary.billable_percent}%`,
          sub: undefined,
          icon: Percent,
          color: "text-amber-600",
          bgColor: "bg-amber-50",
          filterKey: null as boolean | null,
        },
        {
          title: "Employees",
          value: summary.employee_count,
          sub: undefined,
          icon: UserCheck,
          color: "text-purple-600",
          bgColor: "bg-purple-50",
          filterKey: null as boolean | null,
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
            {dataSource === "excel"
              ? "Review Excel-imported utilisation rows in timesheet view"
              : "Manage timesheet entries, workload overview, and HRMS sync"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DataSourceToggle />
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
      {dataSource === "hrms" && (
        <PeriodLockBanner
          isLocked={periodLocked}
          onToggle={handleToggleLock}
          period={selectedPeriod}
        />
      )}

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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {summaryCards.map((card) => {
                const isActive = card.filterKey !== null && filterBillable === card.filterKey
                const isClickable = card.filterKey !== null
                return (
                  <Card
                    key={card.title}
                    className={`transition-all ${isClickable ? "cursor-pointer hover:shadow-md" : ""} ${isActive ? "ring-2 ring-primary" : ""}`}
                    onClick={() => {
                      if (!isClickable) return
                      setFilterBillable(filterBillable === card.filterKey ? null : card.filterKey)
                      setPage(1)
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${isActive ? "bg-primary/10" : card.bgColor}`}>
                          <card.icon className={`h-5 w-5 ${isActive ? "text-primary" : card.color}`} />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{card.title}</p>
                          <p className="text-2xl font-semibold tabular-nums">{card.value}</p>
                          {"sub" in card && card.sub && (
                            <p className="text-[11px] text-muted-foreground">{card.sub}</p>
                          )}
                        </div>
                      </div>
                      {isActive && (
                        <p className="mt-1.5 text-[10px] text-primary font-medium">Filtered ✕ click to clear</p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
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
          {dataSource === "hrms" && showApprovalBar && (
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

      {activeTab === "heatmap" && (
        dataSource === "excel" ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
            <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">Heatmap is unavailable for Excel report mode</p>
            <p className="text-xs text-gray-400 mt-1">
              The uploaded workbook contains monthly utilisation snapshots, not day-level timesheet rows.
            </p>
          </div>
        ) : (
          <WorkloadHeatmap period={selectedPeriod} />
        )
      )}
    </div>
  )
}
