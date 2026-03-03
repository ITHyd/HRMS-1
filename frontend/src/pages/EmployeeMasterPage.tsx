import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { useOrgChartStore } from "@/store/orgChartStore"
import { listEmployees, getEmployeeDepartments } from "@/api/employees"
import {
  Users2,
  UserCheck,
  UserX,
  SlidersHorizontal,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import type { EmployeeMasterEntry } from "@/types/employee"

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

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

export function EmployeeMasterPage() {
  const [searchParams] = useSearchParams()
  const urlDeptId = searchParams.get("department_id") || ""

  const [employees, setEmployees] = useState<EmployeeMasterEntry[]>([])
  const [total, setTotal] = useState(0)
  const [activeCount, setActiveCount] = useState(0)
  const [inactiveCount, setInactiveCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)

  // Filters
  const [showFilters, setShowFilters] = useState(!!urlDeptId)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [departmentId, setDepartmentId] = useState(urlDeptId)
  const [level, setLevel] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")

  // Filter options
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([])

  const selectEmployee = useOrgChartStore((s) => s.selectEmployee)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listEmployees({
        search: search || undefined,
        department_id: departmentId || undefined,
        level: level || undefined,
        is_active: statusFilter === "" ? undefined : statusFilter === "active",
        page,
        page_size: pageSize,
      })
      setEmployees(data.employees)
      setTotal(data.total)
      setActiveCount(data.active_count)
      setInactiveCount(data.inactive_count)
    } catch (err) {
      console.error("Failed to load employees:", err)
      setEmployees([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [search, departmentId, level, statusFilter, page, pageSize])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    getEmployeeDepartments().then(setDepartments).catch(console.error)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const totalPages = Math.ceil(total / pageSize)

  const activeFilterCount = [
    search,
    departmentId,
    level,
    statusFilter,
  ].filter(Boolean).length

  const summaryCards = [
    { title: "Total Employees", value: total, icon: Users2, color: "text-blue-600", bgColor: "bg-blue-50" },
    { title: "Active", value: activeCount, icon: UserCheck, color: "text-green-600", bgColor: "bg-green-50" },
    { title: "Inactive", value: inactiveCount, icon: UserX, color: "text-red-600", bgColor: "bg-red-50" },
  ]

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Employee Master</h2>
          <p className="text-sm text-muted-foreground">
            View all HRMS-synced employees in your branch
          </p>
        </div>
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
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${card.bgColor}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {loading ? "-" : card.value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Collapsible Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  placeholder="Search name, email, designation..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </form>
              <select
                value={departmentId}
                onChange={(e) => { setDepartmentId(e.target.value); setPage(1) }}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <select
                value={level}
                onChange={(e) => { setLevel(e.target.value); setPage(1) }}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Levels</option>
                <option value="junior">Junior</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
                <option value="manager">Manager</option>
                <option value="director">Director</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
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
                    <th className="py-2.5 px-3 font-medium border-l border-border">Join Date</th>
                    <th className="py-2.5 px-3 font-medium border-l border-border">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        {activeFilterCount > 0
                          ? "No employees match the current filters"
                          : "No employees found"}
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp) => (
                      <tr
                        key={emp.id}
                        className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-2.5 px-3">
                          <button
                            onClick={() => selectEmployee(emp.id)}
                            className="font-medium text-primary hover:underline text-left"
                          >
                            {emp.name}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground border-l border-border">
                          {emp.email}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground border-l border-border">
                          {emp.designation}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground border-l border-border">
                          {emp.department}
                        </td>
                        <td className="py-2.5 px-3 border-l border-border">
                          <span className="capitalize text-muted-foreground">{emp.level}</span>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground border-l border-border">
                          {emp.location}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap border-l border-border">
                          {emp.join_date
                            ? new Date(emp.join_date).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="py-2.5 px-3 border-l border-border">
                          <StatusBadge status={emp.is_active ? "active" : "inactive"} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {total > 0 && (
              <div className="flex items-center justify-between px-3 py-3 border-t">
                <p className="text-xs text-muted-foreground tabular-nums min-w-[140px]">
                  Showing {(page - 1) * pageSize + 1}&ndash;{Math.min(page * pageSize, total)} of{" "}
                  {total}
                </p>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page <= 1}
                    className="rounded-md border p-1 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    className="rounded-md border p-1 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>

                  {getPageNumbers(page, totalPages).map((item, idx) =>
                    item === "ellipsis" ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-1.5 text-xs text-muted-foreground select-none"
                      >
                        &hellip;
                      </span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setPage(item)}
                        className={`rounded-md min-w-7 px-1.5 py-1 text-xs font-medium transition-colors ${
                          item === page
                            ? "bg-primary text-primary-foreground"
                            : "border hover:bg-accent"
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}

                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                    className="rounded-md border p-1 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page >= totalPages}
                    className="rounded-md border p-1 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 min-w-[140px] justify-end">
                  <span className="text-xs text-muted-foreground">Rows</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                    className="h-7 rounded-md border border-input bg-transparent px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
