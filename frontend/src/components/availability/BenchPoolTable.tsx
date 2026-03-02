import { useState } from "react"
import { Settings2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { SkillBadge } from "@/components/availability/SkillBadge"
import { SkillTagManager } from "@/components/availability/SkillTagManager"
import type { AvailableEmployee } from "@/types/availability"

interface BenchPoolTableProps {
  employees: AvailableEmployee[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onRefresh: () => void
}

export function BenchPoolTable({
  employees,
  total,
  page,
  pageSize,
  onPageChange,
  onRefresh,
}: BenchPoolTableProps) {
  const [managingEmployee, setManagingEmployee] = useState<AvailableEmployee | null>(null)
  const totalPages = Math.ceil(total / pageSize)

  const handleSkillUpdate = () => {
    onRefresh()
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Available Employees</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Designation</th>
                  <th className="pb-2 pr-4 font-medium">Department</th>
                  <th className="pb-2 pr-4 font-medium">Skills</th>
                  <th className="pb-2 pr-4 font-medium text-right">Utilisation %</th>
                  <th className="pb-2 pr-4 font-medium">Classification</th>
                  <th className="pb-2 pr-4 font-medium">Projects</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No available employees found
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr
                      key={emp.employee_id}
                      className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-2.5 pr-4 font-medium">{emp.employee_name}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {emp.designation}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {emp.department}
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {emp.skills.length === 0 ? (
                            <span className="text-muted-foreground text-xs">-</span>
                          ) : (
                            emp.skills.slice(0, 4).map((skill) => (
                              <SkillBadge
                                key={skill.id}
                                name={skill.skill_name}
                                proficiency={skill.proficiency}
                              />
                            ))
                          )}
                          {emp.skills.length > 4 && (
                            <span className="text-[10px] text-muted-foreground self-center">
                              +{emp.skills.length - 4} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">
                        <span
                          className={
                            emp.utilisation_percent >= 80
                              ? "text-green-600 font-medium"
                              : emp.utilisation_percent >= 50
                              ? "text-amber-600 font-medium"
                              : "text-red-600 font-medium"
                          }
                        >
                          {emp.utilisation_percent.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <StatusBadge status={emp.classification} />
                      </td>
                      <td className="py-2.5 pr-4 max-w-[200px]">
                        <span
                          className="truncate block text-muted-foreground"
                          title={
                            emp.current_projects
                              .map((p) => p.project_name)
                              .join(", ")
                          }
                        >
                          {emp.current_projects
                            .map((p) => p.project_name)
                            .join(", ") || "-"}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setManagingEmployee(emp)}
                          className="h-7 text-xs"
                        >
                          <Settings2 className="mr-1 h-3.5 w-3.5" />
                          Manage Skills
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * pageSize + 1}-
                {Math.min(page * pageSize, total)} of {total} employees
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1}
                  className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (page <= 3) {
                    pageNum = i + 1
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = page - 2 + i
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => onPageChange(pageNum)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        pageNum === page
                          ? "bg-primary text-primary-foreground"
                          : "border hover:bg-accent"
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                <button
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skill Tag Manager Modal */}
      {managingEmployee && (
        <SkillTagManager
          employeeId={managingEmployee.employee_id}
          employeeName={managingEmployee.employee_name}
          skills={managingEmployee.skills}
          onUpdate={handleSkillUpdate}
          onClose={() => setManagingEmployee(null)}
        />
      )}
    </>
  )
}
