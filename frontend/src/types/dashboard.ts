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
  project_type: string
  client_name: string
  start_date?: string
  end_date?: string
  progress_percent: number
  total_hours_consumed: number
  billable_hours: number
  billable_percent: number
  member_count: number
  members: Array<{
    employee_id: string
    employee_name: string
    role: string
    hours: number
    billable_hours: number
  }>
  over_utilised_members: string[]
  resource_variance: number
}

export interface ProjectDashboardResponse {
  period: string
  projects: ProjectDashboardEntry[]
  total: number
}

export interface AllocationEntry {
  employee_id: string
  employee_name: string
  project_id: string
  project_name: string
  client_name: string | null
  allocation_percentage: number
  allocated_days: number
  total_working_days: number
  total_allocated_days: number
  available_days: number
}

export interface AllocationDashboardResponse {
  period: string
  allocations: AllocationEntry[]
  total: number
}

export interface ResourceAllocationEntry {
  employee_id: string
  employee_name: string
  line_manager: string
  project_name: string | null
  client_name: string | null
  allocation_percentage: number
  billable_hours: number
  non_billable_hours: number
  classification: string
  available_days: number
}

export interface ResourceAllocationResponse {
  period: string
  entries: ResourceAllocationEntry[]
  total: number
}
