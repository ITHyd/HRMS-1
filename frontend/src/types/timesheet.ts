export interface TimesheetEntry {
  id: string
  employee_id: string
  employee_name: string
  project_id: string
  project_name: string
  date: string
  hours: number
  is_billable: boolean
  description?: string
  status: "draft" | "submitted" | "approved" | "rejected"
  source: "manual" | "hrms_sync"
  period: string
  created_at: string
  updated_at: string
}

export interface TimesheetSummary {
  total_hours: number
  billable_hours: number
  billable_percent: number
  employee_count: number
  project_count: number
  billable_employee_count: number
  non_billable_employee_count: number
}

export interface TimesheetFilterOptions {
  employees: Array<{ id: string; name: string }>
  projects: Array<{ id: string; name: string }>
}

export interface TimesheetListResponse {
  entries: TimesheetEntry[]
  total: number
  period: string
  is_locked: boolean
  latest_period?: string
  summary: TimesheetSummary
  filter_options: TimesheetFilterOptions
}

export interface TimesheetEntryCreate {
  employee_id: string
  project_id: string
  date: string
  hours: number
  is_billable: boolean
  description?: string
}

export interface TimesheetEntryUpdate {
  hours?: number
  is_billable?: boolean
  description?: string
  project_id?: string
}

export interface TimesheetEditHistory {
  id: string
  field_changed: string
  old_value?: string
  new_value?: string
  changed_by_name: string
  changed_at: string
}

export interface HrmsSyncLog {
  batch_id: string
  period: string
  status: "running" | "completed" | "failed"
  mode?: "demo" | "live"
  total_records: number
  imported_count: number
  duplicate_count: number
  error_count: number
  errors: Array<{ employee_id?: string; key?: string; error?: string; message?: string; entity?: string }>
  entity_counts?: Record<string, Record<string, number>>
  cursor?: Record<string, unknown>
  started_at: string
  completed_at?: string
}

export interface HrmsSyncLogsResponse {
  logs: HrmsSyncLog[]
  total: number
}

export interface HeatmapDateMeta {
  date: string
  day: number
  weekday: string
  is_weekend: boolean
  is_holiday: boolean
  holiday_name?: string | null
}

export interface HeatmapDayCell {
  hours: number
  billable_hours: number
  projects: Record<string, number>
}

export interface HeatmapEmployeeRow {
  employee_id: string
  employee_name: string
  total_hours: number
  billable_hours: number
  days: Record<string, HeatmapDayCell | null>
}

export interface WorkloadHeatmapResponse {
  period: string
  dates: HeatmapDateMeta[]
  employees: HeatmapEmployeeRow[]
  summary: {
    total_employees: number
    total_hours: number
    billable_hours: number
    billable_employee_count: number
    non_billable_employee_count: number
  }
}
