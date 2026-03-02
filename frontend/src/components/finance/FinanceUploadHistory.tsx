import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, FileText } from "lucide-react"
import type { FinanceUploadHistoryEntry } from "@/types/finance"

interface FinanceUploadHistoryProps {
  history: FinanceUploadHistoryEntry[]
}

export function FinanceUploadHistory({ history }: FinanceUploadHistoryProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload History</CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            No upload history yet.
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => (
              <div
                key={entry.batch_id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{entry.period}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                      v{entry.version}
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {entry.filename}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(entry.uploaded_at)}</span>
                    <span>&middot;</span>
                    <span>by {entry.uploaded_by}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="secondary" className="text-[10px]">
                    {entry.total_rows} total
                  </Badge>
                  <Badge className="bg-green-100 text-green-700 text-[10px]">
                    {entry.valid_count} valid
                  </Badge>
                  {entry.error_count > 0 && (
                    <Badge variant="destructive" className="text-[10px]">
                      {entry.error_count} errors
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
