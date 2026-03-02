import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ProjectSummary } from "@/types/analytics"

function StatusBadge({ status }: { status: string }) {
  const variant = status === "ACTIVE" ? "default" : status === "COMPLETED" ? "secondary" : "outline"
  return <Badge variant={variant} className="text-[10px]">{status}</Badge>
}

export function ProjectOverview({
  projects,
  orphaned,
}: {
  projects: ProjectSummary[]
  orphaned: ProjectSummary[]
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Projects</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{proj.name}</p>
                <p className="text-xs text-muted-foreground">{proj.department}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {proj.member_count} members
                </span>
                <StatusBadge status={proj.status} />
              </div>
            </div>
          ))}

          {orphaned.length > 0 && (
            <>
              <div className="border-t pt-2 mt-3">
                <p className="text-xs font-semibold text-amber-600 mb-1">
                  Orphaned Projects (no assigned employees)
                </p>
              </div>
              {orphaned.map((proj) => (
                <div
                  key={proj.id}
                  className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{proj.name}</p>
                    <p className="text-xs text-muted-foreground">{proj.department}</p>
                  </div>
                  <StatusBadge status={proj.status} />
                </div>
              ))}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
