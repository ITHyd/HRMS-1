import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Upload, FileText, Download, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { uploadCsv, confirmImport, downloadTemplate } from "@/api/importExport"
import type { ImportValidationResponse, ValidationRow } from "@/types/api"

export function CsvUploader() {
  const [validation, setValidation] = useState<ImportValidationResponse | null>(null)
  const [uploading, setUploading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleTemplate = async () => {
    try {
      const blob = await downloadTemplate()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "import_template.csv"
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // handle error
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setResult(null)
    try {
      const res = await uploadCsv(file)
      setValidation(res)
    } catch {
      setResult("Upload failed. Please check the file format.")
    } finally {
      setUploading(false)
    }
  }

  const handleConfirm = async () => {
    if (!validation) return
    setConfirming(true)
    try {
      const res = await confirmImport(validation.import_token)
      setResult(res.message)
      setValidation(null)
    } catch {
      setResult("Import failed.")
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import Employees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm text-green-700">{result}</p>
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
                <Badge className="bg-green-100 text-green-700">{validation.valid_count} valid</Badge>
                {validation.error_count > 0 && (
                  <Badge variant="destructive">{validation.error_count} errors</Badge>
                )}
                {validation.warning_count > 0 && (
                  <Badge className="bg-amber-100 text-amber-700">{validation.warning_count} warnings</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left w-10">#</th>
                    <th className="px-3 py-2 text-left w-10">Status</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Designation</th>
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
                      <td className="px-3 py-2">{row.data.name || "—"}</td>
                      <td className="px-3 py-2">{row.data.email || "—"}</td>
                      <td className="px-3 py-2">{row.data.designation || "—"}</td>
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
                {confirming ? "Importing..." : `Confirm Import (${validation.valid_count} rows)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
