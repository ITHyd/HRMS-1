import { create } from "zustand"

interface FilterState {
  searchQuery: string
  locationFilter: string | null
  departmentFilter: string | null
  levelFilter: string | null
  setSearchQuery: (q: string) => void
  setLocationFilter: (loc: string | null) => void
  setDepartmentFilter: (dept: string | null) => void
  setLevelFilter: (level: string | null) => void
  resetFilters: () => void
}

export const useFilterStore = create<FilterState>((set) => ({
  searchQuery: "",
  locationFilter: null,
  departmentFilter: null,
  levelFilter: null,
  setSearchQuery: (q) => set({ searchQuery: q }),
  setLocationFilter: (loc) => set({ locationFilter: loc }),
  setDepartmentFilter: (dept) => set({ departmentFilter: dept }),
  setLevelFilter: (level) => set({ levelFilter: level }),
  resetFilters: () =>
    set({
      searchQuery: "",
      locationFilter: null,
      departmentFilter: null,
      levelFilter: null,
    }),
}))
