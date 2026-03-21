import { useEffect, useState, useCallback } from "react"
import { PeriodSelector } from "@/components/shared/PeriodSelector"
import { DataSourceToggle } from "@/components/shared/DataSourceToggle"
import { FinanceCsvUploader } from "@/components/finance/FinanceCsvUploader"
import { FinanceBillableTable } from "@/components/finance/FinanceBillableTable"
import { FinanceUploadHistory } from "@/components/finance/FinanceUploadHistory"
import { getFinanceBillable, getFinanceUploadHistory } from "@/api/finance"
import { useDataSourceStore } from "@/store/dataSourceStore"
import { useReportPeriodStore } from "@/store/reportPeriodStore"
import type {
  FinanceBillableEntry,
  FinanceUploadHistoryEntry,
} from "@/types/finance"


export function FinancePage() {
  const dataSource = useDataSourceStore((s) => s.dataSource)
  const selectedPeriod = useReportPeriodStore((s) => s.selectedPeriod)
  const setSelectedPeriod = useReportPeriodStore((s) => s.setSelectedPeriod)
  const [billableData, setBillableData] = useState<FinanceBillableEntry[]>([])
  const [uploadHistory, setUploadHistory] = useState<FinanceUploadHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBillable = useCallback(
    async () => {
      try {
        const res = await getFinanceBillable({
          period: selectedPeriod,
          data_source: dataSource,
        })
        setBillableData(res.entries)
      } catch {
        setBillableData([])
      }
    },
    [dataSource, selectedPeriod]
  )

  const fetchHistory = useCallback(async () => {
    try {
      const res = await getFinanceUploadHistory(dataSource)
      setUploadHistory(res)
    } catch {
      setUploadHistory([])
    }
  }, [dataSource])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([fetchBillable(), fetchHistory()])
    } finally {
      setLoading(false)
    }
  }, [fetchBillable, fetchHistory])

  useEffect(() => {
    queueMicrotask(() => {
      void fetchAll()
    })
  }, [fetchAll])

  const handleUploadComplete = () => {
    fetchAll()
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Finance Billable Data</h2>
          <p className="text-sm text-muted-foreground">
            {dataSource === "excel"
              ? "Excel-derived finance view using uploaded utilisation data with HRMS project enrichment"
              : "Upload and review monthly billable data for your branch"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DataSourceToggle />
          <PeriodSelector value={selectedPeriod} onChange={setSelectedPeriod} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {dataSource === "hrms" ? (
          <FinanceCsvUploader
            period={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            onUploadComplete={handleUploadComplete}
          />
        ) : (
          <div className="rounded-xl border bg-muted/20 p-6">
            <h3 className="text-sm font-semibold">Excel Source Active</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Finance rows are being derived from the uploaded utilisation workbook for {selectedPeriod}.
              HRMS project and client fields are merged in when they exist.
            </p>
          </div>
        )}
        <FinanceBillableTable
          entries={billableData}
          period={selectedPeriod}
        />
      </div>

      <FinanceUploadHistory history={uploadHistory} />
    </div>
  )
}
