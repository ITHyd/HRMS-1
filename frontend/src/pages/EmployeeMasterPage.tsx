import { useEffect, useState, useCallback, useRef } from "react"
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
  X,
} from "lucide-react"
import { Pagination } from "@/components/shared/Pagination"
import { SelectDropdown } from "@/components/shared/SelectDropdown"
import type { EmployeeMasterEntry } from "@/types/employee"

const LEVEL_OPTIONS = [
  { value: "", label: "All Levels" },
  { value: "intern", label: "Intern" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
  { value: "manager", label: "Manager" },
  { value: "director", label: "Director" },
]

const STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]


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

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchInput = (value: string) => {
    setSearchInput(value)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      setSearch(value)
      setPage(1)
    }, 300)
  }

  const resetFilters = () => {
    setSearchInput("")
    setSearch("")
    setDepartmentId("")
    setLevel("")
    setStatusFilter("")
    setPage(1)
  }

  const handleCardFilter = (status: string) => {
    setStatusFilter((prev) => prev === status ? "" : status)
    setPage(1)
    setShowFilters(true)
  }

  const activeFilterCount = [
    search,
    departmentId,
    level,
    statusFilter,
  ].filter(Boolean).length

  const summaryCards = [
    { title: "Total Employees", value: total, icon: Users2, color: "text-blue-600", bgColor: "bg-blue-50", filterKey: "" },
    { title: "Active", value: activeCount, icon: UserCheck, color: "text-green-600", bgColor: "bg-green-50", filterKey: "active" },
    { title: "Inactive", value: inactiveCount, icon: UserX, color: "text-red-600", bgColor: "bg-red-50", filterKey: "inactive" },
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
          <Card
            key={card.title}
            className={`cursor-pointer transition-all hover:shadow-md ${
              statusFilter === card.filterKey && card.filterKey !== ""
                ? "ring-2 ring-primary"
                : ""
            }`}
            onClick={() => {
              if (card.filterKey === "") {
                resetFilters()
              } else {
                handleCardFilter(card.filterKey)
              }
            }}
          >
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
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  placeholder="Search name, email, designation..."
                  value={searchInput}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <SelectDropdown
                options={[
                  { value: "", label: "All Departments" },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
                value={departmentId}
                onChange={(v) => { setDepartmentId(v); setPage(1) }}
              />
              <SelectDropdown
                options={LEVEL_OPTIONS}
                value={level}
                onChange={(v) => { setLevel(v); setPage(1) }}
              />
              <SelectDropdown
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={(v) => { setStatusFilter(v); setPage(1) }}
              />
              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="cursor-pointer inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}
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
                        onClick={() => selectEmployee(emp.id)}
                        className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer group"
                      >
                        <td className="py-2.5 px-3">
                          <span className="font-medium text-primary group-hover:underline">
                            {emp.name}
                          </span>
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

            <Pagination
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
