import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/authStore"
import { getAuditLog } from "@/api/audit"
import type { AuditEntry } from "@/types/api"
import { ChevronLeft, ChevronRight } from "lucide-react"

export function AuditLogTable() {
  const user = useAuthStore((s) => s.user)
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const pageSize = 20

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getAuditLog(user.branch_location_id, page, pageSize)
      .then((res) => {
        setEntries(res.entries)
        setTotal(res.total)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user, page])

  const totalPages = Math.ceil(total / pageSize)

  const actionColor = (action: string) => {
    switch (action) {
      case "CREATE": return "bg-green-100 text-green-700"
      case "UPDATE": return "bg-blue-100 text-blue-700"
      case "DELETE": return "bg-red-100 text-red-700"
      case "IMPORT": return "bg-purple-100 text-purple-700"
      default: return "bg-gray-100 text-gray-700"
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Audit Log</CardTitle>
          <span className="text-sm text-muted-foreground">{total} entries</span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No audit entries yet
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 rounded-lg border px-4 py-3">
                  <Badge className={`${actionColor(entry.action)} text-[10px] shrink-0 mt-0.5`}>
                    {entry.action}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{entry.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      by {entry.changed_by_name} ·{" "}
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {entry.entity_type}
                  </Badge>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
