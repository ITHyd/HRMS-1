import { create } from "zustand"

function getCurrentPeriod(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

type DashboardTab = "executive" | "resources" | "projects"

interface DashboardState {
  selectedPeriod: string
  activeTab: DashboardTab
  setPeriod: (period: string) => void
  setActiveTab: (tab: DashboardTab) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedPeriod: getCurrentPeriod(),
  activeTab: "executive",
  setPeriod: (period) => set({ selectedPeriod: period }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
