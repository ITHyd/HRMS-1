import { useState, useEffect } from "react"
import { Search, X, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { searchSkillCatalog } from "@/api/availability"

interface BenchFiltersProps {
  onSearch: (query: string) => void
  onSkillFilter: (skill: string) => void
  onClassificationFilter: (classification: string) => void
  searchQuery: string
  skillFilter: string
  classificationFilter: string
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
  searchQuery,
  skillFilter,
  classificationFilter,
}: BenchFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const [localSkill, setLocalSkill] = useState(skillFilter)
  const [skillSuggestions, setSkillSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    setLocalSearch(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    setLocalSkill(skillFilter)
  }, [skillFilter])

  useEffect(() => {
    if (localSkill.length < 2) {
      setSkillSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchSkillCatalog(localSkill)
        setSkillSuggestions(results.map((r) => r.display_name))
        setShowSuggestions(true)
      } catch {
        setSkillSuggestions([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [localSkill])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(localSearch)
  }

  const handleSkillSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setShowSuggestions(false)
    onSkillFilter(localSkill)
  }

  const handleSkillSelect = (skill: string) => {
    setLocalSkill(skill)
    setShowSuggestions(false)
    onSkillFilter(skill)
  }

  const hasActiveFilters = searchQuery || skillFilter || classificationFilter

  const handleClearFilters = () => {
    setLocalSearch("")
    setLocalSkill("")
    onSearch("")
    onSkillFilter("")
    onClassificationFilter("")
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Search by name */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Search
            </label>
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </form>
          </div>

          {/* Skill filter */}
          <div className="flex-1 min-w-[200px] relative">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Skill
            </label>
            <form onSubmit={handleSkillSubmit} className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by skill..."
                value={localSkill}
                onChange={(e) => setLocalSkill(e.target.value)}
                onFocus={() => skillSuggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="pl-9 h-8 text-sm"
              />
            </form>
            {showSuggestions && skillSuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                {skillSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onMouseDown={() => handleSkillSelect(suggestion)}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors first:rounded-t-md last:rounded-b-md"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Classification dropdown */}
          <div className="min-w-[180px]">
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

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-muted-foreground"
            >
              <X className="mr-1.5 h-4 w-4" />
              Clear Filters
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
