import { useEffect, useState } from "react"
import { Sheet, SheetHeader, SheetTitle, SheetContent } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useOrgChartStore } from "@/store/orgChartStore"
import { useAuthStore } from "@/store/authStore"
import { getEmployee } from "@/api/employees"
import { getReportingChain } from "@/api/org"
import { getEmployeeTimeline } from "@/api/projects"
import type { EmployeeDetail } from "@/types/employee"
import type { EmployeeTimeline } from "@/types/project"
import { LOCATION_COLORS, LEVEL_LABELS } from "@/lib/constants"
import {
  User,
  Mail,
  Calendar,
  Clock,
  MapPin,
  Users,
  ChevronRight,
  Briefcase,
  Shield,
  Wrench,
  BarChart3,
  FileText,
  TrendingUp,
} from "lucide-react"

const PROFICIENCY_COLORS: Record<string, string> = {
  beginner: "bg-gray-100 text-gray-700 border-gray-200",
  intermediate: "bg-blue-50 text-blue-700 border-blue-200",
  advanced: "bg-green-50 text-green-700 border-green-200",
  expert: "bg-purple-50 text-purple-700 border-purple-200",
}

const CLASSIFICATION_STYLES: Record<string, string> = {
  fully_billed: "bg-green-100 text-green-800",
  partially_billed: "bg-amber-100 text-amber-800",
  bench: "bg-red-100 text-red-800",
}

export function EmployeeDrawer() {
  const isOpen = useOrgChartStore((s) => s.isDrawerOpen)
  const selectedId = useOrgChartStore((s) => s.selectedEmployeeId)
  const closeDrawer = useOrgChartStore((s) => s.closeDrawer)
  const focusEmployee = useOrgChartStore((s) => s.focusEmployee)
  const drawerPeriod = useOrgChartStore((s) => s.drawerPeriod)
  const loggedInUser = useAuthStore((s) => s.user)
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null)
  const [chain, setChain] = useState<Record<string, unknown>[]>([])
  const [timeline, setTimeline] = useState<EmployeeTimeline | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedId || !isOpen) return
    let isActive = true
    queueMicrotask(() => {
      if (!isActive) return
      setLoading(true)
      setError(null)
      setEmployee(null)
      setChain([])
      setTimeline(null)

      const loadEmployee = async () => {
        try {
          const emp = await getEmployee(selectedId, drawerPeriod ?? undefined)
          if (isActive) setEmployee(emp)
        } catch (err) {
          console.error("Failed to load employee:", err)
          if (isActive) setError("Failed to load employee details")
        }

        try {
          const chainRes = await getReportingChain(selectedId)
          if (isActive) setChain(chainRes.chain || [])
        } catch (err) {
          console.error("Failed to load chain:", err)
        }

        try {
          const tl = await getEmployeeTimeline(selectedId)
          if (isActive) setTimeline(tl)
        } catch (err) {
          console.error("Failed to load timeline:", err)
        }

        if (isActive) setLoading(false)
      }

      void loadEmployee()
    })
    return () => {
      isActive = false
    }
  }, [selectedId, isOpen, drawerPeriod])

  if (!isOpen) return null

  const locColor = employee
    ? LOCATION_COLORS[employee.location_code] || "#6b7280"
    : "#6b7280"

  return (
    <Sheet open={isOpen} onClose={closeDrawer}>
      {loading ? (
        <div className="flex h-full items-center justify-center">
          <div className="animate-spin h-6 w-6 rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : error ? (
        <div className="flex h-full items-center justify-center p-6">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : employee ? (
        <>
          <SheetHeader>
            <div className="flex items-center gap-2.5">
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ backgroundColor: locColor }}
              >
                {employee.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-base leading-tight">{employee.name}</SheetTitle>
                <p className="text-xs text-muted-foreground">{employee.designation}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{employee.department}</Badge>
              <Badge className="text-[10px] px-1.5 py-0" style={{ backgroundColor: locColor + "20", color: locColor, borderColor: locColor }}>
                {employee.location_code} · {employee.location_city}
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{LEVEL_LABELS[employee.level] || employee.level}</Badge>
            </div>
          </SheetHeader>

          <SheetContent>
            {/* Reporting Chain Breadcrumbs */}
            {chain.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Shield className="h-4 w-4" /> Reporting Chain
                </h3>
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  {[...chain].reverse().map((c, i) => (
                    <span key={(c as Record<string, string>).id} className="flex items-center">
                      {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5" />}
                      <button
                        onClick={() => focusEmployee((c as Record<string, string>).id)}
                        className="cursor-pointer rounded px-1.5 py-0.5 hover:bg-accent transition-colors"
                      >
                        {(c as Record<string, string>).id === loggedInUser?.employee_id ? (
                          <strong>{(c as Record<string, string>).name} (You)</strong>
                        ) : (
                          (c as Record<string, string>).name
                        )}
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Own Branch: Full details */}
            {employee.is_own_branch && (
              <>
                {/* Contact & Info */}
                <div className="mb-6 space-y-2">
                  {employee.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{employee.email}</span>
                    </div>
                  )}
                  {employee.join_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Joined {new Date(employee.join_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  {employee.tenure_months != null && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Tenure: {Math.floor(employee.tenure_months / 12)}y{" "}
                        {employee.tenure_months % 12}m
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{employee.location_city}</span>
                  </div>
                </div>

                {/* Utilisation */}
                {employee.utilisation && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                      <BarChart3 className="h-4 w-4" /> Utilisation ({employee.utilisation.period})
                    </h3>
                    <div className="rounded-lg border p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Classification</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${CLASSIFICATION_STYLES[employee.utilisation.classification] || "bg-gray-100 text-gray-800"}`}>
                          {employee.utilisation.classification.replace("_", " ")}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Utilisation</span>
                          <span className="font-medium">{employee.utilisation.utilisation_percent.toFixed(1)}%</span>
                        </div>
                        <Progress value={Math.min(employee.utilisation.utilisation_percent, 100)} className="h-2" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Billable</span>
                          <span className="font-medium">{employee.utilisation.billable_percent.toFixed(1)}%</span>
                        </div>
                        <Progress value={Math.min(employee.utilisation.billable_percent, 100)} className="h-2" />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-md bg-muted/50 p-1.5">
                          <p className="text-[10px] text-muted-foreground">Total</p>
                          <p className="text-xs font-semibold">{employee.utilisation.total_hours.toFixed(0)}h</p>
                        </div>
                        <div className="rounded-md bg-muted/50 p-1.5">
                          <p className="text-[10px] text-muted-foreground">Billable</p>
                          <p className="text-xs font-semibold">{employee.utilisation.billable_hours.toFixed(0)}h</p>
                        </div>
                        <div className="rounded-md bg-muted/50 p-1.5">
                          <p className="text-[10px] text-muted-foreground">Capacity</p>
                          <p className="text-xs font-semibold">{employee.utilisation.capacity_hours.toFixed(0)}h</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Timesheet Summary */}
                {employee.timesheet_summary && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                      <FileText className="h-4 w-4" /> Timesheet ({employee.timesheet_summary.period})
                    </h3>
                    <div className="rounded-lg border p-3">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-md bg-muted/50 p-1.5">
                          <p className="text-[10px] text-muted-foreground">Hours Logged</p>
                          <p className="text-xs font-semibold">{employee.timesheet_summary.total_hours.toFixed(1)}</p>
                        </div>
                        <div className="rounded-md bg-muted/50 p-1.5">
                          <p className="text-[10px] text-muted-foreground">Billable</p>
                          <p className="text-xs font-semibold">{employee.timesheet_summary.billable_hours.toFixed(1)}</p>
                        </div>
                        <div className="rounded-md bg-muted/50 p-1.5">
                          <p className="text-[10px] text-muted-foreground">Entries</p>
                          <p className="text-xs font-semibold">{employee.timesheet_summary.entry_count}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Skills */}
                {employee.skills && employee.skills.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                      <Wrench className="h-4 w-4" /> Skills
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {employee.skills.map((skill) => (
                        <span
                          key={skill.skill_name}
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${PROFICIENCY_COLORS[skill.proficiency] || PROFICIENCY_COLORS.intermediate}`}
                          title={skill.notes || skill.proficiency}
                        >
                          {skill.skill_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Managers */}
                {employee.managers.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                      <User className="h-4 w-4" /> Reports To
                    </h3>
                    <div className="space-y-2">
                      {employee.managers.map((mgr) => (
                        <button
                          key={mgr.id}
                          onClick={() => focusEmployee(mgr.id)}
                          className="cursor-pointer flex w-full items-center gap-2 rounded-lg border p-2 text-left text-sm hover:bg-accent transition-colors"
                        >
                          <div className="flex-1">
                            <p className="font-medium">{mgr.name}</p>
                            <p className="text-xs text-muted-foreground">{mgr.designation}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {mgr.relationship_type}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {mgr.location_code}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Projects */}
                {employee.projects.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                      <Briefcase className="h-4 w-4" /> Projects
                    </h3>
                    <div className="space-y-3">
                      {employee.projects.map((proj) => (
                        <div key={proj.id} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium">{proj.name}</p>
                            <div className="flex gap-1">
                              {proj.project_type && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${proj.project_type === "client" ? "border-blue-300 text-blue-700 bg-blue-50" : "border-gray-300 text-gray-600 bg-gray-50"}`}
                                >
                                  {proj.project_type}
                                </Badge>
                              )}
                              <Badge
                                variant={
                                  proj.status === "ACTIVE"
                                    ? "default"
                                    : proj.status === "COMPLETED"
                                    ? "secondary"
                                    : "outline"
                                }
                                className="text-[10px]"
                              >
                                {proj.status}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            Role: {proj.role_in_project}
                          </p>
                          <div className="flex items-center gap-2">
                            <Progress value={proj.progress_percent} className="flex-1" />
                            <span className="text-xs font-medium">
                              {proj.progress_percent.toFixed(0)}%
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(proj.start_date).toLocaleDateString()}
                            {proj.end_date && ` — ${new Date(proj.end_date).toLocaleDateString()}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Project Timeline */}
                {timeline && timeline.timeline.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4" /> Project Timeline
                    </h3>
                    <div className="overflow-x-auto">
                      <div className="flex gap-0.5 min-w-max">
                        {timeline.timeline.map((entry) => {
                          const [yr, mo] = entry.period.split("-")
                          const label = new Date(Number(yr), Number(mo) - 1).toLocaleDateString("en", { month: "short", year: "2-digit" })
                          const isBench = entry.status === "bench" || entry.projects.length === 0
                          const projectNames = entry.projects.map((p) => p.project_name).join(", ")
                          return (
                            <div
                              key={entry.period}
                              title={isBench ? `${entry.period}: Standby Period` : `${entry.period}: ${projectNames}`}
                              className="flex flex-col items-center gap-1"
                            >
                              <div
                                className={`w-8 h-8 rounded-sm transition-opacity hover:opacity-80 ${
                                  isBench
                                    ? "bg-red-200"
                                    : entry.status === "fully_billed"
                                    ? "bg-green-400"
                                    : entry.status === "partially_billed"
                                    ? "bg-amber-300"
                                    : "bg-blue-300"
                                }`}
                              />
                              <span className="text-[9px] text-muted-foreground leading-none">{label}</span>
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex gap-3 mt-2 flex-wrap">
                        {[
                          { color: "bg-green-400", label: "Fully Billed" },
                          { color: "bg-amber-300", label: "Partial" },
                          { color: "bg-blue-300", label: "Allocated" },
                          { color: "bg-red-200", label: "Standby Period" },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center gap-1">
                            <div className={`w-3 h-3 rounded-sm ${item.color}`} />
                            <span className="text-[10px] text-muted-foreground">{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Direct Reports */}
            {employee.direct_reports.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> Direct Reports ({employee.direct_reports.length})
                </h3>
                <div className="space-y-1">
                  {employee.direct_reports.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => focusEmployee(report.id)}
                      className="cursor-pointer flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors"
                    >
                      <div
                        className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{
                          backgroundColor:
                            LOCATION_COLORS[report.location_code] || "#6b7280",
                        }}
                      >
                        {report.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{report.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {report.designation}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Limited access notice for non-branch employees */}
            {!employee.is_own_branch && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mt-4">
                <p className="text-sm text-amber-700">
                  Limited access — this employee is in another branch.
                  Contact info and project details are not available.
                </p>
              </div>
            )}
          </SheetContent>
        </>
      ) : null}
    </Sheet>
  )
}
