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

export interface TimesheetListResponse {
  entries: TimesheetEntry[]
  total: number
  period: string
  is_locked: boolean
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
  total_records: number
  imported_count: number
  duplicate_count: number
  error_count: number
  errors: Array<{ employee_id: string; error: string }>
  started_at: string
  completed_at?: string
}

export interface HrmsSyncLogsResponse {
  logs: HrmsSyncLog[]
  total: number
}
