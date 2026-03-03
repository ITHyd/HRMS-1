import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { useOrgChartStore } from "@/store/orgChartStore"
import { getProjectDetail } from "@/api/projects"
import { ArrowLeft, Calendar, Users, Clock } from "lucide-react"
import type { ProjectDetail } from "@/types/project"

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const selectEmployee = useOrgChartStore((s) => s.selectEmployee)
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    getProjectDetail(projectId)
      .then(setProject)
      .catch((err) => {
        console.error("Failed to load project:", err)
        setError("Project not found")
      })
      .finally(() => setLoading(false))
  }, [projectId])

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
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
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
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </button>

      {/* Project Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold">{project.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {project.department_name}
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

      {/* Timeline & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-blue-50">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Start Date</p>
                <p className="text-sm font-medium">
                  {startDate ? startDate.toLocaleDateString() : "Not set"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-red-50">
                <Calendar className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">End Date</p>
                <p className="text-sm font-medium">
                  {endDate ? endDate.toLocaleDateString() : "Not set"}
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
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Timeline Progress</p>
            <span className="text-sm font-medium tabular-nums">
              {project.progress_percent.toFixed(1)}%
            </span>
          </div>
          <Progress value={project.progress_percent} className="h-3" />
          {startDate && endDate && (
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{startDate.toLocaleDateString()}</span>
              <span>{endDate.toLocaleDateString()}</span>
            </div>
          )}
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
                    <th className="py-2 px-3 font-medium border-l border-border">Designation</th>
                    <th className="py-2 px-3 font-medium border-l border-border">Department</th>
                    <th className="py-2 px-3 font-medium border-l border-border">Location</th>
                    <th className="py-2 px-3 font-medium border-l border-border">Role</th>
                    <th className="py-2 px-3 font-medium border-l border-border">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {project.members.map((member) => (
                    <tr
                      key={member.employee_id}
                      className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => selectEmployee(member.employee_id)}
                          className="font-medium text-primary hover:underline text-left"
                        >
                          {member.employee_name}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground border-l border-border">
                        {member.designation}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground border-l border-border">
                        {member.department}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground border-l border-border">
                        {member.location}
                      </td>
                      <td className="py-2.5 px-3 border-l border-border">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {member.role_in_project}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap border-l border-border">
                        {member.assigned_at
                          ? new Date(member.assigned_at).toLocaleDateString()
                          : "-"}
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
