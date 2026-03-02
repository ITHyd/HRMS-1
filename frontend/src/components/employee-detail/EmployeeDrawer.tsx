import { useEffect, useState } from "react"
import { Sheet, SheetHeader, SheetTitle, SheetContent } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useOrgChartStore } from "@/store/orgChartStore"
import { getEmployee } from "@/api/employees"
import { getReportingChain } from "@/api/org"
import type { EmployeeDetail } from "@/types/employee"
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
} from "lucide-react"

export function EmployeeDrawer() {
  const isOpen = useOrgChartStore((s) => s.isDrawerOpen)
  const selectedId = useOrgChartStore((s) => s.selectedEmployeeId)
  const closeDrawer = useOrgChartStore((s) => s.closeDrawer)
  const selectEmployee = useOrgChartStore((s) => s.selectEmployee)
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null)
  const [chain, setChain] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedId || !isOpen) return
    setLoading(true)
    setError(null)
    setEmployee(null)
    setChain([])

    const loadEmployee = async () => {
      try {
        const emp = await getEmployee(selectedId)
        setEmployee(emp)
      } catch (err) {
        console.error("Failed to load employee:", err)
        setError(`Failed to load employee details`)
      }

      try {
        const chainRes = await getReportingChain(selectedId)
        setChain(chainRes.chain || [])
      } catch (err) {
        console.error("Failed to load chain:", err)
      }

      setLoading(false)
    }

    loadEmployee()
  }, [selectedId, isOpen])

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
            <div className="flex items-center gap-3">
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold text-white"
                style={{ backgroundColor: locColor }}
              >
                {employee.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div>
                <SheetTitle>{employee.name}</SheetTitle>
                <p className="text-sm text-muted-foreground">{employee.designation}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary">{employee.department}</Badge>
              <Badge style={{ backgroundColor: locColor + "20", color: locColor, borderColor: locColor }}>
                {employee.location_code} · {employee.location_city}
              </Badge>
              <Badge variant="outline">{LEVEL_LABELS[employee.level] || employee.level}</Badge>
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
                        onClick={() => selectEmployee((c as Record<string, string>).id)}
                        className="rounded px-1.5 py-0.5 hover:bg-accent transition-colors"
                      >
                        {(c as Record<string, string>).id === employee.id ? (
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
                          onClick={() => selectEmployee(mgr.id)}
                          className="flex w-full items-center gap-2 rounded-lg border p-2 text-left text-sm hover:bg-accent transition-colors"
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
                      onClick={() => selectEmployee(report.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors"
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
