export interface HealthBreakdown {
  allocation: number
  billable: number
  timeline: number
  team: number
}

export interface ProjectBrief {
  id: string
  name: string
  status: string
  project_type: string
  client_name: string
  description?: string
  member_count: number
  start_date: string | null
  end_date: string | null
  progress_percent: number
  planned_days: number
  worked_days: number
  health_score: number
  health_breakdown: HealthBreakdown
}

export interface EmployeeTimelineEntry {
  period: string
  status: "allocated" | "bench" | "fully_billed" | "partially_billed"
  projects: Array<{
    project_id: string
    project_name: string
    client_name: string | null
    allocated_days: number
    allocation_percentage: number
    role: string
  }>
}

export interface EmployeeTimeline {
  employee_id: string
  from_period: string
  to_period: string
  timeline: EmployeeTimelineEntry[]
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
  client_name: string
  description?: string
  start_date: string | null
  end_date: string | null
  planned_days: number
  worked_days: number
  progress_percent: number
  health_score: number
  health_breakdown: HealthBreakdown
  member_count: number
  members: Array<{
    employee_id: string
    employee_name: string
    line_manager: string
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

export interface TimelineProject {
  project_id: string
  name: string
  status: string
  project_type: string
  client_name: string
  start_date: string | null
  end_date: string | null
  days_until_end: number | null
  urgency: "overdue" | "critical" | "warning" | "upcoming" | "future" | "no_date"
  member_count: number
  members: Array<{
    employee_id: string
    employee_name: string
    designation: string
    role_in_project: string
  }>
}

export interface FreeingUpEmployee {
  employee_id: string
  employee_name: string
  designation: string
  role_in_project: string
  projects_ending: string[]
}

export interface ClientOpportunity {
  client_name: string
  projects: Array<{
    project_id: string
    name: string
    end_date: string | null
    urgency: string
    member_count: number
  }>
  earliest_end_date: string | null
  total_freeing_employees: number
}

export interface ProjectTimelineResponse {
  projects: TimelineProject[]
  freeing_up_by_month: Record<string, FreeingUpEmployee[]>
  client_opportunities: ClientOpportunity[]
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
