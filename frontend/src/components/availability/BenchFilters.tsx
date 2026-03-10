import { useState, useEffect, useRef } from "react"
import { Search, X, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  searchSkillCatalog,
  getLocations,
  getDesignations,
} from "@/api/availability"

interface BenchFiltersProps {
  onSearch: (query: string) => void
  onSkillFilter: (skill: string) => void
  onClassificationFilter: (classification: string) => void
  onLocationFilter: (location: string) => void
  onDesignationFilter: (designation: string) => void
  onUtilisationRange: (min: number | undefined, max: number | undefined) => void
  searchQuery: string
  skillFilter: string
  classificationFilter: string
  locationFilter: string
  designationFilter: string
  utilisationMin?: number
  utilisationMax?: number
}

const CLASSIFICATION_OPTIONS = [
  { value: "", label: "All Classifications" },
  { value: "bench", label: "Bench" },
  { value: "partially_billed", label: "Partially Billed" },
]

export function BenchFilters({
  onSearch,
  onSkillFilter,
  onClassificationFilter,
  onLocationFilter,
  onDesignationFilter,
  onUtilisationRange,
  searchQuery,
  skillFilter,
  classificationFilter,
  locationFilter,
  designationFilter,
  utilisationMin,
  utilisationMax,
}: BenchFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const [localSkill, setLocalSkill] = useState(skillFilter)
  const [skillSuggestions, setSkillSuggestions] = useState<
    { name: string; display_name: string }[]
  >([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [locationOptions, setLocationOptions] = useState<
    { value: string; label: string }[]
  >([{ value: "", label: "All Locations" }])
  const [designationOptions, setDesignationOptions] = useState<
    { value: string; label: string }[]
  >([{ value: "", label: "All Roles" }])
  const [localUtilMin, setLocalUtilMin] = useState(
    utilisationMin?.toString() ?? ""
  )
  const [localUtilMax, setLocalUtilMax] = useState(
    utilisationMax?.toString() ?? ""
  )

  // Fetch location options on mount
  useEffect(() => {
    getLocations()
      .then((locs) =>
        setLocationOptions([
          { value: "", label: "All Locations" },
          ...locs.map((l) => ({ value: l.code, label: l.label })),
        ])
      )
      .catch(() => {})
  }, [])

  // Fetch designation options on mount
  useEffect(() => {
    getDesignations()
      .then((desigs) =>
        setDesignationOptions([
          { value: "", label: "All Roles" },
          ...desigs.map((d) => ({ value: d, label: d })),
        ])
      )
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLocalSearch(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    setLocalSkill(skillFilter)
  }, [skillFilter])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchQuery) {
        onSearch(localSearch)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [localSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce utilisation range
  useEffect(() => {
    const timer = setTimeout(() => {
      const min = localUtilMin ? parseFloat(localUtilMin) : undefined
      const max = localUtilMax ? parseFloat(localUtilMax) : undefined
      if (min !== utilisationMin || max !== utilisationMax) {
        onUtilisationRange(min, max)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [localUtilMin, localUtilMax]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (localSkill.length < 2) {
      setSkillSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchSkillCatalog(localSkill)
        setSkillSuggestions(
          results.map((r) => ({ name: r.name, display_name: r.display_name }))
        )
        setShowSuggestions(true)
      } catch {
        setSkillSuggestions([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [localSkill])

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchInput = (value: string) => {
    setLocalSearch(value)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      onSearch(value)
    }, 300)
  }

  const handleSkillSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setShowSuggestions(false)
    onSkillFilter(localSkill)
  }

  const handleSkillSelect = (name: string, displayName: string) => {
    setLocalSkill(displayName)
    setShowSuggestions(false)
    onSkillFilter(name)
  }

  const hasActiveFilters =
    searchQuery ||
    skillFilter ||
    classificationFilter ||
    locationFilter ||
    designationFilter ||
    utilisationMin !== undefined ||
    utilisationMax !== undefined

  const handleClearFilters = () => {
    setLocalSearch("")
    setLocalSkill("")
    setLocalUtilMin("")
    setLocalUtilMax("")
    onSearch("")
    onSkillFilter("")
    onClassificationFilter("")
    onLocationFilter("")
    onDesignationFilter("")
    onUtilisationRange(undefined, undefined)
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          {/* Search */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={localSearch}
                onChange={(e) => handleSearchInput(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
          </div>

          {/* Skill */}
          <div className="relative">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Skill
            </label>
            <form onSubmit={handleSkillSubmit} className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by skill..."
                value={localSkill}
                onChange={(e) => setLocalSkill(e.target.value)}
                onFocus={() =>
                  skillSuggestions.length > 0 && setShowSuggestions(true)
                }
                onBlur={() =>
                  setTimeout(() => setShowSuggestions(false), 200)
                }
                className="pl-9 h-8 text-sm"
              />
            </form>
            {showSuggestions && skillSuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                {skillSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.name}
                    type="button"
                    onMouseDown={() =>
                      handleSkillSelect(suggestion.name, suggestion.display_name)
                    }
                    className="cursor-pointer block w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors first:rounded-t-md last:rounded-b-md"
                  >
                    {suggestion.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Classification */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Classification
            </label>
            <Select
              options={CLASSIFICATION_OPTIONS}
              value={classificationFilter}
              onChange={(e) => onClassificationFilter(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Location */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Location
            </label>
            <Select
              options={locationOptions}
              value={locationFilter}
              onChange={(e) => onLocationFilter(e.target.value)}
              className="h-8 text-sm"
              maxRows={6}
              searchable
            />
          </div>

          {/* Role */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Role
            </label>
            <Select
              options={designationOptions}
              value={designationFilter}
              onChange={(e) => onDesignationFilter(e.target.value)}
              className="h-8 text-sm"
              maxRows={6}
              searchable
            />
          </div>

          {/* Utilisation % + Clear */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Utilisation %
              </label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  placeholder="Min"
                  min={0}
                  max={100}
                  value={localUtilMin}
                  onChange={(e) => setLocalUtilMin(e.target.value)}
                  className="h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">&ndash;</span>
                <Input
                  type="number"
                  placeholder="Max"
                  min={0}
                  max={100}
                  value={localUtilMax}
                  onChange={(e) => setLocalUtilMax(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-muted-foreground h-8 px-2"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
