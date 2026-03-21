import { create } from "zustand"
import { persist } from "zustand/middleware"

export type AppDataSource = "hrms" | "excel"

interface DataSourceState {
  dataSource: AppDataSource
  setDataSource: (source: AppDataSource) => void
}

export const useDataSourceStore = create<DataSourceState>()(
  persist(
    (set) => ({
      dataSource: "hrms",
      setDataSource: (source) => set({ dataSource: source }),
    }),
    {
      name: "app-data-source",
    }
  )
)
