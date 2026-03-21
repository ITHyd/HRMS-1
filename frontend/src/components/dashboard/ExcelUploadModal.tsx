import { useRef, useState } from "react"
import { Upload, X, CheckCircle, AlertCircle, FileSpreadsheet } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { uploadExcelReport, getExcelUploadHistory } from "@/api/excelUtilisation"
import type { ExcelUploadLog, ExcelUploadResult } from "@/api/excelUtilisation"
import { useEffect } from "react"

interface Props {
  onClose: () => void
  onUploaded: () => void
}

export function ExcelUploadModal({ onClose, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ExcelUploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<ExcelUploadLog[]>([])

  useEffect(() => {
    getExcelUploadHistory().then(setHistory).catch(() => {})
  }, [])

  const handleFile = async (file: File) => {
    setError(null)
    setResult(null)
    setUploading(true)
    try {
      const res = await uploadExcelReport(file)
      setResult(res)
      getExcelUploadHistory().then(setHistory).catch(() => {})
      onUploaded()
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            <span className="font-semibold text-sm">Upload Utilisation Report</span>
          </div>
          <button onClick={onClose} className="cursor-pointer rounded-md p-1 hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
            }`}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Drop your Excel file here</p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse — .xlsx / .xls</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>

          {/* Status */}
          {uploading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin h-4 w-4 rounded-full border-2 border-primary border-t-transparent" />
              Parsing and storing data...
            </div>
          )}

          {result && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-3 flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <div className="text-xs space-y-0.5">
                  <p className="font-medium text-green-800">Upload successful</p>
                  <p className="text-green-700">{result.total_rows} employees · {result.matched_rows} matched · {result.rows_stored} rows stored</p>
                  <p className="text-green-700">Periods: {result.periods.join(", ")}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <p className="text-xs text-red-700">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Upload history */}
          {history.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Previous uploads</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {history.map((h) => (
                  <div key={h.batch_id} className="flex items-center justify-between text-xs rounded-md bg-muted/40 px-3 py-2">
                    <span className="font-medium truncate max-w-[200px]">{h.filename}</span>
                    <span className="text-muted-foreground shrink-0 ml-2">
                      {h.total_rows} rows · {new Date(h.uploaded_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-4 flex justify-end">
          <button
            onClick={onClose}
            className="cursor-pointer px-4 py-2 rounded-md text-sm font-medium bg-muted hover:bg-muted/80 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
