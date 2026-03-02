import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { SpanOfControl as SpanData } from "@/types/analytics"

export function SpanOfControl({ data }: { data: SpanData[] }) {
  const sorted = [...data].sort((a, b) => b.direct_report_count - a.direct_report_count)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Manager Span of Control</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[250px] overflow-y-auto">
          {sorted.map((mgr) => (
            <div
              key={mgr.manager_id}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{mgr.manager_name}</p>
                <p className="text-xs text-muted-foreground">{mgr.designation}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">{mgr.direct_report_count}</span>
                {mgr.is_outlier && (
                  <Badge variant="destructive" className="text-[10px]">
                    {mgr.direct_report_count > 10 ? "Too wide" : "Too narrow"}
                  </Badge>
                )}
              </div>
            </div>
          ))}
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground">No manager data</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
