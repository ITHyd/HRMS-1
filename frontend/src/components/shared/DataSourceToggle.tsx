import { Database, FileSpreadsheet } from "lucide-react"
import { useDataSourceStore } from "@/store/dataSourceStore"

export function DataSourceToggle() {
  const dataSource = useDataSourceStore((s) => s.dataSource)
  const setDataSource = useDataSourceStore((s) => s.setDataSource)

  return (
    <div className="flex items-center rounded-lg border bg-muted/30 p-0.5 gap-0.5">
      <button
        onClick={() => setDataSource("hrms")}
        className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          dataSource === "hrms"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Database className="h-3.5 w-3.5" />
        HRMS Live
      </button>
      <button
        onClick={() => setDataSource("excel")}
        className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          dataSource === "excel"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <FileSpreadsheet className="h-3.5 w-3.5" />
        Excel Report
      </button>
    </div>
  )
}
