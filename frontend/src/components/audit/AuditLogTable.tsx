import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AuditEntry } from "@/types/api"
import { ChevronDown, ChevronUp } from "lucide-react"

interface AuditLogTableProps {
  entries: AuditEntry[]
  total: number
  loading: boolean
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  IMPORT: "bg-purple-100 text-purple-700",
  SYNC: "bg-cyan-100 text-cyan-700",
  EXPORT: "bg-amber-100 text-amber-700",
  UPLOAD: "bg-indigo-100 text-indigo-700",
  APPROVE: "bg-emerald-100 text-emerald-700",
  REJECT: "bg-rose-100 text-rose-700",
  LOCK: "bg-orange-100 text-orange-700",
  COMPUTE: "bg-teal-100 text-teal-700",
  SKILL_TAG: "bg-violet-100 text-violet-700",
}

function MetadataToggle({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false)
  const hasMetadata =
    (entry.old_value && Object.keys(entry.old_value).length > 0) ||
    (entry.new_value && Object.keys(entry.new_value).length > 0)

  if (!hasMetadata) return null

  return (
    <div className="mt-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-muted-foreground"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronUp className="mr-1 h-3 w-3" />
        ) : (
          <ChevronDown className="mr-1 h-3 w-3" />
        )}
        {expanded ? "Hide details" : "Show details"}
      </Button>
      {expanded && (
        <div className="mt-1.5 space-y-1.5 text-xs">
          {entry.old_value && Object.keys(entry.old_value).length > 0 && (
            <div className="rounded bg-red-50 px-3 py-2">
              <span className="font-medium text-red-600">Previous: </span>
              <code className="text-red-700">
                {JSON.stringify(entry.old_value, null, 2)}
              </code>
            </div>
          )}
          {entry.new_value && Object.keys(entry.new_value).length > 0 && (
            <div className="rounded bg-green-50 px-3 py-2">
              <span className="font-medium text-green-600">Updated: </span>
              <code className="text-green-700">
                {JSON.stringify(entry.new_value, null, 2)}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function AuditLogTable({ entries, total, loading }: AuditLogTableProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Activity</CardTitle>
          <span className="text-sm text-muted-foreground">
            {total} {total === 1 ? "entry" : "entries"}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No audit entries found
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 rounded-lg border px-4 py-3"
              >
                <Badge
                  className={`${ACTION_COLORS[entry.action] || "bg-gray-100 text-gray-700"} text-[10px] shrink-0 mt-0.5`}
                >
                  {entry.action}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{entry.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    by {entry.changed_by_name} &middot;{" "}
                    {new Date(entry.timestamp).toLocaleString()}
                  </p>
                  <MetadataToggle entry={entry} />
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {entry.entity_type}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
