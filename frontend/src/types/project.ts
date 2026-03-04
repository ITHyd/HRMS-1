export interface ProjectBrief {
  id: string
  name: string
  status: string
  project_type: string
  department_name: string
  description?: string
  member_count: number
  start_date: string | null
  end_date: string | null
  progress_percent: number
  planned_days: number
  worked_days: number
}

export interface ProjectListResponse {
  projects: ProjectBrief[]
  total: number
  active_count: number
  completed_count: number
  on_hold_count: number
}

export interface ProjectDetail {
  id: string
  name: string
  status: string
  project_type: string
  description?: string
  department_name: string
  start_date: string | null
  end_date: string | null
  planned_days: number
  worked_days: number
  progress_percent: number
  member_count: number
  members: Array<{
    employee_id: string
    employee_name: string
    designation: string
    department: string
    location: string
    location_code: string
    role_in_project: string
    assigned_at: string | null
    allocation_percentage: number | null
    allocated_days: number | null
    worked_days: number | null
  }>
}

export interface AssignToProjectRequest {
  employee_ids: string[]
  project_id?: string
  new_project?: {
    name: string
    project_type: string
    description?: string
    department_id: string
    start_date: string
    end_date?: string
  }
  role_in_project: string
}

export interface AssignmentResponse {
  project_id: string
  project_name: string
  assigned: number
  skipped_duplicate: number
}
