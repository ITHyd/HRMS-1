import { create } from "zustand"

function getCurrentPeriod(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

interface TimesheetState {
  selectedPeriod: string
  isLocked: boolean
  loading: boolean
  setPeriod: (period: string) => void
  setLocked: (locked: boolean) => void
  setLoading: (loading: boolean) => void
}

export const useTimesheetStore = create<TimesheetState>((set) => ({
  selectedPeriod: getCurrentPeriod(),
  isLocked: false,
  loading: false,
  setPeriod: (period) => set({ selectedPeriod: period }),
  setLocked: (locked) => set({ isLocked: locked }),
  setLoading: (loading) => set({ loading }),
}))
