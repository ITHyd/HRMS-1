export interface ClientCount {
  client: string
  count: number
}

export interface LevelCount {
  level: string
  count: number
}

export interface MonthlyTrend {
  month: string
  new_hires: number
  cumulative: number
}

export interface SpanOfControl {
  manager_id: string
  manager_name: string
  designation: string
  direct_report_count: number
  is_outlier: boolean
}

export interface CrossReport {
  employee_id: string
  employee_name: string
  employee_designation: string
  external_manager_id: string
  external_manager_name: string
  external_manager_location: string
  relationship_type: string
}

export interface ProjectSummary {
  id: string
  name: string
  status: string
  member_count: number
  client_name: string
}

export interface BranchAnalytics {
  period?: string | null
  data_source?: "hrms" | "excel"
  total_headcount: number
  active_count: number
  client_breakdown: ClientCount[]
  level_breakdown: LevelCount[]
  monthly_trend: MonthlyTrend[]
  span_of_control: SpanOfControl[]
  hierarchy_depth: number
  departments_without_manager: string[]
  cross_reports: CrossReport[]
  projects: ProjectSummary[]
  orphaned_projects: ProjectSummary[]
}
