import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronRight } from "lucide-react"
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
  const navigate = useNavigate()

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Projects</CardTitle>
          <button
            onClick={() => navigate("/projects")}
            className="cursor-pointer text-xs text-foreground hover:underline"
          >
            View all
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {projects.map((proj) => (
            <button
              key={proj.id}
              onClick={() => navigate(`/projects/${proj.id}`)}
              className="cursor-pointer w-full text-left flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/50 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-foreground group-hover:underline">
                  {proj.name}
                </p>
                <p className="text-xs text-muted-foreground">{proj.client_name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {proj.member_count} {proj.member_count === 1 ? "member" : "members"}
                </span>
                <StatusBadge status={proj.status} />
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}

          {orphaned.length > 0 && (
            <>
              <div className="border-t pt-2 mt-3">
                <p className="text-xs font-semibold text-amber-600 mb-1">
                  Orphaned Projects (no assigned employees)
                </p>
              </div>
              {orphaned.map((proj) => (
                <button
                  key={proj.id}
                  onClick={() => navigate(`/projects/${proj.id}`)}
                  className="cursor-pointer w-full text-left flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 hover:bg-amber-100 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground group-hover:underline">
                      {proj.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{proj.client_name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={proj.status} />
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
