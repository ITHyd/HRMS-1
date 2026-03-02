import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Upload, Download, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { PeriodSelector } from "@/components/shared/PeriodSelector"
import {
  downloadFinanceTemplate,
  uploadFinanceCsv,
  confirmFinanceUpload,
} from "@/api/finance"
import type { FinanceUploadValidationResponse } from "@/types/finance"

interface FinanceCsvUploaderProps {
  period: string
  onPeriodChange: (period: string) => void
  onUploadComplete?: () => void
}

export function FinanceCsvUploader({
  period,
  onPeriodChange,
  onUploadComplete,
}: FinanceCsvUploaderProps) {
  const [validation, setValidation] = useState<FinanceUploadValidationResponse | null>(null)
  const [uploading, setUploading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleTemplate = async () => {
    try {
      const blob = await downloadFinanceTemplate()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "finance_billable_template.csv"
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setResult({ type: "error", message: "Failed to download template." })
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setResult(null)
    setValidation(null)
    try {
      const res = await uploadFinanceCsv(file, period)
      setValidation(res)
    } catch {
      setResult({ type: "error", message: "Upload failed. Please check the file format." })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const handleConfirm = async () => {
    if (!validation) return
    setConfirming(true)
    try {
      const res = await confirmFinanceUpload(validation.upload_token)
      setResult({ type: "success", message: res.message })
      setValidation(null)
      onUploadComplete?.()
    } catch {
      setResult({ type: "error", message: "Import failed. Please try again." })
    } finally {
      setConfirming(false)
    }
  }

  const rowIcon = (status: string) => {
    if (status === "valid") return <CheckCircle2 className="h-4 w-4 text-green-500" />
    if (status === "error") return <XCircle className="h-4 w-4 text-red-500" />
    return <AlertTriangle className="h-4 w-4 text-amber-500" />
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload Finance Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">Period:</span>
            <PeriodSelector value={period} onChange={onPeriodChange} />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleTemplate}>
              <Download className="mr-1.5 h-4 w-4" />
              Download Template
            </Button>
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="mr-1.5 h-4 w-4" />
              {uploading ? "Uploading..." : "Upload CSV"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleUpload}
            />
          </div>

          {result && (
            <div
              className={`rounded-lg border p-3 ${
                result.type === "success"
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <p
                className={`text-sm ${
                  result.type === "success" ? "text-green-700" : "text-red-700"
                }`}
              >
                {result.message}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {validation && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Validation Results</CardTitle>
              <div className="flex gap-2">
                <Badge variant="secondary">{validation.total_rows} rows</Badge>
                <Badge className="bg-green-100 text-green-700">
                  {validation.valid_count} valid
                </Badge>
                {validation.error_count > 0 && (
                  <Badge variant="destructive">
                    {validation.error_count} errors
                  </Badge>
                )}
                {validation.warning_count > 0 && (
                  <Badge className="bg-amber-100 text-amber-700">
                    {validation.warning_count} warnings
                  </Badge>
                )}
                {validation.duplicate_count > 0 && (
                  <Badge className="bg-blue-100 text-blue-700">
                    {validation.duplicate_count} duplicates
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Period: {validation.period} &middot; Version: {validation.version}
            </p>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left w-10">#</th>
                    <th className="px-3 py-2 text-left w-10">Status</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Billable Status</th>
                    <th className="px-3 py-2 text-left">Hours</th>
                    <th className="px-3 py-2 text-left">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {validation.rows.map((row) => (
                    <tr
                      key={row.row_number}
                      className={
                        row.status === "error"
                          ? "bg-red-50"
                          : row.status === "warning"
                          ? "bg-amber-50"
                          : "bg-green-50/30"
                      }
                    >
                      <td className="px-3 py-2">{row.row_number}</td>
                      <td className="px-3 py-2">{rowIcon(row.status)}</td>
                      <td className="px-3 py-2">
                        {row.data.employee_email || "\u2014"}
                      </td>
                      <td className="px-3 py-2">
                        {row.data.billable_status || "\u2014"}
                      </td>
                      <td className="px-3 py-2">
                        {row.data.billable_hours || "\u2014"}
                      </td>
                      <td className="px-3 py-2">
                        {row.errors.map((e, i) => (
                          <p key={i} className="text-xs text-red-600">{e}</p>
                        ))}
                        {row.warnings.map((w, i) => (
                          <p key={i} className="text-xs text-amber-600">{w}</p>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => setValidation(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={confirming || validation.valid_count === 0}
              >
                {confirming
                  ? "Importing..."
                  : `Confirm Import (${validation.valid_count} rows)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
