import { Database, FileSpreadsheet, Loader2 } from "lucide-react"
import { useState } from "react"
import { useDataSourceStore } from "@/store/dataSourceStore"
import { triggerExcelReimport } from "@/api/excelUtilisation"

export function DataSourceToggle() {
  const dataSource = useDataSourceStore((s) => s.dataSource)
  const setDataSource = useDataSourceStore((s) => s.setDataSource)
  const [importing, setImporting] = useState(false)

  const handleExcelClick = async () => {
    if (dataSource === "excel") return
    setDataSource("excel")
    setImporting(true)
    try {
      await triggerExcelReimport()
    } catch (e) {
      // silently ignore — data may already be up to date
    } finally {
      setImporting(false)
    }
  }

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
        onClick={handleExcelClick}
        disabled={importing}
        className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          dataSource === "excel"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        } disabled:opacity-60`}
      >
        {importing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-3.5 w-3.5" />
        )}
        Excel Report
      </button>
    </div>
  )
}
