import { useState, useEffect, useRef } from "react"
import {
  Search,
  Users2,
  FolderKanban,
  Wrench,
  Building2,
  ArrowRight,
  Loader2,
  Network,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { globalSearch } from "@/api/search"
import { useOrgChartStore } from "@/store/orgChartStore"
import { useNavigate, useLocation } from "react-router-dom"
import { LOCATION_COLORS } from "@/lib/constants"
import type { GlobalSearchResponse } from "@/types/search"

export function SearchBar() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GlobalSearchResponse | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const selectEmployee = useOrgChartStore((s) => s.selectEmployee)
  const focusEmployee = useOrgChartStore((s) => s.focusEmployee)

  // Debounced global search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults(null)
      setIsOpen(false)
      return
    }
    setIsLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await globalSearch({ q: query })
        setResults(res)
        setIsOpen(true)
      } catch {
        setResults(null)
      } finally {
        setIsLoading(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as HTMLElement)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Ctrl+K / Cmd+K to focus, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === "Escape") {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const close = () => {
    setIsOpen(false)
    setQuery("")
  }

  const handleEmployeeClick = (id: string) => {
    close()
    selectEmployee(id)
  }

  const handleViewInOrgChart = (id: string) => {
    close()
    // Set focus target in the store — OrgChartCanvas will handle
    // ancestor expansion and centering once tree data is ready
    focusEmployee(id)
    if (location.pathname !== "/org-chart") {
      navigate("/org-chart")
    }
  }

  const handleProjectClick = (id: string) => {
    close()
    navigate(`/projects/${id}`)
  }

  const handleSkillClick = (skillName: string) => {
    close()
    navigate(`/search?tab=skills&skill=${encodeURIComponent(skillName)}&q=${encodeURIComponent(query)}`)
  }

  const handleDepartmentClick = (deptId: string) => {
    close()
    navigate(`/employees?department_id=${deptId}`)
  }

  const handleViewAll = () => {
    const q = query
    close()
    navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim()) {
      e.preventDefault()
      handleViewAll()
    }
  }

  const hasResults =
    results &&
    (results.employees.items.length > 0 ||
      results.projects.items.length > 0 ||
      results.skills.items.length > 0 ||
      results.departments.items.length > 0)

  return (
    <div ref={containerRef} className="relative w-96">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (results) setIsOpen(true) }}
        placeholder="Search employees, projects, skills... (Ctrl+K)"
        className="pl-9 pr-8"
      />
      {isLoading && query.trim() && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin" />
      )}

      {isOpen && hasResults && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-[480px] overflow-auto">
          {/* Employees */}
          {results!.employees.items.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b bg-muted/30">
                <Users2 className="h-3.5 w-3.5" />
                Employees
                <span className="ml-auto text-[10px] font-normal">{results!.employees.total} total</span>
              </div>
              {results!.employees.items.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center hover:bg-accent transition-colors"
                >
                  <button
                    onClick={() => handleEmployeeClick(emp.id)}
                    className="flex flex-1 items-center gap-3 px-3 py-2 text-left text-sm min-w-0"
                  >
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: LOCATION_COLORS[emp.location_code] || "#6b7280" }}
                    >
                      {emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{emp.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {emp.designation} · {emp.department}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{emp.location_code}</span>
                  </button>
                  <button
                    onClick={() => handleViewInOrgChart(emp.id)}
                    className="shrink-0 rounded p-1.5 mr-2 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                    title="View in Org Chart"
                  >
                    <Network className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Projects */}
          {results!.projects.items.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b bg-muted/30">
                <FolderKanban className="h-3.5 w-3.5" />
                Projects
                <span className="ml-auto text-[10px] font-normal">{results!.projects.total} total</span>
              </div>
              {results!.projects.items.map((proj) => (
                <button
                  key={proj.id}
                  onClick={() => handleProjectClick(proj.id)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                >
                  <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{proj.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {proj.project_type} · {proj.member_count} members
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[9px] shrink-0 ${
                      proj.status === "ACTIVE"
                        ? "border-green-300 text-green-700 bg-green-50"
                        : proj.status === "ON_HOLD"
                        ? "border-amber-300 text-amber-700 bg-amber-50"
                        : "border-gray-300 text-gray-600 bg-gray-50"
                    }`}
                  >
                    {proj.status}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {/* Skills */}
          {results!.skills.items.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b bg-muted/30">
                <Wrench className="h-3.5 w-3.5" />
                Skills
                <span className="ml-auto text-[10px] font-normal">{results!.skills.total} total</span>
              </div>
              {results!.skills.items.map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => handleSkillClick(skill.name)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                >
                  <Wrench className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{skill.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {skill.category} · {skill.employee_count} employee{skill.employee_count !== 1 ? "s" : ""} in branch
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Departments */}
          {results!.departments.items.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b bg-muted/30">
                <Building2 className="h-3.5 w-3.5" />
                Departments
                <span className="ml-auto text-[10px] font-normal">{results!.departments.total} total</span>
              </div>
              {results!.departments.items.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => handleDepartmentClick(dept.id)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{dept.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {dept.employee_count} employee{dept.employee_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* View all results */}
          <button
            onClick={handleViewAll}
            className="flex w-full items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium text-primary hover:bg-accent transition-colors border-t"
          >
            View all results for &ldquo;{query}&rdquo;
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {isOpen && !hasResults && !isLoading && query.trim() && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-md border bg-popover p-3 shadow-lg">
          <p className="text-sm text-muted-foreground text-center">No results found for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  )
}
