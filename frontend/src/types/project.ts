export interface ProjectBrief {
  id: string
  name: string
  status: string
  project_type: string
  department: string
  member_count: number
  start_date: string
  end_date?: string
  progress_percent: number
}

export interface ProjectDetail {
  id: string
  name: string
  status: string
  project_type: string
  description?: string
  department: string
  start_date: string
  end_date?: string
  progress_percent: number
  members: Array<{
    employee_id: string
    employee_name: string
    designation: string
    role_in_project: string
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
