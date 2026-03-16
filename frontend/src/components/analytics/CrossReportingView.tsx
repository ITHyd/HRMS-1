import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight } from "lucide-react"
import { useOrgChartStore } from "@/store/orgChartStore"
import type { CrossReport } from "@/types/analytics"

export function CrossReportingView({ data }: { data: CrossReport[] }) {
  const selectEmployee = useOrgChartStore((s) => s.selectEmployee)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Cross-Branch Reporting</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {data.map((cr, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border px-3 py-2 hover:bg-muted/50 transition-colors"
            >
              <button
                onClick={() => selectEmployee(cr.employee_id)}
                className="cursor-pointer flex-1 min-w-0 text-left group"
              >
                <p className="text-sm font-medium truncate text-foreground group-hover:underline">
                  {cr.employee_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {cr.employee_designation}
                </p>
              </button>
              <div className="flex items-center gap-1 px-2 shrink-0">
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <button
                onClick={() => selectEmployee(cr.external_manager_id)}
                className="cursor-pointer flex-1 min-w-0 text-right group"
              >
                <p className="text-sm font-medium truncate text-foreground group-hover:underline">
                  {cr.external_manager_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {cr.external_manager_location}
                </p>
              </button>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {cr.relationship_type}
              </Badge>
            </div>
          ))}
          {data.length === 0 && (
            <p className="text-sm text-muted-foreground">No cross-branch reporting lines</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
