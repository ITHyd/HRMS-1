import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { useOrgChartStore } from "@/store/orgChartStore"
import type { ProjectDashboardEntry } from "@/types/dashboard"

interface ProjectHealthTableProps {
  projects: ProjectDashboardEntry[]
}

export function ProjectHealthTable({ projects }: ProjectHealthTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const selectEmployee = useOrgChartStore((s) => s.selectEmployee)

  const toggleRow = (projectId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  const isOverdue = (endDate?: string) => {
    if (!endDate) return false
    return new Date(endDate) < new Date()
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Project Health Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-2 font-medium w-8"></th>
                <th className="pb-2 pr-4 font-medium">Project</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Progress</th>
                <th className="pb-2 pr-4 font-medium">Deadline</th>
                <th className="pb-2 pr-4 font-medium text-right">Members</th>
                <th className="pb-2 pr-4 font-medium text-right">Hours</th>
                <th className="pb-2 pr-4 font-medium text-right">Billable %</th>
                <th className="pb-2 font-medium">Health</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground">
                    No projects found
                  </td>
                </tr>
              ) : (
                projects.map((project) => {
                  const isExpanded = expandedRows.has(project.project_id)
                  const overdue = isOverdue(project.end_date)
                  return (
                    <>
                      <tr
                        key={project.project_id}
                        className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => toggleRow(project.project_id)}
                      >
                        <td className="py-2.5 pr-2">
                          {project.members.length > 0 && (
                            isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )
                          )}
                        </td>
                        <td className="py-2.5 pr-4 font-medium">
                          {project.project_name}
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${project.project_type === "client" ? "border-blue-300 text-blue-700 bg-blue-50" : "border-gray-300 text-gray-600 bg-gray-50"}`}
                          >
                            {project.project_type}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4">
                          <StatusBadge status={project.status} />
                        </td>
                        <td className="py-2.5 pr-4 w-32">
                          <div className="flex items-center gap-2">
                            <Progress value={project.progress_percent} className="flex-1 h-2" />
                            <span className="text-xs tabular-nums font-medium w-10 text-right">
                              {project.progress_percent.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-xs">
                          {project.end_date ? (
                            <span className={overdue ? "text-red-600 font-medium" : "text-muted-foreground"}>
                              {new Date(project.end_date).toLocaleDateString()}
                              {overdue && " (overdue)"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">
                          {project.member_count}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">
                          {project.total_hours_consumed.toFixed(1)}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">
                          <span
                            className={
                              project.billable_percent >= 80
                                ? "text-green-600 font-medium"
                                : project.billable_percent >= 50
                                ? "text-amber-600 font-medium"
                                : "text-red-600 font-medium"
                            }
                          >
                            {project.billable_percent.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5">
                          <StatusBadge status={project.health} />
                        </td>
                      </tr>
                      {isExpanded && project.members.length > 0 && (
                        <tr key={`${project.project_id}-members`}>
                          <td colSpan={10} className="p-0">
                            <div className="bg-muted/30 border-b px-8 py-3">
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                Team Members
                              </p>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-muted-foreground">
                                    <th className="pb-1 text-left font-medium">Name</th>
                                    <th className="pb-1 text-left font-medium">Role</th>
                                    <th className="pb-1 text-right font-medium">Hours</th>
                                    <th className="pb-1 text-right font-medium">Billable Hrs</th>
                                    <th className="pb-1 text-right font-medium">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {project.members.map((member) => {
                                    const isOverUtilised =
                                      project.over_utilised_members.includes(
                                        member.employee_id
                                      )
                                    return (
                                      <tr
                                        key={member.employee_id}
                                        className="border-t border-muted"
                                      >
                                        <td className="py-1.5">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              selectEmployee(member.employee_id)
                                            }}
                                            className="text-primary hover:underline font-medium"
                                          >
                                            {member.employee_name}
                                          </button>
                                        </td>
                                        <td className="py-1.5 text-muted-foreground">
                                          {member.role}
                                        </td>
                                        <td className="py-1.5 text-right tabular-nums">
                                          {member.hours.toFixed(1)}
                                        </td>
                                        <td className="py-1.5 text-right tabular-nums">
                                          {member.billable_hours.toFixed(1)}
                                        </td>
                                        <td className="py-1.5 text-right">
                                          {isOverUtilised ? (
                                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                                              Over-Utilised
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                                              Normal
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
