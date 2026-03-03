export interface EmployeeBrief {
  id: string
  name: string
  designation: string
  department: string
  department_id: string
  level: string
  location_id: string
  location_code: string
  location_city: string
  photo_url?: string
  is_active: boolean
}

export interface ManagerInfo {
  id: string
  name: string
  designation: string
  location_code: string
  relationship_type: string
}

export interface ProjectInfo {
  id: string
  name: string
  status: string
  project_type?: string
  role_in_project: string
  start_date: string
  end_date?: string
  progress_percent: number
}

export interface SkillInfo {
  skill_name: string
  proficiency: string
  notes?: string
}

export interface UtilisationInfo {
  period: string
  utilisation_percent: number
  billable_percent: number
  total_hours: number
  billable_hours: number
  non_billable_hours: number
  capacity_hours: number
  classification: string
}

export interface TimesheetSummary {
  period: string
  total_hours: number
  billable_hours: number
  entry_count: number
}

export interface EmployeeMasterEntry {
  id: string
  name: string
  email: string
  designation: string
  department: string
  level: string
  location: string
  join_date: string | null
  is_active: boolean
}

export interface EmployeeDetail {
  id: string
  name: string
  email?: string
  designation: string
  department: string
  department_id: string
  level: string
  location_id: string
  location_code: string
  location_city: string
  photo_url?: string
  is_active: boolean
  join_date?: string
  tenure_months?: number
  managers: ManagerInfo[]
  reporting_chain: EmployeeBrief[]
  direct_reports: EmployeeBrief[]
  projects: ProjectInfo[]
  skills?: SkillInfo[]
  utilisation?: UtilisationInfo
  timesheet_summary?: TimesheetSummary
  is_own_branch: boolean
}
