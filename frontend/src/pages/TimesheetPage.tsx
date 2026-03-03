import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PeriodSelector } from "@/components/shared/PeriodSelector"
import { PeriodLockBanner } from "@/components/timesheet/PeriodLockBanner"
import { TimesheetTable } from "@/components/timesheet/TimesheetTable"
import { TimesheetEntryForm } from "@/components/timesheet/TimesheetEntryForm"
import { TimesheetApprovalPanel } from "@/components/timesheet/TimesheetApprovalPanel"
import { HrmsSyncPanel } from "@/components/timesheet/HrmsSyncPanel"
import { useAuthStore } from "@/store/authStore"
import {
  getTimesheets,
  createTimesheetEntry,
  submitTimesheetEntries,
  approveTimesheetEntries,
  rejectTimesheetEntries,
  getPeriodLockStatus,
  togglePeriodLock,
  getProjects,
  getEmployees,
} from "@/api/timesheets"
import type { TimesheetEntry, TimesheetEntryCreate } from "@/types/timesheet"
import { Plus, Send, ClipboardList, Users, RefreshCw } from "lucide-react"

type Tab = "my" | "approval" | "sync"

const TAB_CONFIG: { key: Tab; label: string; icon: typeof ClipboardList }[] = [
  { key: "my", label: "My Timesheets", icon: ClipboardList },
  { key: "approval", label: "Team Approval", icon: Users },
  { key: "sync", label: "HRMS Sync", icon: RefreshCw },
]

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
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [periodLocked, setPeriodLocked] = useState(false)
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([])

  // Fetch timesheets
  const fetchTimesheets = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await getTimesheets({ period: selectedPeriod })
      setEntries(data.entries)
    } catch (err) {
      console.error("Failed to fetch timesheets:", err)
    } finally {
      setLoading(false)
    }
  }, [user, selectedPeriod])

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

  // Fetch reference data
  const fetchReferenceData = useCallback(async () => {
    if (!user) return
    try {
      const [projData, empData] = await Promise.all([
        getProjects(user.branch_location_id),
        getEmployees(user.branch_location_id),
      ])
      setProjects(projData)
      setEmployees(empData)
    } catch (err) {
      console.error("Failed to fetch reference data:", err)
    }
  }, [user])

  useEffect(() => {
    fetchTimesheets()
    fetchLockStatus()
  }, [fetchTimesheets, fetchLockStatus])

  useEffect(() => {
    fetchReferenceData()
  }, [fetchReferenceData])

  // Clear selection when period or tab changes
  useEffect(() => {
    setSelectedIds(new Set())
    setShowEntryForm(false)
  }, [selectedPeriod, activeTab])

  // Derived data
  const myEntries = entries.filter((e) => e.employee_id === user?.employee_id)
  const submittedEntries = entries.filter((e) => e.status === "submitted")

  const displayedEntries = activeTab === "my" ? myEntries : submittedEntries

  // Handlers
  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedIds.size === displayedEntries.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(displayedEntries.map((e) => e.id)))
    }
  }

  const handleCreateEntry = async (data: TimesheetEntryCreate) => {
    if (!user) return
    try {
      await createTimesheetEntry(data)
      setShowEntryForm(false)
      fetchTimesheets()
    } catch (err) {
      console.error("Failed to create entry:", err)
    }
  }

  const handleSubmitSelected = async () => {
    if (selectedIds.size === 0) return
    try {
      await submitTimesheetEntries(Array.from(selectedIds))
      setSelectedIds(new Set())
      fetchTimesheets()
    } catch (err) {
      console.error("Failed to submit entries:", err)
    }
  }

  const handleApproveAll = async () => {
    const ids = submittedEntries
      .filter((e) => selectedIds.size === 0 || selectedIds.has(e.id))
      .map((e) => e.id)
    if (ids.length === 0) return
    try {
      await approveTimesheetEntries(ids)
      setSelectedIds(new Set())
      fetchTimesheets()
    } catch (err) {
      console.error("Failed to approve entries:", err)
    }
  }

  const handleReject = async (reason: string) => {
    const ids = submittedEntries
      .filter((e) => selectedIds.size === 0 || selectedIds.has(e.id))
      .map((e) => e.id)
    if (ids.length === 0) return
    try {
      await rejectTimesheetEntries(ids, reason)
      setSelectedIds(new Set())
      fetchTimesheets()
    } catch (err) {
      console.error("Failed to reject entries:", err)
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

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Timesheets</h2>
          <p className="text-sm text-muted-foreground">
            Manage timesheet entries, approvals, and HRMS sync
          </p>
        </div>
        <PeriodSelector value={selectedPeriod} onChange={setSelectedPeriod} />
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
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {key === "approval" && submittedEntries.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[10px] font-medium">
                {submittedEntries.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "my" && (
        <div className="space-y-4">
          {/* Actions Bar */}
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              onClick={() => setShowEntryForm(!showEntryForm)}
              disabled={periodLocked}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New Entry
            </Button>
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSubmitSelected}
                disabled={periodLocked}
              >
                <Send className="mr-1.5 h-4 w-4" />
                Submit Selected ({selectedIds.size})
              </Button>
            )}
          </div>

          {/* Entry Form */}
          {showEntryForm && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">New Timesheet Entry</CardTitle>
              </CardHeader>
              <CardContent>
                <TimesheetEntryForm
                  onSubmit={handleCreateEntry}
                  onCancel={() => setShowEntryForm(false)}
                  projects={projects}
                  employees={employees}
                />
              </CardContent>
            </Card>
          )}

          {/* Timesheet Table */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-6 w-6 rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <TimesheetTable
              entries={myEntries}
              onSelect={handleSelect}
              selectedIds={selectedIds}
              onSelectAll={handleSelectAll}
            />
          )}
        </div>
      )}

      {activeTab === "approval" && (
        <div className="space-y-4">
          {/* Approval Panel */}
          <TimesheetApprovalPanel
            count={
              selectedIds.size > 0
                ? submittedEntries.filter((e) => selectedIds.has(e.id)).length
                : submittedEntries.length
            }
            onApprove={handleApproveAll}
            onReject={handleReject}
          />

          {/* Submitted Entries Table */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-6 w-6 rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <TimesheetTable
              entries={submittedEntries}
              onSelect={handleSelect}
              selectedIds={selectedIds}
              onSelectAll={handleSelectAll}
            />
          )}
        </div>
      )}

      {activeTab === "sync" && <HrmsSyncPanel period={selectedPeriod} />}
    </div>
  )
}
