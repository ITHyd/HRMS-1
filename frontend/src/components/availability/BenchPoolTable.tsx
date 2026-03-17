import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { SkillBadge } from "@/components/availability/SkillBadge"
import { SkillTagManager } from "@/components/availability/SkillTagManager"
import { Pagination } from "@/components/shared/Pagination"
import { useOrgChartStore } from "@/store/orgChartStore"
import { Briefcase, Clock } from "lucide-react"
import type { AvailableEmployee } from "@/types/availability"

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

interface BenchPoolTableProps {
  employees: AvailableEmployee[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onRefresh: () => void
  hasActiveFilters?: boolean
}

/** Format bench duration into a human-friendly string */
function formatDuration(days: number | null | undefined): string {
  if (days == null) return "—"
  if (days === 0) return "Today"
  if (days < 7) return `${days}d`
  if (days < 30) return `${Math.floor(days / 7)}w ${days % 7}d`
  const months = Math.floor(days / 30)
  const rem = days % 30
  return rem > 0 ? `${months}mo ${rem}d` : `${months}mo`
}

/** Color-code bench duration badge */
function benchDurationVariant(days: number | null | undefined): string {
  if (days == null) return "bg-muted text-muted-foreground"
  if (days <= 14) return "bg-green-100 text-green-700"
  if (days <= 45) return "bg-amber-100 text-amber-700"
  return "bg-red-100 text-red-700"
}

/** Format a date string as "MMM D, YYYY" */
function fmtDate(d: string | null | undefined): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** Format a YYYY-MM period string as "Jan 2026" */
function fmtPeriod(p: string | null | undefined): string {
  if (!p) return ""
  const [y, m] = p.split("-")
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  })
}

/** For a last_project entry, return a concise subtitle line */
function lastProjectSubtitle(p: { role?: string; period?: string | null; end_date?: string | null }): string {
  const parts: string[] = []
  if (p.role) parts.push(p.role)
  if (p.period) {
    parts.push(`last active ${fmtPeriod(p.period)}`)
  } else if (p.end_date) {
    parts.push(`ended ${fmtDate(p.end_date)}`)
  }
  return parts.join(" · ")
}

export function BenchPoolTable({
  employees,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  hasActiveFilters = false,
}: BenchPoolTableProps) {
  const [managingEmployee, setManagingEmployee] = useState<AvailableEmployee | null>(null)
  const selectEmployee = useOrgChartStore((s) => s.selectEmployee)
  const navigate = useNavigate()

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Available Talent</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 px-3 font-medium border-l border-border">Employee</th>
                  <th className="pb-2 px-3 font-medium border-l border-border">Skills</th>
                  <th className="pb-2 px-3 font-medium border-l border-border">Status</th>
                  <th className="pb-2 px-3 font-medium border-l border-border">Last Project(s)</th>
                  <th className="pb-2 px-3 font-medium border-l border-border whitespace-nowrap">Bench Since</th>
                  <th className="pb-2 px-3 font-medium border-l border-border">Duration</th>
                  <th className="pb-2 px-3 font-medium border-l border-border whitespace-nowrap">Available From</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      {hasActiveFilters
                        ? "No employees match the current filters"
                        : "No available employees found"}
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => {
                    const isBench = emp.classification === "bench"

                    return (
                      <tr
                        key={emp.employee_id}
                        className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        {/* Employee: name + designation + dept */}
                        <td className="py-2.5 px-3 border-l border-border min-w-40">
                          <button
                            onClick={() => selectEmployee(emp.employee_id)}
                            className="cursor-pointer font-medium text-foreground hover:underline text-left block"
                          >
                            {emp.employee_name}
                          </button>
                          <p className="text-xs text-muted-foreground">{emp.designation}</p>
                          <p className="text-xs text-muted-foreground">{emp.department}</p>
                        </td>

                        {/* Skills */}
                        <td className="py-2.5 px-3 border-l border-border">
                          <div className="flex items-center gap-1 flex-wrap">
                            {emp.skills.length === 0 ? (
                              <span className="text-muted-foreground text-xs">—</span>
                            ) : (
                              <>
                                {emp.skills.slice(0, 3).map((skill) => (
                                  <SkillBadge
                                    key={skill.id}
                                    name={skill.skill_name}
                                    proficiency={skill.proficiency}
                                  />
                                ))}
                                {emp.skills.length > 3 && (
                                  <span
                                    className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground cursor-pointer"
                                    title={emp.skills.slice(3).map((s) => s.skill_name).join(", ")}
                                    onClick={() => setManagingEmployee(emp)}
                                  >
                                    +{emp.skills.length - 3}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </td>

                        {/* Status: classification + utilisation */}
                        <td className="py-2.5 px-3 border-l border-border">
                          <StatusBadge status={emp.classification} />
                          <p
                            className={`text-xs mt-0.5 font-medium tabular-nums ${
                              emp.utilisation_percent >= 50
                                ? "text-amber-600"
                                : "text-red-600"
                            }`}
                          >
                            {emp.utilisation_percent.toFixed(1)}% util
                          </p>
                        </td>

                        {/* Last Project(s) — bench context */}
                        <td className="py-2.5 px-3 border-l border-border max-w-50">
                          {isBench ? (
                            emp.last_projects.length > 0 ? (
                              <div className="space-y-1">
                                {emp.last_projects.slice(0, 2).map((p) => (
                                  <div key={p.project_id} className="flex items-start gap-1">
                                    <Briefcase className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium truncate leading-tight" title={p.project_name}>
                                        <button
                                          onClick={() => navigate(`/projects/${p.project_id}`)}
                                          className="cursor-pointer text-foreground hover:underline"
                                        >
                                          {p.project_name}
                                        </button>
                                        {p.client_name && (
                                          <span className="text-muted-foreground font-normal"> · {p.client_name}</span>
                                        )}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">
                                        {lastProjectSubtitle(p) || "—"}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">No project history</span>
                            )
                          ) : (
                            /* Partially billed: show active projects */
                            emp.active_projects.length > 0 ? (
                              <div className="space-y-1">
                                {emp.active_projects.slice(0, 2).map((p) => (
                                  <div key={p.project_id} className="flex items-start gap-1">
                                    <Briefcase className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium truncate leading-tight" title={p.project_name}>
                                        <button
                                          onClick={() => navigate(`/projects/${p.project_id}`)}
                                          className="cursor-pointer text-foreground hover:underline"
                                        >
                                          {p.project_name}
                                        </button>
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">{p.role}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )
                          )}
                        </td>

                        {/* Bench Since */}
                        <td className="py-2.5 px-3 border-l border-border whitespace-nowrap">
                          {isBench ? (
                            emp.bench_since ? (
                              <span className="text-xs text-muted-foreground">{fmtDate(emp.bench_since)}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">New / No history</span>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Bench Duration — color-coded */}
                        <td className="py-2.5 px-3 border-l border-border">
                          {isBench && emp.bench_duration_days != null ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${benchDurationVariant(emp.bench_duration_days)}`}
                            >
                              <Clock className="h-3 w-3" />
                              {formatDuration(emp.bench_duration_days)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Available From */}
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap border-l border-border">
                          {emp.available_from ? (
                            new Date(emp.available_from) <= new Date() ? (
                              <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 text-xs">
                                Now
                              </Badge>
                            ) : (
                              <span className="text-xs">{fmtDate(emp.available_from)}</span>
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
          />
        </CardContent>
      </Card>

      {/* Skill Tag Manager Modal */}
      {managingEmployee && (
        <SkillTagManager
          employeeId={managingEmployee.employee_id}
          employeeName={managingEmployee.employee_name}
          skills={managingEmployee.skills}
          onUpdate={onRefresh}
          onClose={() => setManagingEmployee(null)}
        />
      )}
    </>
  )
}
