import { useState } from "react"
import { X, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SkillBadge } from "@/components/availability/SkillBadge"
import { addEmployeeSkill, removeEmployeeSkill } from "@/api/availability"
import type { SkillTag } from "@/types/availability"

interface SkillTagManagerProps {
  employeeId: string
  employeeName: string
  skills: SkillTag[]
  onUpdate: () => void
  onClose: () => void
}

const PROFICIENCY_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "expert", label: "Expert" },
]

export function SkillTagManager({
  employeeId,
  employeeName,
  skills,
  onUpdate,
  onClose,
}: SkillTagManagerProps) {
  const [skillName, setSkillName] = useState("")
  const [proficiency, setProficiency] = useState("intermediate")
  const [notes, setNotes] = useState("")
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!skillName.trim()) return

    setAdding(true)
    setError(null)
    try {
      await addEmployeeSkill(employeeId, {
        skill_name: skillName.trim(),
        proficiency,
        notes: notes.trim() || undefined,
      })
      setSkillName("")
      setNotes("")
      setProficiency("intermediate")
      onUpdate()
    } catch (err) {
      console.error("Failed to add skill:", err)
      setError("Failed to add skill. Please try again.")
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveSkill = async (skill: SkillTag) => {
    setRemoving(skill.skill_name)
    setError(null)
    try {
      await removeEmployeeSkill(employeeId, skill.skill_name)
      onUpdate()
    } catch (err) {
      console.error("Failed to remove skill:", err)
      setError("Failed to remove skill. Please try again.")
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-lg mx-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Manage Skills &mdash; {employeeName}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current skills */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Current Skills
            </label>
            {skills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skills assigned yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <SkillBadge
                    key={skill.id}
                    name={skill.skill_name}
                    proficiency={skill.proficiency}
                    onRemove={
                      removing === skill.skill_name
                        ? undefined
                        : () => handleRemoveSkill(skill)
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          {/* Add skill form */}
          <form onSubmit={handleAddSkill} className="space-y-3">
            <label className="text-xs font-medium text-muted-foreground block">
              Add Skill
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Skill name..."
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                className="h-8 text-sm flex-1"
                required
              />
              <Select
                options={PROFICIENCY_OPTIONS}
                value={proficiency}
                onChange={(e) => setProficiency(e.target.value)}
                className="h-8 text-sm w-[140px]"
              />
            </div>
            <Input
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
              >
                Close
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={adding || !skillName.trim()}
              >
                {adding ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 h-4 w-4" />
                )}
                Add Skill
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
