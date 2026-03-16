import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { useAuthStore } from "@/store/authStore"
import type { TimesheetEntryCreate } from "@/types/timesheet"

interface ProjectOption {
  id: string
  name: string
}

interface EmployeeOption {
  id: string
  name: string
}

interface TimesheetEntryFormProps {
  onSubmit: (data: TimesheetEntryCreate) => void
  onCancel?: () => void
  projects: ProjectOption[]
  employees: EmployeeOption[]
  initialData?: Partial<TimesheetEntryCreate>
}

export function TimesheetEntryForm({
  onSubmit,
  onCancel,
  projects,
  employees,
  initialData,
}: TimesheetEntryFormProps) {
  const user = useAuthStore((s) => s.user)

  const [employeeId, setEmployeeId] = useState(
    initialData?.employee_id || user?.employee_id || "",
  )
  const [projectId, setProjectId] = useState(initialData?.project_id || "")
  const [date, setDate] = useState(initialData?.date || "")
  const [hours, setHours] = useState<number>(initialData?.hours || 8)
  const [billable, setBillable] = useState(initialData?.is_billable ?? true)
  const [description, setDescription] = useState(initialData?.description || "")

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({
      employee_id: employeeId,
      project_id: projectId,
      date,
      hours,
      is_billable: billable,
      description,
    })
  }

  const inputClass =
    "w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Employee Select */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none">
            Employee
          </label>
          <Select
            options={[
              { value: "", label: "Select employee..." },
              ...employees.map((emp) => ({ value: emp.id, label: emp.name })),
            ]}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            searchable
            maxRows={8}
          />
        </div>

        {/* Project Select */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none">
            Project
          </label>
          <Select
            options={[
              { value: "", label: "Select project..." },
              ...projects.map((proj) => ({ value: proj.id, label: proj.name })),
            ]}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            searchable
            maxRows={8}
          />
        </div>

        {/* Date Input */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none" htmlFor="ts-date">
            Date
          </label>
          <input
            id="ts-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
            required
          />
        </div>

        {/* Hours Input */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none" htmlFor="ts-hours">
            Hours
          </label>
          <input
            id="ts-hours"
            type="number"
            value={hours}
            onChange={(e) => setHours(parseFloat(e.target.value))}
            min={0.5}
            max={24}
            step={0.5}
            className={inputClass}
            required
          />
        </div>
      </div>

      {/* Billable Checkbox */}
      <div className="flex items-center gap-2">
        <input
          id="ts-billable"
          type="checkbox"
          checked={billable}
          onChange={(e) => setBillable(e.target.checked)}
          className="cursor-pointer h-4 w-4 rounded border-gray-300 text-foreground focus:ring-primary"
        />
        <label className="text-sm font-medium leading-none" htmlFor="ts-billable">
          Billable
        </label>
      </div>

      {/* Description Textarea */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium leading-none" htmlFor="ts-description">
          Description
        </label>
        <textarea
          id="ts-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What did you work on?"
          className={inputClass}
        />
      </div>

      {/* Form Actions */}
      <div className="flex items-center gap-2 pt-2">
        <Button type="submit">Save Entry</Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
