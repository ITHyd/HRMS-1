import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronRight } from "lucide-react"
import { useOrgChartStore } from "@/store/orgChartStore"
import type { SpanOfControl as SpanData } from "@/types/analytics"

export function SpanOfControl({ data }: { data: SpanData[] }) {
  const sorted = [...data].sort((a, b) => b.direct_report_count - a.direct_report_count)
  const selectEmployee = useOrgChartStore((s) => s.selectEmployee)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Manager Span of Control</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {sorted.map((mgr) => (
            <button
              key={mgr.manager_id}
              onClick={() => selectEmployee(mgr.manager_id)}
              className="cursor-pointer w-full text-left flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/50 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-foreground group-hover:underline">
                  {mgr.manager_name}
                </p>
                <p className="text-xs text-muted-foreground">{mgr.designation}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {mgr.direct_report_count} {mgr.direct_report_count === 1 ? "report" : "reports"}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground">No manager data</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
