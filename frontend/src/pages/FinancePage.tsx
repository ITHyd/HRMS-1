import { useEffect, useState, useCallback } from "react"
import { PeriodSelector } from "@/components/shared/PeriodSelector"
import { FinanceCsvUploader } from "@/components/finance/FinanceCsvUploader"
import { FinanceBillableTable } from "@/components/finance/FinanceBillableTable"
import { FinanceUploadHistory } from "@/components/finance/FinanceUploadHistory"
import { getFinanceBillable, getFinanceUploadHistory } from "@/api/finance"
import type {
  FinanceBillableEntry,
  FinanceUploadHistoryEntry,
} from "@/types/finance"

function getCurrentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function FinancePage() {
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriod)
  const [billableData, setBillableData] = useState<FinanceBillableEntry[]>([])
  const [uploadHistory, setUploadHistory] = useState<FinanceUploadHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBillable = useCallback(
    async () => {
      try {
        const res = await getFinanceBillable({
          period: selectedPeriod,
        })
        setBillableData(res.entries)
      } catch {
        setBillableData([])
      }
    },
    [selectedPeriod]
  )

  const fetchHistory = useCallback(async () => {
    try {
      const res = await getFinanceUploadHistory()
      setUploadHistory(res)
    } catch {
      setUploadHistory([])
    }
  }, [])

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
            Upload and review monthly billable data for your branch
          </p>
        </div>
        <PeriodSelector value={selectedPeriod} onChange={setSelectedPeriod} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FinanceCsvUploader
          period={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
          onUploadComplete={handleUploadComplete}
        />
        <FinanceBillableTable
          entries={billableData}
          period={selectedPeriod}
        />
      </div>

      <FinanceUploadHistory history={uploadHistory} />
    </div>
  )
}
