import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { CrossReport } from "@/types/analytics"

export function CrossReportingView({ data }: { data: CrossReport[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Cross-Branch Reporting</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {data.map((cr, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{cr.employee_name}</p>
                <p className="text-xs text-muted-foreground truncate">{cr.employee_designation}</p>
              </div>
              <div className="text-center px-2">
                <span className="text-xs text-muted-foreground">reports to</span>
              </div>
              <div className="flex-1 min-w-0 text-right">
                <p className="text-sm font-medium truncate">{cr.external_manager_name}</p>
                <p className="text-xs text-muted-foreground truncate">{cr.external_manager_location}</p>
              </div>
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
