import { useState, useEffect, useRef } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { searchEmployees } from "@/api/employees"
import { useOrgChartStore } from "@/store/orgChartStore"
import { useNavigate } from "react-router-dom"
import type { EmployeeBrief } from "@/types/employee"
import { LOCATION_COLORS } from "@/lib/constants"

export function SearchBar() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<EmployeeBrief[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const selectEmployee = useOrgChartStore((s) => s.selectEmployee)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      setIsOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchEmployees({ q: query, limit: 10 })
        setResults(res.employees)
        setIsOpen(true)
      } catch {
        setResults([])
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as HTMLElement)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const handleSelect = (emp: EmployeeBrief) => {
    setIsOpen(false)
    setQuery("")
    navigate("/")
    setTimeout(() => selectEmployee(emp.id), 100)
  }

  return (
    <div ref={containerRef} className="relative w-80">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search employees..."
        className="pl-9"
      />
      {isOpen && results.length > 0 && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          {results.map((emp) => (
            <button
              key={emp.id}
              onClick={() => handleSelect(emp)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
            >
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: LOCATION_COLORS[emp.location_code] || "#6b7280" }}
              >
                {emp.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{emp.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {emp.designation} · {emp.location_code}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
      {isOpen && results.length === 0 && query.trim() && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-md border bg-popover p-3 shadow-lg">
          <p className="text-sm text-muted-foreground">No employees found</p>
        </div>
      )}
    </div>
  )
}
