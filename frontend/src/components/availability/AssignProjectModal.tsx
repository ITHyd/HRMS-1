import { useEffect, useState } from "react"
import { X, Search, Plus, Building2, Briefcase } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { listProjects, assignToProject } from "@/api/projects"
import type { ProjectBrief } from "@/types/project"

interface AssignProjectModalProps {
  selectedEmployees: Array<{ id: string; name: string }>
  onClose: () => void
  onSuccess: () => void
}

export function AssignProjectModal({
  selectedEmployees,
  onClose,
  onSuccess,
}: AssignProjectModalProps) {
  const [tab, setTab] = useState<"existing" | "new">("existing")
  const [projects, setProjects] = useState<ProjectBrief[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [role, setRole] = useState("contributor")
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // New project form
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState("client")
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [newEndDate, setNewEndDate] = useState("")
  const [newDescription, setNewDescription] = useState("")

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async (q?: string) => {
    setLoading(true)
    try {
      const data = await listProjects({ search: q, status: "ACTIVE" })
      setProjects(data.projects)
    } catch {
      console.error("Failed to load projects")
    }
    setLoading(false)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadProjects(search)
  }

  const handleAssign = async () => {
    setError(null)
    setSuccessMsg(null)
    setSubmitting(true)

    try {
      if (tab === "existing" && selectedProjectId) {
        const res = await assignToProject({
          employee_ids: selectedEmployees.map((e) => e.id),
          project_id: selectedProjectId,
          role_in_project: role,
        })
        setSuccessMsg(
          `Assigned ${res.assigned} employee(s) to "${res.project_name}"${res.skipped_duplicate > 0 ? ` (${res.skipped_duplicate} already assigned)` : ""}`
        )
      } else if (tab === "new" && newName.trim()) {
        const res = await assignToProject({
          employee_ids: selectedEmployees.map((e) => e.id),
          new_project: {
            name: newName.trim(),
            project_type: newType,
            department_id: "",
            start_date: new Date(newStartDate).toISOString(),
            end_date: newEndDate ? new Date(newEndDate).toISOString() : undefined,
            description: newDescription || undefined,
          },
          role_in_project: role,
        })
        setSuccessMsg(
          `Created project "${res.project_name}" and assigned ${res.assigned} employee(s)`
        )
      }
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1500)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to assign"
      setError(msg)
    }
    setSubmitting(false)
  }

  const canSubmit =
    tab === "existing" ? !!selectedProjectId : newName.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">Assign to Project</h2>
          <button onClick={onClose} className="cursor-pointer p-1 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Selected employees */}
        <div className="px-4 py-2 border-b bg-muted/30">
          <p className="text-xs text-muted-foreground mb-1">
            {selectedEmployees.length} employee(s) selected
          </p>
          <div className="flex flex-wrap gap-1">
            {selectedEmployees.slice(0, 8).map((emp) => (
              <Badge key={emp.id} variant="secondary" className="text-xs">
                {emp.name}
              </Badge>
            ))}
            {selectedEmployees.length > 8 && (
              <Badge variant="outline" className="text-xs">
                +{selectedEmployees.length - 8} more
              </Badge>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-4">
          <button
            onClick={() => setTab("existing")}
            className={`cursor-pointer px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "existing"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="inline h-3.5 w-3.5 mr-1" />
            Existing Project
          </button>
          <button
            onClick={() => setTab("new")}
            className={`cursor-pointer px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "new"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Plus className="inline h-3.5 w-3.5 mr-1" />
            New Project
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-4 py-3">
          {tab === "existing" ? (
            <div className="space-y-3">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </form>
              <div className="space-y-1 max-h-[250px] overflow-auto">
                {loading ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
                ) : projects.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">No active projects found</div>
                ) : (
                  projects.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() => setSelectedProjectId(proj.id)}
                      className={`cursor-pointer flex w-full items-center gap-3 rounded-lg border p-2.5 text-left text-sm transition-colors ${
                        selectedProjectId === proj.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{proj.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {proj.client_name} · {proj.member_count} members
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${proj.project_type === "client" ? "border-blue-300 text-blue-700 bg-blue-50" : "border-gray-300 text-gray-600 bg-gray-50"}`}
                      >
                        {proj.project_type}
                      </Badge>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Project Name *</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Client Portal Redesign"
                  className="h-8 text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Type</label>
                <div className="flex gap-2 mt-1">
                  {["client", "internal"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setNewType(t)}
                      className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        newType === t
                          ? t === "client"
                            ? "border-blue-400 bg-blue-50 text-blue-700"
                            : "border-gray-400 bg-gray-50 text-gray-700"
                          : "hover:bg-muted"
                      }`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Start Date *</label>
                  <Input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">End Date</label>
                  <Input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="h-8 text-sm mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <Input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Brief description..."
                  className="h-8 text-sm mt-1"
                />
              </div>
            </div>
          )}

          {/* Role Selector */}
          <div className="mt-4">
            <label className="text-xs font-medium text-muted-foreground">Role in Project</label>
            <div className="flex gap-2 mt-1">
              {["contributor", "lead", "reviewer"].map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    role === r
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3 flex items-center justify-between">
          <div className="text-xs">
            {error && <span className="text-destructive">{error}</span>}
            {successMsg && <span className="text-green-600">{successMsg}</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAssign}
              disabled={!canSubmit || submitting}
            >
              {submitting ? "Assigning..." : "Assign"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
