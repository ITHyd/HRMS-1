export interface ExecutiveDashboard {
  period: string
  total_active_employees: number
  billable_count: number
  non_billable_count: number
  bench_count: number
  overall_utilisation_percent: number
  overall_billable_percent: number
  top_consuming_projects: Array<{
    project_id: string
    project_name: string
    total_hours: number
    member_count: number
  }>
  resource_availability: {
    available: number
    fully_allocated: number
    over_allocated: number
  }
  classification_breakdown: Array<{
    classification: string
    count: number
    percent: number
  }>
  trend: Array<{
    period: string
    utilisation_percent: number
    billable_percent: number
    headcount: number
  }>
}

export interface ResourceDashboardEntry {
  employee_id: string
  employee_name: string
  designation: string
  department: string
  projects: Array<{
    project_id: string
    project_name: string
    hours: number
  }>
  total_hours: number
  billable_hours: number
  utilisation_percent: number
  billable_percent: number
  classification: string
  availability: string
}

export interface ResourceDashboardResponse {
  period: string
  entries: ResourceDashboardEntry[]
  total: number
}

export interface ProjectDashboardEntry {
  project_id: string
  project_name: string
  status: string
  department: string
  total_hours_consumed: number
  billable_hours: number
  billable_percent: number
  member_count: number
  members: Array<{
    employee_id: string
    employee_name: string
    hours: number
  }>
  health: string
  over_utilised_members: string[]
  resource_variance: number
}

export interface ProjectDashboardResponse {
  period: string
  projects: ProjectDashboardEntry[]
  total: number
}
