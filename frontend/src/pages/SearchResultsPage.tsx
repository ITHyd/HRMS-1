import { useEffect, useState, useCallback } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { useOrgChartStore } from "@/store/orgChartStore"
import { globalSearch, getEmployeesBySkill } from "@/api/search"
import { listEmployees } from "@/api/employees"
import { listProjects } from "@/api/projects"
import {
  Search,
  Users2,
  FolderKanban,
  Wrench,
  Building2,
  ArrowLeft,
  ArrowRight,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import type {
  GlobalSearchResponse,
  EmployeeBySkillResult,
  SearchTab,
} from "@/types/search"
import type { EmployeeMasterEntry } from "@/types/employee"
import type { ProjectBrief } from "@/types/project"

const PAGE_SIZE = 20

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | "ellipsis")[] = [1]
  if (current <= 4) {
    for (let i = 2; i <= 5; i++) pages.push(i)
    pages.push("ellipsis", total)
  } else if (current >= total - 3) {
    pages.push("ellipsis")
    for (let i = total - 4; i <= total; i++) pages.push(i)
  } else {
    pages.push("ellipsis", current - 1, current, current + 1, "ellipsis", total)
  }
  return pages
}

const PROFICIENCY_COLORS: Record<string, string> = {
  beginner: "bg-gray-100 text-gray-700 border-gray-300",
  intermediate: "bg-blue-50 text-blue-700 border-blue-300",
  advanced: "bg-green-50 text-green-700 border-green-300",
  expert: "bg-purple-50 text-purple-700 border-purple-300",
}

function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number
  totalPages: number
  total: number
  onPageChange: (p: number) => void
}) {
  if (total <= 0) return null
  return (
    <div className="flex items-center justify-between px-3 py-3 border-t">
      <p className="text-xs text-muted-foreground tabular-nums min-w-[140px]">
        Showing {(page - 1) * PAGE_SIZE + 1}&ndash;{Math.min(page * PAGE_SIZE, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={page <= 1} className="rounded-md border p-1 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <ChevronsLeft className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="rounded-md border p-1 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {getPageNumbers(page, totalPages).map((item, idx) =>
          item === "ellipsis" ? (
            <span key={`e-${idx}`} className="px-1.5 text-xs text-muted-foreground select-none">&hellip;</span>
          ) : (
            <button key={item} onClick={() => onPageChange(item)} className={`rounded-md min-w-7 px-1.5 py-1 text-xs font-medium transition-colors ${item === page ? "bg-primary text-primary-foreground" : "border hover:bg-accent"}`}>
              {item}
            </button>
          )
        )}
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="rounded-md border p-1 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} className="rounded-md border p-1 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <ChevronsRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-w-[140px]" />
    </div>
  )
}

export function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const selectEmployee = useOrgChartStore((s) => s.selectEmployee)

  const query = searchParams.get("q") || ""
  const activeTab = (searchParams.get("tab") as SearchTab) || "all"
  const selectedSkill = searchParams.get("skill") || ""

  // Global search results (All tab + counts)
  const [globalResults, setGlobalResults] = useState<GlobalSearchResponse | null>(null)
  const [globalLoading, setGlobalLoading] = useState(false)

  // Employees tab
  const [employees, setEmployees] = useState<EmployeeMasterEntry[]>([])
  const [empTotal, setEmpTotal] = useState(0)
  const [empPage, setEmpPage] = useState(1)
  const [empLoading, setEmpLoading] = useState(false)

  // Projects tab
  const [projects, setProjects] = useState<ProjectBrief[]>([])
  const [projTotal, setProjTotal] = useState(0)
  const [projPage, setProjPage] = useState(1)
  const [projLoading, setProjLoading] = useState(false)

  // Skills tab - employees by skill
  const [skillEmployees, setSkillEmployees] = useState<EmployeeBySkillResult[]>([])
  const [skillEmpTotal, setSkillEmpTotal] = useState(0)
  const [skillEmpPage, setSkillEmpPage] = useState(1)
  const [skillEmpLoading, setSkillEmpLoading] = useState(false)
  const [skillName, setSkillName] = useState("")

  const setTab = (tab: SearchTab) => {
    const params: Record<string, string> = { q: query, tab }
    if (tab === "skills" && selectedSkill) params.skill = selectedSkill
    setSearchParams(params)
  }

  // Fetch global results
  useEffect(() => {
    if (!query) return
    setGlobalLoading(true)
    globalSearch({ q: query, employee_limit: 10, project_limit: 10, skill_limit: 10, department_limit: 10 })
      .then(setGlobalResults)
      .catch(console.error)
      .finally(() => setGlobalLoading(false))
  }, [query])

  // Fetch employees tab
  const fetchEmployees = useCallback(async () => {
    if (!query || activeTab !== "employees") return
    setEmpLoading(true)
    try {
      const data = await listEmployees({ search: query, page: empPage, page_size: PAGE_SIZE })
      setEmployees(data.employees)
      setEmpTotal(data.total)
    } catch { setEmployees([]) }
    finally { setEmpLoading(false) }
  }, [query, empPage, activeTab])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  // Fetch projects tab
  const fetchProjects = useCallback(async () => {
    if (!query || activeTab !== "projects") return
    setProjLoading(true)
    try {
      const data = await listProjects({ search: query, page: projPage, page_size: PAGE_SIZE })
      setProjects(data.projects)
      setProjTotal(data.total)
    } catch { setProjects([]) }
    finally { setProjLoading(false) }
  }, [query, projPage, activeTab])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  // Fetch skill employees
  const fetchSkillEmployees = useCallback(async () => {
    if (!selectedSkill || activeTab !== "skills") return
    setSkillEmpLoading(true)
    try {
      const data = await getEmployeesBySkill({ skill: selectedSkill, page: skillEmpPage, page_size: PAGE_SIZE })
      setSkillEmployees(data.employees)
      setSkillEmpTotal(data.total)
      setSkillName(data.skill_name)
    } catch { setSkillEmployees([]) }
    finally { setSkillEmpLoading(false) }
  }, [selectedSkill, skillEmpPage, activeTab])

  useEffect(() => { fetchSkillEmployees() }, [fetchSkillEmployees])

  const tabs: { key: SearchTab; label: string; count: number | null; icon: typeof Users2 }[] = [
    { key: "all", label: "All", count: null, icon: Search },
    { key: "employees", label: "Employees", count: globalResults?.employees.total ?? null, icon: Users2 },
    { key: "projects", label: "Projects", count: globalResults?.projects.total ?? null, icon: FolderKanban },
    { key: "skills", label: "Skills", count: globalResults?.skills.total ?? null, icon: Wrench },
    { key: "departments", label: "Departments", count: globalResults?.departments.total ?? null, icon: Building2 },
  ]

  const isLoading = globalLoading || empLoading || projLoading || skillEmpLoading

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">
          Search Results {query && <>for &ldquo;{query}&rdquo;</>}
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            {tab.count != null && (
              <span className="text-[10px] bg-muted rounded-full px-1.5 py-0.5 font-normal">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex h-32 items-center justify-center">
          <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* All Tab */}
      {!isLoading && activeTab === "all" && globalResults && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: "Employees", count: globalResults.employees.total, icon: Users2, color: "text-blue-600", bg: "bg-blue-50", tab: "employees" as SearchTab },
              { label: "Projects", count: globalResults.projects.total, icon: FolderKanban, color: "text-green-600", bg: "bg-green-50", tab: "projects" as SearchTab },
              { label: "Skills", count: globalResults.skills.total, icon: Wrench, color: "text-purple-600", bg: "bg-purple-50", tab: "skills" as SearchTab },
              { label: "Departments", count: globalResults.departments.total, icon: Building2, color: "text-amber-600", bg: "bg-amber-50", tab: "departments" as SearchTab },
            ].map((card) => (
              <Card key={card.label} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTab(card.tab)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${card.bg}`}>
                      <card.icon className={`h-5 w-5 ${card.color}`} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                      <p className="text-2xl font-semibold tabular-nums">{card.count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Employee results */}
          {globalResults.employees.items.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <div className="flex items-center gap-2">
                    <Users2 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Employees ({globalResults.employees.total})</h3>
                  </div>
                  {globalResults.employees.total > globalResults.employees.items.length && (
                    <button onClick={() => setTab("employees")} className="text-xs text-primary hover:underline flex items-center gap-1">
                      View all <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="divide-y">
                  {globalResults.employees.items.map((emp) => (
                    <button key={emp.id} onClick={() => selectEmployee(emp.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary">{emp.name}</p>
                        <p className="text-xs text-muted-foreground">{emp.designation} · {emp.department}</p>
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">{emp.level}</span>
                      <span className="text-xs text-muted-foreground">{emp.location_code}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Project results */}
          {globalResults.projects.items.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <div className="flex items-center gap-2">
                    <FolderKanban className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Projects ({globalResults.projects.total})</h3>
                  </div>
                  {globalResults.projects.total > globalResults.projects.items.length && (
                    <button onClick={() => setTab("projects")} className="text-xs text-primary hover:underline flex items-center gap-1">
                      View all <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="divide-y">
                  {globalResults.projects.items.map((proj) => (
                    <button key={proj.id} onClick={() => navigate(`/projects/${proj.id}`)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary">{proj.name}</p>
                        <p className="text-xs text-muted-foreground">{proj.department_name} · {proj.member_count} members</p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${proj.project_type === "client" ? "border-blue-300 text-blue-700 bg-blue-50" : "border-gray-300 text-gray-600 bg-gray-50"}`}>
                        {proj.project_type}
                      </Badge>
                      <StatusBadge status={proj.status} />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Skill results */}
          {globalResults.skills.items.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Skills ({globalResults.skills.total})</h3>
                  </div>
                  {globalResults.skills.total > globalResults.skills.items.length && (
                    <button onClick={() => setTab("skills")} className="text-xs text-primary hover:underline flex items-center gap-1">
                      View all <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                  {globalResults.skills.items.map((skill) => (
                    <button
                      key={skill.id}
                      onClick={() => setSearchParams({ q: query, tab: "skills", skill: skill.name })}
                      className="flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
                    >
                      <Wrench className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{skill.display_name}</p>
                        <p className="text-xs text-muted-foreground">{skill.category}</p>
                      </div>
                      <span className="text-xs font-medium text-primary tabular-nums">{skill.employee_count}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Department results */}
          {globalResults.departments.items.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Departments ({globalResults.departments.total})</h3>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4">
                  {globalResults.departments.items.map((dept) => (
                    <button
                      key={dept.id}
                      onClick={() => navigate(`/employees?department_id=${dept.id}`)}
                      className="flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
                    >
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{dept.name}</p>
                        <p className="text-xs text-muted-foreground">{dept.employee_count} employees</p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Employees Tab */}
      {!empLoading && activeTab === "employees" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2.5 px-3 font-medium">Name</th>
                    <th className="py-2.5 px-3 font-medium border-l border-border">Email</th>
                    <th className="py-2.5 px-3 font-medium border-l border-border">Designation</th>
                    <th className="py-2.5 px-3 font-medium border-l border-border">Department</th>
                    <th className="py-2.5 px-3 font-medium border-l border-border">Level</th>
                    <th className="py-2.5 px-3 font-medium border-l border-border">Location</th>
                    <th className="py-2.5 px-3 font-medium border-l border-border">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 ? (
                    <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No employees found</td></tr>
                  ) : employees.map((emp) => (
                    <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-2.5 px-3">
                        <button onClick={() => selectEmployee(emp.id)} className="font-medium text-primary hover:underline text-left">{emp.name}</button>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground border-l border-border">{emp.email}</td>
                      <td className="py-2.5 px-3 text-muted-foreground border-l border-border">{emp.designation}</td>
                      <td className="py-2.5 px-3 text-muted-foreground border-l border-border">{emp.department}</td>
                      <td className="py-2.5 px-3 border-l border-border"><span className="capitalize text-muted-foreground">{emp.level}</span></td>
                      <td className="py-2.5 px-3 text-muted-foreground border-l border-border">{emp.location}</td>
                      <td className="py-2.5 px-3 border-l border-border"><StatusBadge status={emp.is_active ? "active" : "inactive"} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={empPage} totalPages={Math.ceil(empTotal / PAGE_SIZE)} total={empTotal} onPageChange={setEmpPage} />
          </CardContent>
        </Card>
      )}

      {/* Projects Tab */}
      {!projLoading && activeTab === "projects" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2.5 px-3 font-medium">Project Name</th>
                    <th className="py-2.5 px-3 font-medium border-l border-border">Type</th>
                    <th className="py-2.5 px-3 font-medium border-l border-border">Status</th>
                    <th className="py-2.5 px-3 font-medium border-l border-border">Department</th>
                    <th className="py-2.5 px-3 font-medium border-l border-border min-w-[150px]">Progress</th>
                    <th className="py-2.5 px-3 font-medium text-right border-l border-border">Members</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No projects found</td></tr>
                  ) : projects.map((proj) => (
                    <tr key={proj.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-2.5 px-3">
                        <button onClick={() => navigate(`/projects/${proj.id}`)} className="font-medium text-primary hover:underline text-left">{proj.name}</button>
                      </td>
                      <td className="py-2.5 px-3 border-l border-border">
                        <Badge variant="outline" className={`text-[10px] ${proj.project_type === "client" ? "border-blue-300 text-blue-700 bg-blue-50" : "border-gray-300 text-gray-600 bg-gray-50"}`}>{proj.project_type}</Badge>
                      </td>
                      <td className="py-2.5 px-3 border-l border-border"><StatusBadge status={proj.status} /></td>
                      <td className="py-2.5 px-3 text-muted-foreground border-l border-border">{proj.department_name}</td>
                      <td className="py-2.5 px-3 border-l border-border">
                        <div className="flex items-center gap-2">
                          <Progress value={proj.progress_percent} className="h-2 flex-1" />
                          <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{proj.progress_percent.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right border-l border-border">
                        <div className="flex items-center justify-end gap-1 text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          <span className="tabular-nums">{proj.member_count}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={projPage} totalPages={Math.ceil(projTotal / PAGE_SIZE)} total={projTotal} onPageChange={setProjPage} />
          </CardContent>
        </Card>
      )}

      {/* Skills Tab */}
      {!skillEmpLoading && activeTab === "skills" && (
        <>
          {selectedSkill ? (
            /* Employees-by-skill table */
            <div className="space-y-4">
              <button
                onClick={() => setSearchParams({ q: query, tab: "skills" })}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to skill results
              </button>
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-base font-semibold">
                  Employees with &ldquo;{skillName || selectedSkill}&rdquo; ({skillEmpTotal})
                </h3>
              </div>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2.5 px-3 font-medium">Name</th>
                          <th className="py-2.5 px-3 font-medium border-l border-border">Email</th>
                          <th className="py-2.5 px-3 font-medium border-l border-border">Designation</th>
                          <th className="py-2.5 px-3 font-medium border-l border-border">Department</th>
                          <th className="py-2.5 px-3 font-medium border-l border-border">Level</th>
                          <th className="py-2.5 px-3 font-medium border-l border-border">Location</th>
                          <th className="py-2.5 px-3 font-medium border-l border-border">Proficiency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {skillEmployees.length === 0 ? (
                          <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No employees found with this skill</td></tr>
                        ) : skillEmployees.map((emp) => (
                          <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                            <td className="py-2.5 px-3">
                              <button onClick={() => selectEmployee(emp.id)} className="font-medium text-primary hover:underline text-left">{emp.name}</button>
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground border-l border-border">{emp.email}</td>
                            <td className="py-2.5 px-3 text-muted-foreground border-l border-border">{emp.designation}</td>
                            <td className="py-2.5 px-3 text-muted-foreground border-l border-border">{emp.department}</td>
                            <td className="py-2.5 px-3 border-l border-border"><span className="capitalize text-muted-foreground">{emp.level}</span></td>
                            <td className="py-2.5 px-3 text-muted-foreground border-l border-border">{emp.location}</td>
                            <td className="py-2.5 px-3 border-l border-border">
                              <Badge variant="outline" className={`text-[10px] capitalize ${PROFICIENCY_COLORS[emp.proficiency] || ""}`}>
                                {emp.proficiency}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={skillEmpPage} totalPages={Math.ceil(skillEmpTotal / PAGE_SIZE)} total={skillEmpTotal} onPageChange={setSkillEmpPage} />
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Skill catalog cards */
            <div className="space-y-4">
              {globalResults && globalResults.skills.items.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {globalResults.skills.items.map((skill) => (
                    <Card
                      key={skill.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSearchParams({ q: query, tab: "skills", skill: skill.name })}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg p-2 bg-purple-50">
                            <Wrench className="h-5 w-5 text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{skill.display_name}</p>
                            <p className="text-xs text-muted-foreground">{skill.category}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold tabular-nums">{skill.employee_count}</p>
                            <p className="text-[10px] text-muted-foreground">employees</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  No skills found matching &ldquo;{query}&rdquo;
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Departments Tab */}
      {!globalLoading && activeTab === "departments" && globalResults && (
        <div>
          {globalResults.departments.items.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {globalResults.departments.items.map((dept) => (
                <Card key={dept.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/employees?department_id=${dept.id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg p-2 bg-amber-50">
                        <Building2 className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{dept.name}</p>
                        <p className="text-xs text-muted-foreground">{dept.employee_count} employees</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No departments found matching &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  )
}
