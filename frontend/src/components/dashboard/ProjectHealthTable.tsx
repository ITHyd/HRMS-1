import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/StatusBadge"
import type { ProjectDashboardEntry } from "@/types/dashboard"

interface ProjectHealthTableProps {
  projects: ProjectDashboardEntry[]
}

export function ProjectHealthTable({ projects }: ProjectHealthTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

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
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Department</th>
                <th className="pb-2 pr-4 font-medium text-right">Members</th>
                <th className="pb-2 pr-4 font-medium text-right">Hours</th>
                <th className="pb-2 pr-4 font-medium text-right">Billable %</th>
                <th className="pb-2 pr-4 font-medium">Health</th>
                <th className="pb-2 font-medium text-right">Over-Utilised</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No projects found
                  </td>
                </tr>
              ) : (
                projects.map((project) => {
                  const isExpanded = expandedRows.has(project.project_id)
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
                          <StatusBadge status={project.status} />
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">
                          {project.department}
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
                        <td className="py-2.5 pr-4">
                          <StatusBadge status={project.health} />
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          {project.over_utilised_members.length > 0 ? (
                            <span className="text-red-600 font-medium">
                              {project.over_utilised_members.length}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && project.members.length > 0 && (
                        <tr key={`${project.project_id}-members`}>
                          <td colSpan={9} className="p-0">
                            <div className="bg-muted/30 border-b px-8 py-3">
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                Team Members
                              </p>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-muted-foreground">
                                    <th className="pb-1 text-left font-medium">Name</th>
                                    <th className="pb-1 text-right font-medium">Hours</th>
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
                                        <td className="py-1.5">{member.employee_name}</td>
                                        <td className="py-1.5 text-right tabular-nums">
                                          {member.hours.toFixed(1)}
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
