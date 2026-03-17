import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { PeriodSelector } from "@/components/shared/PeriodSelector"
import { useOrgChartStore } from "@/store/orgChartStore"
import { getProjectDetail } from "@/api/projects"
import { ArrowLeft, Users, Clock, CalendarDays, Briefcase, ChevronDown, ChevronRight, Activity } from "lucide-react"
import type { ProjectDetail } from "@/types/project"

function HealthScoreCard({ score, breakdown }: { score: number; breakdown: { allocation: number; billable: number; timeline: number; team: number } }) {
  const [open, setOpen] = useState(false)
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444"
  const textColor = score >= 75 ? "text-green-700" : score >= 50 ? "text-amber-700" : "text-red-700"
  const rows = [
    { key: "Allocation",  val: breakdown.allocation  },
    { key: "Billable",    val: breakdown.billable    },
    { key: "Timeline",    val: breakdown.timeline    },
    { key: "Team",        val: breakdown.team        },
  ]
  return (
    <Card>
      <CardContent className="p-4">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg p-2 bg-slate-100">
              <Activity className="h-5 w-5 text-slate-600" />
            </div>
            <div className="text-left">
              <p className="text-xs text-muted-foreground">Health Score</p>
              <p className={`text-xl font-semibold tabular-nums ${textColor}`}>
                {score.toFixed(0)}/100
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full border-2 flex items-center justify-center" style={{ borderColor: color }}>
              <span className="text-[10px] font-bold" style={{ color }}>{score.toFixed(0)}</span>
            </div>
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>
        {open && (
          <div className="mt-3 pt-3 border-t grid grid-cols-2 sm:grid-cols-4 gap-3">
            {rows.map(({ key, val }) => {
              const c = val >= 75 ? "#22c55e" : val >= 50 ? "#f59e0b" : "#ef4444"
              return (
                <div key={key} className="text-center">
                  <p className="text-[11px] text-muted-foreground mb-1">{key}</p>
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-full border-2 mx-auto" style={{ borderColor: c }}>
                    <span className="text-xs font-bold" style={{ color: c }}>{val.toFixed(0)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const selectEmployee = useOrgChartStore((s) => s.selectEmployee)
  const setDrawerPeriod = useOrgChartStore((s) => s.setDrawerPeriod)
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })

  useEffect(() => {
    setDrawerPeriod(selectedPeriod)
    return () => setDrawerPeriod(null)
  }, [selectedPeriod, setDrawerPeriod])

  const fetchProject = useCallback(() => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    getProjectDetail(projectId, selectedPeriod)
      .then(setProject)
      .catch((err) => {
        console.error("Failed to load project:", err)
        setError("Project not found")
      })
      .finally(() => setLoading(false))
  }, [projectId, selectedPeriod])

  useEffect(() => {
    queueMicrotask(() => {
      fetchProject()
    })
  }, [fetchProject])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate("/projects")}
          className="cursor-pointer inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group mb-4"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="group-hover:underline">Back to Projects</span>
        </button>
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          {error || "Project not found"}
        </div>
      </div>
    )
  }

  const startDate = project.start_date ? new Date(project.start_date) : null
  const endDate = project.end_date ? new Date(project.end_date) : null
  const durationDays =
    startDate && endDate
      ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      : null

  return (
    <div className="space-y-6 p-6">
      {/* Back button */}
      <button
        onClick={() => navigate("/projects")}
        className="cursor-pointer inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        <span className="group-hover:underline">Back to Projects</span>
      </button>

      {/* Project Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold">{project.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Client: {project.client_name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs ${
                  project.project_type === "client"
                    ? "border-blue-300 text-blue-700 bg-blue-50"
                    : "border-gray-300 text-gray-600 bg-gray-50"
                }`}
              >
                {project.project_type}
              </Badge>
              <StatusBadge status={project.status} />
            </div>
          </div>

          {project.description && (
            <p className="mt-4 text-sm text-muted-foreground border-t pt-4">
              {project.description}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Period Selector + Stats */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Monthly Progress</p>
        <PeriodSelector value={selectedPeriod} onChange={setSelectedPeriod} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-blue-50">
                <CalendarDays className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Planned Days</p>
                <p className="text-xl font-semibold tabular-nums">
                  {project.planned_days > 0 ? project.planned_days : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-green-50">
                <Briefcase className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Worked Days</p>
                <p className="text-xl font-semibold tabular-nums">
                  {project.worked_days > 0 ? project.worked_days : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-purple-50">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-sm font-medium">
                  {durationDays != null ? `${durationDays} days` : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-amber-50">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Team Size</p>
                <p className="text-xl font-semibold tabular-nums">
                  {project.member_count}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Health Score */}
      {project.health_score != null && (
        <HealthScoreCard score={project.health_score} breakdown={project.health_breakdown} />
      )}

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">
              {project.planned_days > 0 ? "Allocation Progress" : "Timeline Progress"}
            </p>
            <span className={`text-sm font-medium tabular-nums ${
              project.progress_percent >= 80
                ? "text-green-700"
                : project.progress_percent >= 40
                  ? "text-amber-700"
                  : "text-red-700"
            }`}>
              {project.progress_percent.toFixed(1)}%
            </span>
          </div>
          <Progress
            value={project.progress_percent}
            className={`h-3 ${
              project.progress_percent >= 80
                ? "[&>div]:bg-green-500"
                : project.progress_percent >= 40
                  ? "[&>div]:bg-amber-500"
                  : "[&>div]:bg-red-500"
            }`}
          />
          {project.planned_days > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              {project.worked_days} / {project.planned_days} days worked
            </p>
          ) : startDate && endDate ? (
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{startDate.toLocaleDateString()}</span>
              <span>{endDate.toLocaleDateString()}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">
              Team Members ({project.member_count})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {project.members.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              No team members assigned to this project
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 px-3 font-medium">Name</th>
                    <th className="py-2 px-3 font-medium border-l border-border">Line Manager</th>
                    <th className="py-2 px-3 font-medium border-l border-border">Designation</th>
                    <th className="py-2 px-3 font-medium border-l border-border">Department</th>
                    <th className="py-2 px-3 font-medium border-l border-border">Role</th>
                    <th className="py-2 px-3 font-medium text-right border-l border-border">Alloc %</th>
                    <th className="py-2 px-3 font-medium text-right border-l border-border">Planned</th>
                    <th className="py-2 px-3 font-medium text-right border-l border-border">Worked</th>
                  </tr>
                </thead>
                <tbody>
                  {project.members.map((member) => (
                    <tr
                      key={member.employee_id}
                      onClick={() => selectEmployee(member.employee_id)}
                      className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-foreground group-hover:underline">
                          {member.employee_name}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground border-l border-border">
                        {member.line_manager || "No Manager"}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground border-l border-border">
                        {member.designation}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground border-l border-border">
                        {member.department}
                      </td>
                      <td className="py-2.5 px-3 border-l border-border">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {member.role_in_project}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right border-l border-border">
                        {member.allocation_percentage != null ? (
                          <span className={`text-xs font-medium tabular-nums ${
                            member.allocation_percentage >= 80
                              ? "text-green-700"
                              : member.allocation_percentage >= 40
                                ? "text-amber-700"
                                : "text-red-700"
                          }`}>
                            {member.allocation_percentage}%
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground border-l border-border">
                        {member.allocated_days != null ? member.allocated_days : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums border-l border-border">
                        {member.worked_days != null ? (
                          <span className={
                            member.allocated_days != null && member.worked_days > member.allocated_days
                              ? "text-red-700 font-medium"
                              : "text-muted-foreground"
                          }>
                            {member.worked_days}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
