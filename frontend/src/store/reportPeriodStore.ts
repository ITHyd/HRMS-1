import { create } from "zustand"
import { persist } from "zustand/middleware"
import { getCurrentPeriod } from "@/components/shared/PeriodSelector"

interface ReportPeriodState {
  selectedPeriod: string
  setSelectedPeriod: (period: string) => void
}

export const useReportPeriodStore = create<ReportPeriodState>()(
  persist(
    (set) => ({
      selectedPeriod: getCurrentPeriod(),
      setSelectedPeriod: (period) => set({ selectedPeriod: period }),
    }),
    {
      name: "app-report-period",
    }
  )
)
