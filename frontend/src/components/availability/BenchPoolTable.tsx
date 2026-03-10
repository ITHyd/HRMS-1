import { useState } from "react"
import { Settings2, Briefcase } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { SkillBadge } from "@/components/availability/SkillBadge"
import { SkillTagManager } from "@/components/availability/SkillTagManager"
import { AssignProjectModal } from "@/components/availability/AssignProjectModal"
import { Pagination } from "@/components/shared/Pagination"
import { useOrgChartStore } from "@/store/orgChartStore"
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showAssignModal, setShowAssignModal] = useState(false)
  const selectEmployee = useOrgChartStore((s) => s.selectEmployee)
  const totalPages = Math.ceil(total / pageSize)

  const handleSkillUpdate = () => {
    onRefresh()
  }

  const toggleSelect = (id: string) => {
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

  const toggleAll = () => {
    if (selectedIds.size === employees.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(employees.map((e) => e.employee_id)))
    }
  }

  const selectedEmployees = employees
    .filter((e) => selectedIds.has(e.employee_id))
    .map((e) => ({ id: e.employee_id, name: e.employee_name }))

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Available Employees</CardTitle>
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                onClick={() => setShowAssignModal(true)}
                className="h-8 text-xs"
              >
                <Briefcase className="mr-1.5 h-3.5 w-3.5" />
                Assign to Project ({selectedIds.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 px-3 font-medium w-8">
                    <input
                      type="checkbox"
                      checked={employees.length > 0 && selectedIds.size === employees.length}
                      onChange={toggleAll}
                      className="cursor-pointer rounded border-gray-300"
                    />
                  </th>
                  <th className="pb-2 px-3 font-medium border-l border-border">Name</th>
                  <th className="pb-2 px-3 font-medium border-l border-border">Designation</th>
                  <th className="pb-2 px-3 font-medium border-l border-border">Department</th>
                  <th className="pb-2 px-3 font-medium border-l border-border">Skills</th>
                  <th className="pb-2 px-3 font-medium text-right whitespace-nowrap border-l border-border">Utilisation %</th>
                  <th className="pb-2 px-3 font-medium border-l border-border">Classification</th>
                  <th className="pb-2 px-3 font-medium border-l border-border">Available From</th>
                  <th className="pb-2 px-3 font-medium border-l border-border">Projects</th>
                  <th className="pb-2 px-3 font-medium border-l border-border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-muted-foreground">
                      {hasActiveFilters
                        ? "No employees match the current filters"
                        : "No available employees found"}
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr
                      key={emp.employee_id}
                      className={`border-b last:border-0 hover:bg-muted/50 transition-colors ${selectedIds.has(emp.employee_id) ? "bg-primary/5" : ""}`}
                    >
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(emp.employee_id)}
                          onChange={() => toggleSelect(emp.employee_id)}
                          className="cursor-pointer rounded border-gray-300"
                        />
                      </td>
                      <td className="py-2.5 px-3 border-l border-border">
                        <button
                          onClick={() => selectEmployee(emp.employee_id)}
                          className="cursor-pointer font-medium text-primary hover:underline text-left"
                        >
                          {emp.employee_name}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground border-l border-border">
                        {emp.designation}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground border-l border-border">
                        {emp.department}
                      </td>
                      <td className="py-2.5 px-3 border-l border-border">
                        <div className="flex items-center gap-1">
                          {emp.skills.length === 0 ? (
                            <span className="text-muted-foreground text-xs">-</span>
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
                                  className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                                  title={emp.skills.slice(3).map((s) => s.skill_name).join(", ")}
                                >
                                  +{emp.skills.length - 3}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums border-l border-border">
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
                      <td className="py-2.5 px-3 border-l border-border">
                        <StatusBadge status={emp.classification} />
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap border-l border-border">
                        {emp.available_from
                          ? new Date(emp.available_from) <= new Date()
                            ? "Now"
                            : emp.available_from
                          : "-"}
                      </td>
                      <td className="py-2.5 px-3 max-w-50 border-l border-border">
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
                      <td className="py-2.5 px-3 border-l border-border">
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
          onUpdate={handleSkillUpdate}
          onClose={() => setManagingEmployee(null)}
        />
      )}

      {/* Assign Project Modal */}
      {showAssignModal && (
        <AssignProjectModal
          selectedEmployees={selectedEmployees}
          onClose={() => setShowAssignModal(false)}
          onSuccess={() => {
            setSelectedIds(new Set())
            onRefresh()
          }}
        />
      )}
    </>
  )
}
